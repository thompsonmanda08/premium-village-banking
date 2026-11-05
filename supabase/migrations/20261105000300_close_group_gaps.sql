-- Closes the gaps found comparing the constitution, the chat and the workbooks with the app:
--   1. a defaulter's interest is forfeited at payout and re-shared among the others by savings;
--   2. committee positions on members;
--   3. a purpose on each loan, and what the group lends for;
--   4. spending from the hosting and fee pots, and the pots shared by savings (not equally) at payout.

-- 2. Committee position ---------------------------------------------------------------------------------
alter table public.members add column position text
  check (position in ('chairperson', 'vice_chair', 'treasurer', 'vice_treasurer', 'secretary', 'trustee'));
grant update (position) on public.members to authenticated;  -- members_update already limits updates to the group's admins

-- The roster every member reads gains the position (a new last column keeps the old ones in place).
create or replace view public.group_members with (security_invoker = false, security_barrier = true) as
  select m.id, m.group_id, m.full_name, m.short_name, m.role, m.status, (m.user_id is not null) as linked, m.position
  from public.members m
  where public.is_member(m.group_id);

-- 3. Loan purpose ---------------------------------------------------------------------------------------
alter table public.loans add column purpose text check (purpose in ('business', 'education', 'emergency', 'other'));

create or replace function public.set_loan_purpose(p_loan uuid, p_purpose text)
returns public.loans
language plpgsql security definer set search_path = public, pg_temp as $$
declare v loans;
begin
  select * into v from loans where id = p_loan;
  if not found or not is_admin(v.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_purpose is not null and p_purpose not in ('business', 'education', 'emergency', 'other') then
    raise exception 'invalid_purpose' using errcode = 'P0001';
  end if;
  update loans set purpose = p_purpose where id = p_loan returning * into v;
  perform private.audit(v.group_id, 'loan.purpose', 'loans', v.id, jsonb_build_object('purpose', p_purpose));
  return v;
end $$;
revoke execute on function public.set_loan_purpose(uuid, text) from public, anon, authenticated;
grant execute on function public.set_loan_purpose(uuid, text) to authenticated;

-- What the group lends for: totals only, so every member may read them (like group_statements).
create or replace function public.lending_by_purpose(p_cycle uuid)
returns table (purpose text, loans int, principal numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_c cycles;
begin
  select * into v_c from cycles where id = p_cycle;
  if not found or not is_member(v_c.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
    select coalesce(l.purpose, 'unspecified'), count(*)::int, sum(l.principal)
      from loans l join periods p on p.id = l.period_id
     where p.cycle_id = p_cycle
     group by coalesce(l.purpose, 'unspecified')
     order by sum(l.principal) desc;
end $$;
revoke execute on function public.lending_by_purpose(uuid) from public, anon, authenticated;
grant execute on function public.lending_by_purpose(uuid) to authenticated;

-- 4. Spending from the pots -----------------------------------------------------------------------------
-- The membership fee is a meeting-hosting pot; members' transfer fees are the fee pot. Spending is recorded, never edited:
-- a mistake is corrected by recording the opposite amount (a negative amount is a refund into the pot).
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  cycle_id uuid not null references public.cycles on delete cascade,
  pot text not null check (pot in ('hosting', 'fees')),
  amount numeric(12, 2) not null check (amount <> 0),
  spent_on date not null,
  note text not null check (length(trim(note)) between 1 and 200),
  created_by uuid references auth.users on delete set null
);
create index expenses_cycle_idx on public.expenses (cycle_id);
alter table public.expenses enable row level security;
revoke all on public.expenses from public, anon, authenticated;
grant select on public.expenses to authenticated;
create policy expenses_select on public.expenses for select to authenticated using (public.is_member(group_id));
create trigger expenses_append_only before update or delete on public.expenses
  for each row execute function public.ledger_append_only();
create trigger expenses_truncate_guard before truncate on public.expenses
  for each statement execute function public.ledger_truncate_guard();

create or replace function public.record_expense(p_cycle uuid, p_pot text, p_amount numeric, p_spent_on date, p_note text)
returns public.expenses
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_c cycles; v expenses;
begin
  select * into v_c from cycles where id = p_cycle;
  if not found or not is_admin(v_c.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_pot is null or p_pot not in ('hosting', 'fees') then raise exception 'invalid_pot' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 9999999999.99 or p_amount <> round(p_amount, 2) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if p_spent_on is null then raise exception 'invalid_date' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p_note, ''))) not between 1 and 200 then raise exception 'invalid_note' using errcode = 'P0001'; end if;
  insert into expenses (group_id, cycle_id, pot, amount, spent_on, note, created_by)
  values (v_c.group_id, p_cycle, p_pot, p_amount, p_spent_on, trim(p_note), auth.uid()) returning * into v;
  perform private.audit(v.group_id, 'expense.recorded', 'expenses', v.id, jsonb_build_object('pot', p_pot, 'amount', p_amount, 'note', trim(p_note)));
  return v;
end $$;
revoke execute on function public.record_expense(uuid, text, numeric, date, text) from public, anon, authenticated;
grant execute on function public.record_expense(uuid, text, numeric, date, text) to authenticated;

-- Where each pot stands. Group totals, so every member may read them (the constitution has members review the books monthly).
create or replace function public.pot_balances(p_cycle uuid)
returns table (pot text, collected numeric, spent numeric, remaining numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_c cycles;
begin
  select * into v_c from cycles where id = p_cycle;
  if not found or not is_member(v_c.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
    with hosting as (
      select coalesce(sum(l.amount) filter (where l.kind = 'membership'), 0) as collected,
             coalesce((select sum(e.amount) from expenses e where e.cycle_id = p_cycle and e.pot = 'hosting'), 0) as spent
        from private.ledger_lines l where l.cycle_id = p_cycle
    ), fees as (
      select coalesce(sum(l.amount) filter (where l.kind = 'txn_fee'), 0) as collected,
             coalesce(sum(l.amount) filter (where l.kind = 'payout_fee'), 0)
               + coalesce((select sum(e.amount) from expenses e where e.cycle_id = p_cycle and e.pot = 'fees'), 0) as spent
        from private.ledger_lines l where l.cycle_id = p_cycle
    )
    select 'hosting', h.collected, h.spent, h.collected - h.spent from hosting h
    union all
    select 'fees', f.collected, f.spent, f.collected - f.spent from fees f;
end $$;
revoke execute on function public.pot_balances(uuid) from public, anon, authenticated;
grant execute on function public.pot_balances(uuid) to authenticated;

-- 1 and 4. Payout preview -------------------------------------------------------------------------------
-- Same columns as before. Changes:
--   * a member in default gets only their savings (less what they owe): interest_earned is 0 and the interest they had
--     earned is shared among the members not in default, by savings (the remainder to the largest of them);
--   * what is left in the pots after expenses is shared by savings among every member, defaulters included (the remainder
--     to the largest saver); with no savings anywhere it falls back to an equal share.
create or replace function public.payout_preview(p_cycle uuid)
returns table (member_id uuid, short_name text, savings numeric, interest_earned numeric, owed numeric, pot_share numeric, payout numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare v_c cycles; v_period uuid; v_pots numeric;
begin
  select * into v_c from cycles where id = p_cycle;
  if not found or not is_member(v_c.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  -- The month holding the latest figures: the open one, else the last closed one.
  select p.id into v_period from periods p
   where p.cycle_id = p_cycle and p.status <> 'planned'
   order by (p.status = 'open') desc, p.month_index desc
   limit 1;
  -- What is left in the fee pot and the hosting pot after the fees paid out and the recorded expenses.
  select coalesce(sum(case when l.kind = 'payout_fee' then -l.amount else l.amount end), 0) into v_pots
    from private.ledger_lines l
   where l.cycle_id = p_cycle and l.kind in ('txn_fee', 'payout_fee', 'membership');
  v_pots := v_pots - coalesce((select sum(e.amount) from expenses e where e.cycle_id = p_cycle), 0);

  return query
  with mem as (
    select m.id, m.short_name, coalesce(ms.defaulted, false) as defaulted
    from members m
    left join member_status ms on ms.member_id = m.id and ms.cycle_id = p_cycle
    where m.group_id = v_c.group_id
      and (m.status = 'active' or exists (select 1 from private.ledger_lines x where x.member_id = m.id and x.cycle_id = p_cycle))
  ),
  fig as (
    select mem.id, mem.short_name, mem.defaulted,
      coalesce((select sum(l.amount) from private.ledger_lines l
                where l.cycle_id = p_cycle and l.member_id = mem.id and l.kind = 'saving'), 0) as savings,
      coalesce((select sum(l.amount) from private.ledger_lines l
                where l.cycle_id = p_cycle and l.member_id = mem.id and l.kind = 'interest_share'), 0) as interest,
      case when v_period is null then 0 else private.member_balance(mem.id, v_period) end as owed
    from mem
  ),
  tot as (
    select sum(f.savings) as all_sav,
           sum(f.savings) filter (where not f.defaulted) as live_sav,
           coalesce(sum(f.interest) filter (where f.defaulted), 0) as forfeited,
           count(*) as n
    from fig f
  ),
  ranked as (
    select f.*,
           row_number() over (order by f.savings desc, f.short_name) as rn_all,
           row_number() over (partition by f.defaulted order by f.savings desc, f.short_name) as rn_def
    from fig f
  ),
  parts as (
    select r.*,
           case when not r.defaulted and coalesce(t.live_sav, 0) > 0 then trunc(t.forfeited * r.savings / t.live_sav, 2) else 0 end as extra,
           case when coalesce(t.all_sav, 0) > 0 then trunc(v_pots * r.savings / t.all_sav, 2) else trunc(v_pots / t.n, 2) end as pot0,
           t.forfeited, t.live_sav
    from ranked r cross join tot t
  ),
  fin as (
    select p.id, p.short_name, p.savings, p.owed,
           case when p.defaulted then 0
                else p.interest + p.extra
                     + case when p.rn_def = 1 and coalesce(p.live_sav, 0) > 0 then p.forfeited - sum(p.extra) over () else 0 end
           end as interest_earned,
           p.pot0 + case when p.rn_all = 1 then v_pots - sum(p.pot0) over () else 0 end as pot_share
    from parts p
  )
  select f.id, f.short_name, f.savings, f.interest_earned, f.owed, f.pot_share,
         f.savings + f.interest_earned - f.owed + f.pot_share
  from fin f
  where can_see_figures(v_c.group_id, f.id)
  order by f.short_name;
end $$;
