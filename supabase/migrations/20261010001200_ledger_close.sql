-- Month close (spec §5). close_figures computes; write_close writes; close_month previews or commits.
-- The 2026 import closes its months through the same two functions.

create or replace function private.close_figures(p_period uuid, p_imported boolean default false) returns jsonb
language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_p periods;
  v_r cycle_rules;
  v_prev_id uuid;
  v_prev_gs group_statements;
  v_received numeric;
  v_savings numeric;
  v_loans numeric;
  v_fee_in numeric;
  v_fee_out numeric;
  v_meet_in numeric;
  v_opening numeric;
  v_idle numeric;
  v_excess numeric;
  v_out jsonb;
begin
  select * into v_p from periods where id = p_period;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  select * into v_r from cycle_rules where cycle_id = v_p.cycle_id;
  select id into v_prev_id from periods where cycle_id = v_p.cycle_id and month_index = v_p.month_index - 1;
  select * into v_prev_gs from group_statements where period_id = v_prev_id;

  -- Step 2, cash. Payments for last month's statement arrive in this month's window. Transfer fees and membership
  -- sit in their own pots and never touch lending cash.
  select coalesce(sum(amount) filter (where kind = 'payment'), 0),
         coalesce(sum(amount) filter (where kind = 'saving'), 0),
         coalesce(sum(amount) filter (where kind = 'loan_sent'), 0),
         coalesce(sum(amount) filter (where kind = 'txn_fee'), 0),
         coalesce(sum(amount) filter (where kind = 'payout_fee'), 0),
         coalesce(sum(amount) filter (where kind = 'membership'), 0)
    into v_received, v_savings, v_loans, v_fee_in, v_fee_out, v_meet_in
    from private.ledger_lines where period_id = p_period;
  v_opening := coalesce(v_prev_gs.idle_cash, 0) + v_received;
  v_idle := v_opening + v_savings - v_loans;
  -- Step 3, the excess charge: the cycle's rate (10%) of idle lending cash, to the ngwee.
  v_excess := round(v_r.excess_rate * greatest(v_idle, 0), 2);

  with mem as (
    select m.id, m.short_name, coalesce(ms.defaulted, false) as defaulted
    from members m
    left join member_status ms on ms.member_id = m.id and ms.cycle_id = v_p.cycle_id
    where m.group_id = v_p.group_id
      and (m.status = 'active'
           or exists (select 1 from private.ledger_lines x where x.member_id = m.id and x.cycle_id = v_p.cycle_id))
  ),
  lines as (
    select l.* from private.ledger_lines l
    where l.cycle_id = v_p.cycle_id and l.month_index <= v_p.month_index and l.member_id is not null
  ),
  sums as (
    select mem.id, mem.short_name, mem.defaulted,
      coalesce(sum(l.amount) filter (where l.kind = 'saving' and l.month_index = v_p.month_index), 0) as saving,
      coalesce(sum(l.amount) filter (where l.kind = 'saving'), 0) as cum_savings,
      coalesce(sum(l.amount) filter (where l.kind = 'payment' and l.month_index = v_p.month_index), 0) as paid_total,
      coalesce(sum(l.amount) filter (where l.kind = 'loan_sent' and l.month_index = v_p.month_index), 0) as principal_sent,
      coalesce(sum(l.amount) filter (where l.kind = 'loan_interest' and l.month_index = v_p.month_index), 0) as interest_charged,
      coalesce(sum(l.amount) filter (where l.kind = 'penalty' and l.month_index = v_p.month_index), 0) as penalties_charged,
      -- This month's excess and interest shares are what the close produces, so a replay of a closed month ignores
      -- the ones already booked; only corrections posted this month (and an import's own excess) are inputs.
      coalesce(sum(l.amount) filter (where l.kind = 'excess_charge' and l.month_index = v_p.month_index
                                       and l.source = 'correction'), 0) as excess_adjust,
      coalesce(sum(l.amount) filter (where l.kind = 'excess_charge' and l.month_index = v_p.month_index
                                       and l.source = 'import'), 0) as excess_imported,
      coalesce(sum(l.amount) filter (where l.kind = 'interest_share' and l.month_index = v_p.month_index
                                       and l.source = 'correction'), 0) as share_adjust,
      coalesce(sum(l.amount) filter (where l.kind = 'excess_charge' and l.month_index < v_p.month_index), 0) as excess_before,
      coalesce(sum(l.amount) filter (where l.kind = 'penalty'), 0) as penalties_to_date,
      coalesce(sum(l.amount) filter (where l.kind = 'loan_interest'), 0) as interest_to_date
    from mem left join lines l on l.member_id = mem.id
    group by mem.id, mem.short_name, mem.defaulted
  ),
  -- What earlier statements of this cycle already applied, bucket by bucket.
  earlier as (
    select s.member_id,
           sum(s.paid_to_excess) as exc_paid, sum(s.paid_to_penalties) as pen_paid,
           sum(s.paid_to_interest) as int_paid, sum(s.paid_to_principal) as pri_paid
    from statements s join periods p on p.id = s.period_id
    where p.cycle_id = v_p.cycle_id and p.month_index < v_p.month_index
    group by s.member_id
  ),
  prev as (
    select s.member_id, s.closing_owed, s.next_minimum, s.interest_earned_to_date
    from statements s where s.period_id = v_prev_id
  ),
  -- Step 3, the split: by cumulative savings including this month's deposit, every member billed (arrears and
  -- defaulters too), each share cut to the ngwee; the remainder goes to the largest saver so the parts sum exactly.
  ex1 as (
    select s.id,
           case when p_imported then s.excess_imported
                else coalesce(trunc(v_excess * s.cum_savings / nullif(sum(s.cum_savings) over (), 0), 2), 0) end as share,
           row_number() over (order by s.cum_savings desc, s.short_name) as rnk,
           sum(s.cum_savings) over () as total_cum
    from sums s
  ),
  ex as (
    select ex1.id,
           ex1.share + case when ex1.rnk = 1 and not p_imported and ex1.total_cum > 0
                            then v_excess - sum(ex1.share) over () else 0 end as share
    from ex1
  ),
  due as (
    select s.*, ex.share as excess_share, ex.share + s.excess_adjust as excess_charged,
           s.excess_before + ex.share + s.excess_adjust - coalesce(pr.exc_paid, 0) as exc_due,
           s.penalties_to_date - coalesce(pr.pen_paid, 0) as pen_due,
           s.interest_to_date - coalesce(pr.int_paid, 0) as int_due,
           coalesce(pr.int_paid, 0) as int_paid_before,
           coalesce(pr.pri_paid, 0) as pri_paid_before
    from sums s join ex on ex.id = s.id left join earlier pr on pr.member_id = s.id
  ),
  -- Step 4, payments: excess, then penalties, then loan interest, then principal. Whatever is left (or a reversal,
  -- when a correction makes the month's payments negative) goes to principal; beyond the debt it is a credit.
  a1 as (select d.*, case when d.paid_total > 0 then least(d.paid_total, greatest(d.exc_due, 0)) else 0 end as to_exc from due d),
  a2 as (select a1.*, case when a1.paid_total > 0 then least(a1.paid_total - a1.to_exc, greatest(a1.pen_due, 0)) else 0 end as to_pen
         from a1),
  a3 as (select a2.*, case when a2.paid_total > 0 then least(a2.paid_total - a2.to_exc - a2.to_pen, greatest(a2.int_due, 0)) else 0 end
                as to_int
         from a2),
  alloc as (select a3.*, a3.paid_total - a3.to_exc - a3.to_pen - a3.to_int as to_pri from a3),
  -- Payments always clear the oldest loan first, so everything paid to interest and to principal so far fills the
  -- member's loans in the order they were sent. That gives each loan's remaining balance without storing one.
  loan_amounts as (
    select l.id as loan_id, l.member_id, l.sent_at,
           coalesce(sum(x.amount) filter (where x.kind = 'loan_sent'), 0) as principal,
           coalesce(sum(x.amount) filter (where x.kind = 'loan_interest'), 0) as interest
    from loans l
    join periods lp on lp.id = l.period_id
    left join private.ledger_lines x on x.loan_id = l.id and x.month_index <= v_p.month_index
    where lp.cycle_id = v_p.cycle_id and lp.month_index <= v_p.month_index
    group by l.id, l.member_id, l.sent_at
  ),
  loan_left as (
    select la.loan_id, la.member_id, la.sent_at,
           (la.interest - least(la.interest, greatest(0, a.int_paid_before + a.to_int - coalesce(sum(la.interest) over w, 0))))
         + (la.principal - least(la.principal, greatest(0, a.pri_paid_before + a.to_pri - coalesce(sum(la.principal) over w, 0))))
           as remaining
    from loan_amounts la join alloc a on a.id = la.member_id
    window w as (partition by la.member_id order by la.sent_at, la.loan_id rows between unbounded preceding and 1 preceding)
  ),
  -- Next month's instalments on loans still owing, each capped at what that loan still owes (a waiver or an early
  -- payment shortens the schedule rather than asking for money that is not owed).
  next_due as (
    select ll.member_id, sum(least(i.amount_due, greatest(ll.remaining, 0))) as amount
    from loan_left ll
    join loan_instalments i on i.loan_id = ll.loan_id
    join periods np on np.id = i.period_id and np.month_index = v_p.month_index + 1
    group by ll.member_id
  ),
  -- Step 5, interest earned: what was collected this month (paid to excess, penalties and loan interest), shared by
  -- cumulative savings among members not in default; the remainder to the largest share.
  pool as (select coalesce(sum(a.to_exc + a.to_pen + a.to_int), 0) as collected from alloc a),
  sh1 as (
    select a.id,
           case when a.defaulted then 0
                else coalesce(trunc(pool.collected * a.cum_savings
                                    / nullif(sum(a.cum_savings) filter (where not a.defaulted) over (), 0), 2), 0) end as share,
           row_number() over (order by a.defaulted, a.cum_savings desc, a.short_name) as rnk,
           coalesce(sum(a.cum_savings) filter (where not a.defaulted) over (), 0) as total_cum
    from alloc a cross join pool
  ),
  sh as (
    select sh1.id,
           sh1.share + case when sh1.rnk = 1 and sh1.total_cum > 0
                            then (select collected from pool) - sum(sh1.share) over () else 0 end as share
    from sh1
  ),
  -- Step 6, statements.
  final as (
    select a.id as member_id, a.short_name,
           coalesce(pv.closing_owed, 0) as opening_owed,
           a.saving, a.cum_savings,
           a.principal_sent as loan_principal_sent, a.interest_charged as loan_interest_charged,
           a.excess_charged, a.penalties_charged, a.paid_total,
           a.to_exc as paid_to_excess, a.to_pen as paid_to_penalties, a.to_int as paid_to_interest, a.to_pri as paid_to_principal,
           coalesce(pv.closing_owed, 0) + a.principal_sent + a.interest_charged + a.excess_charged + a.penalties_charged
             - a.paid_total as closing_owed,
           greatest(0, coalesce(pv.next_minimum, 0) - a.paid_total) as unpaid_minimum,
           coalesce(nd.amount, 0) as next_due,
           a.excess_share,
           sh.share as interest_share,
           sh.share + a.share_adjust as interest_earned,
           coalesce(pv.interest_earned_to_date, 0) + sh.share + a.share_adjust as interest_earned_to_date
    from alloc a
    join sh on sh.id = a.id
    left join prev pv on pv.member_id = a.id
    left join next_due nd on nd.member_id = a.id
  ),
  final2 as (
    select f.*,
           case when p_imported and wf.value is not null then wf.value
                else greatest(0, least(f.closing_owed, f.next_due + f.excess_charged + f.unpaid_minimum)) end as next_minimum
    from final f
    left join workbook_figures wf on wf.period_id = p_period and wf.member_id = f.member_id and wf.field = 'next_minimum'
  )
  select jsonb_build_object(
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'member_id', member_id, 'short_name', short_name, 'opening_owed', opening_owed, 'saving', saving,
        'cum_savings', cum_savings, 'loan_principal_sent', loan_principal_sent, 'loan_interest_charged', loan_interest_charged,
        'excess_charged', excess_charged, 'penalties_charged', penalties_charged, 'paid_total', paid_total,
        'paid_to_excess', paid_to_excess, 'paid_to_penalties', paid_to_penalties, 'paid_to_interest', paid_to_interest,
        'paid_to_principal', paid_to_principal, 'closing_owed', closing_owed, 'next_minimum', next_minimum,
        'unpaid_minimum', unpaid_minimum, 'interest_earned', interest_earned, 'interest_earned_to_date', interest_earned_to_date,
        'excess_share', excess_share, 'interest_share', interest_share) order by short_name), '[]'::jsonb) from final2),
    'loans', (select coalesce(jsonb_agg(jsonb_build_object('loan_id', loan_id, 'remaining', remaining)
                                        order by sent_at, loan_id), '[]'::jsonb) from loan_left),
    'collected', (select collected from pool))
  into v_out;

  return jsonb_build_object(
    'period_id', p_period, 'label', v_p.label, 'month_index', v_p.month_index, 'committed', false,
    'group', jsonb_build_object(
      'opening_cash', v_opening, 'received', v_received, 'savings', v_savings, 'loans_sent', v_loans,
      'idle_cash', v_idle, 'excess_rate', v_r.excess_rate,
      'excess_billed', (select coalesce(sum((m ->> 'excess_share')::numeric), 0) from jsonb_array_elements(v_out -> 'members') m),
      'interest_collected', (v_out ->> 'collected')::numeric,
      'fee_pot_in', v_fee_in, 'fee_pot_out', v_fee_out,
      'fee_pot_balance', coalesce(v_prev_gs.fee_pot_balance, 0) + v_fee_in - v_fee_out,
      'meeting_pot_in', v_meet_in, 'meeting_pot_balance', coalesce(v_prev_gs.meeting_pot_balance, 0) + v_meet_in,
      'total_savings', (select coalesce(sum((m ->> 'cum_savings')::numeric), 0) from jsonb_array_elements(v_out -> 'members') m),
      'total_owed', (select coalesce(sum((m ->> 'closing_owed')::numeric), 0) from jsonb_array_elements(v_out -> 'members') m)),
    'members', v_out -> 'members',
    'loans', v_out -> 'loans');
end $$;

create or replace function private.write_close(p_period uuid, p_figures jsonb, p_source text) returns void
language plpgsql set search_path = public, pg_temp as $$
declare v_p periods;
begin
  select * into v_p from periods where id = p_period;
  -- The month's outputs as ledger entries. An import already carries the workbook's excess charges.
  insert into entries (group_id, period_id, member_id, kind, amount, source, created_by)
  select v_p.group_id, p_period, (m ->> 'member_id')::uuid, x.kind, x.amount, p_source, auth.uid()
  from jsonb_array_elements(p_figures -> 'members') m
  cross join lateral (values ('excess_charge', (m ->> 'excess_share')::numeric),
                             ('interest_share', (m ->> 'interest_share')::numeric)) as x(kind, amount)
  where x.amount > 0 and (x.kind = 'interest_share' or p_source = 'close');

  insert into statements (group_id, period_id, member_id, opening_owed, saving, cum_savings, loan_principal_sent,
    loan_interest_charged, excess_charged, penalties_charged, paid_total, paid_to_excess, paid_to_penalties,
    paid_to_interest, paid_to_principal, closing_owed, next_minimum, unpaid_minimum, interest_earned,
    interest_earned_to_date, source)
  select v_p.group_id, p_period, r.member_id, r.opening_owed, r.saving, r.cum_savings, r.loan_principal_sent,
    r.loan_interest_charged, r.excess_charged, r.penalties_charged, r.paid_total, r.paid_to_excess, r.paid_to_penalties,
    r.paid_to_interest, r.paid_to_principal, r.closing_owed, r.next_minimum, r.unpaid_minimum, r.interest_earned,
    r.interest_earned_to_date, p_source
  from jsonb_array_elements(p_figures -> 'members') m
  cross join lateral jsonb_populate_record(null::public.statements, m) r;

  insert into group_statements (group_id, period_id, opening_cash, received, savings, loans_sent, idle_cash, excess_rate,
    excess_billed, interest_collected, fee_pot_in, fee_pot_out, fee_pot_balance, meeting_pot_in, meeting_pot_balance,
    total_savings, total_owed, source)
  select v_p.group_id, p_period, r.opening_cash, r.received, r.savings, r.loans_sent, r.idle_cash, r.excess_rate,
    r.excess_billed, r.interest_collected, r.fee_pot_in, r.fee_pot_out, r.fee_pot_balance, r.meeting_pot_in,
    r.meeting_pot_balance, r.total_savings, r.total_owed, p_source
  from jsonb_populate_record(null::public.group_statements, p_figures -> 'group') r;

  update loans set status = 'repaid'
   where status = 'open'
     and id in (select (x ->> 'loan_id')::uuid from jsonb_array_elements(p_figures -> 'loans') x
                where (x ->> 'remaining')::numeric <= 0);
end $$;

create or replace function public.close_month(p_period uuid, p_commit boolean default false, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_p periods; v jsonb;
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
  if not p_commit then return v; end if;

  perform private.write_close(p_period, v, 'close');
  update periods set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = p_period;
  perform private.audit(v_p.group_id, 'period.closed', 'periods', p_period, jsonb_build_object(
    'label', v_p.label, 'excess_billed', v -> 'group' -> 'excess_billed',
    'interest_collected', v -> 'group' -> 'interest_collected', 'fee_pot_balance', v -> 'group' -> 'fee_pot_balance',
    'reason', nullif(trim(p_reason), ''))
    -- Transfer fees are paid even when the fee pot cannot cover them; a short pot is flagged, not refused.
    || case when (v -> 'group' ->> 'fee_pot_balance')::numeric < 0 then '{"warning": "fee_pot_short"}'::jsonb
            else '{}'::jsonb end);
  return jsonb_set(v, '{committed}', 'true'::jsonb);
end $$;

revoke execute on function public.close_month(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.close_month(uuid, boolean, text) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
