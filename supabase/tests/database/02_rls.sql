begin;
select * from no_plan();
select tests.fixture();

-- Rows the fixture does not create, so the denied reads below are not vacuous.
insert into audit_log (group_id, action, entity) values
  (tests.id('group'), 'test.entry', 'group'),
  (tests.id('group2'), 'test.entry', 'group');
insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group2'), tests.id('m_g2'), 'second@test.local', 'hash-g2', now() + interval '14 days', tests.id('owner2'));

-- Roles: anon (signed out), outsider (signed in, no membership), member, admin (members.role)
-- and owner (groups.owner_user_id). "Cannot" on UPDATE/DELETE means RLS filtered the row out,
-- so those cases assert the data is unchanged; a failing INSERT check raises 42501.

-- anon: nothing is reachable --------------------------------------------------
select tests.login_anon();
select throws_ok('select count(*) from ' || t, '42501', null, 'anon cannot read ' || t)
from unnest(array['groups', 'members', 'group_members', 'invites', 'cycles', 'cycle_rules', 'audit_log']) as t;
select throws_ok('insert into ' || t || ' default values', '42501', null, 'anon cannot insert into ' || t)
from unnest(array['groups', 'members', 'invites', 'cycles', 'cycle_rules', 'audit_log']) as t;
select throws_ok('update ' || t || ' set created_at = now()', '42501', null, 'anon cannot update ' || t)
from unnest(array['groups', 'members', 'invites', 'cycles', 'cycle_rules', 'audit_log']) as t;
select throws_ok('delete from ' || t, '42501', null, 'anon cannot delete from ' || t)
from unnest(array['groups', 'members', 'invites', 'cycles', 'cycle_rules', 'audit_log']) as t;
select throws_ok($$select public.is_member(tests.id('group'))$$, '42501', null, 'anon cannot call is_member');
select throws_ok($$select public.is_admin(tests.id('group'))$$, '42501', null, 'anon cannot call is_admin');
select throws_ok($$select public.can_see_figures(tests.id('group'), tests.id('m_other'))$$, '42501', null, 'anon cannot call can_see_figures');
reset role;

-- table privileges: only what the app needs, nothing by default --------------------
select ok(not has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE,REFERENCES,TRIGGER'),
  'authenticated has no truncate, references or trigger on ' || t)
from unnest(array['groups', 'members', 'group_members', 'invites', 'cycles', 'cycle_rules', 'audit_log']) as t;
select ok(not has_any_column_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE'),
  'authenticated has no insert or update on ' || t)
from unnest(array['group_members', 'audit_log']) as t;
select ok(not has_table_privilege('authenticated', 'public.group_members', 'DELETE'), 'authenticated cannot delete from group_members');
select ok(has_table_privilege('authenticated', 'public.group_members', 'SELECT'), 'authenticated can read group_members');
select ok(not has_any_column_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,REFERENCES')
  and not has_table_privilege('anon', 'public.' || t, 'DELETE,TRUNCATE,TRIGGER'),
  'anon holds no privilege on ' || t)
from unnest(array['groups', 'members', 'group_members', 'invites', 'cycles', 'cycle_rules', 'audit_log']) as t;
select tests.login_as(tests.id('member'));
select throws_ok('truncate public.' || t, '42501', null, 'authenticated cannot truncate ' || t)
from unnest(array['groups', 'members', 'invites', 'cycles', 'cycle_rules', 'audit_log']) as t;
reset role;
-- New functions get PUBLIC execute from a global default, so each migration must revoke it itself;
-- this fails the build if one forgets. The allowlist is the invite page's preview and nothing else
-- (03_invites_admins.sql asserts that anon can in fact run it).
select is((select count(*)::int from pg_proc
           where pronamespace = 'public'::regnamespace and has_function_privilege('anon', oid, 'EXECUTE')
             and oid is distinct from to_regprocedure('public.invite_preview(text)')::oid),
  0, 'anon can execute no function in public except invite_preview(text)');
-- Objects created from now on start with no grants to anon or authenticated.
create table public.zz_future (id int);
create view public.zz_future_v as select 1 as x;
create sequence public.zz_future_s;
select ok(not has_any_column_privilege(r, t, 'SELECT,INSERT,UPDATE,REFERENCES') and not has_table_privilege(r, t, 'DELETE,TRUNCATE,TRIGGER'),
  r || ' gets nothing on a new ' || t)
from unnest(array['anon', 'authenticated']) as r, unnest(array['public.zz_future', 'public.zz_future_v']) as t;
select ok(not has_sequence_privilege(r, 'public.zz_future_s', 'USAGE,SELECT,UPDATE'), r || ' gets nothing on a new sequence')
from unnest(array['anon', 'authenticated']) as r;
select ok(not exists (
  select 1 from pg_default_acl d, aclexplode(d.defaclacl) a
  where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace
    and a.grantee in (select oid from pg_roles where rolname in ('anon', 'authenticated'))),
  'default privileges in public grant nothing to anon or authenticated');

-- outsider: signed in, belongs to no group ----------------------------------------
select tests.login_as(tests.id('outsider'));
select results_eq('select count(*)::int from ' || t, 'values (0)', 'outsider reads no ' || t)
from unnest(array['groups', 'members', 'group_members', 'invites', 'cycles', 'cycle_rules', 'audit_log']) as t;
select throws_ok($$insert into groups (name, owner_user_id) values ('Mine', auth.uid())$$, '42501', null, 'outsider cannot create a group');
select throws_ok($$insert into members (group_id, full_name, short_name) values (tests.id('group'), 'Eve', 'Eve')$$, '42501', null, 'outsider cannot add members');
select throws_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_unlinked'), 'x@test.local', 'hash-o', now() + interval '1 day', auth.uid())$$,
  '42501', null, 'outsider cannot create invites');
select throws_ok($$insert into cycles (group_id, label, starts_on, ends_on, payout_on)
  values (tests.id('group'), 'Sneaky', '2029-01-01', '2029-12-31', '2029-12-20')$$, '42501', null, 'outsider cannot create cycles');
select throws_ok($$insert into cycle_rules (cycle_id, loan_multiples, tenor_bands) values (tests.id('c_planned'), '[]', '[]')$$,
  '42501', null, 'outsider cannot add cycle rules');
select throws_ok($$insert into audit_log (group_id, action, entity) values (tests.id('group'), 'fake', 'x')$$, '42501', null, 'outsider cannot write the audit log');
update groups set name = 'X';
update members set full_name = 'X';
update invites set revoked_at = now();
update cycles set label = 'X';
update cycle_rules set min_saving = 1;
delete from cycles;
delete from cycle_rules;
reset role;
select is(
  (select count(*)::int from groups where name = 'X') + (select count(*)::int from members where full_name = 'X')
  + (select count(*)::int from invites where revoked_at is not null) + (select count(*)::int from cycles where label = 'X')
  + (select count(*)::int from cycle_rules where min_saving = 1),
  0, 'outsider edits nothing');
select is((select count(*)::int from cycles), 2, 'outsider deletes no cycles');
select is((select count(*)::int from cycle_rules), 2, 'outsider deletes no cycle rules');

-- groups -------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select is((select count(*)::int from groups), 1, 'member reads only their own group');
update groups set name = 'Hacked' where id = tests.id('group');
reset role;
select is((select name from groups where id = tests.id('group')), 'Test Group', 'member cannot rename the group');

select tests.login_as(tests.id('admin'));
update groups set name = 'Renamed', figures_visibility = 'private' where id = tests.id('group');
reset role;
select is((select name || '/' || figures_visibility from groups where id = tests.id('group')), 'Renamed/private', 'admin renames group and sets visibility');
update groups set figures_visibility = 'open' where id = tests.id('group');

select tests.login_as(tests.id('admin'));
select throws_ok($$update groups set owner_user_id = auth.uid() where id = tests.id('group')$$, '42501', null, 'owner cannot be changed from the client');
reset role;

select tests.login_as(tests.id('owner'));
select is((select count(*)::int from groups), 1, 'owner reads only their own group');
update groups set name = 'Owner Renamed', figures_visibility = 'private' where id = tests.id('group');
reset role;
select is((select name || '/' || figures_visibility from groups where id = tests.id('group')), 'Owner Renamed/private', 'owner renames group and sets visibility');
update groups set figures_visibility = 'open' where id = tests.id('group');

select tests.login_as(tests.id('owner'));
select throws_ok($$update groups set owner_user_id = auth.uid() where id = tests.id('group')$$, '42501', null, 'owner cannot reassign ownership from the client');
reset role;

-- members (base table) ------------------------------------------------------
select tests.login_as(tests.id('member'));
select is((select count(*)::int from members), 1, 'member reads only their own members row');
select is((select email from members), null, 'member reads their own row');
select throws_ok($$insert into members (group_id, full_name, short_name) values (tests.id('group'), 'Eve', 'Eve')$$, '42501', null, 'member cannot add members');
update members set full_name = 'Changed' where id = tests.id('m_other');
reset role;
select is((select full_name from members where id = tests.id('m_other')), 'Other Member', 'member cannot edit another member');

select tests.login_as(tests.id('admin'));
select is((select count(*)::int from members), 5, 'admin reads every member of their group and none of the other group');
select lives_ok($$insert into members (group_id, full_name, short_name) values (tests.id('group'), 'New Person', 'Newbie')$$, 'admin adds a member');
select throws_ok($$insert into members (group_id, full_name, short_name) values (tests.id('group2'), 'Spy', 'Spy')$$, '42501', null, 'admin cannot add members to another group');
select throws_ok($$update members set role = 'admin' where id = tests.id('m_member')$$, '42501', null, 'role cannot be changed directly');
select throws_ok($$update members set user_id = auth.uid() where id = tests.id('m_unlinked')$$, '42501', null, 'user_id cannot be changed directly');
select lives_ok($$update members set phone = '+260970000000' where id = tests.id('m_member')$$, 'admin edits contact details');
reset role;

select tests.login_as(tests.id('owner'));
select is((select count(*)::int from members), 6, 'owner reads every member of their group and none of the other group');
select lives_ok($$insert into members (group_id, full_name, short_name) values (tests.id('group'), 'Owner Added', 'Ollie')$$, 'owner adds a member');
select throws_ok($$insert into members (group_id, full_name, short_name) values (tests.id('group2'), 'Spy', 'Spy2')$$, '42501', null, 'owner cannot add members to another group');
select throws_ok($$update members set role = 'admin' where id = tests.id('m_member')$$, '42501', null, 'owner cannot change a role directly');
select throws_ok($$update members set user_id = auth.uid() where id = tests.id('m_unlinked')$$, '42501', null, 'owner cannot change user_id directly');
select lives_ok($$update members set phone = '+260971111111' where id = tests.id('m_member')$$, 'owner edits contact details');
reset role;
select tests.login_as(tests.id('member'));
update members set full_name = 'Self Edit', phone = '000' where id = tests.id('m_member');
reset role;
select is((select full_name || '/' || phone from members where id = tests.id('m_member')), 'Mary Member/+260971111111', 'member cannot edit their own members row');

-- group_members view --------------------------------------------------------
select hasnt_column('public', 'group_members', 'email', 'view hides email');
select hasnt_column('public', 'group_members', 'phone', 'view hides phone');
select hasnt_column('public', 'group_members', 'user_id', 'view hides user_id');
select hasnt_column('public', 'group_members', 'joined_on', 'view hides joined_on');
select columns_are('public', 'group_members', array['id', 'group_id', 'full_name', 'short_name', 'role', 'status', 'linked'],
  'view exposes exactly the list columns');
select tests.login_as(tests.id('member'));
-- 5 fixture members + 'Newbie' (admin) + 'Ollie' (owner)
select is((select count(*)::int from group_members), 7, 'member reads the whole group list through the view');
select is((select count(*)::int from group_members where group_id = tests.id('group2')), 0, 'view hides other groups');
select is((select linked from group_members where id = tests.id('m_unlinked')), false, 'view reports unlinked members');
reset role;
select tests.login_as(tests.id('admin'));
select is((select count(*)::int from group_members), 7, 'admin reads the whole group list through the view');
reset role;
select tests.login_as(tests.id('owner'));
select is((select count(*)::int from group_members), 7, 'owner reads the whole group list through the view');
select is((select count(*)::int from group_members where group_id = tests.id('group2')), 0, 'owner does not see the other group in the view');
reset role;

select ok((select reloptions @> array['security_invoker=false', 'security_barrier=true'] from pg_class where oid = 'public.group_members'::regclass),
  'view runs as its owner and is a security barrier');
-- The view runs as its owner, so it must not accept writes: they would bypass RLS on members.
select tests.login_as(tests.id('member'));
select throws_ok($$update group_members set role = 'admin' where id = tests.id('m_member')$$, '42501', null, 'member cannot promote themselves through the view');
select throws_ok($$update group_members set group_id = tests.id('group2') where id = tests.id('m_member')$$, '42501', null, 'member cannot move their row to another group through the view');
select throws_ok($$insert into group_members (group_id, full_name, short_name, role) values (tests.id('group'), 'Mallory', 'Mal', 'admin')$$, '42501', null, 'member cannot insert through the view');
select throws_ok($$insert into group_members (group_id, full_name, short_name, role) values (tests.id('group2'), 'Mallory', 'Mal2', 'admin')$$, '42501', null, 'member cannot insert into another group through the view');
select throws_ok($$delete from group_members where id = tests.id('m_other')$$, '42501', null, 'member cannot delete through the view');
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok($$update group_members set role = 'member' where id = tests.id('m_owner')$$, '42501', null, 'admin cannot change a role through the view');
select throws_ok($$update group_members set group_id = tests.id('group2') where id = tests.id('m_admin')$$, '42501', null, 'admin cannot move a member to another group through the view');
select throws_ok($$insert into group_members (group_id, full_name, short_name, role) values (tests.id('group2'), 'Mallory', 'Mal3', 'admin')$$, '42501', null, 'admin cannot insert through the view');
select throws_ok($$delete from group_members where id = tests.id('m_unlinked')$$, '42501', null, 'admin cannot delete through the view');
reset role;
select tests.login_as(tests.id('owner'));
select throws_ok($$update group_members set role = 'member' where id = tests.id('m_admin')$$, '42501', null, 'owner cannot change a role through the view');
select throws_ok($$update group_members set group_id = tests.id('group2') where id = tests.id('m_owner')$$, '42501', null, 'owner cannot move a member to another group through the view');
select throws_ok($$insert into group_members (group_id, full_name, short_name, role) values (tests.id('group2'), 'Mallory', 'Mal4', 'admin')$$, '42501', null, 'owner cannot insert through the view');
select throws_ok($$delete from group_members where id = tests.id('m_member')$$, '42501', null, 'owner cannot delete through the view');
reset role;
select is((select count(*)::int from members where group_id = tests.id('group') and role = 'admin'), 2, 'the view writes changed no role');
select is((select count(*)::int from members where group_id = tests.id('group')), 7, 'the view writes added or removed no member of the group');
select is((select count(*)::int from members where group_id = tests.id('group2')), 1, 'the view writes touched nothing in the other group');
select is((select count(*)::int from members where short_name like 'Mal%'), 0, 'the view writes inserted no rows');

-- invites -------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select lives_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_unlinked'), 'unlinked@test.local', 'hash-a', now() + interval '14 days', auth.uid())$$, 'admin creates an invite');
select throws_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_unlinked'), 'unlinked@test.local', 'hash-b', now() + interval '14 days', tests.id('member'))$$,
  '42501', null, 'invite must be created by the signed-in admin');
select throws_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_g2'), 'second@test.local', 'hash-e', now() + interval '14 days', auth.uid())$$,
  '42501', null, 'invite must name a member of the same group');
select is((select count(*)::int from invites), 1, 'admin reads invites of their group only');
reset role;
select tests.login_as(tests.id('member'));
select is((select count(*)::int from invites), 0, 'member reads no invites');
select throws_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_unlinked'), 'x@test.local', 'hash-c', now() + interval '1 day', auth.uid())$$,
  '42501', null, 'member cannot create invites');
update invites set revoked_at = now();
reset role;
select is((select count(*)::int from invites where revoked_at is not null), 0, 'member cannot revoke invites');
select tests.login_as(tests.id('owner'));
select lives_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_unlinked'), 'unlinked@test.local', 'hash-d', now() + interval '14 days', auth.uid())$$, 'owner creates an invite');
select throws_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_unlinked'), 'unlinked@test.local', 'hash-f', now() + interval '14 days', tests.id('member'))$$,
  '42501', null, 'invite must be created by the signed-in owner');
select is((select count(*)::int from invites), 2, 'owner reads invites of their group only');
reset role;
select tests.login_as(tests.id('admin'));
update invites set revoked_at = now() where token_hash in ('hash-a', 'hash-g2');
select throws_ok($$update invites set token_hash = 'swapped' where token_hash = 'hash-d'$$, '42501', null, 'invite token cannot be edited');
reset role;
select ok((select revoked_at is not null from invites where token_hash = 'hash-a'), 'admin revokes an invite');
select ok((select revoked_at is null from invites where token_hash = 'hash-g2'), 'admin cannot revoke another group''s invite');
select tests.login_as(tests.id('owner'));
update invites set revoked_at = now() where token_hash = 'hash-d';
reset role;
select ok((select revoked_at is not null from invites where token_hash = 'hash-d'), 'owner revokes an invite');
select tests.login_as(tests.id('admin'));
select throws_ok($$update invites set revoked_at = null where token_hash = 'hash-a'$$, '42501', null, 'admin cannot un-revoke an invite');
reset role;
select tests.login_as(tests.id('owner'));
select throws_ok($$update invites set revoked_at = null where token_hash = 'hash-d'$$, '42501', null, 'owner cannot un-revoke an invite');
reset role;
select is((select count(*)::int from invites where revoked_at is not null), 2, 'revoked invites stay revoked');

-- cycles and rules ----------------------------------------------------------
select tests.login_as(tests.id('member'));
select is((select count(*)::int from cycles), 2, 'member reads cycles');
select is((select count(*)::int from cycle_rules), 2, 'member reads cycle rules');
update cycle_rules set min_saving = 1 where cycle_id = tests.id('c_planned');
reset role;
select is((select min_saving from cycle_rules where cycle_id = tests.id('c_planned')), 250::numeric, 'member cannot change rules');

select tests.login_as(tests.id('admin'));
update cycle_rules set min_saving = 300 where cycle_id = tests.id('c_planned');
update cycle_rules set min_saving = 300 where cycle_id = tests.id('c_active');
update cycles set label = 'Cycle 2027 (renamed)' where id = tests.id('c_planned');
update cycles set label = 'Changed' where id = tests.id('c_active');
reset role;
select is((select min_saving from cycle_rules where cycle_id = tests.id('c_planned')), 300::numeric, 'admin changes planned-cycle rules');
select is((select min_saving from cycle_rules where cycle_id = tests.id('c_active')), 250::numeric, 'rules lock once the cycle is active');
select is((select label from cycles where id = tests.id('c_planned')), 'Cycle 2027 (renamed)', 'admin edits a planned cycle');
select is((select label from cycles where id = tests.id('c_active')), 'Cycle 2026', 'active cycle cannot be edited');

select tests.login_as(tests.id('owner'));
update cycle_rules set min_saving = 400 where cycle_id = tests.id('c_planned');
update cycle_rules set min_saving = 400 where cycle_id = tests.id('c_active');
update cycles set label = 'Cycle 2027 (owner)' where id = tests.id('c_planned');
update cycles set label = 'Changed' where id = tests.id('c_active');
reset role;
select is((select min_saving from cycle_rules where cycle_id = tests.id('c_planned')), 400::numeric, 'owner changes planned-cycle rules');
select is((select min_saving from cycle_rules where cycle_id = tests.id('c_active')), 250::numeric, 'owner cannot change active-cycle rules');
select is((select label from cycles where id = tests.id('c_planned')), 'Cycle 2027 (owner)', 'owner edits a planned cycle');
select is((select label from cycles where id = tests.id('c_active')), 'Cycle 2026', 'owner cannot edit an active cycle');

select tests.login_as(tests.id('admin'));
select throws_ok($$update cycles set status = 'active' where id = tests.id('c_planned')$$, '42501', null, 'cycle status cannot be changed from the client');
select throws_ok($$insert into cycles (group_id, label, starts_on, ends_on, payout_on, status)
  values (tests.id('group'), 'Sneaky', '2029-01-01', '2029-12-31', '2029-12-20', 'active')$$, '42501', null, 'a cycle cannot be created active');
reset role;

-- cycles: insert
select tests.login_as(tests.id('member'));
select throws_ok($$insert into cycles (group_id, label, starts_on, ends_on, payout_on)
  values (tests.id('group'), 'Member Cycle', '2029-01-01', '2029-12-31', '2029-12-20')$$, '42501', null, 'member cannot create cycles');
reset role;
select tests.login_as(tests.id('admin'));
select lives_ok($$insert into cycles (group_id, label, starts_on, ends_on, payout_on)
  values (tests.id('group'), 'Admin Cycle', '2029-01-01', '2029-12-31', '2029-12-20')$$, 'admin creates a cycle');
select throws_ok($$insert into cycles (group_id, label, starts_on, ends_on, payout_on)
  values (tests.id('group2'), 'Spy Cycle', '2029-01-01', '2029-12-31', '2029-12-20')$$, '42501', null, 'admin cannot create cycles for another group');
reset role;
select tests.login_as(tests.id('owner'));
select lives_ok($$insert into cycles (group_id, label, starts_on, ends_on, payout_on)
  values (tests.id('group'), 'Owner Cycle', '2030-01-01', '2030-12-31', '2030-12-20')$$, 'owner creates a cycle');
reset role;
select is((select count(*)::int from cycles where status = 'planned' and label in ('Admin Cycle', 'Owner Cycle')), 2, 'new cycles start planned');

-- Cycles without rules: two planned (just created) and one active (made here).
select tests.remember('c_new_admin', (select id from cycles where label = 'Admin Cycle'));
select tests.remember('c_new_owner', (select id from cycles where label = 'Owner Cycle'));
with c as (
  insert into cycles (group_id, label, starts_on, ends_on, payout_on, status)
  values (tests.id('group'), 'Bare Active', '2025-02-15', '2026-02-14', '2026-02-05', 'active') returning id)
select tests.remember('c_active_bare', id) from c;

-- cycle_rules: insert (admin or owner, only while the cycle is planned)
select tests.login_as(tests.id('member'));
select throws_ok($$insert into cycle_rules (cycle_id, loan_multiples, tenor_bands) values (tests.id('c_new_admin'), '[]', '[]')$$,
  '42501', null, 'member cannot add cycle rules');
reset role;
select tests.login_as(tests.id('admin'));
select lives_ok($$insert into cycle_rules (cycle_id, min_saving, loan_multiples, tenor_bands) values (tests.id('c_new_admin'), 300, '[]', '[]')$$,
  'admin adds rules to a planned cycle');
select throws_ok($$insert into cycle_rules (cycle_id, loan_multiples, tenor_bands) values (tests.id('c_active_bare'), '[]', '[]')$$,
  '42501', null, 'admin cannot add rules to an active cycle');
reset role;
select tests.login_as(tests.id('owner'));
select lives_ok($$insert into cycle_rules (cycle_id, min_saving, loan_multiples, tenor_bands) values (tests.id('c_new_owner'), 300, '[]', '[]')$$,
  'owner adds rules to a planned cycle');
select throws_ok($$insert into cycle_rules (cycle_id, loan_multiples, tenor_bands) values (tests.id('c_active_bare'), '[]', '[]')$$,
  '42501', null, 'owner cannot add rules to an active cycle');
reset role;

-- cycle_rules and cycles: delete (admin or owner, only while the cycle is planned)
select tests.login_as(tests.id('member'));
delete from cycle_rules where cycle_id = tests.id('c_new_admin');
delete from cycles where id = tests.id('c_new_admin');
reset role;
select is((select count(*)::int from cycle_rules where cycle_id = tests.id('c_new_admin')), 1, 'member cannot delete cycle rules');
select is((select count(*)::int from cycles where id = tests.id('c_new_admin')), 1, 'member cannot delete a cycle');

select tests.login_as(tests.id('admin'));
delete from cycle_rules where cycle_id = tests.id('c_active');
delete from cycles where id = tests.id('c_active');
reset role;
select is((select count(*)::int from cycle_rules where cycle_id = tests.id('c_active')), 1, 'admin cannot delete rules of an active cycle');
select is((select count(*)::int from cycles where id = tests.id('c_active')), 1, 'admin cannot delete an active cycle');
select tests.login_as(tests.id('admin'));
delete from cycle_rules where cycle_id = tests.id('c_new_admin');
reset role;
select is((select count(*)::int from cycle_rules where cycle_id = tests.id('c_new_admin')), 0, 'admin deletes rules of a planned cycle');
select tests.login_as(tests.id('admin'));
delete from cycles where id = tests.id('c_new_admin');
reset role;
select is((select count(*)::int from cycles where id = tests.id('c_new_admin')), 0, 'admin deletes a planned cycle');

select tests.login_as(tests.id('owner'));
delete from cycle_rules where cycle_id = tests.id('c_active');
delete from cycles where id = tests.id('c_active');
delete from cycles where id = tests.id('c_active_bare');
delete from cycle_rules where cycle_id = tests.id('c_new_owner');
reset role;
select is((select count(*)::int from cycle_rules where cycle_id = tests.id('c_active')), 1, 'owner cannot delete rules of an active cycle');
select is((select count(*)::int from cycles where id in (tests.id('c_active'), tests.id('c_active_bare'))), 2, 'owner cannot delete an active cycle');
select is((select count(*)::int from cycle_rules where cycle_id = tests.id('c_new_owner')), 0, 'owner deletes rules of a planned cycle');
select tests.login_as(tests.id('owner'));
delete from cycles where id = tests.id('c_new_owner');
reset role;
select is((select count(*)::int from cycles where id = tests.id('c_new_owner')), 0, 'owner deletes a planned cycle');

-- audit log -----------------------------------------------------------------
select tests.login_as(tests.id('member'));
select is((select count(*)::int from audit_log), 0, 'member reads no audit entries');
select throws_ok($$insert into audit_log (group_id, action, entity) values (tests.id('group'), 'fake', 'x')$$, '42501', null, 'clients cannot write the audit log');
reset role;
select tests.login_as(tests.id('admin'));
select is((select count(*)::int from audit_log where action = 'test.entry'), 1, 'admin reads the audit entries of their group only');
select is((select count(*)::int from audit_log where group_id <> tests.id('group')), 0, 'admin: none from another group');
select throws_ok($$insert into audit_log (group_id, action, entity) values (tests.id('group'), 'fake', 'x')$$, '42501', null, 'admin cannot write the audit log');
reset role;
select tests.login_as(tests.id('owner'));
select is((select count(*)::int from audit_log where action = 'test.entry'), 1, 'owner reads the audit entries of their group only');
select is((select count(*)::int from audit_log where group_id <> tests.id('group')), 0, 'owner: none from another group');
select throws_ok($$insert into audit_log (group_id, action, entity) values (tests.id('group'), 'fake', 'x')$$, '42501', null, 'owner cannot write the audit log');
reset role;

-- no client deletes groups, members, invites or audit entries ----------------------
select tests.login_as(tests.id('member'));
select throws_ok('delete from ' || t, '42501', null, 'member cannot delete from ' || t)
from unnest(array['groups', 'members', 'invites', 'audit_log']) as t;
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok('delete from ' || t, '42501', null, 'admin cannot delete from ' || t)
from unnest(array['groups', 'members', 'invites', 'audit_log']) as t;
reset role;
select tests.login_as(tests.id('owner'));
select throws_ok('delete from ' || t, '42501', null, 'owner cannot delete from ' || t)
from unnest(array['groups', 'members', 'invites', 'audit_log']) as t;
reset role;

-- figures visibility --------------------------------------------------------
select tests.login_as(tests.id('member'));
select ok(can_see_figures(tests.id('group'), tests.id('m_other')), 'open: member sees another member''s figures');
select ok(can_see_figures(tests.id('group'), tests.id('m_member')), 'open: member sees own figures');
reset role;
update groups set figures_visibility = 'private' where id = tests.id('group');
select tests.login_as(tests.id('member'));
select ok(not can_see_figures(tests.id('group'), tests.id('m_other')), 'private: member cannot see another member''s figures');
select ok(can_see_figures(tests.id('group'), tests.id('m_member')), 'private: member still sees own figures');
reset role;
select tests.login_as(tests.id('admin'));
select ok(can_see_figures(tests.id('group'), tests.id('m_other')), 'private: admin sees everyone');
reset role;
select tests.login_as(tests.id('owner'));
select ok(can_see_figures(tests.id('group'), tests.id('m_other')), 'private: owner sees everyone');
reset role;
select tests.login_as(tests.id('outsider'));
select ok(not can_see_figures(tests.id('group'), tests.id('m_other')), 'outsider sees nothing');
reset role;
-- the member asked about must belong to the group asked about
select tests.login_as(tests.id('admin'));
select ok(not can_see_figures(tests.id('group'), tests.id('m_g2')), 'admin cannot see figures of another group''s member');
reset role;
select tests.login_as(tests.id('owner'));
select ok(not can_see_figures(tests.id('group'), tests.id('m_g2')), 'owner cannot see figures of another group''s member');
reset role;
select tests.login_as(tests.id('member'));
select ok(not can_see_figures(tests.id('group2'), tests.id('m_member')), 'a member''s own figures do not open another group');
reset role;
select tests.login_as(tests.id('owner2'));
select ok(not can_see_figures(tests.id('group2'), tests.id('m_other')), 'another group''s owner cannot see this group''s member through their own group');
select ok(can_see_figures(tests.id('group2'), tests.id('m_g2')), 'owner sees figures of a member of their own group');
reset role;

-- admin and owner of one group change nothing in another group -------------------------
with c as (
  insert into cycles (group_id, label, starts_on, ends_on, payout_on)
  values (tests.id('group2'), 'G2 Planned', '2031-01-01', '2031-12-31', '2031-12-20') returning id),
r as (
  insert into cycle_rules (cycle_id, min_saving, loan_multiples, tenor_bands) select id, 250, '[]', '[]' from c)
select tests.remember('c_g2_planned', id) from c;
select tests.login_as(tests.id('admin'));
update groups set name = 'Cross' where id = tests.id('group2');
update members set full_name = 'Cross' where id = tests.id('m_g2');
update cycles set label = 'Cross' where id = tests.id('c_g2_planned');
update cycle_rules set min_saving = 999 where cycle_id = tests.id('c_g2_planned');
reset role;
select is((select name from groups where id = tests.id('group2')), 'Other Group', 'admin cannot rename another group');
select is((select full_name from members where id = tests.id('m_g2')), 'Second Owner', 'admin cannot edit another group''s member');
select is((select label from cycles where id = tests.id('c_g2_planned')), 'G2 Planned', 'admin cannot edit another group''s planned cycle');
select is((select min_saving from cycle_rules where cycle_id = tests.id('c_g2_planned')), 250::numeric, 'admin cannot edit another group''s cycle rules');
select tests.login_as(tests.id('owner'));
update groups set name = 'Cross' where id = tests.id('group2');
update members set full_name = 'Cross' where id = tests.id('m_g2');
update cycles set label = 'Cross' where id = tests.id('c_g2_planned');
update cycle_rules set min_saving = 999 where cycle_id = tests.id('c_g2_planned');
reset role;
select is((select name from groups where id = tests.id('group2')), 'Other Group', 'owner cannot rename another group');
select is((select full_name from members where id = tests.id('m_g2')), 'Second Owner', 'owner cannot edit another group''s member');
select is((select label from cycles where id = tests.id('c_g2_planned')), 'G2 Planned', 'owner cannot edit another group''s planned cycle');
select is((select min_saving from cycle_rules where cycle_id = tests.id('c_g2_planned')), 250::numeric, 'owner cannot edit another group''s cycle rules');

-- owner without a member row: group2's owner, once their member row is gone ---------
delete from members where id = tests.id('m_g2');
select is((select count(*)::int from members where group_id = tests.id('group2')), 0, 'group2 owner has no member row');
select tests.login_as(tests.id('owner2'));
select ok(is_member(tests.id('group2')), 'owner without a member row is a member');
select ok(is_admin(tests.id('group2')), 'owner without a member row is an admin');
select ok(not is_member(tests.id('group')), 'owner of one group is not a member of another');
select is((select count(*)::int from groups), 1, 'owner without a member row reads their group');
update groups set name = 'Second Group' where id = tests.id('group2');
select lives_ok($$insert into members (group_id, full_name, short_name) values (tests.id('group2'), 'Newcomer', 'Neo')$$, 'owner without a member row adds a member');
select throws_ok($$insert into members (group_id, full_name, short_name) values (tests.id('group'), 'Spy', 'Spy3')$$, '42501', null, 'owner of one group cannot add members to another');
select is((select count(*)::int from members), 1, 'owner without a member row reads their members');
select is((select count(*)::int from group_members), 1, 'owner without a member row reads the group list');
select lives_ok($$insert into cycles (group_id, label, starts_on, ends_on, payout_on)
  values (tests.id('group2'), 'Second Cycle', '2027-03-01', '2028-03-01', '2028-02-20')$$, 'owner without a member row creates a cycle');
reset role;
select is((select name from groups where id = tests.id('group2')), 'Second Group', 'owner without a member row renames their group');
select tests.remember('c_g2', (select id from cycles where label = 'Second Cycle'));
select tests.login_as(tests.id('admin'));
select throws_ok($$insert into cycle_rules (cycle_id, loan_multiples, tenor_bands) values (tests.id('c_g2'), '[]', '[]')$$,
  '42501', null, 'admin cannot add rules to another group''s cycle');
delete from cycles where id = tests.id('c_g2');
reset role;
select is((select count(*)::int from cycles where id = tests.id('c_g2')), 1, 'admin cannot delete another group''s cycle');
select tests.login_as(tests.id('owner2'));
select lives_ok($$insert into cycle_rules (cycle_id, loan_multiples, tenor_bands) values (tests.id('c_g2'), '[]', '[]')$$,
  'owner without a member row adds rules to a planned cycle');
reset role;

-- a member who left loses access --------------------------------------------
update members set status = 'left' where id = tests.id('m_other');
select tests.login_as(tests.id('other'));
select is((select count(*)::int from groups), 0, 'a member who left cannot open the group');
select is((select count(*)::int from group_members), 0, 'a member who left sees no member list');
reset role;

select * from finish();
rollback;
