-- Self-service group creation.
-- A signed-in user who already owns or belongs to a group may not create another one.
-- The function inserts the group and the creator's member row atomically, so the caller
-- lands immediately in a fully-formed group without a separate "join" step.

create or replace function public.create_group(
  p_name       text,
  p_currency   text,
  p_full_name  text,
  p_short_name text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_gid   uuid;
  v_mid   uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;

  -- 1-group rule: already owns any group
  if exists (select 1 from groups where owner_user_id = v_uid) then
    raise exception 'already_in_group' using errcode = 'P0001';
  end if;
  -- 1-group rule: active member of any group
  if exists (select 1 from members where user_id = v_uid and status = 'active') then
    raise exception 'already_in_group' using errcode = 'P0001';
  end if;

  -- Input validation (mirrors table check constraints; gives a clean error code)
  if length(trim(coalesce(p_name, ''))) < 1 or length(trim(p_name)) > 120 then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;
  if p_currency not in ('ZMW', 'USD', 'ZAR', 'KES', 'GHS', 'NGN', 'UGX', 'TZS') then
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
