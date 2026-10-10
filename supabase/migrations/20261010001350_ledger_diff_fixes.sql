-- Task 7 review fixes to the workbook comparison: every workbook figure is compared (none skipped silently), and a
-- different loan term explains a minimum difference only up to the principal still owed.

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
  -- Every workbook figure is compared. One the app has no figure for (a member the close does not list) shows with
  -- app null and is unexplained.
  d as (
    select w.member_id, coalesce(a.short_name, mb.short_name) as short_name, w.field, a.app, w.value as workbook,
           a.app - w.value as difference
    from workbook_figures w
    left join app a on a.member_id is not distinct from w.member_id and a.field = w.field
    left join members mb on mb.id = w.member_id
    where w.period_id = p_period and a.app is distinct from w.value
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
        when e.principal_left > 0 and abs(d.difference) <= e.principal_left then 'workbook_term_differs'
        else 'unexplained' end
      end as reason_code
    from d
    left join mx x on x.member_id = d.member_id
    left join extra e on e.member_id = d.member_id
    where d.member_id is not null and d.field <> 'excess_charged'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'member_id', r.member_id, 'short_name', r.short_name, 'field', r.field, 'app', r.app, 'workbook', r.workbook,
           'difference', r.difference, 'reason_code', case when r.app is null then 'unexplained' else r.reason_code end) order by r.short_name nulls first, r.field), '[]'::jsonb)
    into v_out
  from (select * from g union all select * from mx union all select * from mo) r;
  return v_out;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
