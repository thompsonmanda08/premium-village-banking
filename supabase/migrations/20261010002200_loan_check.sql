-- A read-only look at a loan before it is sent: lending cash on hand, the member's cap and arrears, and, for an amount, its
-- interest, term and whether send_loan would refuse it. send_loan is unchanged and stays the only writer; this repeats its
-- formulas so the screen never has to compute money, and pgTAP (18_loan_check) pins the two together.

create or replace function public.loan_check(p_member uuid, p_principal numeric default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_m members;
  v_p periods;
  v_r cycle_rules;
  v_multiple numeric;
  v_open boolean;
  v_cash numeric;
  v_cum numeric;
  v_owed numeric;
  v_cap numeric;
  v_unpaid numeric;
  v_paid_this_month numeric;
  v_arrears text;
  v_term int;
  v_out jsonb;
begin
  select * into v_m from members where id = p_member;
  if not found then raise exception 'member_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v_m.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if v_m.status <> 'active' then raise exception 'member_not_active' using errcode = 'P0001'; end if;
  if p_principal is not null
     and (not (p_principal > 0 and p_principal <= 9999999999.99) or p_principal <> round(p_principal, 2)) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  select * into v_p from periods where group_id = v_m.group_id and status = 'open';
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  select * into v_r from cycle_rules where cycle_id = v_p.cycle_id;

  select (x ->> 'multiple')::numeric into v_multiple
    from jsonb_array_elements(v_r.loan_multiples) x
   where v_p.month_index between (x ->> 'from_month')::int and (x ->> 'to_month')::int
   limit 1;
  v_open := v_p.month_index < 12 and coalesce(v_multiple, 0) > 0;
  v_cash := private.lending_cash(v_p.id);
  v_cum := coalesce((select sum(l.amount) from private.ledger_lines l
                     where l.member_id = p_member and l.cycle_id = v_p.cycle_id and l.kind = 'saving'
                       and l.month_index <= v_p.month_index), 0);
  v_owed := private.loans_owed(p_member, v_p.id);
  v_cap := coalesce(v_multiple, 0) * v_cum;

  -- Arrears: the same sentence send_loan stores (previous month's minimum less payments received so far this month).
  select coalesce(sum(l.amount), 0) into v_paid_this_month
    from private.ledger_lines l
   where l.period_id = v_p.id and l.member_id = p_member and l.kind = 'payment';
  select s.next_minimum into v_unpaid
    from periods prev join statements s on s.period_id = prev.id and s.member_id = p_member
   where prev.cycle_id = v_p.cycle_id and prev.month_index = v_p.month_index - 1;
  if coalesce(v_unpaid, 0) - v_paid_this_month > 0 then
    v_arrears := format('K%s of last month''s minimum unpaid (K%s due, K%s paid so far); already owes K%s in all',
                        round(coalesce(v_unpaid, 0) - v_paid_this_month, 2), round(coalesce(v_unpaid, 0), 2),
                        round(v_paid_this_month, 2), round(greatest(private.member_balance(p_member, v_p.id), 0), 2));
  end if;

  v_out := jsonb_build_object(
    'period_id', v_p.id, 'label', v_p.label, 'month_index', v_p.month_index, 'loans_open', v_open,
    'lending_cash', v_cash, 'multiple', coalesce(v_multiple, 0), 'cum_savings', v_cum, 'loans_owed', v_owed,
    'cap', v_cap, 'headroom', v_cap - v_owed, 'arrears', v_arrears);

  if p_principal is not null then
    -- The term is the tenor band for the size, shortened so the last instalment falls by month 12 (as schedule_loan does).
    select (b ->> 'months')::int into v_term
      from jsonb_array_elements(v_r.tenor_bands) with ordinality as x(b, i)
     where b ->> 'max' is null or p_principal <= (b ->> 'max')::numeric
     order by i
     limit 1;
    v_term := least(coalesce(v_term, 1), 12 - v_p.month_index);
    v_out := v_out || jsonb_build_object(
      'principal', p_principal, 'interest', round(p_principal * v_r.loan_rate, 2),
      'term_months', case when v_term < 1 then null else v_term end,
      'over_cap', v_owed + p_principal > v_cap, 'insufficient_cash', p_principal > v_cash);
  end if;
  return v_out;
end $$;

revoke execute on function public.loan_check(uuid, numeric) from public, anon, authenticated;
grant execute on function public.loan_check(uuid, numeric) to authenticated;
