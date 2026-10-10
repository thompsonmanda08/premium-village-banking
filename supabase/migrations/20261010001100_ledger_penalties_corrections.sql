-- Penalties (suggested, then applied or not), default flags, and append-only corrections and waivers.
-- Money parameters are range-tested rather than compared: NaN and Infinity sort above every number, so the test refuses
-- them, and 9999999999.99 is the largest amount the numeric(12,2) columns hold.

create or replace function public.apply_penalty(p_member uuid, p_period uuid, p_amount numeric, p_ground text, p_reason text)
returns public.entries
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_m members; v_p periods; v entries;
begin
  select * into v_m from members where id = p_member;
  if not found then raise exception 'member_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v_m.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if v_m.status <> 'active' then raise exception 'member_not_active' using errcode = 'P0001'; end if;
  -- The ground is the first half of the reason: without a known ground and a written reason there is no penalty.
  if p_ground is null or p_ground not in ('late_declaration', 'missed_minimum', 'under_saving', 'other')
     or coalesce(trim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if length(trim(p_reason)) > 500 then raise exception 'invalid_note' using errcode = 'P0001'; end if;
  if p_amount is null or not (p_amount > 0 and p_amount <= 9999999999.99) or p_amount <> round(p_amount, 2) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  -- Lock the month (never the member row: submit_declaration takes the member first), then write.
  select * into v_p from periods where id = p_period and group_id = v_m.group_id for update;
  if not found or v_p.status <> 'open' then raise exception 'period_not_open' using errcode = 'P0001'; end if;

  insert into entries (group_id, period_id, member_id, kind, amount, source, reason, created_by)
  values (v_m.group_id, p_period, p_member, 'penalty', p_amount, 'app', p_ground || ': ' || trim(p_reason), auth.uid())
  returning * into v;
  perform private.audit(v_m.group_id, 'penalty.applied', 'entries', v.id,
    jsonb_build_object('member_id', p_member, 'amount', p_amount, 'ground', p_ground, 'reason', trim(p_reason)));
  return v;
end $$;

-- Read-only: nothing is written; the treasurer applies a suggestion through apply_penalty, or does not.
create or replace function public.suggest_penalties(p_period uuid)
returns table (member_id uuid, short_name text, ground text, amount numeric, detail text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_p periods;
  v_r cycle_rules;
  v_today date := (now() at time zone 'Africa/Lusaka')::date;
begin
  select * into v_p from periods where id = p_period;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if not is_admin(v_p.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  -- Corrections of an earlier month that land in this month's lines say nothing about this month's saving or payments,
  -- so they are left out below (a correction of this month's own entry still counts).
  -- Days "so far" only mean something while the month is open.
  if v_p.status <> 'open' then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  select * into v_r from cycle_rules where cycle_id = v_p.cycle_id;

  return query
  with mem as (
    select m.id, m.short_name from members m where m.group_id = v_p.group_id and m.status = 'active'
  ),
  late as (
    select mem.id, mem.short_name,
           exists (select 1 from declarations d where d.period_id = p_period and d.member_id = mem.id) as declared,
           coalesce((select min((d.submitted_at at time zone 'Africa/Lusaka')::date) from declarations d
                     where d.period_id = p_period and d.member_id = mem.id), v_today) - v_p.deadline as days
    from mem
  ),
  paid as (
    select mem.id, mem.short_name,
           coalesce((select sum(l.amount) from private.ledger_lines l
                     where l.period_id = p_period and l.member_id = mem.id and l.kind = 'saving'
                       and not exists (select 1 from entries c join entries r on r.id = c.corrects_entry_id
                                       where c.id = l.id and r.period_id <> c.period_id)), 0) as saving,
           coalesce((select sum(l.amount) from private.ledger_lines l
                     where l.period_id = p_period and l.member_id = mem.id and l.kind = 'payment'
                       and not exists (select 1 from entries c join entries r on r.id = c.corrects_entry_id
                                       where c.id = l.id and r.period_id <> c.period_id)), 0) as payment,
           coalesce((select s.next_minimum from periods prev join statements s on s.period_id = prev.id and s.member_id = mem.id
                     where prev.cycle_id = v_p.cycle_id and prev.month_index = v_p.month_index - 1), 0) as minimum
    from mem
  )
  select l.id, l.short_name, 'late_declaration'::text, (l.days * v_r.penalty_per_day)::numeric,
         case when l.declared then format('Declared %s days after the deadline', l.days)
              else format('Not declared, %s days after the deadline', l.days) end
  from late l where l.days > 0
  union all
  select p.id, p.short_name, 'under_saving'::text, v_r.penalty_per_day,
         format('Saved K%s of the K%s minimum', p.saving, v_r.min_saving)
  from paid p where v_today > v_p.deadline and p.saving < v_r.min_saving
  union all
  select p.id, p.short_name, 'missed_minimum'::text, v_r.penalty_per_day,
         format('Paid K%s of the K%s minimum', p.payment, p.minimum)
  from paid p where v_today > v_p.deadline and p.payment < p.minimum
  order by 2, 3;
end $$;

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

  select coalesce(defaulted, false) into v_prev from member_status where member_id = p_member and cycle_id = p_cycle;
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

-- Corrections and waivers target an original entry (never another correction), land in the cycle's open month and
-- point back at it, so closed months are never rewritten and balances fix forward. The effective amount of an original is
-- its amount plus the later increases less the waivers and adjustments. Locking the open month first serialises
-- corrections of one cycle (the effective amount is read under the lock) and makes them wait for a close in progress.
create or replace function public.post_correction(p_entry uuid, p_new_amount numeric, p_reason text)
returns public.entries
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_e entries; v_open periods; v_eff numeric; v_delta numeric; v entries;
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

  insert into entries (group_id, period_id, member_id, kind, amount, loan_id, wallet_id, source, corrects_entry_id, reason, created_by)
  values (v_e.group_id, v_open.id, v_e.member_id, case when v_delta > 0 then v_e.kind else 'adjustment' end,
          abs(v_delta), v_e.loan_id, v_e.wallet_id, 'correction', v_e.id, trim(p_reason), auth.uid())
  returning * into v;
  perform private.audit(v_e.group_id, 'entry.corrected', 'entries', v_e.id, jsonb_build_object(
    'kind', v_e.kind, 'from', v_eff, 'to', p_new_amount, 'reason', trim(p_reason), 'correction_id', v.id));
  return v;
end $$;

create or replace function public.post_waiver(p_entry uuid, p_amount numeric, p_reason text)
returns public.entries
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_e entries; v_open periods; v_eff numeric; v entries;
begin
  select * into v_e from entries where id = p_entry;
  if not found then raise exception 'entry_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v_e.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if v_e.source = 'correction' or v_e.kind not in ('loan_interest', 'excess_charge', 'penalty') then
    raise exception 'entry_not_found' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
  if length(trim(p_reason)) > 500 then raise exception 'invalid_note' using errcode = 'P0001'; end if;
  if p_amount is null or not (p_amount > 0 and p_amount <= 9999999999.99) or p_amount <> round(p_amount, 2) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  select p.* into v_open from periods p join periods o on o.cycle_id = p.cycle_id
   where o.id = v_e.period_id and p.status = 'open' for update of p;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;

  select v_e.amount + coalesce(sum(case when c.kind in ('waiver', 'adjustment') then -c.amount else c.amount end), 0)
    into v_eff from entries c where c.corrects_entry_id = v_e.id;
  if p_amount > v_eff then raise exception 'invalid_amount' using errcode = 'P0001'; end if;

  insert into entries (group_id, period_id, member_id, kind, amount, loan_id, source, corrects_entry_id, reason, created_by)
  values (v_e.group_id, v_open.id, v_e.member_id, 'waiver', p_amount, v_e.loan_id, 'correction', v_e.id,
          trim(p_reason), auth.uid())
  returning * into v;
  perform private.audit(v_e.group_id, 'entry.corrected', 'entries', v_e.id, jsonb_build_object(
    'kind', v_e.kind, 'waived', p_amount, 'from', v_eff, 'to', v_eff - p_amount, 'reason', trim(p_reason), 'correction_id', v.id));
  return v;
end $$;

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
