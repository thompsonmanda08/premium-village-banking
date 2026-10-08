begin;
select * from no_plan();

-- The local seed already created Premium VB; remove it inside this transaction.
delete from public.groups where name = 'Premium Village Banking';

select tests.remember('boss', tests.create_user('boss@test.local'));
select tests.remember('pvb', private.bootstrap_premium_vb(tests.id('boss')));

select is((select count(*)::int from members where group_id = tests.id('pvb')), 18, '18 members created');
select is((select role || '/' || (user_id = tests.id('boss'))::text from members where group_id = tests.id('pvb') and short_name = 'Thompson'),
  'admin/true', 'owner linked to Thompson as admin');
select is((select full_name from members where group_id = tests.id('pvb') and short_name = 'Sapi'), 'Sapi Mulimbika', 'known full names kept');
select is((select count(*)::int from cycles where group_id = tests.id('pvb') and status = 'planned'), 1, 'one planned cycle');
select is((select starts_on::text || ' ' || payout_on::text from cycles where group_id = tests.id('pvb')), '2027-02-15 2028-02-05', 'cycle dates');
select is((select r.min_saving from cycle_rules r join cycles c on c.id = r.cycle_id where c.group_id = tests.id('pvb')), 250::numeric, 'constitution rules');
select is((select jsonb_array_length(r.tenor_bands) from cycle_rules r join cycles c on c.id = r.cycle_id where c.group_id = tests.id('pvb')), 4, 'four tenor bands');
select throws_ok($$select private.bootstrap_premium_vb(tests.id('boss'))$$, 'P0001', 'already_bootstrapped', 'bootstrap runs once');

-- Nothing in schema private is reachable by app roles or PUBLIC, now or on future functions.
select ok(not has_schema_privilege('anon', 'private', 'USAGE,CREATE') and not has_schema_privilege('authenticated', 'private', 'USAGE,CREATE'),
  'app roles hold no privilege on schema private');
select is((select count(*)::int from pg_proc p, unnest(array['anon', 'authenticated']) as r
           where p.pronamespace = 'private'::regnamespace and has_function_privilege(r, p.oid, 'EXECUTE')),
  0, 'app roles can execute nothing in schema private');
select is((select count(*)::int from pg_proc p
           where p.pronamespace = 'private'::regnamespace and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0)),
  0, 'PUBLIC can execute nothing in schema private');

select tests.login_as(tests.id('boss'));
select throws_ok($$select private.bootstrap_premium_vb(auth.uid())$$, '42501', null, 'app users cannot call bootstrap');
reset role;

select * from finish();
rollback;
