-- The group's vote on each rule, kept on the record. Append-only: a later vote on the same rule is a new row.

create table public.rule_ratifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  cycle_id uuid not null,
  rule_key text not null check (rule_key ~ '^[a-z][a-z_]{2,39}$'),
  decided_on date not null,
  votes_for int not null,
  votes_total int not null,
  passed boolean not null,
  meeting_ref text check (length(meeting_ref) <= 500),
  note text check (length(note) <= 500),
  recorded_by uuid references auth.users,
  check (votes_total >= 1 and votes_for between 0 and votes_total),
  foreign key (cycle_id, group_id) references public.cycles (id, group_id) on delete cascade
);
create index rule_ratifications_cycle_idx on public.rule_ratifications (cycle_id, rule_key, decided_on desc);

create trigger rule_ratifications_append_only before update or delete on public.rule_ratifications
  for each row execute function public.ledger_append_only();

alter table public.rule_ratifications enable row level security;
revoke all on public.rule_ratifications from public, anon, authenticated;
grant select on public.rule_ratifications to authenticated;
create policy rule_ratifications_select on public.rule_ratifications for select to authenticated using (public.is_member(group_id));

create or replace function public.record_ratification(
  p_cycle uuid, p_rule_key text, p_decided_on date, p_votes_for int, p_votes_total int,
  p_meeting_ref text default null, p_note text default null)
returns public.rule_ratifications
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_c cycles; v rule_ratifications; v_passed boolean;
begin
  select * into v_c from cycles where id = p_cycle;
  if not found or not is_admin(v_c.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_rule_key is null or p_rule_key !~ '^[a-z][a-z_]{2,39}$' then raise exception 'invalid_rule' using errcode = 'P0001'; end if;
  if p_decided_on is null or p_votes_for is null or p_votes_total is null
     or p_votes_total < 1 or p_votes_for < 0 or p_votes_for > p_votes_total
     or p_decided_on > (now() at time zone 'Africa/Lusaka')::date then
    raise exception 'invalid_vote' using errcode = 'P0001';
  end if;
  if length(p_note) > 500 or length(p_meeting_ref) > 500 then raise exception 'invalid_note' using errcode = 'P0001'; end if;

  -- Two thirds of the votes cast carry a rule.
  v_passed := p_votes_for * 3 >= p_votes_total * 2;
  insert into rule_ratifications (group_id, cycle_id, rule_key, decided_on, votes_for, votes_total, passed, meeting_ref, note, recorded_by)
  values (v_c.group_id, p_cycle, p_rule_key, p_decided_on, p_votes_for, p_votes_total, v_passed, p_meeting_ref, p_note, auth.uid())
  returning * into v;
  perform private.audit(v_c.group_id, 'rule.ratified', 'rule_ratifications', v.id,
    jsonb_build_object('rule_key', p_rule_key, 'votes_for', p_votes_for, 'votes_total', p_votes_total,
                       'passed', v_passed, 'decided_on', p_decided_on));
  return v;
end $$;
revoke execute on function public.record_ratification(uuid, text, date, int, int, text, text) from public, anon;
grant execute on function public.record_ratification(uuid, text, date, int, int, text, text) to authenticated;
