-- Months of a cycle, the shared audit helper and the effective-amount view every ledger function reads.

-- Audit rows for ledger actions (the Foundation's write_audit trigger covers only its own tables).
create or replace function private.audit(p_group uuid, p_action text, p_entity text, p_id uuid, p_data jsonb)
returns void language sql set search_path = public, pg_temp as $$
  insert into public.audit_log (group_id, actor_user_id, action, entity, entity_id, data)
  values (p_group, auth.uid(), p_action, p_entity, p_id, coalesce(p_data, '{}'::jsonb));
$$;

-- One line per entry with its effective sign: waivers and adjustments count against the kind they correct.
-- Corrections always point at the original entry, so one join is enough.
create view private.ledger_lines as
  select e.id, e.group_id, p.cycle_id, p.month_index, e.period_id, e.member_id, e.loan_id, e.source,
         coalesce(r.kind, e.kind) as kind,
         case when e.kind in ('waiver', 'adjustment') then -e.amount else e.amount end as amount
  from public.entries e
  join public.periods p on p.id = e.period_id
  left join public.entries r on r.id = e.corrects_entry_id and e.kind in ('waiver', 'adjustment');
revoke all on private.ledger_lines from public, anon, authenticated;

-- The cycle's twelve months: Feb … Jan for a cycle starting in February. Idempotent.
create or replace function private.ensure_periods(p_cycle uuid) returns void
language sql set search_path = public, pg_temp as $$
  insert into public.periods (group_id, cycle_id, month_index, label, starts_on, deadline)
  select c.group_id, c.id, i, to_char(x.m, 'Mon YYYY'), x.m, x.m + (coalesce(r.window_close_day, 7) - 1)
  from public.cycles c
  left join public.cycle_rules r on r.cycle_id = c.id
  cross join generate_series(1, 12) as i
  cross join lateral (select (date_trunc('month', c.starts_on) + (i - 1) * interval '1 month')::date as m) x
  where c.id = p_cycle
  on conflict (cycle_id, month_index) do nothing;
$$;

create or replace function public.open_period(p_cycle uuid, p_month_index int, p_deadline date default null)
returns public.periods
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_c cycles; v periods;
begin
  select * into v_c from cycles where id = p_cycle;
  if not found or not is_admin(v_c.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  perform private.ensure_periods(p_cycle);
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

create or replace function public.set_deadline(p_period uuid, p_deadline date, p_reason text)
returns public.periods
language plpgsql security definer set search_path = public, pg_temp as $$
declare v periods; v_old date;
begin
  select * into v from periods where id = p_period for update;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if not is_admin(v.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if v.status not in ('planned', 'open') then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
  if p_deadline is null or p_deadline < v.starts_on then raise exception 'invalid_date' using errcode = 'P0001'; end if;

  v_old := v.deadline;
  update periods set deadline = p_deadline where id = v.id returning * into v;
  perform private.audit(v.group_id, 'period.deadline_changed', 'periods', v.id,
    jsonb_build_object('label', v.label, 'from', v_old, 'to', p_deadline, 'reason', trim(p_reason)));
  return v;
end $$;

revoke execute on function public.open_period(uuid, int, date), public.set_deadline(uuid, date, text) from public, anon, authenticated;
grant execute on function public.open_period(uuid, int, date), public.set_deadline(uuid, date, text) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
