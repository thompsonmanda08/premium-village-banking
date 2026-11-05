-- The monthly report every member of the group can read (spec §5, §11), and the log of overrides it includes.
-- Both only read. Names and per-member rows follow can_see_figures: open figures, an admin, or the caller's own row.

-- A month the 2026 import wrote (spec §11.4): decided by its data, not by a date.
create or replace function private.period_imported(p_period uuid) returns boolean
language sql stable set search_path = public, pg_temp as $$
  select exists (select 1 from public.statements where period_id = p_period and source = 'import')
      or exists (select 1 from public.entries where period_id = p_period and source = 'import');
$$;
revoke all on function private.period_imported(uuid) from public, anon, authenticated;

create or replace function public.month_overrides(p_period uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_p periods;
  v_from timestamptz;
  v_to timestamptz;
begin
  select * into v_p from periods where id = p_period;
  if not found or not is_member(v_p.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if v_p.status <> 'closed' then raise exception 'period_not_closed' using errcode = 'P0001'; end if;
  -- The import recorded no overrides, so an imported month has none to show (the report says "not recorded").
  if private.period_imported(p_period) then return '[]'::jsonb; end if;

  -- Audit rows belong to the month whose dates (Lusaka time) contain them.
  v_from := v_p.starts_on::timestamp at time zone 'Africa/Lusaka';
  v_to := (v_p.starts_on + interval '1 month') at time zone 'Africa/Lusaka';

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'at', o.at, 'kind', o.kind,
             'member_id', case when can_see_figures(v_p.group_id, o.member_id) then o.member_id end,
             'member', case when can_see_figures(v_p.group_id, o.member_id) then m.short_name end,
             'amount', o.amount, 'reason', o.reason) order by o.at, o.kind)
    from (
      -- Corrections and waivers belong to the month they were posted in, whichever month's entry they correct.
      -- A correction's amount is the change: negative when it lowers the original.
      select e.created_at as at,
             case when e.kind <> 'waiver' then 'correction' when r.kind = 'penalty' then 'penalty_waived' else 'waiver' end as kind,
             e.member_id,
             case when e.kind = 'adjustment' then -e.amount else e.amount end as amount,
             e.reason
      from entries e join entries r on r.id = e.corrects_entry_id
      where e.period_id = p_period and e.source = 'correction'
      union all
      select e.created_at, 'penalty_applied', e.member_id, e.amount, e.reason
      from entries e where e.period_id = p_period and e.kind = 'penalty' and e.source = 'app'
      union all
      select l.sent_at, 'loan_over_cap', l.member_id, l.principal, l.approved_reason
      from loans l where l.period_id = p_period and l.cap_warning is not null
      union all
      select a.created_at, case when (a.data ->> 'defaulted')::boolean then 'default_set' else 'default_cleared' end,
             a.entity_id, null::numeric, a.data ->> 'reason'
      from audit_log a
      where a.group_id = v_p.group_id and a.action = 'member.default_changed' and a.data ->> 'cycle_id' = v_p.cycle_id::text
        and a.created_at >= v_from and a.created_at < v_to
      union all
      -- Only a later deadline is an extension; moving it earlier gives nobody extra time.
      select a.created_at, 'deadline_extended', null::uuid, null::numeric, a.data ->> 'reason'
      from audit_log a join periods d on d.id = a.entity_id and d.cycle_id = v_p.cycle_id
      where a.group_id = v_p.group_id and a.action = 'period.deadline_changed'
        and (a.data ->> 'to')::date > (a.data ->> 'from')::date
        and a.created_at >= v_from and a.created_at < v_to
    ) o
    left join members m on m.id = o.member_id), '[]'::jsonb);
end $$;

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
    -- sent_*: loans sent in this month. open_*: loans of this cycle whose status is 'open' when the report is read
    -- (not as of this month's close), counted at the principal lent, not what is left to repay.
    'loans', (select jsonb_build_object(
                'sent_count', count(*) filter (where l.period_id = p_period),
                'sent_principal', coalesce(sum(l.principal) filter (where l.period_id = p_period), 0),
                'open_count', count(*) filter (where l.status = 'open'),
                'open_principal', coalesce(sum(l.principal) filter (where l.status = 'open'), 0))
              from loans l join periods lp on lp.id = l.period_id
              where lp.cycle_id = v_p.cycle_id),
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
    -- A rule counts when its latest vote in this cycle (by created_at) passed on or before the close date.
    'rules', jsonb_build_object('ratified_by_close', (
               select count(*)::int from (
                 select distinct on (r.rule_key) r.passed, r.decided_on
                 from rule_ratifications r where r.cycle_id = v_p.cycle_id
                 order by r.rule_key, r.created_at desc, r.id desc) x
               where x.passed and x.decided_on <= (v_p.closed_at at time zone 'Africa/Lusaka')::date)));
end $$;

revoke execute on function public.month_overrides(uuid), public.month_report(uuid) from public, anon;
grant execute on function public.month_overrides(uuid), public.month_report(uuid) to authenticated;
