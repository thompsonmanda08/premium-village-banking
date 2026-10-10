-- Ledger hardening: TRUNCATE guards, service_role write revoke, FK tightening, null-kind check,
-- cycle_rules finite checks, concurrency fixes, business guards. See hardening-report.md.

-- ============================================================
-- 1. TRUNCATE guard
-- ============================================================
-- Per-row triggers cannot fire for TRUNCATE; add a statement-level trigger function.
create or replace function public.ledger_truncate_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'append_only' using errcode = 'P0001';
end $$;
revoke execute on function public.ledger_truncate_guard() from public, anon, authenticated;

create trigger entries_truncate_guard before truncate on public.entries
  for each statement execute function public.ledger_truncate_guard();
create trigger statements_truncate_guard before truncate on public.statements
  for each statement execute function public.ledger_truncate_guard();
create trigger group_statements_truncate_guard before truncate on public.group_statements
  for each statement execute function public.ledger_truncate_guard();
create trigger workbook_figures_truncate_guard before truncate on public.workbook_figures
  for each statement execute function public.ledger_truncate_guard();

-- service_role currently inherits postgres ALL on public tables; revoke writes on ledger tables.
-- postgres (the owner / import role) keeps everything; app roles never had write access.
revoke insert, update, delete, truncate on
  public.wallets, public.periods, public.declarations, public.loans, public.loan_instalments,
  public.entries, public.statements, public.group_statements, public.workbook_figures, public.member_status
  from service_role;

-- ============================================================
-- 2. entries.created_by and member_status.changed_by: NO ACTION
-- ============================================================
alter table public.entries drop constraint if exists entries_created_by_fkey;
alter table public.entries add constraint entries_created_by_fkey
  foreign key (created_by) references auth.users on delete no action;

alter table public.member_status drop constraint if exists member_status_changed_by_fkey;
alter table public.member_status add constraint member_status_changed_by_fkey
  foreign key (changed_by) references auth.users on delete no action;

-- ============================================================
-- 3. Group-scoped composite FKs for corrects_entry_id and supersedes_id
-- ============================================================
-- entries does not have unique(id, group_id) yet; add it so the FK target can be composite.
alter table public.entries add constraint entries_id_group_key unique (id, group_id);

alter table public.entries drop constraint if exists entries_corrects_entry_id_fkey;
alter table public.entries add constraint entries_corrects_entry_id_group_fkey
  foreign key (corrects_entry_id, group_id) references public.entries(id, group_id);

-- declarations already has unique(id, group_id) from 0700; add supersedes_id composite FK.
alter table public.declarations drop constraint if exists declarations_supersedes_id_fkey;
alter table public.declarations add constraint declarations_supersedes_id_group_fkey
  foreign key (supersedes_id, group_id) references public.declarations(id, group_id);

-- ============================================================
-- 4. entries.member_id null kind check
-- ============================================================
-- Only payout_fee may have a null member_id; a declaration row always has a member.
alter table public.entries add constraint entries_member_id_kind_check
  check (member_id is not null or kind = 'payout_fee');
alter table public.entries add constraint entries_declaration_needs_member
  check (declaration_id is null or member_id is not null);

-- ============================================================
-- 5. cycle_rules finite checks
-- ============================================================
-- NaN passes >= 0 (it sorts above every finite number); add explicit finiteness guards.
-- existing data already passes these (no NaN/huge values inserted).
alter table public.cycle_rules add constraint cycle_rules_min_saving_finite
  check (min_saving <> 'NaN'::numeric and min_saving < 10000000000);
alter table public.cycle_rules add constraint cycle_rules_penalty_per_day_finite
  check (penalty_per_day <> 'NaN'::numeric and penalty_per_day < 10000000000);
alter table public.cycle_rules add constraint cycle_rules_membership_fee_finite
  check (membership_fee <> 'NaN'::numeric and membership_fee < 10000000000);
alter table public.cycle_rules add constraint cycle_rules_loan_rate_finite
  check (loan_rate <> 'NaN'::numeric);
alter table public.cycle_rules add constraint cycle_rules_excess_rate_finite
  check (excess_rate <> 'NaN'::numeric);

-- ============================================================
-- 6a. submit_declaration: period FOR SHARE (lock period before member row)
-- ============================================================
create or replace function public.submit_declaration(
  p_period uuid, p_member uuid, p_saving numeric default 0, p_loan_repayment numeric default 0,
  p_excess numeric default 0, p_membership numeric default 0, p_penalty numeric default 0,
  p_txn_fee numeric default 0, p_borrowing_request numeric default 0, p_wallet uuid default null, p_note text default null)
returns public.declarations
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_m members;
  v_p periods;
  v_old uuid;
  v_sent numeric;
  v declarations;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  -- A member declares for themselves; the treasurer may type in any member's (WhatsApp) declaration.
  -- Anyone else learns nothing, not even whether the member exists.
  select * into v_m from members where id = p_member;
  if not found or not ((v_m.user_id = v_uid and v_m.status = 'active') or is_admin(v_m.group_id)) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  -- Take a shared lock on the period first (before the member row) to avoid deadlocks with close_month
  -- and to race against a commit: submit waits for the close, then sees it as closed.
  select * into v_p from periods where id = p_period and group_id = v_m.group_id for share;
  if not found or v_p.status <> 'open' then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(array[p_saving, p_loan_repayment, p_excess, p_membership, p_penalty, p_txn_fee,
                                        p_borrowing_request]) as a
             where a is null or not (a >= 0 and a <= 9999999999.99) or a <> round(a, 2)) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  -- NaN fails the range test (it sorts above every number) and so does Infinity; numeric(12,2) holds up to 9999999999.99.
  if length(trim(coalesce(p_note, ''))) > 500 then raise exception 'invalid_note' using errcode = 'P0001'; end if;
  v_sent := p_saving + p_loan_repayment + p_excess + p_membership + p_penalty + p_txn_fee;
  if v_sent = 0 and p_borrowing_request = 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;
  if (v_sent > 0 or p_wallet is not null)
     and not exists (select 1 from wallets w where w.id = p_wallet and w.group_id = v_m.group_id and w.active) then
    raise exception 'wallet_not_found' using errcode = 'P0001';
  end if;

  -- Serialise submits for one member (a double tap, two devices): the second waits, then sees the first as the live one.
  perform 1 from members where id = p_member for no key update;

  -- A resubmission replaces the member's waiting or returned declaration. An approved one stays; a new one stands beside it.
  select d.id into v_old from declarations d
   where d.period_id = p_period and d.member_id = p_member and d.status in ('submitted', 'returned')
     and not exists (select 1 from declarations n where n.supersedes_id = d.id)
   order by d.submitted_at desc
   limit 1
   for update;

  insert into declarations (group_id, period_id, member_id, saving, loan_repayment, excess, membership, penalty, txn_fee,
    borrowing_request, wallet_id, note, submitted_by, supersedes_id)
  values (v_m.group_id, p_period, p_member, p_saving, p_loan_repayment, p_excess, p_membership, p_penalty, p_txn_fee,
    p_borrowing_request, p_wallet, nullif(trim(p_note), ''), v_uid, v_old)
  returning * into v;
  perform private.audit(v.group_id, 'declaration.submitted', 'declarations', v.id,
    jsonb_build_object('period_id', v.period_id, 'member_id', v.member_id));
  return v;
end $$;

-- ============================================================
-- 6b. close_month: admin check before FOR UPDATE lock
-- ============================================================
create or replace function public.close_month(p_period uuid, p_commit boolean default false, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_p periods; v jsonb; v_diff jsonb; v_unexplained int; v_group_id uuid;
begin
  -- On the commit path: do a plain read first to get the group_id for the admin check, THEN lock.
  -- This avoids holding FOR UPDATE while waiting on is_admin(), and keeps non-commit path as a plain SELECT.
  if p_commit then
    select group_id into v_group_id from periods where id = p_period;
    if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
    if not is_admin(v_group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
    select * into v_p from periods where id = p_period for update;
  else
    select * into v_p from periods where id = p_period;
    if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
    if not is_admin(v_p.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  end if;
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

-- ============================================================
-- 6c. open_period: group row lock before previous_period_open check
-- ============================================================
create or replace function public.open_period(p_cycle uuid, p_month_index int, p_deadline date default null)
returns public.periods
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_c cycles; v periods;
begin
  select * into v_c from cycles where id = p_cycle;
  if not found or not is_admin(v_c.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  perform private.ensure_periods(p_cycle);
  -- Lock the group row so concurrent open_period calls serialise and give previous_period_open
  -- instead of a raw unique-index 23505 violation.
  perform 1 from groups where id = v_c.group_id for no key update;
  select * into v from periods where cycle_id = p_cycle and month_index = p_month_index for update;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if v.status <> 'planned' then raise exception 'already_opened' using errcode = 'P0001'; end if;
  if exists (select 1 from periods where cycle_id = p_cycle and month_index < p_month_index and status <> 'closed')
     or exists (select 1 from periods where group_id = v.group_id and status in ('open', 'closing')) then
    raise exception 'previous_period_open' using errcode = 'P0001';
  end if;
  if p_deadline is not null and p_deadline < v.starts_on then raise exception 'invalid_date' using errcode = 'P0001'; end if;

  update periods set status = 'open', deadline = coalesce(p_deadline, deadline) where id = v.id returning * into v;
  perform private.audit(v.group_id, 'period.opened', 'periods', v.id, jsonb_build_object('label', v.label, 'deadline', v.deadline));
  return v;
end $$;

-- ============================================================
-- 6d. set_default: previous-flag read under FOR UPDATE row lock
-- ============================================================
create or replace function public.set_default(p_member uuid, p_cycle uuid, p_defaulted boolean, p_reason text)
returns public.member_status
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_m members; v member_status; v_prev boolean;
begin
  select * into v_m from members where id = p_member;
  if not found then raise exception 'member_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v_m.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if not exists (select 1 from cycles c where c.id = p_cycle and c.group_id = v_m.group_id) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  if p_defaulted is null or coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
  if length(trim(p_reason)) > 500 then raise exception 'invalid_note' using errcode = 'P0001'; end if;

  -- Read the previous flag under a row lock so two concurrent calls give a clean upsert and the audit 'from' is accurate.
  select coalesce(defaulted, false) into v_prev from member_status
   where member_id = p_member and cycle_id = p_cycle for update;
  v_prev := coalesce(v_prev, false);
  insert into member_status (group_id, member_id, cycle_id, defaulted, changed_by, reason)
  values (v_m.group_id, p_member, p_cycle, p_defaulted, auth.uid(), trim(p_reason))
  on conflict (member_id, cycle_id) do update
    set defaulted = excluded.defaulted, changed_at = now(), changed_by = excluded.changed_by, reason = excluded.reason
  returning * into v;
  perform private.audit(v_m.group_id, 'member.default_changed', 'members', p_member,
    jsonb_build_object('cycle_id', p_cycle, 'from', v_prev, 'defaulted', p_defaulted, 'reason', trim(p_reason)));
  return v;
end $$;

-- ============================================================
-- 7a. schedule_loan: instalment-count guard
-- ============================================================
create or replace function private.schedule_loan(p_period uuid, p_member uuid, p_principal numeric, p_interest numeric,
  p_wallet uuid, p_sent_at timestamptz)
returns public.loans language plpgsql set search_path = public, pg_temp as $$
declare v_p periods; v_term int; v loans; v_total numeric; v_each numeric; v_count int;
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

  get diagnostics v_count = row_count;
  if v_count <> v_term then
    raise exception 'period_not_open' using errcode = 'P0001',
      detail = format('Expected %s instalments, wrote %s', v_term, v_count);
  end if;
  return v;
end $$;

-- ============================================================
-- 7b. send_loan: arrears warning counts payments received this month
-- ============================================================
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
  v_paid_this_month numeric;
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
  -- Arrears: previous month's minimum minus payments received so far THIS month.
  -- A member has cleared arrears if they already paid this month even before the close.
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

-- ============================================================
-- 7c. post_correction: left-member guard for penalty increases
-- ============================================================
create or replace function public.post_correction(p_entry uuid, p_new_amount numeric, p_reason text)
returns public.entries
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_e entries; v_open periods; v_eff numeric; v_delta numeric; v entries; v_m_status text;
begin
  select * into v_e from entries where id = p_entry;
  if not found then raise exception 'entry_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v_e.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  -- Only amounts the ledger alone decides can be corrected. Loans (principal, interest, schedule) and interest shares
  -- have their own writers; their interest is waived through post_waiver, and a correction is never corrected.
  if v_e.source = 'correction' or v_e.kind not in
     ('saving', 'payment', 'membership', 'txn_fee', 'penalty', 'excess_charge', 'payout_fee') then
    raise exception 'entry_not_found' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
  if length(trim(p_reason)) > 500 then raise exception 'invalid_note' using errcode = 'P0001'; end if;
  if p_new_amount is null or not (p_new_amount >= 0 and p_new_amount <= 9999999999.99) or p_new_amount <> round(p_new_amount, 2) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  select p.* into v_open from periods p join periods o on o.cycle_id = p.cycle_id
   where o.id = v_e.period_id and p.status = 'open' for update of p;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;

  select v_e.amount + coalesce(sum(case when c.kind in ('waiver', 'adjustment') then -c.amount else c.amount end), 0)
    into v_eff from entries c where c.corrects_entry_id = v_e.id;
  v_delta := p_new_amount - v_eff;
  if v_delta = 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;

  -- A correction that increases a penalty (positive delta) is refused for a member who has left.
  if v_e.kind = 'penalty' and v_delta > 0 then
    select status into v_m_status from members where id = v_e.member_id;
    if v_m_status is distinct from 'active' then
      raise exception 'member_not_active' using errcode = 'P0001';
    end if;
  end if;

  insert into entries (group_id, period_id, member_id, kind, amount, loan_id, wallet_id, source, corrects_entry_id, reason, created_by)
  values (v_e.group_id, v_open.id, v_e.member_id, case when v_delta > 0 then v_e.kind else 'adjustment' end,
          abs(v_delta), v_e.loan_id, v_e.wallet_id, 'correction', v_e.id, trim(p_reason), auth.uid())
  returning * into v;
  perform private.audit(v_e.group_id, 'entry.corrected', 'entries', v_e.id, jsonb_build_object(
    'kind', v_e.kind, 'from', v_eff, 'to', p_new_amount, 'reason', trim(p_reason), 'correction_id', v.id));
  return v;
end $$;

-- ============================================================
-- Re-apply grants
-- ============================================================
revoke execute on function
  public.submit_declaration(uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, uuid, text),
  public.return_declaration(uuid, text), public.approve_declaration(uuid)
  from public, anon, authenticated;
grant execute on function
  public.submit_declaration(uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, uuid, text),
  public.return_declaration(uuid, text), public.approve_declaration(uuid)
  to authenticated;

revoke execute on function public.close_month(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.close_month(uuid, boolean, text) to authenticated;

revoke execute on function public.open_period(uuid, int, date), public.set_deadline(uuid, date, text) from public, anon, authenticated;
grant execute on function public.open_period(uuid, int, date), public.set_deadline(uuid, date, text) to authenticated;

revoke execute on function
  public.apply_penalty(uuid, uuid, numeric, text, text), public.suggest_penalties(uuid),
  public.set_default(uuid, uuid, boolean, text), public.post_correction(uuid, numeric, text),
  public.post_waiver(uuid, numeric, text)
  from public, anon, authenticated;
grant execute on function
  public.apply_penalty(uuid, uuid, numeric, text, text), public.suggest_penalties(uuid),
  public.set_default(uuid, uuid, boolean, text), public.post_correction(uuid, numeric, text),
  public.post_waiver(uuid, numeric, text)
  to authenticated;

revoke execute on function public.send_loan(uuid, numeric, uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.send_loan(uuid, numeric, uuid, text, numeric) to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
