begin;
select * from no_plan();
select tests.ledger_fixture();

-- tables and RLS ------------------------------------------------------------------
select has_table('public', t, t || ' exists')
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
select ok((select relrowsecurity from pg_class where oid = ('public.' || t)::regclass), 'RLS is enabled on ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;

-- privileges: clients read through RLS and write nothing ---------------------------
select ok(has_table_privilege('authenticated', 'public.' || t, 'SELECT'), 'authenticated can read ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
select ok(not has_any_column_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,REFERENCES')
          and not has_table_privilege('authenticated', 'public.' || t, 'DELETE,TRUNCATE,TRIGGER'),
  'authenticated cannot write ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
select ok(not has_any_column_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,REFERENCES')
          and not has_table_privilege('anon', 'public.' || t, 'DELETE,TRUNCATE,TRIGGER'),
  'anon holds no privilege on ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
select ok(not has_function_privilege(r, 'public.ledger_append_only()', 'EXECUTE'), r || ' cannot execute ledger_append_only')
from unnest(array['anon', 'authenticated']) as r;

-- sample rows, written as the migration role (as the definer functions will) -----
insert into entries (group_id, period_id, member_id, kind, amount, wallet_id, source) values
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'saving', 500, tests.id('w_airtel'), 'app'),
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'saving', 1, null, 'import'),
  (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 'saving', 700, tests.id('w_airtel'), 'app'),
  (tests.id('lg'), tests.lp(1), null, 'payout_fee', 10, null, 'app');
insert into statements (group_id, period_id, member_id, closing_owed, source) values
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 100, 'close'),
  (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 200, 'close');
insert into group_statements (group_id, period_id, idle_cash, excess_rate, source)
  values (tests.id('lg'), tests.lp(1), 1000, 0.10, 'close');
insert into workbook_figures (group_id, period_id, member_id, field, value) values
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'closing_owed', 100),
  (tests.id('lg'), tests.lp(1), null, 'idle_cash', 990);
with l as (insert into loans (group_id, member_id, period_id, principal, interest, term_months)
           values (tests.id('lg'), tests.lm('Ben'), tests.lp(1), 1000, 150, 1) returning id)
select tests.remember('loan_ben', id) from l;
insert into loan_instalments (group_id, loan_id, period_id, amount_due)
  values (tests.id('lg'), tests.id('loan_ben'), tests.lp(2), 1150);
insert into member_status (group_id, member_id, cycle_id, defaulted, reason)
  values (tests.id('lg'), tests.lm('Cid'), tests.id('lcycle'), true, 'synthetic default');
insert into declarations (group_id, period_id, member_id, saving, wallet_id, submitted_by) values
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 500, tests.id('w_airtel'), tests.id('member')),
  (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 700, tests.id('w_airtel'), tests.id('other'));

-- integrity -----------------------------------------------------------------------
select throws_ok($$insert into entries (group_id, period_id, member_id, kind, amount, source)
  values (tests.id('group2'), tests.lp(1), tests.id('m_g2'), 'saving', 1, 'app')$$, '23503', null, 'an entry cannot point at another group''s month');
select throws_ok($$insert into entries (group_id, period_id, member_id, kind, amount, source)
  values (tests.id('lg'), tests.lp(1), tests.id('m_g2'), 'saving', 1, 'app')$$, '23503', null, 'an entry cannot point at another group''s member');
select throws_ok($$insert into entries (group_id, period_id, member_id, kind, amount, source)
  values (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'saving', 0, 'app')$$, '23514', null, 'entry amounts are positive');
select throws_ok($$insert into entries (group_id, period_id, member_id, kind, amount, source)
  values (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'waiver', 5, 'app')$$, '23514', null, 'a waiver only exists as a correction');
select throws_ok($$insert into entries (group_id, period_id, member_id, kind, amount, source, corrects_entry_id)
  select tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'saving', 5, 'correction', id from entries where amount = 500$$,
  '23514', null, 'a correction needs a reason');
select throws_ok($$insert into statements (group_id, period_id, member_id, source)
  values (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'close')$$, '23505', null, 'one statement per member per month');
select throws_ok($$insert into workbook_figures (group_id, period_id, member_id, field, value)
  values (tests.id('lg'), tests.lp(1), null, 'idle_cash', 1)$$, '23505', null, 'one workbook figure per field, group rows included');
update periods set status = 'open' where id = tests.lp(1);
select throws_ok($$update periods set status = 'open' where id = tests.lp(2)$$, '23505', null, 'one open month per group');
update periods set status = 'planned' where id = tests.lp(1);

-- reads by role -------------------------------------------------------------------
select tests.login_anon();
select throws_ok('select count(*) from ' || t, '42501', null, 'anon cannot read ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
reset role;

select tests.login_as(tests.id('outsider'));
select results_eq('select count(*)::int from ' || t, 'values (0)', 'outsider reads no ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
reset role;

-- figures open (the default): a member reads the whole group's ledger, never the workbook copy
select tests.login_as(tests.id('member'));
select is((select count(*)::int from entries), 4, 'member reads every entry, group-level ones included');
select is((select count(*)::int from statements), 2, 'member reads every statement');
select is((select count(*)::int from declarations), 2, 'member reads every declaration');
select is((select count(*)::int from member_status), 1, 'member reads default flags');
select is((select count(*)::int from loans), 1, 'member reads loans');
select is((select count(*)::int from loan_instalments), 1, 'member reads instalments');
select is((select count(*)::int from periods), 12, 'member reads the months');
select is((select count(*)::int from wallets), 3, 'member reads the wallets');
select is((select count(*)::int from group_statements), 1, 'member reads the group statement');
select is((select count(*)::int from workbook_figures), 0, 'members never read the workbook copy');
reset role;

-- figures private: own rows plus group-level ones
update groups set figures_visibility = 'private' where id = tests.id('lg');
select tests.login_as(tests.id('member'));
select is((select count(*)::int from entries), 3, 'private: own entries and group-level ones');
select is((select count(*)::int from statements), 1, 'private: own statement only');
select is((select count(*)::int from declarations), 1, 'private: own declaration only');
select is((select count(*)::int from member_status), 0, 'private: not another member''s default flag');
select is((select count(*)::int from loans), 1, 'private: own loan');
select is((select count(*)::int from loan_instalments), 1, 'private: own instalments');
select is((select count(*)::int from group_statements), 1, 'private: the group statement is still the group''s');
reset role;
select tests.login_as(tests.id('other'));
select is((select count(*)::int from loans), 0, 'private: not another member''s loan');
select is((select count(*)::int from loan_instalments), 0, 'private: not another member''s instalments');
reset role;

select tests.login_as(tests.id('admin'));
select is((select count(*)::int from entries), 4, 'admin reads every entry');
select is((select count(*)::int from statements), 2, 'admin reads every statement');
select is((select count(*)::int from member_status), 1, 'admin reads default flags');
select is((select count(*)::int from workbook_figures), 2, 'admin reads the workbook copy');
reset role;
select tests.login_as(tests.id('owner'));
select is((select count(*)::int from entries), 4, 'owner reads every entry');
select is((select count(*)::int from workbook_figures), 2, 'owner reads the workbook copy');
reset role;
select tests.login_as(tests.id('owner2'));
select results_eq('select count(*)::int from ' || t || ' where group_id = tests.id(''lg'')', 'values (0)',
  'another group''s admin reads no ' || t || ' of this group')
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
reset role;
update groups set figures_visibility = 'open' where id = tests.id('lg');

-- no client writes, not even for admins ---------------------------------------------
select tests.login_as(tests.id('admin'));
select throws_ok('insert into ' || t || ' default values', '42501', null, 'admin cannot insert into ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
select throws_ok('update ' || t || ' set created_at = now()', '42501', null, 'admin cannot update ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
select throws_ok('delete from ' || t, '42501', null, 'admin cannot delete from ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
reset role;

-- append-only, even for the table owner ----------------------------------------------
select throws_ok('update ' || t || ' set created_at = now()', 'P0001', 'append_only', t || ' rows cannot be edited')
from unnest(array['entries', 'statements', 'group_statements', 'workbook_figures']) as t;
select throws_ok('delete from ' || t, 'P0001', 'append_only', t || ' rows cannot be deleted')
from unnest(array['entries', 'statements', 'group_statements', 'workbook_figures']) as t;
-- the import's switch frees only the import's own rows
select set_config('ledger.import_reset', 'on', true);
select throws_ok($$delete from entries where source = 'app'$$, 'P0001', 'append_only', 'the import switch never frees app rows');
select throws_ok($$delete from statements$$, 'P0001', 'append_only', 'nor closed statements');
select lives_ok($$delete from entries where source = 'import'$$, 'the import switch frees import rows');
select lives_ok($$delete from workbook_figures$$, 'and workbook figures');
select set_config('ledger.import_reset', 'off', true);
select throws_ok($$delete from entries where source = 'app'$$, 'P0001', 'append_only', 'switched off again');

select * from finish();
rollback;
