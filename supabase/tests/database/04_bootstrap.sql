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
select is((select r.loan_multiples::jsonb from cycle_rules r join cycles c on c.id = r.cycle_id where c.group_id = tests.id('pvb')),
  '[{"from_month":1,"to_month":4,"multiple":3},{"from_month":5,"to_month":9,"multiple":2},{"from_month":10,"to_month":11,"multiple":1},{"from_month":12,"to_month":12,"multiple":0}]'::jsonb,
  'loan multiples follow the constitution');
select is((select r.tenor_bands::jsonb from cycle_rules r join cycles c on c.id = r.cycle_id where c.group_id = tests.id('pvb')),
  '[{"max":3000,"months":1},{"max":5000,"months":2},{"max":9999.99,"months":3},{"max":null,"months":4}]'::jsonb,
  'tenor bands follow the constitution');
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
