-- Access helpers, row-level security policies, column grants and the member-list view.

create or replace function public.is_member(p_group_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from public.members m
           where m.group_id = p_group_id and m.user_id = auth.uid() and m.status = 'active')
      or exists (select 1 from public.groups g where g.id = p_group_id and g.owner_user_id = auth.uid());
$$;

create or replace function public.is_admin(p_group_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from public.members m
           where m.group_id = p_group_id and m.user_id = auth.uid() and m.status = 'active' and m.role = 'admin')
      or exists (select 1 from public.groups g where g.id = p_group_id and g.owner_user_id = auth.uid());
$$;

-- The member must belong to the group asked about, whichever branch applies.
create or replace function public.can_see_figures(p_group_id uuid, p_member_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.id = p_member_id and m.group_id = p_group_id)
     and (public.is_admin(p_group_id)
          or exists (select 1 from public.members m where m.id = p_member_id and m.user_id = auth.uid())
          or (public.is_member(p_group_id)
              and exists (select 1 from public.groups g where g.id = p_group_id and g.figures_visibility = 'open')));
$$;

revoke execute on function public.is_member(uuid), public.is_admin(uuid), public.can_see_figures(uuid, uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_admin(uuid), public.can_see_figures(uuid, uuid) to authenticated;

-- Supabase grants every privilege on new public objects to anon and authenticated. Take that away
-- for what this role creates from now on; each table below then gets back only what it needs.
-- (Objects created by supabase_admin carry their own defaults, which postgres cannot change. The
-- built-in PUBLIC execute default on functions is global, so a new function must revoke it itself.)
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;

-- groups
revoke all on public.groups from public, anon, authenticated;
grant select on public.groups to authenticated;
grant update (name, figures_visibility) on public.groups to authenticated;
create policy groups_select on public.groups for select to authenticated using (public.is_member(id));
create policy groups_update on public.groups for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

-- members: base table for admins and the member themselves
revoke all on public.members from public, anon, authenticated;
grant select on public.members to authenticated;
grant insert (group_id, full_name, short_name, email, phone, joined_on) on public.members to authenticated;
grant update (full_name, short_name, email, phone, status) on public.members to authenticated;
create policy members_select on public.members for select to authenticated
  using (public.is_admin(group_id) or user_id = auth.uid());
create policy members_insert on public.members for insert to authenticated
  with check (public.is_admin(group_id));
create policy members_update on public.members for update to authenticated
  using (public.is_admin(group_id)) with check (public.is_admin(group_id));

-- group list for every member, without contact details or account ids.
-- Owned by the migration role, so it reads past RLS; the WHERE clause is the access rule.
create view public.group_members with (security_invoker = false, security_barrier = true) as
  select m.id, m.group_id, m.full_name, m.short_name, m.role, m.status, (m.user_id is not null) as linked
  from public.members m
  where public.is_member(m.group_id);
-- Auto-updatable and owned by postgres, so any write privilege here would bypass RLS on members.
revoke all on public.group_members from public, anon, authenticated;
grant select on public.group_members to authenticated;

-- invites
revoke all on public.invites from public, anon, authenticated;
grant select on public.invites to authenticated;
grant insert (group_id, member_id, email, token_hash, expires_at, created_by) on public.invites to authenticated;
grant update (revoked_at) on public.invites to authenticated;
create policy invites_select on public.invites for select to authenticated using (public.is_admin(group_id));
create policy invites_insert on public.invites for insert to authenticated
  with check (
    public.is_admin(group_id)
    and created_by = auth.uid()
    and exists (select 1 from public.members m where m.id = member_id and m.group_id = invites.group_id)
  );
-- Revoking is one way: the new row must stay revoked.
create policy invites_update on public.invites for update to authenticated
  using (public.is_admin(group_id)) with check (public.is_admin(group_id) and revoked_at is not null);

-- cycles: admins edit and delete only while planned; status changes belong to later sub-projects
revoke all on public.cycles from public, anon, authenticated;
grant select on public.cycles to authenticated;
grant insert (group_id, label, starts_on, ends_on, payout_on) on public.cycles to authenticated;
grant update (label, starts_on, ends_on, payout_on) on public.cycles to authenticated;
grant delete on public.cycles to authenticated;
create policy cycles_select on public.cycles for select to authenticated using (public.is_member(group_id));
create policy cycles_insert on public.cycles for insert to authenticated with check (public.is_admin(group_id));
create policy cycles_update on public.cycles for update to authenticated
  using (public.is_admin(group_id) and status = 'planned') with check (public.is_admin(group_id) and status = 'planned');
create policy cycles_delete on public.cycles for delete to authenticated
  using (public.is_admin(group_id) and status = 'planned');

-- cycle rules: readable by members; admins insert, edit and delete only while the cycle is planned
revoke all on public.cycle_rules from public, anon, authenticated;
grant select on public.cycle_rules to authenticated;
grant insert (cycle_id, min_saving, loan_rate, excess_rate, penalty_per_day, membership_fee,
              window_open_day, window_close_day, loan_multiples, tenor_bands) on public.cycle_rules to authenticated;
grant update (min_saving, loan_rate, excess_rate, penalty_per_day, membership_fee,
              window_open_day, window_close_day, loan_multiples, tenor_bands) on public.cycle_rules to authenticated;
grant delete on public.cycle_rules to authenticated;
create policy cycle_rules_select on public.cycle_rules for select to authenticated
  using (exists (select 1 from public.cycles c where c.id = cycle_id and public.is_member(c.group_id)));
create policy cycle_rules_insert on public.cycle_rules for insert to authenticated
  with check (exists (select 1 from public.cycles c where c.id = cycle_id and c.status = 'planned' and public.is_admin(c.group_id)));
create policy cycle_rules_update on public.cycle_rules for update to authenticated
  using (exists (select 1 from public.cycles c where c.id = cycle_id and c.status = 'planned' and public.is_admin(c.group_id)))
  with check (exists (select 1 from public.cycles c where c.id = cycle_id and c.status = 'planned' and public.is_admin(c.group_id)));
create policy cycle_rules_delete on public.cycle_rules for delete to authenticated
  using (exists (select 1 from public.cycles c where c.id = cycle_id and c.status = 'planned' and public.is_admin(c.group_id)));

-- audit log: admins read; only definer functions and triggers write
revoke all on public.audit_log from public, anon, authenticated;
grant select on public.audit_log to authenticated;
create policy audit_log_select on public.audit_log for select to authenticated using (public.is_admin(group_id));
