-- Test helpers. Not wrapped in a transaction: later files reuse what this creates.
-- scripts/db-test.mjs drops schema `tests` before and after every run, so none of this
-- (security definer functions that write auth.users) outlives a run on the hosted database.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(p_email text) returns uuid
language plpgsql security definer set search_path = auth, public as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '{"provider":"email"}', '{}', now(), now());
  return v;
end $$;

create or replace function tests.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_user, 'role', 'authenticated', 'email', (select email from auth.users where id = p_user))::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.login_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

create table if not exists tests.ids (name text primary key, id uuid not null);
grant select on tests.ids to anon, authenticated;

create or replace function tests.id(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name
$$;

create or replace function tests.remember(p_name text, p_id uuid) returns uuid language sql as $$
  insert into tests.ids values (p_name, p_id) on conflict (name) do update set id = excluded.id returning id
$$;

create or replace function tests.fixture() returns void
language plpgsql security definer set search_path = public, tests as $$
declare g uuid; g2 uuid; v uuid;
  multiples jsonb := '[{"from_month":1,"to_month":12,"multiple":2}]';
  tenors jsonb := '[{"max":null,"months":4}]';
begin
  delete from tests.ids;
  perform tests.remember('owner', tests.create_user('owner@test.local'));
  perform tests.remember('admin', tests.create_user('admin@test.local'));
  perform tests.remember('member', tests.create_user('member@test.local'));
  perform tests.remember('other', tests.create_user('other@test.local'));
  perform tests.remember('outsider', tests.create_user('outsider@test.local'));
  perform tests.remember('owner2', tests.create_user('owner2@test.local'));

  insert into groups (name, owner_user_id) values ('Test Group', tests.id('owner')) returning id into g;
  insert into groups (name, owner_user_id) values ('Other Group', tests.id('owner2')) returning id into g2;
  perform tests.remember('group', g);
  perform tests.remember('group2', g2);

  insert into members (group_id, full_name, short_name, user_id, role) values (g, 'Olive Owner', 'Olive', tests.id('owner'), 'admin') returning id into v;
  perform tests.remember('m_owner', v);
  insert into members (group_id, full_name, short_name, user_id, role) values (g, 'Adam Admin', 'Adam', tests.id('admin'), 'admin') returning id into v;
  perform tests.remember('m_admin', v);
  insert into members (group_id, full_name, short_name, user_id) values (g, 'Mary Member', 'Mary', tests.id('member')) returning id into v;
  perform tests.remember('m_member', v);
  insert into members (group_id, full_name, short_name, user_id) values (g, 'Other Member', 'Otto', tests.id('other')) returning id into v;
  perform tests.remember('m_other', v);
  insert into members (group_id, full_name, short_name, email) values (g, 'Una Unlinked', 'Una', 'unlinked@test.local') returning id into v;
  perform tests.remember('m_unlinked', v);
  insert into members (group_id, full_name, short_name, user_id, role) values (g2, 'Second Owner', 'Sam', tests.id('owner2'), 'admin') returning id into v;
  perform tests.remember('m_g2', v);

  insert into cycles (group_id, label, starts_on, ends_on, payout_on) values (g, 'Cycle 2027', '2027-02-15', '2028-02-15', '2028-02-05') returning id into v;
  perform tests.remember('c_planned', v);
  insert into cycle_rules (cycle_id, loan_multiples, tenor_bands) values (v, multiples, tenors);
  insert into cycles (group_id, label, starts_on, ends_on, payout_on, status) values (g, 'Cycle 2026', '2026-02-15', '2027-02-15', '2027-02-06', 'active') returning id into v;
  perform tests.remember('c_active', v);
  insert into cycle_rules (cycle_id, loan_multiples, tenor_bands) values (v, multiples, tenors);
end $$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select pass('test helpers installed');
select * from finish();
