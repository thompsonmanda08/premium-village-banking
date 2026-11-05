-- Two integrity fixes to the rule votes and the monthly report that reads them.
--  1. A published month must not move: only votes recorded (created_at) by the close count, whatever date was typed in.
--  2. Only the app's own rules can be voted on. The list mirrors RULE_CATALOG in src/features/rules/ruleCatalog.ts;
--     ruleCatalog.test.ts fails if the two drift.

create or replace function private.rule_keys() returns text[]
language sql immutable set search_path = pg_temp as $$
  select array['saving_minimum', 'loan_interest', 'loan_terms', 'loan_cap', 'no_loans_last_month', 'excess_charge',
               'minimum_payable', 'payment_order', 'penalty_basis', 'membership_fee', 'deadlines_and_extensions',
               'default_handling', 'payout_and_pots'];
$$;
revoke all on function private.rule_keys() from public, anon, authenticated;

create or replace function public.record_ratification(
  p_cycle uuid, p_rule_key text, p_decided_on date, p_votes_for int, p_votes_total int,
  p_meeting_ref text default null, p_note text default null)
returns public.rule_ratifications
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_c cycles; v rule_ratifications; v_passed boolean;
begin
  select * into v_c from cycles where id = p_cycle;
  if not found or not is_admin(v_c.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_rule_key is null or p_rule_key !~ '^[a-z][a-z_]{2,39}$' or p_rule_key <> all (private.rule_keys()) then
    raise exception 'invalid_rule' using errcode = 'P0001';
  end if;
  if p_decided_on is null or p_votes_for is null or p_votes_total is null
     or p_votes_total < 1 or p_votes_for < 0 or p_votes_for > p_votes_total
     or p_decided_on > (now() at time zone 'Africa/Lusaka')::date then
    raise exception 'invalid_vote' using errcode = 'P0001';
  end if;
  if length(p_note) > 500 or length(p_meeting_ref) > 500 then raise exception 'invalid_note' using errcode = 'P0001'; end if;

  -- Two thirds of the votes cast carry a rule.
  v_passed := p_votes_for * 3 >= p_votes_total * 2;
  insert into rule_ratifications (group_id, cycle_id, rule_key, decided_on, votes_for, votes_total, passed, meeting_ref, note, recorded_by)
  values (v_c.group_id, p_cycle, p_rule_key, p_decided_on, p_votes_for, p_votes_total, v_passed, p_meeting_ref, p_note, auth.uid())
  returning * into v;
  perform private.audit(v_c.group_id, 'rule.ratified', 'rule_ratifications', v.id,
    jsonb_build_object('rule_key', p_rule_key, 'votes_for', p_votes_for, 'votes_total', p_votes_total,
                       'passed', v_passed, 'decided_on', p_decided_on));
  return v;
end $$;

-- month_report as in 20261105000200, except the 'rules' term (see the comment there).
create or replace function public.month_report(p_period uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_p periods;
  v_names boolean;
begin
  select * into v_p from periods where id = p_period;
  if not found or not is_member(v_p.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if v_p.status <> 'closed' then raise exception 'period_not_closed' using errcode = 'P0001'; end if;
  -- The named arrears list is the group's whole list: open figures or an admin only (no own-row exception).
  v_names := is_admin(v_p.group_id)
             or exists (select 1 from groups g where g.id = v_p.group_id and g.figures_visibility = 'open');

  return jsonb_build_object(
    'period', jsonb_build_object('id', v_p.id, 'label', v_p.label, 'month_index', v_p.month_index, 'closed_at', v_p.closed_at),
    'group', (select to_jsonb(g) from group_statements g where g.period_id = p_period),
    -- sent_*: loans sent in this month. members_owing and total_owed: what was owed at this month's close
    -- (its statements and group statement), so a published month never changes.
    'loans', jsonb_build_object(
                'sent_count', (select count(*) from loans l where l.period_id = p_period),
                'sent_principal', (select coalesce(sum(l.principal), 0) from loans l where l.period_id = p_period),
                'members_owing', (select count(*) from statements s where s.period_id = p_period and s.closing_owed > 0),
                'total_owed', (select g.total_owed from group_statements g where g.period_id = p_period)),
    -- Arrears: last month's minimum not paid by this close.
    'arrears', (select jsonb_build_object(
                  'count', count(*),
                  'total', coalesce(sum(s.unpaid_minimum), 0),
                  'members', case when v_names then coalesce(jsonb_agg(jsonb_build_object(
                               'member_id', s.member_id, 'name', m.short_name, 'unpaid', s.unpaid_minimum) order by m.short_name), '[]') end)
                from statements s join members m on m.id = s.member_id
                where s.period_id = p_period and s.unpaid_minimum > 0),
    'overrides', month_overrides(p_period),
    'overrides_recorded', not private.period_imported(p_period),
    -- Of this cycle's votes on the app's rules, a rule counts when its latest (by created_at) passed. A vote counts only if
    -- it was decided by the close date and also recorded by the close, so a backdated vote entered later cannot change a published month.
    'rules', jsonb_build_object('ratified_by_close', (
               select count(*)::int from (
                 select distinct on (r.rule_key) r.passed
                 from rule_ratifications r
                 where r.cycle_id = v_p.cycle_id
                   and r.rule_key = any (private.rule_keys())
                   and r.decided_on <= (v_p.closed_at at time zone 'Africa/Lusaka')::date
                   and r.created_at <= v_p.closed_at
                 order by r.rule_key, r.created_at desc, r.id desc) x
               where x.passed)));
end $$;

revoke execute on function public.month_report(uuid) from public, anon;
grant execute on function public.month_report(uuid) to authenticated;
