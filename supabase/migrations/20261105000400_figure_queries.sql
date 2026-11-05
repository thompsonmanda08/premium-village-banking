-- A member's question about one of their own figures in a closed month, and the treasurer's answer, on the record.
-- Private to the member and the admins. Written only through raise_query and answer_query; an answer is never edited.

create table public.figure_queries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  period_id uuid not null,
  member_id uuid not null,
  field text not null check (field in ('cum_savings', 'closing_owed', 'next_minimum', 'excess_charged',
                                       'interest_earned_to_date', 'paid_total')),
  note text not null check (length(trim(note)) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'answered')),
  reply text check (length(trim(reply)) between 1 and 500),
  answered_by uuid references auth.users,
  answered_at timestamptz,
  check ((status = 'answered') = (reply is not null and answered_at is not null)),
  check (status <> 'answered' or answered_by is not null),
  foreign key (period_id, group_id) references public.periods (id, group_id) on delete cascade,
  foreign key (member_id, group_id) references public.members (id, group_id) on delete cascade
);
create index figure_queries_member_idx on public.figure_queries (member_id, status);
create index figure_queries_group_idx on public.figure_queries (group_id, status, created_at);

-- On the record for every role, the owner included: never deleted, and the only change is open to answered,
-- which fills in the answer and touches nothing the member wrote.
create or replace function public.figure_queries_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if TG_OP = 'UPDATE' and OLD.status = 'open' and NEW.status = 'answered'
     and to_jsonb(NEW) - array['status', 'reply', 'answered_by', 'answered_at']
       = to_jsonb(OLD) - array['status', 'reply', 'answered_by', 'answered_at'] then
    return NEW;
  end if;
  raise exception 'append_only' using errcode = 'P0001';
end $$;
revoke execute on function public.figure_queries_guard() from public, anon, authenticated;
create trigger figure_queries_guard before update or delete on public.figure_queries
  for each row execute function public.figure_queries_guard();
create trigger figure_queries_truncate_guard before truncate on public.figure_queries
  for each statement execute function public.ledger_truncate_guard();

alter table public.figure_queries enable row level security;
revoke all on public.figure_queries from public, anon, authenticated;
revoke insert, update, delete, truncate on public.figure_queries from service_role;
grant select on public.figure_queries to authenticated;
create policy figure_queries_select on public.figure_queries for select to authenticated using (
  public.is_admin(group_id)
  or exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()));

create or replace function public.raise_query(p_period uuid, p_field text, p_note text)
returns public.figure_queries
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_p periods; v_m members; v figure_queries;
begin
  -- Always the caller's own active member row: a member cannot name anyone else. Unknown months answer the same.
  select * into v_p from periods where id = p_period;
  if found then
    select * into v_m from members where group_id = v_p.group_id and user_id = auth.uid() and status = 'active';
  end if;
  if v_m.id is null then raise exception 'not_admin' using errcode = '42501'; end if;
  if v_p.status <> 'closed' then raise exception 'period_not_closed' using errcode = 'P0001'; end if;
  if p_field is null or p_field not in ('cum_savings', 'closing_owed', 'next_minimum', 'excess_charged',
                                         'interest_earned_to_date', 'paid_total') then
    raise exception 'invalid_field' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_note, ''))) not between 1 and 500 then raise exception 'invalid_note' using errcode = 'P0001'; end if;

  -- Serialise raises for one member (a double tap, two devices) so the cap of three open queries holds.
  perform 1 from members where id = v_m.id and status = 'active' for no key update;
  if not found then raise exception 'not_admin' using errcode = '42501'; end if;
  if (select count(*) from figure_queries where member_id = v_m.id and status = 'open') >= 3 then
    raise exception 'too_many_queries' using errcode = 'P0001';
  end if;

  insert into figure_queries (group_id, period_id, member_id, field, note)
  values (v_p.group_id, p_period, v_m.id, p_field, trim(p_note))
  returning * into v;
  -- The note is the member's own words; the audit log keeps only what the query is about.
  perform private.audit(v_p.group_id, 'query.raised', 'figure_queries', v.id,
    jsonb_build_object('query_id', v.id, 'field', p_field, 'period_id', p_period));
  return v;
end $$;
revoke execute on function public.raise_query(uuid, text, text) from public, anon;
grant execute on function public.raise_query(uuid, text, text) to authenticated;

create or replace function public.answer_query(p_query uuid, p_reply text)
returns public.figure_queries
language plpgsql security definer set search_path = public, pg_temp as $$
declare v figure_queries;
begin
  -- Check the caller with a plain read first, so someone who may not answer never holds the row lock.
  select * into v from figure_queries where id = p_query;
  if not found or not is_admin(v.group_id) then
    -- Someone who admins no group learns nothing; an admin is told the query is not one of theirs.
    -- (The same test as is_admin, over every group.)
    if exists (select 1 from members m where m.user_id = auth.uid() and m.role = 'admin' and m.status = 'active')
       or exists (select 1 from groups g where g.owner_user_id = auth.uid()) then
      raise exception 'query_not_found' using errcode = 'P0001';
    end if;
    raise exception 'not_admin' using errcode = '42501';
  end if;
  -- Lock the query so two answers at once cannot both pass the "still open" check.
  select * into v from figure_queries where id = p_query for update;
  if v.status <> 'open' then raise exception 'already_answered' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p_reply, ''))) not between 1 and 500 then raise exception 'invalid_note' using errcode = 'P0001'; end if;

  update figure_queries set status = 'answered', reply = trim(p_reply), answered_by = auth.uid(), answered_at = now()
  where id = p_query
  returning * into v;
  perform private.audit(v.group_id, 'query.answered', 'figure_queries', v.id,
    jsonb_build_object('query_id', v.id, 'field', v.field, 'period_id', v.period_id));
  return v;
end $$;
revoke execute on function public.answer_query(uuid, text) from public, anon;
grant execute on function public.answer_query(uuid, text) to authenticated;
