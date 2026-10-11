begin;
select * from no_plan();

select tests.remember('u_new', tests.create_user('founder@test.local'));
select tests.remember('u_member', tests.create_user('member@test.local'));

-- privileges
select ok(not has_function_privilege('anon', 'public.create_group(text,text,text,text)', 'EXECUTE'), 'anon cannot execute create_group');
select ok(has_function_privilege('authenticated', 'public.create_group(text,text,text,text)', 'EXECUTE'), 'authenticated can execute create_group');

-- signed out
select tests.login_anon();
select throws_ok($$select create_group('G', 'ZMW', 'Fay Founder', 'Fay')$$, '42501', null, 'anon is refused');

-- happy path
reset role;
select tests.login_as(tests.id('u_new'));
select lives_ok($$select create_group('  Founders Circle  ', 'USD', ' Fay Founder ', ' Fay ')$$, 'founder creates a group');
reset role;
select is((select name || '/' || currency from groups where owner_user_id = tests.id('u_new')), 'Founders Circle/USD', 'group created, name trimmed');
select is((select role || '/' || status || '/' || short_name || '/' || email from members where user_id = tests.id('u_new')),
  'admin/active/Fay/founder@test.local', 'creator is an active admin member with trimmed names and email');
select is((select count(*)::int from audit_log a join groups g on g.id = a.group_id where g.owner_user_id = tests.id('u_new') and a.action = 'group.created'), 1, 'creation is audited');
select tests.login_as(tests.id('u_new'));

-- 1-group rule
select throws_ok($$select create_group('Second', 'ZMW', 'Fay Founder', 'Fay')$$, 'P0001', 'already_in_group', 'owner cannot create a second group');

-- an active member (not owner) of another group is refused too
reset role;
insert into groups (name, owner_user_id) values ('Other', tests.id('u_new'));
insert into members (group_id, full_name, short_name, user_id) select id, 'Mel Member', 'Mel', tests.id('u_member') from groups where name = 'Other';
select tests.login_as(tests.id('u_member'));
select throws_ok($$select create_group('Third', 'ZMW', 'Mel Member', 'Mel')$$, 'P0001', 'already_in_group', 'active member cannot create a group');

-- a member who left may start fresh
reset role;
update members set status = 'left' where user_id = tests.id('u_member');
select tests.login_as(tests.id('u_member'));
select lives_ok($$select create_group('Fresh Start', 'KES', 'Mel Member', 'Mel')$$, 'a member who left can create a group');

-- validation
reset role;
select tests.remember('u_bad', tests.create_user('bad@test.local'));
select tests.login_as(tests.id('u_bad'));
select throws_ok($$select create_group('   ', 'ZMW', 'Bad Actor', 'Bad')$$, 'P0001', 'invalid_body', 'blank group name');
select throws_ok($$select create_group('G', 'EUR', 'Bad Actor', 'Bad')$$, 'P0001', 'invalid_body', 'unsupported currency');
select throws_ok($$select create_group('G', null, 'Bad Actor', 'Bad')$$, 'P0001', 'invalid_body', 'null currency');
select throws_ok($$select create_group('G', 'ZMW', ' ', 'Bad')$$, 'P0001', 'invalid_body', 'blank full name');
select throws_ok($$select create_group('G', 'ZMW', 'Bad Actor', repeat('x', 41))$$, 'P0001', 'invalid_body', 'short name over 40 chars');
reset role;
select is((select count(*)::int from groups where owner_user_id = tests.id('u_bad')), 0, 'failed calls leave nothing behind');

-- accept_invite honours the same rule ----------------------------------------
reset role;
select tests.remember('u_owner2', tests.create_user('owner2@test.local'));
select tests.remember('u_joiner', tests.create_user('joiner@test.local'));
insert into groups (name, owner_user_id) values ('Elsewhere', tests.id('u_owner2'));
insert into members (group_id, full_name, short_name, user_id, role) select id, 'Olga Owner', 'Olga', tests.id('u_owner2'), 'admin' from groups where name = 'Elsewhere';
insert into members (group_id, full_name, short_name, email) select id, 'Zed One', 'Zed', 'founder@test.local' from groups where name = 'Elsewhere';
insert into members (group_id, full_name, short_name, email) select id, 'Jo Joiner', 'Jo', 'joiner@test.local' from groups where name = 'Elsewhere';
create function pg_temp.h(t text) returns text language sql as $$ select encode(extensions.digest(t, 'sha256'), 'hex') $$;
insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  select m.group_id, m.id, m.email, pg_temp.h('tok-' || m.short_name), now() + interval '14 days', tests.id('u_owner2')
  from members m join groups g on g.id = m.group_id where g.name = 'Elsewhere' and m.short_name in ('Zed', 'Jo');
select tests.login_as(tests.id('u_new'));
select throws_ok($$select accept_invite('tok-Zed')$$, 'P0001', 'already_in_group', 'a group owner cannot accept an invite to another group');
reset role;
select tests.login_as(tests.id('u_joiner'));
select lives_ok($$select accept_invite('tok-Jo')$$, 'a user with no group can accept an invite');
reset role;

select * from finish();
rollback;
