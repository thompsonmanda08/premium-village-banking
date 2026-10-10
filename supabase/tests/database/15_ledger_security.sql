begin;
select * from no_plan();
select tests.ledger_fixture();
select tests.ledger_inputs(1);
select tests.remember('entry', (select id from entries where member_id = tests.lm('Ann') and kind = 'saving'));
select tests.remember('interest', (select id from entries where member_id = tests.lm('Cid') and kind = 'loan_interest'));
insert into declarations (group_id, period_id, member_id, saving, wallet_id, submitted_by)
  values (tests.id('lg'), tests.lp(1), tests.lm('Dee'), 250, tests.id('w_airtel'), tests.id('admin'));
select tests.remember('decl', (select id from declarations where member_id = tests.lm('Dee')));

-- Another group's plain member, and another group's cycle and open month, for the cross-group probes.
select tests.remember('g2member', tests.create_user('g2member@test.local'));
insert into members (group_id, full_name, short_name, user_id)
  values (tests.id('group2'), 'Gina Second', 'Gina', tests.id('g2member'));
with c as (insert into cycles (group_id, label, starts_on, ends_on, payout_on)
            values (tests.id('group2'), 'Other 2026', '2026-02-15', '2027-02-15', '2027-02-06') returning id)
select tests.remember('c_g2', id) from c;
with p as (insert into periods (group_id, cycle_id, month_index, label, starts_on, deadline, status)
            values (tests.id('group2'), tests.id('c_g2'), 1, 'Feb 2026', '2026-02-01', '2026-02-07', 'open') returning id)
select tests.remember('p_g2', id) from p;

-- catalogue ----------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', f, 'EXECUTE'), 'anon cannot execute ' || f)
from unnest(array['public.open_period(uuid,integer,date)', 'public.set_deadline(uuid,date,text)',
  'public.submit_declaration(uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text)',
  'public.return_declaration(uuid,text)', 'public.approve_declaration(uuid)', 'public.send_loan(uuid,numeric,uuid,text,numeric)',
  'public.apply_penalty(uuid,uuid,numeric,text,text)', 'public.suggest_penalties(uuid)', 'public.set_default(uuid,uuid,boolean,text)',
  'public.post_correction(uuid,numeric,text)', 'public.post_waiver(uuid,numeric,text)', 'public.close_month(uuid,boolean,text)',
  'public.ledger_check(uuid)', 'public.payout_preview(uuid)', 'public.ledger_append_only()']) as f;
select ok(has_function_privilege('authenticated', f, 'EXECUTE'), 'signed-in users can call ' || f || ' (it checks them itself)')
from unnest(array['public.open_period(uuid,integer,date)', 'public.set_deadline(uuid,date,text)',
  'public.submit_declaration(uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text)',
  'public.return_declaration(uuid,text)', 'public.approve_declaration(uuid)', 'public.send_loan(uuid,numeric,uuid,text,numeric)',
  'public.apply_penalty(uuid,uuid,numeric,text,text)', 'public.suggest_penalties(uuid)', 'public.set_default(uuid,uuid,boolean,text)',
  'public.post_correction(uuid,numeric,text)', 'public.post_waiver(uuid,numeric,text)', 'public.close_month(uuid,boolean,text)',
  'public.ledger_check(uuid)', 'public.payout_preview(uuid)']) as f;
select is((select count(*)::int from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
           where p.pronamespace = 'public'::regnamespace and a.grantee = 0
             and p.proname in ('open_period', 'set_deadline', 'submit_declaration', 'return_declaration', 'approve_declaration',
                               'send_loan', 'apply_penalty', 'suggest_penalties', 'set_default', 'post_correction', 'post_waiver',
                               'close_month', 'ledger_check', 'payout_preview', 'ledger_append_only')),
  0, 'PUBLIC executes none of the ledger functions');
select ok((select bool_and(prosecdef) from pg_proc
           where pronamespace = 'public'::regnamespace
             and proname in ('open_period', 'set_deadline', 'submit_declaration', 'return_declaration', 'approve_declaration',
                             'send_loan', 'apply_penalty', 'suggest_penalties', 'set_default', 'post_correction', 'post_waiver',
                             'close_month', 'ledger_check', 'payout_preview')),
  'every ledger API function is security definer (05_hardening checks their search_path)');
select is((select count(*)::int from pg_proc p, unnest(array['anon', 'authenticated']) as r
           where p.pronamespace = 'private'::regnamespace and has_function_privilege(r, p.oid, 'EXECUTE')),
  0, 'app roles execute nothing in private (close_figures, import_history, …)');

-- Every function the ledger added, public and private, searches pg_temp last (a temp table cannot shadow a ledger table).
select is((select count(*)::int from pg_proc
           where (pronamespace = 'public'::regnamespace
                  and proname in ('open_period', 'set_deadline', 'submit_declaration', 'return_declaration', 'approve_declaration',
                                  'send_loan', 'apply_penalty', 'suggest_penalties', 'set_default', 'post_correction',
                                  'post_waiver', 'close_month', 'ledger_check', 'payout_preview', 'ledger_append_only'))
              or (pronamespace = 'private'::regnamespace
                  and proname in ('audit', 'ensure_periods', 'schedule_loan', 'lending_cash', 'member_balance', 'loans_owed',
                                  'close_figures', 'write_close', 'close_diff', 'check_cycle', 'import_history'))),
  26, 'the 26 ledger functions are all there');
select is(array(select pronamespace::regnamespace || '.' || proname from pg_proc
                where (pronamespace = 'public'::regnamespace
                       and proname in ('open_period', 'set_deadline', 'submit_declaration', 'return_declaration',
                                       'approve_declaration', 'send_loan', 'apply_penalty', 'suggest_penalties', 'set_default',
                                       'post_correction', 'post_waiver', 'close_month', 'ledger_check', 'payout_preview',
                                       'ledger_append_only'))
                   or (pronamespace = 'private'::regnamespace
                       and proname in ('audit', 'ensure_periods', 'schedule_loan', 'lending_cash', 'member_balance', 'loans_owed',
                                       'close_figures', 'write_close', 'close_diff', 'check_cycle', 'import_history'))
                except
                select pronamespace::regnamespace || '.' || proname from pg_proc
                where coalesce(proconfig, '{}') @> array['search_path=public, pg_temp']),
  '{}'::text[], 'every ledger function sets search_path = public, pg_temp');
select ok(not has_table_privilege(r, 'private.ledger_lines', 'SELECT'), r || ' cannot read private.ledger_lines')
from unnest(array['anon', 'authenticated']) as r;

-- Tables: RLS on, reads only. 06_ledger_tables checks each table and role; these are the sweep's totals.
select is(array(select t from unnest(array['wallets', 'periods', 'declarations', 'entries', 'loans', 'loan_instalments',
                                           'member_status', 'statements', 'group_statements', 'workbook_figures']) as t
                where not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass)),
  '{}'::text[], 'RLS is on for all ten ledger tables');
select is(array(select tablename || ':' || policyname from pg_policies
                where schemaname = 'public' and cmd <> 'SELECT'
                  and tablename in ('wallets', 'periods', 'declarations', 'entries', 'loans', 'loan_instalments',
                                    'member_status', 'statements', 'group_statements', 'workbook_figures')),
  '{}'::text[], 'no ledger table has a policy that writes');
select is(array(select r || ' ' || p || ' ' || t
                from unnest(array['wallets', 'periods', 'declarations', 'entries', 'loans', 'loan_instalments',
                                  'member_status', 'statements', 'group_statements', 'workbook_figures']) as t,
                     unnest(array['anon', 'authenticated']) as r,
                     unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) as p
                where has_table_privilege(r, 'public.' || t, p)),
  '{}'::text[], 'anon and authenticated hold no write privilege on any ledger table');

-- Append-only: 06_ledger_tables checks UPDATE and DELETE on entries, statements, group_statements, workbook_figures.
-- TRUNCATE skips row triggers and only the table owner can run it (app roles hold no TRUNCATE privilege, checked above),
-- but nothing stops the owner yet. Known gap, closed by the hardening migration after Task 14; then replace the skip with:
--   select throws_ok('truncate entries', 'P0001', 'append_only', 'entries cannot be truncated');
select skip('known gap: entries has no TRUNCATE trigger yet (hardening migration)', 1);

-- the matrix ---------------------------------------------------------------------------------------
select tests.login_anon();
select throws_ok(c.call, '42501', null, 'anon: ' || c.name) from tests.admin_calls() c;
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$, '42501', null,
  'anon: submit_declaration');
select throws_ok($$select * from payout_preview(tests.id('lcycle'))$$, '42501', null, 'anon: payout_preview');
reset role;

select tests.login_as(tests.id('outsider'));
select throws_ok(c.call, '42501', 'not_admin', 'outsider: ' || c.name) from tests.admin_calls() c;
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'member_not_found', 'outsider: submit_declaration');
select throws_ok($$select * from payout_preview(tests.id('lcycle'))$$, '42501', 'not_admin', 'outsider: payout_preview');
reset role;

select tests.login_as(tests.id('g2member'));
select throws_ok(c.call, '42501', 'not_admin', 'another group''s member: ' || c.name) from tests.admin_calls() c;
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'member_not_found', 'another group''s member: submit_declaration');
select throws_ok($$select * from payout_preview(tests.id('lcycle'))$$, '42501', 'not_admin', 'another group''s member: payout_preview');
reset role;

select tests.login_as(tests.id('member'));
select throws_ok(c.call, '42501', 'not_admin', 'member: ' || c.name) from tests.admin_calls() c;
select lives_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$,
  'member: declares for themselves');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Cid'), 500, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'member_not_found', 'member: not for someone else');
select lives_ok($$select * from payout_preview(tests.id('lcycle'))$$, 'member: payout preview');
reset role;

select tests.login_as(tests.id('owner2'));
select throws_ok(c.call, '42501', 'not_admin', 'another group''s admin: ' || c.name) from tests.admin_calls() c;
reset role;

-- Cross-group probing: where a function promises it, an id from another group is refused exactly like one that does
-- not exist, so this group's treasurer cannot learn what another group holds. (Functions that look the row up before
-- checking the caller answer not_admin for a foreign id and *_not_found for a missing one; ids are random UUIDs.)
select tests.login_as(tests.id('admin'));
select throws_ok(c, '42501', 'not_admin', 'probe: ' || c)
from unnest(array[$$select open_period(tests.id('c_g2'), 2)$$, $$select open_period(gen_random_uuid(), 2)$$,
                  $$select ledger_check(tests.id('group2'))$$, $$select ledger_check(gen_random_uuid())$$,
                  $$select * from payout_preview(tests.id('c_g2'))$$, $$select * from payout_preview(gen_random_uuid())$$]) as c;
select throws_ok(c, 'P0001', 'member_not_found', 'probe: ' || c)
from unnest(array[$$select submit_declaration(tests.lp(1), tests.id('m_g2'), 500, p_wallet => tests.id('w_airtel'))$$,
                  $$select submit_declaration(tests.lp(1), gen_random_uuid(), 500, p_wallet => tests.id('w_airtel'))$$,
                  $$select set_default(tests.lm('Dee'), tests.id('c_g2'), true, 'x')$$,
                  $$select set_default(tests.lm('Dee'), gen_random_uuid(), true, 'x')$$]) as c;
select throws_ok(c, 'P0001', 'period_not_open', 'probe: ' || c)
from unnest(array[$$select submit_declaration(tests.id('p_g2'), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$,
                  $$select submit_declaration(gen_random_uuid(), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$]) as c;
select throws_ok(c, 'P0001', 'wallet_not_found', 'probe: ' || c)
from unnest(array[$$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_g2'))$$,
                  $$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => gen_random_uuid())$$,
                  $$select send_loan(tests.lm('Dee'), 10, tests.id('w_g2'))$$,
                  $$select send_loan(tests.lm('Dee'), 10, gen_random_uuid())$$]) as c;

-- admin and owner get through (spot checks; each function's own file covers its behaviour)
select lives_ok($$select * from suggest_penalties(tests.lp(1))$$, 'admin: suggest_penalties');
select lives_ok($$select ledger_check(tests.id('lg'))$$, 'admin: ledger_check');
reset role;
-- (Dee's and Ben's declarations are still waiting, so the owner decides them before previewing the close.)
select tests.login_as(tests.id('owner'));
select lives_ok($$select approve_declaration(tests.id('decl'))$$, 'owner: approve');
select lives_ok($$select return_declaration((select id from declarations where member_id = tests.lm('Ben')), 'test')$$, 'owner: return');
select lives_ok($$select close_month(tests.lp(1))$$, 'owner: close preview');
select lives_ok($$select * from payout_preview(tests.id('lcycle'))$$, 'owner: payout preview');
reset role;

select * from finish();
rollback;
