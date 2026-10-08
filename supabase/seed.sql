-- LOCAL/CI STACK ONLY: never apply to a hosted project; these accounts have a public password.
-- `supabase start` (CI) loads this after the migrations. scripts/db-cli.mjs resets the hosted
-- database with --no-seed and refuses to seed any host that is not localhost.
create function pg_temp.make_user(p_email text, p_password text) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v, v::text,
    jsonb_build_object('sub', v::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  return v;
end $$;

do $$
declare
  v_owner uuid := pg_temp.make_user('owner@pvb.test', 'password123');
  v_admin uuid := pg_temp.make_user('admin@pvb.test', 'password123');
  v_member uuid := pg_temp.make_user('member@pvb.test', 'password123');
  g uuid;
begin
  perform pg_temp.make_user('outsider@pvb.test', 'password123');
  g := private.bootstrap_premium_vb(v_owner);
  update public.members set user_id = v_admin, role = 'admin', email = 'admin@pvb.test' where group_id = g and short_name = 'Nsama';
  update public.members set user_id = v_member, email = 'member@pvb.test' where group_id = g and short_name = 'Tafara';
end $$;
