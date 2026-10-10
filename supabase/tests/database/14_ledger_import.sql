begin;
select * from no_plan();
select tests.fixture();

-- A small synthetic group and a made-up two-month bundle shaped like the parser's output (Task 11).
create function pg_temp.new_group(p_name text) returns uuid language sql as $$
  with g as (insert into groups (name, owner_user_id) values (p_name, tests.id('owner2')) returning id),
  m as (insert into members (group_id, full_name, short_name)
        select g.id, x.f, x.s from g, (values ('Ann Alpha', 'Ann'), ('Ben Beta', 'Ben'), ('Cid Gamma', 'Cid')) as x(f, s))
  select id from g
$$;
select tests.remember('ig', pg_temp.new_group('Import Group'));

-- February: savings 3,000 + 500 + 500 = 4,000; Ben borrows 1,000 + 2,000 (one cell, two loans) at 15% = 450.
--   Idle 4,000 − 3,000 = 1,000 (the workbook did not take February's K20 loan fee out); excess 100 split 75 / 12.50 / 12.50.
--   Received against February (paid in March's window): Ann 75, Ben 2,000, Cid 0.
-- March: savings 0 + 500 + 250; Cid borrows 600 at 15% = 90; loan fee K10, which the workbook took from cash:
--   workbook opening 1,000 + 2,075 = 3,075; idle 3,075 + 750 − 600 − 10 = 3,215; excess 321.50 split by 3,000/1,000/750
--   of 4,750: 203.0526…, 67.6842…, 50.7631… Names are matched ignoring case and spaces, by short or full name.
select tests.keep('bundle', $json$
{
  "cycle": {"label": "Cycle 2026", "starts_on": "2026-02-15", "ends_on": "2027-02-15", "payout_on": "2027-02-06"},
  "through": 2,
  "deadlines": {"1": "2026-02-17"},
  "months": [
    {"month_index": 1, "fee_spent": 20,
     "group": {"opening_cash": null, "idle_cash": 1000, "excess_billed": 100},
     "rows": [
       {"name": "Ann", "saving": 3000, "cum_savings": 3000, "txn_fee": 10, "membership": 50, "loans": [], "interest": 0,
        "excess": 75, "penalty": 0, "total": 75, "minimum": 75, "received": 75},
       {"name": "ben", "saving": 500, "cum_savings": 500, "txn_fee": 0, "membership": 50, "loans": [1000, 2000], "interest": 450,
        "excess": 12.5, "penalty": 0, "total": 3462.5, "minimum": 3462.5, "received": 2000},
       {"name": " Cid Gamma ", "saving": 500, "cum_savings": 500, "txn_fee": 0, "membership": 0, "loans": [], "interest": 0,
        "excess": 12.5, "penalty": 0, "total": 12.5, "minimum": 12.5, "received": 0}
     ]},
    {"month_index": 2, "fee_spent": 10,
     "group": {"opening_cash": 3075, "idle_cash": 3215, "excess_billed": 321.5},
     "rows": [
       {"name": "Ann", "saving": 0, "cum_savings": 3000, "txn_fee": 0, "membership": 0, "loans": [], "interest": 0,
        "excess": 203.0526315789, "penalty": 0, "total": 203.0526315789, "minimum": 203.05, "received": null},
       {"name": "ben", "saving": 500, "cum_savings": 1000, "txn_fee": 0, "membership": 0, "loans": [], "interest": 0,
        "excess": 67.6842105263, "penalty": 0, "total": 1530.1842105263, "minimum": 800, "received": null},
       {"name": " Cid Gamma ", "saving": 250, "cum_savings": 750, "txn_fee": 0, "membership": 0, "loans": [600], "interest": 90,
        "excess": 50.7631578947, "penalty": 0, "total": 753.2631578947, "minimum": 753.26, "received": null}
     ]}
  ]
}
$json$::jsonb);

-- only the owner (the script's database login) can run it
select ok(not has_function_privilege('authenticated', 'private.import_history(uuid, jsonb)', 'EXECUTE'), 'app roles cannot import');
select ok(not has_function_privilege('anon', 'private.import_history(uuid, jsonb)', 'EXECUTE'), 'nor can anon');
select tests.login_as(tests.id('owner2'));
select throws_ok($$select private.import_history(tests.id('ig'), tests.kept('bundle'))$$, '42501', null, 'not even the group owner, from the app');
reset role;

-- refusals before anything is written
select throws_ok($$select private.import_history(gen_random_uuid(), tests.kept('bundle'))$$,
  '42501', 'not_admin', 'an unknown group is refused as other ledger functions refuse one');
select throws_ok($$select private.import_history(tests.id('ig'), jsonb_set(tests.kept('bundle'), '{months,0,rows,0,name}', '"Zoe"'))$$,
  'P0001', 'member_not_found', 'a workbook name that matches no member stops the import');
select throws_ok($$select private.import_history(tests.id('ig'), jsonb_set(tests.kept('bundle'), '{months,0,rows,1,name}', '"ann"'))$$,
  'P0001', 'member_not_found', 'two rows of one month on the same member stop it');
select throws_ok($$select private.import_history(tests.id('ig'), jsonb_set(tests.kept('bundle'), '{through}', '3'))$$,
  'P0001', 'invalid_amount', 'the bundle must hold months 1 to through');
-- malformed bundles: every amount a JSON number from 0 to under 10^10, names present, dates real
select throws_ok(format($$select private.import_history(tests.id('ig'), jsonb_set(tests.kept('bundle'), %L, %L))$$, x.path, x.val),
  'P0001', 'invalid_amount', 'malformed: ' || x.what)
from (values
  ('{through}', '2.5', 'a fractional "through"'),
  ('{through}', 'null', 'no "through"'),
  ('{months,0,rows,0,name}', 'null', 'a row with no name'),
  ('{months,0,rows,0,name}', '"  "', 'a blank name'),
  ('{months,0,rows,0,saving}', '"NaN"', 'NaN'),
  ('{months,0,rows,0,saving}', '"3000"', 'a number written as text'),
  ('{months,0,rows,0,saving}', '-1', 'a negative saving'),
  ('{months,0,rows,0,received}', '-75', 'a negative receipt'),
  ('{months,0,rows,0,saving}', '10000000000', '10^10'),
  ('{months,0,rows,0,total}', '-10000000000', 'a figure past numeric(12,2)'),
  ('{months,0,rows,1,loans}', '[1000, "x"]', 'a loan that is not a number'),
  ('{months,0,rows,1,loans}', '1000', 'loans that are not a list'),
  ('{months,0,rows,0,interest}', '10', 'interest with no loan to carry it'),
  ('{months,0,fee_spent}', '-20', 'a negative loan fee'),
  ('{months,0,group,idle_cash}', '"1000"', 'a group figure written as text'),
  ('{deadlines}', '{"1": "2026-02-30"}', 'a date that does not exist'),
  ('{deadlines}', '{"13": "2027-03-07"}', 'a deadline for a thirteenth month'),
  ('{deadlines}', '{"2": "2026-02-20"}', 'a deadline before its month starts'),
  ('{cycle,starts_on}', '"soon"', 'a cycle start that is not a date'),
  ('{cycle,payout_on}', '"2027-03-01"', 'a payout after the cycle ends')
) as x(path, val, what);
select throws_ok($$select private.import_history(tests.id('ig'), jsonb_set(tests.kept('bundle'), '{months,1,rows}', 'null'))$$,
  'P0001', 'invalid_amount', 'malformed: a month whose rows are null');
select throws_ok($$select private.import_history(tests.id('ig'), tests.kept('bundle') #- '{months,1,rows}')$$,
  'P0001', 'invalid_amount', 'malformed: a month with no rows');
-- The refusal says which row carries interest with no loan.
create function pg_temp.detail(q text) returns text language plpgsql as $f$
declare d text;
begin
  execute q;
  return null;
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  return d;
end $f$;
select is(pg_temp.detail($$select private.import_history(tests.id('ig'),
            jsonb_set(jsonb_set(tests.kept('bundle'), '{months,0,rows,0,interest}', '10'), '{months,1,rows,2,loans}', '[]'))$$),
  'Interest with no loan: Ann in month 1, Cid Gamma in month 2', 'interest with no loan names the member and the month');
select is((select count(*)::int from cycles where group_id = tests.id('ig')), 0, 'a refused import leaves nothing behind');
-- a name matching two members (one's short name, the other's full name)
select tests.remember('ig_amb', pg_temp.new_group('Ambiguous Group'));
insert into members (group_id, full_name, short_name) values (tests.id('ig_amb'), 'Ben', 'Benny');
select throws_ok($$select private.import_history(tests.id('ig_amb'), tests.kept('bundle'))$$,
  'P0001', 'member_not_found', 'a name that matches two members stops the import');

-- import --------------------------------------------------------------------------------------------------
select tests.keep('summary', private.import_history(tests.id('ig'), tests.kept('bundle')));
select tests.remember('icycle', (select id from cycles where group_id = tests.id('ig') and label = 'Cycle 2026'));
create function pg_temp.ip(m int) returns uuid language sql as $$
  select id from public.periods where cycle_id = tests.id('icycle') and month_index = m
$$;
create function pg_temp.im(s text) returns uuid language sql as $$
  select id from public.members where group_id = tests.id('ig') and short_name = s
$$;

select is((select status || ' ' || starts_on || ' ' || payout_on from cycles where id = tests.id('icycle')), 'active 2026-02-15 2027-02-06',
  'Cycle 2026 is created and active');
select is((select count(*)::int from cycle_rules where cycle_id = tests.id('icycle')), 1, 'with the constitution''s rules');
select is((select array_agg(status order by month_index) from periods where cycle_id = tests.id('icycle') and month_index <= 3),
  array['closed', 'closed', 'planned'], 'imported months are closed; the next one is ready to open');
select is((select count(*)::int from periods where cycle_id = tests.id('icycle')), 12, 'all twelve months exist');
select is((select deadline from periods where id = pg_temp.ip(1)), date '2026-02-17', 'February''s announced deadline');
select is((select deadline from periods where id = pg_temp.ip(2)), date '2026-03-07', 'otherwise the 7th');
select is((select array_agg(name order by name) from wallets where group_id = tests.id('ig')), array['Airtel', 'MTN'], 'the two wallets');
select is((select count(*)::int from entries e join periods p on p.id = e.period_id
           where p.cycle_id = tests.id('icycle') and e.source <> 'import'), 0, 'every row is marked as imported');
select is((select count(*)::int from audit_log where action = 'ledger.imported' and entity_id = tests.id('icycle')), 1,
  'the import is audited');
select is((select data from audit_log where action = 'ledger.imported' and entity_id = tests.id('icycle')),
  tests.kept('summary') - 'cycle_id', 'with the summary''s counts and totals');

-- Payments move to the month they arrived in.
select is((select array_agg(m.short_name || ' ' || e.amount order by m.short_name) from entries e join members m on m.id = e.member_id
           where e.period_id = pg_temp.ip(2) and e.kind = 'payment'), array['Ann 75.00', 'Ben 2000.00'],
  'February''s receipts are March''s payments');
-- Ben's cell of two loans is two loans, each with its share of the 450 interest: 150 and 300.
select is((select array_agg(principal || '/' || interest order by sent_at) from loans where member_id = pg_temp.im('Ben')),
  array['1000.00/150.00', '2000.00/300.00'], 'one row per loan, interest as the workbook charged it');
select is((select count(*)::int from loans where group_id = tests.id('ig') and wallet_id is not null), 0,
  'imported loans name no wallet (the workbook has none)');

-- Every member has a statement for every imported month (private.loans_owed reads them).
select is((select count(*)::int from statements s join periods p on p.id = s.period_id where p.cycle_id = tests.id('icycle')), 6,
  'three statements in each imported month');
select is(private.loans_owed(pg_temp.im('Ben'), pg_temp.ip(2)), 1530.18, 'Ben still owes 3,450 − 450 − 1,469.82 on loans');
select is(private.loans_owed(pg_temp.im('Cid'), pg_temp.ip(2)), 690.00, 'Cid owes 690 on loans');

-- February statements (official = the workbook's excess, total and minimum; the rest by the ledger's rules)
select is((select closing_owed || '/' || next_minimum from statements s join members m on m.id = s.member_id
           where s.period_id = pg_temp.ip(1) and m.short_name = 'Ben'), '3462.50/3462.50', 'Ben: 3,000 + 450 + 12.50');
select is((select idle_cash || '/' || excess_billed || '/' || fee_pot_balance || '/' || meeting_pot_balance
           from group_statements where period_id = pg_temp.ip(1)), '1000.00/100.00/-10.00/100.00',
  'February: idle 1,000; excess 100; fee pot 10 − 20; meeting pot 100');
-- March: Ben pays 2,000 → 80.18 to excess (12.50 + 67.68), 450 to interest, 1,469.82 to principal.
--   Closing 3,462.50 + 67.68 − 2,000 = 1,530.18; unpaid minimum 3,462.50 − 2,000 = 1,462.50; minimum 800 (the workbook's).
select is((select paid_to_excess || '/' || paid_to_interest || '/' || paid_to_principal || '/' || closing_owed || '/' || unpaid_minimum
                  || '/' || next_minimum
           from statements s join members m on m.id = s.member_id where s.period_id = pg_temp.ip(2) and m.short_name = 'Ben'),
  '80.18/450.00/1469.82/1530.18/1462.50/800.00', 'Ben''s March statement');
select is((select closing_owed from statements s join members m on m.id = s.member_id
           where s.period_id = pg_temp.ip(2) and m.short_name = 'Cid'), 753.26, 'Cid: 12.50 + 600 + 90 + 50.76');
-- Interest collected in March: 75 (Ann's excess) + 80.18 + 450 = 605.18, shared over 4,750:
--   Ann 3,000 → 382.2189 → 382.21; Ben 1,000 → 127.4063 → 127.40; Cid 750 → 95.5547 → 95.55; sum 605.16, 0.02 to Ann → 382.23.
select is((select array_agg(m.short_name || ' ' || s.interest_earned order by m.short_name) from statements s join members m on m.id = s.member_id
           where s.period_id = pg_temp.ip(2)), array['Ann 382.23', 'Ben 127.40', 'Cid 95.55'],
  'interest earned before November follows the ledger''s rule');
-- Group: opening 1,000 + 2,075 = 3,075; idle 3,075 + 750 − 600 = 3,225 (the loan fee came from the fee pot);
--   excess billed = the workbook's shares 203.05 + 67.68 + 50.76 = 321.49; fee pot −10 − 10 = −20.
select is((select opening_cash || '/' || idle_cash || '/' || excess_billed || '/' || interest_collected || '/' || fee_pot_balance
           from group_statements where period_id = pg_temp.ip(2)), '3075.00/3225.00/321.49/605.18/-20.00', 'March''s group statement');
select is((select value from workbook_figures where period_id = pg_temp.ip(2) and member_id is null and field = 'idle_cash'), 3215.00,
  'the workbook''s own idle cash is kept for comparison');

-- The pots the payout would share (from ledger lines) are the pots the imported statements show: 10 − 30 + 100 = 80.
select tests.login_as(tests.id('owner2'));
select tests.keep('pots', jsonb_build_object('v', (select sum(pot_share) from payout_preview(tests.id('icycle')))));
reset role;
select is((tests.kept('pots') ->> 'v')::numeric,
  (select fee_pot_balance + meeting_pot_balance from group_statements where period_id = pg_temp.ip(2)),
  'payout preview pots reconcile with the imported group statement');
select is((tests.kept('pots') ->> 'v')::numeric, 80.00, 'fee pot −20 + meeting pot 100');

-- Loans still owed are rebuilt from May (month 4): the workbook's last minimum covers April. What each loan still owes
-- comes from the payment split (oldest loan first), never from loans.status.
select is((select array_agg((x ->> 'remaining')::numeric order by n)
           from jsonb_array_elements(private.close_figures(pg_temp.ip(2), true) -> 'loans') with ordinality as t(x, n)),
  array[0.00, 1530.18, 690.00], 'Ben''s 1,000 is repaid; his 2,000 and Cid''s 600 are still owed');
select is((select array_agg(p.month_index || ':' || i.amount_due order by p.month_index) from loan_instalments i
           join periods p on p.id = i.period_id join loans l on l.id = i.loan_id where l.principal = 1000 and l.group_id = tests.id('ig')),
  array['2:1150.00'], 'the repaid loan keeps its own schedule for replays');
select is((select array_agg(p.month_index || ':' || i.amount_due order by p.month_index) from loan_instalments i
           join periods p on p.id = i.period_id join loans l on l.id = i.loan_id where l.principal = 2000 and l.group_id = tests.id('ig')),
  array['2:2300.00', '4:1530.18'], 'Ben''s remaining 1,530.18 falls due in May');
select is((select array_agg(p.month_index || ':' || i.amount_due order by p.month_index) from loan_instalments i
           join periods p on p.id = i.period_id join loans l on l.id = i.loan_id where l.principal = 600 and l.group_id = tests.id('ig')),
  array['3:690.00', '4:690.00'], 'Cid''s April instalment stays (the workbook asked for it); May asks the 690 still owed');

-- Summary: counts and totals only.
select is((tests.kept('summary') ->> 'entries')::int, 27, '27 entries');
select is((tests.kept('summary') ->> 'open_loans')::int, 2, 'two loans still owed');
select is((tests.kept('summary') ->> 'owed')::numeric, 2486.49, 'owed 203.05 + 1,530.18 + 753.26');
select is((tests.kept('summary') ->> 'savings')::numeric, 4750.00, 'savings 4,750');
select is((tests.kept('summary') ->> 'fee_pot_balance')::numeric || '/' || (tests.kept('summary') ->> 'meeting_pot_balance')::numeric,
  '-20.00/100.00', 'the pots, so the operator sees a fee pot short by 20');
select is(tests.kept('summary') -> 'receipts_not_imported', '{"count": 0, "total": 0}'::jsonb, 'March has no receipts left over');

-- Replaying March with the ledger's own rules: every difference is explained.
select tests.keep('replay', jsonb_build_object('diff', private.close_diff(pg_temp.ip(2), private.close_figures(pg_temp.ip(2), false))));
select is((select count(*)::int from jsonb_array_elements(tests.kept('replay') -> 'diff') d where d ->> 'reason_code' = 'unexplained'), 0,
  'nothing unexplained');
select is(tests.reason('replay', null, 'idle_cash'), 'fee_pot_vs_cash', 'idle cash: the K10 loan fee');
select is(tests.reason('replay', 'Ben', 'next_minimum'), 'workbook_term_differs', 'Ben''s minimum: the workbook spread his debt');
select is(tests.reason('replay', 'Ann', 'next_minimum'), 'workbook_rounded', 'Ann''s minimum: the workbook''s excess, to the ngwee');
select is(jsonb_array_length(private.close_diff(pg_temp.ip(1), private.close_figures(pg_temp.ip(1), false))), 0,
  'February replays exactly');
-- The admin check page sees every workbook figure matched by an app figure, and nothing unexplained.
select is((select count(*)::int from jsonb_array_elements(private.check_cycle(tests.id('icycle')) -> 'periods') p,
                                     jsonb_array_elements(p -> 'diff') d
           where d ->> 'reason_code' = 'unexplained' or d -> 'app' = 'null'::jsonb), 0, 'ledger check: nothing unexplained');

-- close_month on imported months: a preview replays, a commit is refused.
select tests.login_as(tests.id('owner2'));
select tests.keep('mar_preview', close_month(pg_temp.ip(2)));
select throws_ok($$select close_month(pg_temp.ip(2), true, 'again')$$, 'P0001', 'already_closed', 'an imported month stays closed');
reset role;
select is((tests.kept('mar_preview') ->> 'unexplained')::int, 0, 'close preview of an imported month: nothing unexplained');
select is(tests.kept('mar_preview') -> 'diff', tests.kept('replay') -> 'diff', 'and the same differences as the replay');

-- Re-running replaces the import, it does not double it.
select lives_ok($$select private.import_history(tests.id('ig'), tests.kept('bundle'))$$, 'the import runs again');
select is((select count(*)::int from entries e join periods p on p.id = e.period_id where p.cycle_id = tests.id('icycle')), 27,
  'still 27 entries');
select is((select count(*)::int from workbook_figures w join periods p on p.id = w.period_id where p.cycle_id = tests.id('icycle')), 29,
  'still 29 workbook figures (12 + 2 in February, 12 + 3 in March)');
select is((select count(*)::int from statements s join periods p on p.id = s.period_id where p.cycle_id = tests.id('icycle')), 6,
  'still 6 statements');
select is((select count(*)::int from loans l join periods p on p.id = l.period_id where p.cycle_id = tests.id('icycle')), 3, 'still 3 loans');
select is((select count(*)::int from loan_instalments i join loans l on l.id = i.loan_id where l.group_id = tests.id('ig')), 5,
  'still 5 instalments');
select is((select count(*)::int from cycles where group_id = tests.id('ig')), 1, 'one cycle');
select is((select count(*)::int from audit_log where action = 'ledger.imported' and entity_id = tests.id('icycle')), 2,
  'each run is audited');

-- The workbook's own record wins where the ledger's arithmetic would differ: Cid's March total says 760 and his
-- cumulative savings 800 (the ledger would say 753.26 and 750). The replay still shows the difference.
select tests.remember('ig_wb', pg_temp.new_group('Workbook Group'));
select tests.keep('wb_summary', private.import_history(tests.id('ig_wb'),
  jsonb_set(jsonb_set(tests.kept('bundle'), '{months,1,rows,2,total}', '760'), '{months,1,rows,2,cum_savings}', '800')));
select is((select s.closing_owed || '/' || s.cum_savings from statements s join periods p on p.id = s.period_id
           join members m on m.id = s.member_id
           where m.group_id = tests.id('ig_wb') and m.short_name = 'Cid' and p.month_index = 2), '760.00/800.00',
  'the stored statement is the workbook''s');
select is((select total_owed || '/' || total_savings from group_statements g join periods p on p.id = g.period_id
           where g.group_id = tests.id('ig_wb') and p.month_index = 2), '2493.23/4800.00', 'and the group totals add it up');
select is((tests.kept('wb_summary') ->> 'owed')::numeric, 2493.23, 'as does the summary');

-- Cycle identity: a relabelled cycle with the same start is the same cycle; a clash is refused.
select tests.remember('ig_rel', pg_temp.new_group('Relabel Group'));
select private.create_cycle(tests.id('ig_rel'), '2026 Cycle', date '2026-02-15', date '2027-02-15', date '2027-02-06');
select lives_ok($$select private.import_history(tests.id('ig_rel'), tests.kept('bundle'))$$, 'an import into a relabelled cycle');
select is((select array_agg(label || ' ' || status) from cycles where group_id = tests.id('ig_rel')), array['2026 Cycle active'],
  'reuses it: one cycle, its label kept');
select is((select count(*)::int from statements where group_id = tests.id('ig_rel')), 6, 'and fills it');
select tests.remember('ig_clash', pg_temp.new_group('Clash Group'));
select private.create_cycle(tests.id('ig_clash'), 'Cycle 2026', date '2026-03-01', date '2027-03-01', date '2027-02-20');
select throws_ok($$select private.import_history(tests.id('ig_clash'), tests.kept('bundle'))$$, 'P0001', 'cycle_overlap',
  'the label on a cycle with another start date');
select private.create_cycle(tests.id('ig_clash'), 'Other', date '2026-02-15', date '2027-02-15', date '2027-02-06');
select throws_ok($$select private.import_history(tests.id('ig_clash'), tests.kept('bundle'))$$, 'P0001', 'cycle_overlap',
  'the label and the start date on two different cycles');
select tests.remember('ig_over', pg_temp.new_group('Overlap Group'));
select private.create_cycle(tests.id('ig_over'), 'Cycle 2025', date '2025-06-01', date '2026-06-01', date '2026-05-20');
update cycles set status = 'active' where group_id = tests.id('ig_over');
select throws_ok($$select private.import_history(tests.id('ig_over'), tests.kept('bundle'))$$, 'P0001', 'cycle_overlap',
  'another active cycle over the same dates');
select is((select count(*)::int from cycles where group_id = tests.id('ig_over')), 1, 'no second active cycle');

-- The real flow: February first, then again through March. February's receipts wait for the first app month and
-- the summary says so; the second run moves them into March and rebuilds loans and statements without duplicates.
select tests.remember('ig_step', pg_temp.new_group('Step Group'));
select tests.keep('step1', private.import_history(tests.id('ig_step'),
  jsonb_set(jsonb_set(tests.kept('bundle'), '{through}', '1'), '{months}', jsonb_build_array(tests.kept('bundle') -> 'months' -> 0))));
create function pg_temp.step_counts() returns text language sql as $$
  select (select count(*) from entries where group_id = tests.id('ig_step')) || ' entries, '
      || (select count(*) from entries where group_id = tests.id('ig_step') and kind = 'payment') || ' payments, '
      || (select count(*) from statements where group_id = tests.id('ig_step')) || ' statements, '
      || (select count(*) from loans where group_id = tests.id('ig_step')) || ' loans, '
      || (select string_agg(p.month_index || ':' || i.amount_due, ' ' order by l.principal, p.month_index)
          from loan_instalments i join loans l on l.id = i.loan_id join periods p on p.id = i.period_id
          where l.group_id = tests.id('ig_step'))
$$;
select is(tests.kept('step1') -> 'receipts_not_imported', '{"count": 2, "total": 2075.00}'::jsonb,
  'February''s receipts (Ann 75, Ben 2,000) are counted, not imported');
select is((select data -> 'receipts_not_imported' from audit_log where action = 'ledger.imported' and group_id = tests.id('ig_step')),
  '{"count": 2, "total": 2075.00}'::jsonb, 'and the audit row says so');
select is(pg_temp.step_counts(), '14 entries, 0 payments, 3 statements, 2 loans, 2:1150.00 3:1150.00 2:2300.00 3:2300.00',
  'through February: Ben''s loans fall due again in April, the first month the app asks for');
select tests.keep('step2', private.import_history(tests.id('ig_step'), tests.kept('bundle')));
select is(pg_temp.step_counts(), '27 entries, 2 payments, 6 statements, 3 loans, 3:690.00 4:690.00 2:1150.00 2:2300.00 4:1530.18',
  'through March: payments in March, every statement and loan once, schedules as in a single import');
select is((select s.closing_owed || '/' || s.next_minimum from statements s join periods p on p.id = s.period_id
           join members m on m.id = s.member_id
           where m.group_id = tests.id('ig_step') and m.short_name = 'Ben' and p.month_index = 2), '1530.18/800.00',
  'Ben''s March statement as in a single import');
select is(tests.kept('step2') - 'cycle_id', tests.kept('summary') - 'cycle_id', 'the same summary as a single import');
-- Anything but the import's own rows stops a re-run.
insert into declarations (group_id, period_id, member_id, saving)
values (tests.id('ig'), pg_temp.ip(3), pg_temp.im('Ann'), 250);
select throws_ok($$select private.import_history(tests.id('ig'), tests.kept('bundle'))$$, 'P0001', 'already_opened',
  'a declaration');
delete from declarations where group_id = tests.id('ig');
insert into statements (group_id, period_id, member_id, source)
select tests.id('ig_wb'), p.id, m.id, 'close' from periods p, members m
where p.group_id = tests.id('ig_wb') and p.month_index = 3 and m.group_id = tests.id('ig_wb') and m.short_name = 'Ann';
select throws_ok($$select private.import_history(tests.id('ig_wb'), tests.kept('bundle'))$$, 'P0001', 'already_opened',
  'a statement written by a close');
select tests.remember('ig_app', pg_temp.new_group('App Group'));
select lives_ok($$select private.import_history(tests.id('ig_app'), tests.kept('bundle'))$$, 'another group imports');
insert into entries (group_id, period_id, member_id, kind, amount, source)
select tests.id('ig_app'), p.id, m.id, 'saving', 250, 'app' from periods p, members m
where p.group_id = tests.id('ig_app') and p.month_index = 3 and m.group_id = tests.id('ig_app') and m.short_name = 'Ann';
select throws_ok($$select private.import_history(tests.id('ig_app'), tests.kept('bundle'))$$, 'P0001', 'already_opened',
  'an entry made in the app');

-- Once April (the first app month here) opens, the import refuses.
select tests.login_as(tests.id('owner2'));
select lives_ok($$select open_period(tests.id('icycle'), 3)$$, 'the treasurer opens the first app month');
reset role;
select throws_ok($$select private.import_history(tests.id('ig'), tests.kept('bundle'))$$, 'P0001', 'already_opened',
  'no re-import after the app takes over');

-- April, the first month closed by the app, starts from the imported statements.
-- Cid pays his 753.26 minimum and Ann saves 250. Opening cash 3,225 + 753.26 = 3,978.26; idle 3,978.26 + 250 = 4,228.26.
insert into entries (group_id, period_id, member_id, kind, amount, wallet_id, source, created_by)
select tests.id('ig'), pg_temp.ip(3), pg_temp.im(x.s), x.kind, x.amount,
       (select id from wallets where group_id = tests.id('ig') and name = 'Airtel'), 'app', tests.id('owner2')
from (values ('Cid', 'payment', 753.26), ('Ann', 'saving', 250)) as x(s, kind, amount);
-- a workbook figure the app cannot explain (made up for the test)
insert into workbook_figures (group_id, period_id, member_id, field, value) values (tests.id('ig'), pg_temp.ip(3), null, 'idle_cash', 9999);
select tests.login_as(tests.id('owner2'));
select tests.keep('apr', close_month(pg_temp.ip(3)));
select throws_ok($$select close_month(pg_temp.ip(3), true)$$, 'P0001', 'unexplained_differences',
  'an unexplained difference needs a reason');
select tests.keep('apr_commit', close_month(pg_temp.ip(3), true, 'workbook figure entered by mistake'));
reset role;
select is(tests.gfig('apr', 'idle_cash'), 4228.26, 'April idle cash 4,228.26');
select is((tests.kept('apr') ->> 'unexplained')::int, 1, 'the preview shows one unexplained difference');
select is(array[tests.fig('apr', 'Cid', 'opening_owed'), tests.fig('apr', 'Cid', 'unpaid_minimum')], array[753.26, 0],
  'Cid opens on the imported closing and has paid the workbook''s minimum');
select is(array[tests.fig('apr', 'Ben', 'opening_owed'), tests.fig('apr', 'Ben', 'unpaid_minimum')], array[1530.18, 800],
  'Ben opens on 1,530.18 and still owes the workbook''s 800 minimum');
select is(tests.kept('apr_commit') -> 'members', tests.kept('apr') -> 'members', 'the commit writes what the preview showed');
select is((select count(*)::int from statements where period_id = pg_temp.ip(3) and source = 'close'), 3, 'April is closed by the app');
select is((select (data ->> 'unexplained') || '/' || (data ->> 'reason') from audit_log
           where action = 'period.closed' and entity_id = pg_temp.ip(3)), '1/workbook figure entered by mistake',
  'the close is audited with its reason');
select tests.login_as(tests.id('owner2'));
select tests.keep('pots', jsonb_build_object('v', (select sum(pot_share) from payout_preview(tests.id('icycle')))));
reset role;
select is((tests.kept('pots') ->> 'v')::numeric,
  (select fee_pot_balance + meeting_pot_balance from group_statements where period_id = pg_temp.ip(3)),
  'the pots still reconcile after the first app close');

select * from finish();
rollback;
