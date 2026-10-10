-- Step 7 of the close: compare with the workbook's figures and explain each difference with a fixed reason code.

-- The workbook's figures obey the ledger's money guard (numeric(12,2) already caps their size).
alter table public.workbook_figures add constraint workbook_figures_value_finite check (value <> 'NaN'::numeric);

create or replace function private.close_diff(p_period uuid, p_figures jsonb) returns jsonb
language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_p periods;
  v_r cycle_rules;
  v_fees numeric[];
  v_fees_before numeric[];
  v_out jsonb;
begin
  select * into v_p from periods where id = p_period;
  select * into v_r from cycle_rules where cycle_id = v_p.cycle_id;
  -- Loan transfer fees: the app pays them from the fee pot, the workbook took them from lending cash from some month
  -- on. So idle cash may differ by the fees of any run of months ending this month (opening cash: ending last month).
  select coalesce(array_agg(y.s) filter (where y.s > 0), '{}') into v_fees
    from (select sum(x.f) over (order by x.month_index desc) as s
          from (select p.month_index, coalesce(sum(l.amount), 0) as f
                from periods p left join private.ledger_lines l on l.period_id = p.id and l.kind = 'payout_fee'
                where p.cycle_id = v_p.cycle_id and p.month_index <= v_p.month_index
                group by p.month_index) x) y;
  select coalesce(array_agg(y.s) filter (where y.s > 0), '{}') into v_fees_before
    from (select sum(x.f) over (order by x.month_index desc) as s
          from (select p.month_index, coalesce(sum(l.amount), 0) as f
                from periods p left join private.ledger_lines l on l.period_id = p.id and l.kind = 'payout_fee'
                where p.cycle_id = v_p.cycle_id and p.month_index <= v_p.month_index - 1
                group by p.month_index) x) y;

  with app as (
    select (m ->> 'member_id')::uuid as member_id, m ->> 'short_name' as short_name, f.field, (m ->> f.field)::numeric as app
    from jsonb_array_elements(p_figures -> 'members') m
    cross join unnest(array['cum_savings', 'excess_charged', 'closing_owed', 'next_minimum']) as f(field)
    union all
    select null::uuid, null::text, f.field, (p_figures -> 'group' ->> f.field)::numeric
    from unnest(array['opening_cash', 'idle_cash', 'excess_billed']) as f(field)
  ),
  d as (
    select a.member_id, a.short_name, a.field, a.app, w.value as workbook, a.app - w.value as difference
    from app a
    join workbook_figures w on w.period_id = p_period and w.member_id is not distinct from a.member_id and w.field = a.field
    where a.app <> w.value
  ),
  g as (
    select d.*, case
      when d.field = 'idle_cash' and exists (select 1 from unnest(v_fees) s where abs(d.difference - s) < 0.05)
        then 'fee_pot_vs_cash'
      when d.field = 'opening_cash' and exists (select 1 from unnest(v_fees_before) s where abs(d.difference - s) < 0.05)
        then 'fee_pot_vs_cash'
      when d.field = 'excess_billed'
           and exists (select 1 from unnest(v_fees) s where abs(d.difference - round(v_r.excess_rate * s, 2)) < 0.05)
        then 'fee_pot_vs_cash'
      when abs(d.difference) < 1 then 'workbook_rounded'
      else 'unexplained' end as reason_code
    from d where d.member_id is null
  ),
  gx as (select g.difference, g.reason_code from g where g.field = 'excess_billed'),
  mx as (
    select d.*, case
      when (select gx.reason_code from gx) = 'fee_pot_vs_cash'
           and sign(d.difference) = sign((select gx.difference from gx))
           and abs(d.difference) <= abs((select gx.difference from gx)) + 0.01 then 'fee_pot_vs_cash'
      when abs(d.difference) < 1 then 'workbook_rounded'
      else 'unexplained' end as reason_code
    from d where d.member_id is not null and d.field = 'excess_charged'
  ),
  extra as (
    -- A waiver is never itself corrected (post_correction refuses it), so its own amount is final.
    select (m ->> 'member_id')::uuid as member_id,
           coalesce((select sum(e.amount) from entries e
                     where e.period_id = p_period and e.member_id = (m ->> 'member_id')::uuid and e.kind = 'waiver'), 0) as waived,
           coalesce((select sum(l.amount) from private.ledger_lines l
                     where l.cycle_id = v_p.cycle_id and l.month_index <= v_p.month_index
                       and l.member_id = (m ->> 'member_id')::uuid and l.kind = 'loan_sent'), 0)
           - coalesce((select sum(s.paid_to_principal) from statements s join periods p on p.id = s.period_id
                       where p.cycle_id = v_p.cycle_id and p.month_index < v_p.month_index
                         and s.member_id = (m ->> 'member_id')::uuid), 0)
           - (m ->> 'paid_to_principal')::numeric as principal_left
    from jsonb_array_elements(p_figures -> 'members') m
  ),
  -- the first instalment of each loan sent this month
  firsts as (
    select l.member_id, i.amount_due
    from loans l
    join loan_instalments i on i.loan_id = l.id
    join periods ip on ip.id = i.period_id and ip.cycle_id = v_p.cycle_id and ip.month_index = v_p.month_index + 1
    where l.period_id = p_period
  ),
  mo as (
    select d.*, case
      when d.field = 'cum_savings' then case when abs(d.difference) < 1 then 'workbook_rounded' else 'unexplained' end
      when d.field = 'closing_owed' then case
        when abs(d.difference - coalesce(x.difference, 0)) < 1
          then coalesce(case when abs(coalesce(x.difference, 0)) >= 0.01 then x.reason_code end, 'workbook_rounded')
        when e.waived > 0 and abs(d.difference - coalesce(x.difference, 0) + e.waived) < 1 then 'waiver'
        else 'unexplained' end
      else case
        when abs(d.difference) < 1 then 'workbook_rounded'
        when d.difference > 0 and exists (select 1 from firsts f
                                          where f.member_id = d.member_id and abs(d.difference - f.amount_due) < 1)
          then 'workbook_missed_loan'
        when abs(d.difference + v_r.membership_fee) < 1 then 'penalty_not_charged'
        when e.principal_left > 0 then 'workbook_term_differs'
        else 'unexplained' end
      end as reason_code
    from d
    left join mx x on x.member_id = d.member_id
    left join extra e on e.member_id = d.member_id
    where d.member_id is not null and d.field <> 'excess_charged'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'member_id', r.member_id, 'short_name', r.short_name, 'field', r.field, 'app', r.app, 'workbook', r.workbook,
           'difference', r.difference, 'reason_code', r.reason_code) order by r.short_name nulls first, r.field), '[]'::jsonb)
    into v_out
  from (select * from g union all select * from mx union all select * from mo) r;
  return v_out;
end $$;

create or replace function public.close_month(p_period uuid, p_commit boolean default false, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_p periods; v jsonb; v_diff jsonb; v_unexplained int;
begin
  -- A commit locks the month before anything else: a second close (another phone) waits here, then finds it closed.
  -- FOR UPDATE, as send_loan, apply_penalty and corrections take it, and approvals' FOR SHARE conflicts with it, so
  -- nothing lands mid-close.
  if p_commit then
    select * into v_p from periods where id = p_period for update;
  else
    select * into v_p from periods where id = p_period;
  end if;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if not is_admin(v_p.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_commit and v_p.status = 'closed' then raise exception 'already_closed' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p_reason, ''))) > 500 then raise exception 'invalid_note' using errcode = 'P0001'; end if;
  if v_p.status = 'planned' then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if v_p.month_index > 1 and not exists (select 1 from periods
                                          where cycle_id = v_p.cycle_id and month_index = v_p.month_index - 1 and status = 'closed') then
    raise exception 'previous_period_open' using errcode = 'P0001';
  end if;
  if exists (select 1 from declarations d
             where d.period_id = p_period and d.status = 'submitted'
               and not exists (select 1 from declarations n where n.supersedes_id = d.id)) then
    raise exception 'declarations_pending' using errcode = 'P0001';
  end if;

  -- Preview and commit share this one computation.
  v := private.close_figures(p_period, false);
  v_diff := private.close_diff(p_period, v);
  v_unexplained := (select count(*)::int from jsonb_array_elements(v_diff) x where x ->> 'reason_code' = 'unexplained');
  v := v || jsonb_build_object('diff', v_diff, 'unexplained', v_unexplained);
  if not p_commit then return v; end if;

  if v_unexplained > 0 and coalesce(trim(p_reason), '') = '' then
    raise exception 'unexplained_differences' using errcode = 'P0001';
  end if;
  perform private.write_close(p_period, v, 'close');
  update periods set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = p_period;
  perform private.audit(v_p.group_id, 'period.closed', 'periods', p_period, jsonb_build_object(
    'label', v_p.label, 'excess_billed', v -> 'group' -> 'excess_billed',
    'interest_collected', v -> 'group' -> 'interest_collected', 'fee_pot_balance', v -> 'group' -> 'fee_pot_balance',
    'differences', jsonb_array_length(v_diff), 'unexplained', v_unexplained, 'reason', nullif(trim(p_reason), ''))
    -- Transfer fees are paid even when the fee pot cannot cover them; a short pot is flagged, not refused.
    || case when (v -> 'group' ->> 'fee_pot_balance')::numeric < 0 then '{"warning": "fee_pot_short"}'::jsonb
            else '{}'::jsonb end);
  return jsonb_set(v, '{committed}', 'true'::jsonb);
end $$;

-- Every month that is not planned: its stored group statement and, where workbook figures exist, the replayed differences.
-- A closed month is replayed (spec §7), not read from its statements: imported months store the workbook's own figures,
-- so only the replay can differ from them. The replay uses today's default flags, which move interest shares only; no
-- compared field depends on them.
-- Used by ledger_check (the admin page) and by `bun run ledger:check`.
create or replace function private.check_cycle(p_cycle uuid) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'cycle_id', c.id,
    'cycle_label', c.label,
    'periods', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'label', p.label, 'month_index', p.month_index, 'status', p.status,
               'group', (select to_jsonb(gs) - 'id' - 'group_id' - 'period_id' - 'created_at' - 'source'
                         from group_statements gs where gs.period_id = p.id),
               'checked', exists (select 1 from workbook_figures w where w.period_id = p.id),
               'diff', case when exists (select 1 from workbook_figures w where w.period_id = p.id)
                            then private.close_diff(p.id, private.close_figures(p.id, false)) else '[]'::jsonb end)
             order by p.month_index)
      from periods p where p.cycle_id = c.id and p.status <> 'planned'), '[]'::jsonb))
  from cycles c where c.id = p_cycle
$$;

create or replace function public.ledger_check(p_group uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_cycle uuid;
begin
  if not is_admin(p_group) then raise exception 'not_admin' using errcode = '42501'; end if;
  select id into v_cycle from cycles where group_id = p_group and status = 'active' order by starts_on desc limit 1;
  if v_cycle is null then
    return jsonb_build_object('cycle_id', null, 'cycle_label', null, 'periods', '[]'::jsonb);
  end if;
  return private.check_cycle(v_cycle);
end $$;

revoke execute on function public.ledger_check(uuid) from public, anon, authenticated;
grant execute on function public.ledger_check(uuid) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
