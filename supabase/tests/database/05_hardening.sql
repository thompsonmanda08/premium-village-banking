begin;
select * from no_plan();
select tests.fixture();

-- Security definer functions resolve names with pg_temp searched last, so a session's temp
-- tables can never shadow the tables they read (PostgreSQL searches pg_temp first otherwise).
select is((select count(*)::int from pg_proc
           where pronamespace = 'public'::regnamespace and prosecdef
             and coalesce(proconfig, '{}') @> array['search_path=public, pg_temp']),
          (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and prosecdef),
          'every public security definer function searches pg_temp last');
select ok((select count(*) from pg_proc where pronamespace = 'public'::regnamespace and prosecdef) >= 8,
          'the definer functions are all there');

-- Invite lifetime is capped in the database, not only by the Edge Function.
select throws_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_unlinked'), 'x@test.local', 'hash-long', now() + interval '1 year', tests.id('admin'))$$,
  '23514', null, 'an invite cannot outlive the invite TTL');
select lives_ok($$insert into invites (group_id, member_id, email, token_hash, expires_at, created_by)
  values (tests.id('group'), tests.id('m_unlinked'), 'x@test.local', 'hash-ttl', now() + interval '14 days', tests.id('admin'))$$,
  'a 14-day invite is accepted');

select * from finish();
rollback;
