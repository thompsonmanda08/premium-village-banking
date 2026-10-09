begin;
select * from no_plan();
select tests.fixture();

-- Invites with known raw tokens. Raw token 'tok-x' is stored as sha256('tok-x').
create function pg_temp.h(t text) returns text language sql as $$ select encode(extensions.digest(t, 'sha256'), 'hex') $$;
insert into invites (group_id, member_id, email, token_hash, expires_at, created_by) values
  (tests.id('group'), tests.id('m_unlinked'), 'Unlinked@Test.local', pg_temp.h('tok-valid'), now() + interval '14 days', tests.id('admin')),
  (tests.id('group'), tests.id('m_member'), 'unlinked@test.local', pg_temp.h('tok-expired'), now() - interval '1 minute', tests.id('admin'));
insert into invites (group_id, member_id, email, token_hash, expires_at, created_by, revoked_at) values
  (tests.id('group'), tests.id('m_unlinked'), 'unlinked@test.local', pg_temp.h('tok-revoked'), now() + interval '14 days', tests.id('admin'), now());
select tests.remember('u_unlinked', tests.create_user('unlinked@test.local'));

-- one live invite per member: a second unaccepted, unrevoked one is refused; revoked ones do not count.
-- (tok-expired sits on another member on purpose: an expired but unrevoked invite is still live to the index.)
select throws_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_unlinked'), 'unlinked@test.local', 'hash-second-live', now() + interval '14 days', tests.id('admin'))$$,
  '23505', null, 'a member cannot have two live invites');
select lives_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by, revoked_at)
  values (tests.id('group'), tests.id('m_unlinked'), 'unlinked@test.local', 'hash-second-revoked', now() + interval '14 days', tests.id('admin'), now())$$,
  'a revoked invite does not count as live');

-- function privileges -------------------------------------------------------
-- invite_preview is the only function anon may run (02_rls.sql fails on any other).
select ok(has_function_privilege('anon', 'public.invite_preview(text)', 'EXECUTE'), 'anon can preview an invite');
select ok(not has_function_privilege('anon', 'public.accept_invite(text)', 'EXECUTE'), 'anon cannot execute accept_invite');
select ok(not has_function_privilege('anon', 'public.set_admin(uuid, boolean)', 'EXECUTE'), 'anon cannot execute set_admin');
-- Trigger functions run regardless of the caller's EXECUTE privilege, so nobody needs it.
select ok(not has_function_privilege('authenticated', 'public.write_audit()', 'EXECUTE'), 'authenticated cannot execute write_audit');
select ok(not has_function_privilege('authenticated', 'public.guard_last_admin()', 'EXECUTE'), 'authenticated cannot execute guard_last_admin');

-- invite_preview (works signed out) ----------------------------------------
select tests.login_anon();
select is(invite_preview('tok-valid') ->> 'status', 'valid', 'preview: valid invite');
select is(invite_preview('tok-valid') ->> 'member_name', 'Una', 'preview: names the member');
select is(invite_preview('tok-valid') ->> 'group_name', 'Test Group', 'preview: names the group');
select is(invite_preview('tok-valid') ->> 'email_hint', 'U•••@Test.local', 'preview: masks the email');
select is(invite_preview('tok-expired') ->> 'status', 'expired', 'preview: expired');
select is(invite_preview('tok-revoked') ->> 'status', 'revoked', 'preview: revoked');
select is(invite_preview('nope') ->> 'status', 'not_found', 'preview: unknown token');
select is(invite_preview('nope') ->> 'member_name', null, 'preview: unknown token reveals nothing');
select throws_ok($$select accept_invite('tok-valid')$$, '42501', null, 'anon cannot accept invites');
reset role;

-- accept_invite ------------------------------------------------------------
select tests.login_as(tests.id('outsider'));
select throws_ok($$select accept_invite('tok-valid')$$, 'P0001', 'email_mismatch', 'wrong account is refused');
reset role;
-- ... and the refusal leaves everything as it was: the wrong account is not linked.
select is((select user_id from members where id = tests.id('m_unlinked')), null, 'wrong account does not link the member');
select is((select accepted_at from invites where token_hash = pg_temp.h('tok-valid')), null, 'wrong account does not consume the invite');

select tests.login_as(tests.id('u_unlinked'));
select throws_ok($$select accept_invite('tok-expired')$$, 'P0001', 'invite_expired', 'expired invite is refused');
select throws_ok($$select accept_invite('tok-revoked')$$, 'P0001', 'invite_revoked', 'revoked invite is refused');
select throws_ok($$select accept_invite('nope')$$, 'P0001', 'invite_not_found', 'unknown token is refused');
select is((select short_name from accept_invite('tok-valid')), 'Una', 'invited account is linked (email compared case-insensitively)');
select throws_ok($$select accept_invite('tok-valid')$$, 'P0001', 'invite_used', 'invite cannot be reused');
reset role;
select is((select user_id from members where id = tests.id('m_unlinked')), tests.id('u_unlinked'), 'member row now points at the account');
select isnt((select accepted_at from invites where token_hash = pg_temp.h('tok-valid')), null, 'invite marked accepted');

-- already linked: Mary (member@test.local) gets an invite for a second member row
insert into members (group_id, full_name, short_name) values (tests.id('group'), 'Dup Person', 'Dup');
insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  select tests.id('group'), id, 'member@test.local', pg_temp.h('tok-dup'), now() + interval '1 day', tests.id('admin') from members where short_name = 'Dup';
select tests.login_as(tests.id('member'));
select throws_ok($$select accept_invite('tok-dup')$$, 'P0001', 'already_linked', 'one account links to one member per group');
reset role;

-- member already taken by a different account
insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_other'), 'outsider@test.local', pg_temp.h('tok-taken'), now() + interval '1 day', tests.id('admin'));
select tests.login_as(tests.id('outsider'));
select throws_ok($$select accept_invite('tok-taken')$$, 'P0001', 'member_taken', 'a linked member cannot be claimed again');
reset role;

-- set_admin ----------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select set_admin(tests.id('m_other'), true)$$, '42501', 'not_admin', 'members cannot promote');
reset role;

select tests.login_as(tests.id('admin'));
select is((select role from set_admin(tests.id('m_member'), true)), 'admin', 'admin promotes a member');
select is((select role from set_admin(tests.id('m_member'), false)), 'member', 'admin demotes a member');
select is((select role from set_admin(tests.id('m_owner'), false)), 'member', 'can demote while another admin remains');
-- The owner (groups.owner_user_id) still passes is_admin, but the guard counts member admins only.
select throws_ok($$select set_admin(tests.id('m_admin'), false)$$, 'P0001', 'last_admin', 'cannot demote the last admin');
select throws_ok($$update members set status = 'left' where id = tests.id('m_admin')$$, 'P0001', 'last_admin', 'cannot mark the last admin as left');
select is((select role from members where id = tests.id('m_admin')), 'admin', 'the refused demotion left the last admin in place');
select is((select status from members where id = tests.id('m_admin')), 'active', 'the refused update left the last admin active');
select throws_ok($$select set_admin(tests.id('m_g2'), true)$$, '42501', 'not_admin', 'cannot touch another group');
select throws_ok($$select set_admin(gen_random_uuid(), true)$$, 'P0001', 'member_not_found', 'unknown member');
reset role;

update members set status = 'left' where id = tests.id('m_other');
select tests.login_as(tests.id('admin'));
select throws_ok($$select set_admin(tests.id('m_other'), true)$$, 'P0001', 'member_not_active', 'members who left cannot be admins');
-- An admin who is not the last one can be marked left, by a plain update.
select is((select role from set_admin(tests.id('m_member'), true)), 'admin', 'a second admin exists again');
select lives_ok($$update members set status = 'left' where id = tests.id('m_member')$$, 'a non-last admin can be marked left');
select is((select status from members where id = tests.id('m_member')), 'left', 'the non-last admin is now left');
-- Leaving removed that admin from the count, so the sole remaining admin is protected again.
select throws_ok($$update members set status = 'left' where id = tests.id('m_admin')$$, 'P0001', 'last_admin', 'the remaining admin is protected again');
reset role;

-- audit trail --------------------------------------------------------------
select ok(exists (select 1 from audit_log where action = 'member.linked' and entity_id = tests.id('m_unlinked')), 'linking is audited');
select ok(exists (select 1 from audit_log where action = 'member.role_changed' and entity_id = tests.id('m_member')), 'role change is audited');
select is((select actor_user_id from audit_log where action = 'member.role_changed' and entity_id = tests.id('m_member') order by created_at limit 1),
  tests.id('admin'), 'audit records who acted');
select ok(exists (select 1 from audit_log where action = 'member.status_changed' and entity_id = tests.id('m_member')), 'status change is audited');
select ok(exists (select 1 from audit_log where action = 'invite.accepted'), 'invite acceptance is audited');
select ok(not exists (select 1 from audit_log where data::text like '%token_hash%'), 'audit never stores token hashes');
update groups set figures_visibility = 'private' where id = tests.id('group');
select ok(exists (select 1 from audit_log where action = 'group.visibility_changed'), 'visibility change is audited');

select * from finish();
rollback;
