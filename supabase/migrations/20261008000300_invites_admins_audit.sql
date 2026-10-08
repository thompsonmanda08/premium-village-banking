-- Invite acceptance, admin role changes, last-admin guard and the audit trail.

-- Audit trail ---------------------------------------------------------------
create or replace function public.write_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
  v_entity uuid;
  v_action text;
  v_old jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) - 'token_hash' end;
  v_new jsonb := to_jsonb(NEW) - 'token_hash';
begin
  if TG_TABLE_NAME = 'groups' then
    v_group := NEW.id; v_entity := NEW.id;
    v_action := case when TG_OP = 'UPDATE' and NEW.figures_visibility is distinct from OLD.figures_visibility
                     then 'group.visibility_changed' else 'group.updated' end;
  elsif TG_TABLE_NAME = 'members' then
    v_group := NEW.group_id; v_entity := NEW.id;
    if TG_OP = 'INSERT' then v_action := 'member.added';
    elsif NEW.role is distinct from OLD.role then v_action := 'member.role_changed';
    elsif NEW.user_id is distinct from OLD.user_id then v_action := 'member.linked';
    elsif NEW.status is distinct from OLD.status then v_action := 'member.status_changed';
    else v_action := 'member.updated';
    end if;
  elsif TG_TABLE_NAME = 'invites' then
    v_group := NEW.group_id; v_entity := NEW.id;
    if TG_OP = 'INSERT' then v_action := 'invite.created';
    elsif NEW.accepted_at is not null and OLD.accepted_at is null then v_action := 'invite.accepted';
    elsif NEW.revoked_at is not null and OLD.revoked_at is null then v_action := 'invite.revoked';
    else v_action := 'invite.updated';
    end if;
  elsif TG_TABLE_NAME = 'cycles' then
    v_group := NEW.group_id; v_entity := NEW.id;
    v_action := case when TG_OP = 'INSERT' then 'cycle.created' else 'cycle.updated' end;
  elsif TG_TABLE_NAME = 'cycle_rules' then
    select c.group_id into v_group from cycles c where c.id = NEW.cycle_id;
    v_entity := NEW.cycle_id;
    v_action := case when TG_OP = 'INSERT' then 'rules.created' else 'rules.updated' end;
  end if;

  insert into audit_log (group_id, actor_user_id, action, entity, entity_id, data)
  values (v_group, auth.uid(), v_action, TG_TABLE_NAME, v_entity, jsonb_build_object('old', v_old, 'new', v_new));
  return NEW;
end $$;

create trigger groups_audit after update on public.groups for each row execute function public.write_audit();
create trigger members_audit after insert or update on public.members for each row execute function public.write_audit();
create trigger invites_audit after insert or update on public.invites for each row execute function public.write_audit();
create trigger cycles_audit after insert or update on public.cycles for each row execute function public.write_audit();
create trigger cycle_rules_audit after insert or update on public.cycle_rules for each row execute function public.write_audit();

-- Last-admin guard: covers set_admin and plain status updates alike ----------
-- Counts member admins only, so a group whose owner has no members row is guarded conservatively.
create or replace function public.guard_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if OLD.role = 'admin' and OLD.status = 'active' and (NEW.role <> 'admin' or NEW.status <> 'active') then
    -- Serialise admin removals per group: two concurrent demotions must not each see the other as
    -- the remaining admin. (FOR NO KEY UPDATE does not block the key-share locks of foreign keys.)
    perform 1 from groups where id = OLD.group_id for no key update;
    if not exists (
      select 1 from members m
      where m.group_id = OLD.group_id and m.id <> OLD.id and m.role = 'admin' and m.status = 'active'
    ) then
      raise exception 'last_admin' using errcode = 'P0001';
    end if;
  end if;
  return NEW;
end $$;

create trigger members_guard_last_admin before update of role, status on public.members
  for each row execute function public.guard_last_admin();

-- set_admin -------------------------------------------------------------------
create or replace function public.set_admin(p_member_id uuid, p_make_admin boolean) returns public.members
language plpgsql security definer set search_path = public as $$
declare v members;
begin
  select * into v from members where id = p_member_id for update;
  if not found then raise exception 'member_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_make_admin and v.status <> 'active' then raise exception 'member_not_active' using errcode = 'P0001'; end if;
  update members set role = case when p_make_admin then 'admin' else 'member' end
  where id = p_member_id returning * into v;
  return v;
end $$;

-- invite_preview: what the invite page shows before anyone signs in ------------
create or replace function public.invite_preview(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v record;
begin
  select i.email, i.expires_at, i.accepted_at, i.revoked_at, m.short_name, g.name as group_name
    into v
    from invites i join members m on m.id = i.member_id join groups g on g.id = i.group_id
   where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object(
    'status', case when v.revoked_at is not null then 'revoked'
                   when v.accepted_at is not null then 'used'
                   when v.expires_at <= now() then 'expired'
                   else 'valid' end,
    'group_name', v.group_name,
    'member_name', v.short_name,
    'email_hint', left(split_part(v.email, '@', 1), 1) || '•••@' || split_part(v.email, '@', 2)
  );
end $$;

-- accept_invite -----------------------------------------------------------------
create or replace function public.accept_invite(p_token text) returns public.members
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv invites;
  v_member members;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;

  select * into v_inv from invites
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   for update;
  if not found then raise exception 'invite_not_found' using errcode = 'P0001'; end if;
  if v_inv.revoked_at is not null then raise exception 'invite_revoked' using errcode = 'P0001'; end if;
  if v_inv.accepted_at is not null then raise exception 'invite_used' using errcode = 'P0001'; end if;
  if v_inv.expires_at <= now() then raise exception 'invite_expired' using errcode = 'P0001'; end if;
  if lower(v_inv.email) <> v_email then raise exception 'email_mismatch' using errcode = 'P0001'; end if;
  if exists (select 1 from members where group_id = v_inv.group_id and user_id = v_uid and id <> v_inv.member_id) then
    raise exception 'already_linked' using errcode = 'P0001';
  end if;

  select * into v_member from members where id = v_inv.member_id for update;
  if v_member.status <> 'active' then raise exception 'member_not_active' using errcode = 'P0001'; end if;
  if v_member.user_id is not null and v_member.user_id <> v_uid then
    raise exception 'member_taken' using errcode = 'P0001';
  end if;

  update members set user_id = v_uid, email = coalesce(email, v_inv.email) where id = v_member.id returning * into v_member;
  update invites set accepted_at = now() where id = v_inv.id;
  return v_member;
end $$;

-- New functions start with PUBLIC execute, so each one is revoked and re-granted explicitly.
-- The two trigger functions are granted to nobody: triggers run regardless of EXECUTE.
revoke execute on function public.set_admin(uuid, boolean), public.accept_invite(text), public.invite_preview(text),
  public.write_audit(), public.guard_last_admin() from public, anon, authenticated;
grant execute on function public.set_admin(uuid, boolean), public.accept_invite(text) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
