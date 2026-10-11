-- One group per person, also on the invite path: create_group refuses a user who already belongs to a group, and
-- accept_invite now refuses a user who already belongs to (or owns) a different one. Both take the same per-user
-- advisory lock, so a create and an accept racing each other cannot both succeed.

create or replace function public.accept_invite(p_token text) returns public.members
language plpgsql security definer set search_path = public, pg_temp as $$
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

  perform pg_advisory_xact_lock(hashtextextended('one_group:' || v_uid::text, 0));
  if exists (select 1 from members where user_id = v_uid and status = 'active' and group_id <> v_inv.group_id)
     or exists (select 1 from groups where owner_user_id = v_uid and id <> v_inv.group_id) then
    raise exception 'already_in_group' using errcode = 'P0001';
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

-- create_group (first shipped in 20261010001900): same contract, now serialised per caller with the lock above, a
-- null currency answers invalid_body, and pg_temp is on the search_path like every other definer function here.
create or replace function public.create_group(
  p_name       text,
  p_currency   text,
  p_full_name  text,
  p_short_name text
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_gid   uuid;
  v_mid   uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;

  -- Serialise per caller: a double-tap would otherwise pass both checks below and create two groups.
  perform pg_advisory_xact_lock(hashtextextended('one_group:' || v_uid::text, 0));

  if exists (select 1 from groups where owner_user_id = v_uid) then
    raise exception 'already_in_group' using errcode = 'P0001';
  end if;
  if exists (select 1 from members where user_id = v_uid and status = 'active') then
    raise exception 'already_in_group' using errcode = 'P0001';
  end if;

  if length(trim(coalesce(p_name, ''))) < 1 or length(trim(p_name)) > 120 then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;
  if p_currency is null or p_currency not in ('ZMW', 'USD', 'ZAR', 'KES', 'GHS', 'NGN', 'UGX', 'TZS') then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_full_name, ''))) < 1 or length(trim(p_full_name)) > 120 then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_short_name, ''))) < 1 or length(trim(p_short_name)) > 40 then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;

  insert into groups (name, currency, owner_user_id)
  values (trim(p_name), p_currency, v_uid)
  returning id into v_gid;

  insert into members (group_id, full_name, short_name, user_id, role, status, email)
  values (v_gid, trim(p_full_name), trim(p_short_name), v_uid, 'admin', 'active', nullif(v_email, ''))
  returning id into v_mid;

  perform private.audit(v_gid, 'group.created', 'groups', v_gid,
    jsonb_build_object('name', trim(p_name), 'currency', p_currency, 'member_id', v_mid));

  return v_gid;
end $$;

revoke execute on function public.create_group(text, text, text, text) from public, anon, authenticated;
grant  execute on function public.create_group(text, text, text, text) to authenticated;
