-- Loans: schedule by size, cash on hand, member balance, and send_loan.

-- A loan's own schedule: term by size from the cycle's tenor bands, shortened so the last instalment falls by
-- month 12 (January); equal instalments of (principal + interest) / term cut to the ngwee, the last one absorbing
-- the remainder. Shared by send_loan and the 2026 import.
create or replace function private.schedule_loan(p_period uuid, p_member uuid, p_principal numeric, p_interest numeric,
  p_wallet uuid, p_sent_at timestamptz)
returns public.loans language plpgsql set search_path = public, pg_temp as $$
declare v_p periods; v_term int; v loans; v_total numeric; v_each numeric;
begin
  select * into v_p from periods where id = p_period;
  select (b ->> 'months')::int into v_term
    from cycle_rules r, jsonb_array_elements(r.tenor_bands) with ordinality as x(b, i)
   where r.cycle_id = v_p.cycle_id and (b ->> 'max' is null or p_principal <= (b ->> 'max')::numeric)
   order by i
   limit 1;
  v_term := least(coalesce(v_term, 1), 12 - v_p.month_index);
  if v_term < 1 then raise exception 'loans_closed' using errcode = 'P0001'; end if;

  insert into loans (group_id, member_id, period_id, principal, interest, term_months, sent_at, wallet_id)
  values (v_p.group_id, p_member, p_period, p_principal, p_interest, v_term, p_sent_at, p_wallet)
  returning * into v;

  v_total := p_principal + p_interest;
  v_each := trunc(v_total / v_term, 2);
  insert into loan_instalments (group_id, loan_id, period_id, amount_due)
  select v_p.group_id, v.id, p.id,
         case when p.month_index = v_p.month_index + v_term then v_total - v_each * (v_term - 1) else v_each end
  from periods p
  where p.cycle_id = v_p.cycle_id and p.month_index between v_p.month_index + 1 and v_p.month_index + v_term;
  return v;
end $$;

-- Lending cash on hand in a month: last month's idle cash + payments and savings in so far − loans out so far.
-- Membership and transfer fees sit in their own pots and never count.
create or replace function private.lending_cash(p_period uuid) returns numeric
language sql stable set search_path = public, pg_temp as $$
  select coalesce((select gs.idle_cash from periods p
                   join periods prev on prev.cycle_id = p.cycle_id and prev.month_index = p.month_index - 1
                   join group_statements gs on gs.period_id = prev.id
                   where p.id = p_period), 0)
       + coalesce((select sum(case when l.kind = 'loan_sent' then -l.amount else l.amount end)
                   from private.ledger_lines l
                   where l.period_id = p_period and l.kind in ('payment', 'saving', 'loan_sent')), 0)
$$;

-- What a member owes as of a month: a closed month's statement, or the last statement plus the open month's
-- charges so far less its payments so far.
create or replace function private.member_balance(p_member uuid, p_period uuid) returns numeric
language sql stable set search_path = public, pg_temp as $$
  select case when p.status = 'closed' then
           coalesce((select s.closing_owed from statements s where s.period_id = p.id and s.member_id = p_member), 0)
         else
           coalesce((select s.closing_owed from periods prev join statements s on s.period_id = prev.id and s.member_id = p_member
                     where prev.cycle_id = p.cycle_id and prev.month_index = p.month_index - 1), 0)
           + coalesce((select sum(case when l.kind = 'payment' then -l.amount else l.amount end) from private.ledger_lines l
                       where l.period_id = p.id and l.member_id = p_member
                         and l.kind in ('loan_sent', 'loan_interest', 'excess_charge', 'penalty', 'payment')), 0)
         end
  from periods p where p.id = p_period
$$;


-- What a member still owes on loans alone (principal + interest), for the cap. Excess and penalties are not loans and
-- never count against it. Settled months come from the statements (what was paid to interest and principal); in an open
-- month, payments clear charges other than loans first (the payment order), so only the rest reduces the loans.
create or replace function private.loans_owed(p_member uuid, p_period uuid) returns numeric
language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_p periods; v_k int; v_owed numeric; v_prev_closing numeric; v_new numeric; v_pay numeric; v_other numeric;
begin
  select * into v_p from periods where id = p_period;
  if not found then return 0; end if;
  -- Months whose statements are in: through this one if it is closed, else through the previous one.
  v_k := case when v_p.status = 'closed' then v_p.month_index else v_p.month_index - 1 end;
  v_owed := greatest(
    coalesce((select sum(l.amount) from private.ledger_lines l
              where l.member_id = p_member and l.cycle_id = v_p.cycle_id and l.month_index <= v_k
                and l.kind in ('loan_sent', 'loan_interest')), 0)
    - coalesce((select sum(s.paid_to_interest + s.paid_to_principal) from statements s
                join periods sp on sp.id = s.period_id
                where s.member_id = p_member and sp.cycle_id = v_p.cycle_id and sp.month_index <= v_k), 0), 0);
  if v_p.status = 'closed' then return v_owed; end if;

  select s.closing_owed into v_prev_closing
    from statements s join periods sp on sp.id = s.period_id
   where s.member_id = p_member and sp.cycle_id = v_p.cycle_id and sp.month_index = v_p.month_index - 1;
  select coalesce(sum(l.amount) filter (where l.kind in ('loan_sent', 'loan_interest')), 0),
         coalesce(sum(l.amount) filter (where l.kind = 'payment'), 0),
         coalesce(sum(l.amount) filter (where l.kind in ('penalty', 'excess_charge')), 0)
    into v_new, v_pay, v_other
    from private.ledger_lines l where l.member_id = p_member and l.period_id = p_period;
  -- Charges that are not loans: this month's, plus what last month's statement shows beyond the loans.
  v_other := v_other + greatest(coalesce(v_prev_closing, 0) - v_owed, 0);
  return greatest(v_owed + v_new - greatest(v_pay - v_other, 0), 0);
end $$;

create or replace function public.send_loan(p_member uuid, p_principal numeric, p_wallet uuid,
  p_reason text default null, p_fee numeric default 0)
returns public.loans
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_m members;
  v_p periods;
  v_r cycle_rules;
  v_multiple numeric;
  v_cum numeric;
  v_owed numeric;
  v_unpaid numeric;
  v_cap_warning text;
  v_arrears text;
  v_interest numeric;
  v loans;
begin
  select * into v_m from members where id = p_member;
  if not found then raise exception 'member_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v_m.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  -- NaN and Infinity sort above every number, so the range test refuses them; 9999999999.99 is the column's limit.
  if p_principal is null or not (p_principal > 0 and p_principal <= 9999999999.99) or p_principal <> round(p_principal, 2)
     or p_fee is null or not (p_fee >= 0 and p_fee <= 9999999999.99) or p_fee <> round(p_fee, 2) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) > 500 then raise exception 'invalid_note' using errcode = 'P0001'; end if;
  if v_m.status <> 'active' then raise exception 'member_not_active' using errcode = 'P0001'; end if;
  -- One send at a time per group: the lock makes the cash check and the send a single step, so two treasurers
  -- sending at once cannot both spend the same kwacha. close_month takes the same lock. Lock order is the month, then
  -- nothing else: declarations lock the member row and then the declaration (or the month FOR SHARE), never the reverse.
  select * into v_p from periods where group_id = v_m.group_id and status = 'open' for update;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  select * into v_r from cycle_rules where cycle_id = v_p.cycle_id;
  select (x ->> 'multiple')::numeric into v_multiple
    from jsonb_array_elements(v_r.loan_multiples) x
   where v_p.month_index between (x ->> 'from_month')::int and (x ->> 'to_month')::int
   limit 1;
  if v_p.month_index >= 12 or coalesce(v_multiple, 0) = 0 then raise exception 'loans_closed' using errcode = 'P0001'; end if;
  -- App-entered loans name an active wallet of the group (imported history has none, and does not come through here).
  if not exists (select 1 from wallets w where w.id = p_wallet and w.group_id = v_m.group_id and w.active) then
    raise exception 'wallet_not_found' using errcode = 'P0001';
  end if;
  if p_principal > private.lending_cash(v_p.id) then raise exception 'insufficient_cash' using errcode = 'P0001'; end if;

  -- Cap: what is still owed on loans + this loan ≤ multiple × cumulative savings including this month's saving.
  -- Excess and penalties owed are not loans and do not count.
  v_cum := coalesce((select sum(l.amount) from private.ledger_lines l
                     where l.member_id = p_member and l.cycle_id = v_p.cycle_id and l.kind = 'saving'
                       and l.month_index <= v_p.month_index), 0);
  v_owed := private.loans_owed(p_member, v_p.id);
  if v_owed + p_principal > v_multiple * v_cum then
    v_cap_warning := format('Over the cap: owes K%s, new loan K%s, cap K%s (%s x savings of K%s)',
                            round(v_owed, 2), round(p_principal, 2), round(v_multiple * v_cum, 2), v_multiple, round(v_cum, 2));
    if coalesce(trim(p_reason), '') = '' then raise exception 'over_cap_needs_reason' using errcode = 'P0001'; end if;
  end if;
  -- Arrears: still owing from last month's minimum. Allowed, with a warning that says what the member owes in all.
  select s.unpaid_minimum into v_unpaid
    from periods prev join statements s on s.period_id = prev.id and s.member_id = p_member
   where prev.cycle_id = v_p.cycle_id and prev.month_index = v_p.month_index - 1;
  if coalesce(v_unpaid, 0) > 0 then
    v_arrears := format('K%s of last month''s minimum is unpaid; already owes K%s in all',
                        round(v_unpaid, 2), round(greatest(private.member_balance(p_member, v_p.id), 0), 2));
  end if;

  v_interest := round(p_principal * v_r.loan_rate, 2);
  v := private.schedule_loan(v_p.id, p_member, p_principal, v_interest, p_wallet, clock_timestamp());
  update loans set cap_warning = v_cap_warning, arrears_warning = v_arrears, approved_reason = nullif(trim(p_reason), '')
   where id = v.id returning * into v;

  insert into entries (group_id, period_id, member_id, kind, amount, loan_id, wallet_id, source, created_by)
  values (v_m.group_id, v_p.id, p_member, 'loan_sent', p_principal, v.id, p_wallet, 'app', auth.uid());
  if v_interest > 0 then
    insert into entries (group_id, period_id, member_id, kind, amount, loan_id, source, created_by)
    values (v_m.group_id, v_p.id, p_member, 'loan_interest', v_interest, v.id, 'app', auth.uid());
  end if;
  -- The transfer fee is paid from the fee pot (members' declared fees), never from lending cash.
  if p_fee > 0 then
    insert into entries (group_id, period_id, member_id, kind, amount, loan_id, wallet_id, source, created_by)
    values (v_m.group_id, v_p.id, null, 'payout_fee', p_fee, v.id, p_wallet, 'app', auth.uid());
  end if;

  perform private.audit(v_m.group_id, 'loan.sent', 'loans', v.id, jsonb_build_object(
    'member_id', p_member, 'principal', p_principal, 'interest', v_interest, 'term_months', v.term_months,
    'fee', p_fee, 'cap_warning', v_cap_warning, 'arrears_warning', v_arrears, 'reason', nullif(trim(p_reason), '')));
  return v;
end $$;

revoke execute on function public.send_loan(uuid, numeric, uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.send_loan(uuid, numeric, uuid, text, numeric) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
