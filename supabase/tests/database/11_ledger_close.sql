begin;
select * from no_plan();
select tests.ledger_fixture();
-- Every expected figure below is worked by hand in the comments; none comes from calling the function under test.

-- previous_period_open: March open while February is not closed (set up directly; open_period would refuse it)
update periods set status = 'open' where id = tests.lp(2);
select tests.login_as(tests.id('admin'));
select throws_ok($$select close_month(tests.lp(2))$$, 'P0001', 'previous_period_open', 'a month closes only after the one before');
reset role;
update periods set status = 'planned' where id = tests.lp(2);

select tests.ledger_inputs(1);

-- refusals --------------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select throws_ok($$select close_month(tests.lp(2))$$, 'P0001', 'period_not_open', 'a planned month cannot be closed');
select throws_ok($$select close_month(gen_random_uuid())$$, 'P0001', 'period_not_open', 'nor an unknown one');
reset role;
select tests.login_as(tests.id('member'));
select throws_ok($$select close_month(tests.lp(1))$$, '42501', 'not_admin', 'members cannot preview a close');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select close_month(tests.lp(1))$$, '42501', 'not_admin', 'another group''s admin cannot preview this close');
reset role;
select tests.login_anon();
select throws_ok($$select close_month(tests.lp(1))$$, '42501', null, 'anon cannot call close_month');
reset role;
select tests.login_as(tests.id('admin'));
select lives_ok($$select submit_declaration(tests.lp(1), tests.lm('Zed'), p_borrowing_request => 500)$$, 'Zed asks to borrow');
select throws_ok($$select close_month(tests.lp(1))$$, 'P0001', 'declarations_pending', 'a waiting declaration blocks the close');
select throws_ok($$select close_month(tests.lp(1), true)$$, 'P0001', 'declarations_pending', 'and the commit');
select lives_ok($$select return_declaration((select id from declarations where member_id = tests.lm('Zed')), 'no savings yet')$$,
  'the treasurer returns it');

-- February preview ---------------------------------------------------------------------------------
select tests.keep('feb', close_month(tests.lp(1)));
select tests.keep('feb_again', close_month(tests.lp(1)));
reset role;
select is(tests.kept('feb'), tests.kept('feb_again'), 'determinism: the same inputs give the same figures');
select is((select count(*)::int from statements where period_id = tests.lp(1)), 0, 'a preview writes no statements');
select is((select count(*)::int from entries where period_id = tests.lp(1) and source = 'close'), 0, 'and no entries');
select is((select status from periods where id = tests.lp(1)), 'open', 'and leaves the month open');

-- Cash. No payments in the first month: opening = 0 + 0 = 0.
-- Savings 1,000 + 500 + 2,000 + 250 + 300 + 250 + 12 × 250 = 7,300. Loans 3,000 + 1,000 + 3,001 = 7,001.
-- Idle = 0 + 7,300 − 7,001 = 299. Excess = round(10% × 299, 2) = 29.90.
select is(tests.gfig('feb', 'opening_cash'), 0.00, 'opening cash 0');
select is(tests.gfig('feb', 'savings'), 7300.00, 'savings 7,300');
select is(tests.gfig('feb', 'loans_sent'), 7001.00, 'loans 7,001');
select is(tests.gfig('feb', 'idle_cash'), 299.00, 'idle cash 299');
select is(tests.gfig('feb', 'excess_billed'), 29.90, 'excess billed 29.90');
-- Pots, apart from lending cash: fee pot 10 + 5 in, Cid's loan fee 10 out → 5. Meeting pot 18 × 50 = 900.
select is(tests.gfig('feb', 'fee_pot_in'), 15.00, 'members'' declared fees go to the fee pot');
select is(tests.gfig('feb', 'fee_pot_out'), 10.00, 'the loan transfer fee comes out of it');
select is(tests.gfig('feb', 'fee_pot_balance'), 5.00, 'fee pot 5');
select is(tests.gfig('feb', 'meeting_pot_balance'), 900.00, 'membership goes to the meeting pot');
-- Owed: loans 7,001 + interest (450 + 150 + 450.15 = 1,050.15) + excess 29.90 = 8,081.05.
select is(tests.gfig('feb', 'total_owed'), 8081.05, 'total owed 8,081.05');
select is(tests.gfig('feb', 'total_savings'), 7300.00, 'total savings 7,300');
select is(tests.gfig('feb', 'interest_collected'), 0.00, 'nothing paid yet, nothing to share');

-- Excess split by cumulative savings, 29.90 / 7,300 per kwacha, each share cut to the ngwee:
--   Ann 1,000 → 4.0958 → 4.09; Ben 500 → 2.0479 → 2.04; Cid 2,000 → 8.1917 → 8.19; Eve 300 → 1.2287 → 1.22;
--   Dee, Fay and the twelve plain savers 250 → 1.0239 → 1.02; Zed 0 → 0.
--   Sum 4.09 + 2.04 + 8.19 + 1.22 + 14 × 1.02 = 29.82; the 0.08 remainder goes to the largest saver, Cid: 8.27.
select is(tests.fig('feb', 'Ann', 'excess_charged'), 4.09, 'Ann''s excess 4.09');
select is(tests.fig('feb', 'Ben', 'excess_charged'), 2.04, 'Ben''s excess 2.04');
select is(tests.fig('feb', 'Cid', 'excess_charged'), 8.27, 'Cid, the largest saver, takes the ngwee remainder: 8.27');
select is(tests.fig('feb', 'Eve', 'excess_charged'), 1.22, 'Eve''s excess 1.22');
select is(tests.fig('feb', 'Gus', 'excess_charged'), 1.02, 'a plain saver''s excess 1.02');
select is((select sum((m ->> 'excess_charged')::numeric) from jsonb_array_elements(tests.kept('feb') -> 'members') m), 29.90,
  'the shares add up to the excess billed, to the ngwee');
-- Zed: nothing saved, so no share of the excess, nothing owed, and no division by zero.
select is(tests.fig('feb', 'Zed', 'excess_charged'), 0.00, 'Zed (no savings) is billed no excess');
select is(tests.fig('feb', 'Zed', 'closing_owed'), 0.00, 'and owes nothing');
-- Ben: 1,000 (1 month, interest 150) and 3,001 (2 months, interest 450.15).
--   closing = 0 + 4,001 + 600.15 + 2.04 − 0 = 4,603.19
--   March instalments 1,150 + 1,725.57 = 2,875.57; minimum = 2,875.57 + 2.04 + 0 = 2,877.61 (below 4,603.19)
select is(tests.fig('feb', 'Ben', 'loan_principal_sent'), 4001.00, 'Ben''s two loans');
select is(tests.fig('feb', 'Ben', 'loan_interest_charged'), 600.15, 'interest charged when sent');
select is(tests.fig('feb', 'Ben', 'closing_owed'), 4603.19, 'Ben owes 4,603.19');
select is(tests.fig('feb', 'Ben', 'next_minimum'), 2877.61, 'Ben''s minimum 2,877.61');
-- Cid: 3,000 + 450 + 8.27 = 3,458.27 owed; minimum = 3,450 (all of the 1-month loan) + 8.27 = 3,458.27.
select is(tests.fig('feb', 'Cid', 'closing_owed'), 3458.27, 'Cid owes 3,458.27');
select is(tests.fig('feb', 'Cid', 'next_minimum'), 3458.27, 'and must pay all of it');
-- Ann owes only her excess, and that is her minimum.
select is(tests.fig('feb', 'Ann', 'closing_owed'), 4.09, 'Ann owes 4.09');
select is(tests.fig('feb', 'Ann', 'next_minimum'), 4.09, 'her minimum is her excess');

-- Commit February ---------------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select tests.keep('feb_commit', close_month(tests.lp(1), true, 'first close'));
-- Review focus 1: a second close of the same month (another phone) is refused...
select throws_ok($$select close_month(tests.lp(1), true)$$, 'P0001', 'already_closed', 'a month cannot be closed twice');
reset role;
select is(tests.kept('feb_commit') - 'committed', tests.kept('feb') - 'committed', 'preview and commit give the same figures');
select is((tests.kept('feb_commit') ->> 'committed')::boolean, true, 'the commit says so');
select is((select status from periods where id = tests.lp(1)), 'closed', 'February is closed');
select is((select closed_by from periods where id = tests.lp(1)), tests.id('admin'), 'by the treasurer');
select is((select count(*)::int from statements where period_id = tests.lp(1)), 19, 'one statement per member, Zed included');
select is((select closing_owed from statements where period_id = tests.lp(1) and member_id = tests.lm('Ben')), 4603.19, 'Ben''s statement');
select is((select idle_cash || '/' || excess_billed from group_statements where period_id = tests.lp(1)), '299.00/29.90', 'the group statement');
select is((select sum(amount) from entries where period_id = tests.lp(1) and kind = 'excess_charge' and source = 'close'), 29.90,
  'the excess is booked as entries');
select is((select count(*)::int from entries where period_id = tests.lp(1) and kind = 'excess_charge'), 18,
  'one excess entry per member with a share (not Zed)');
select is((select data ->> 'reason' from audit_log where action = 'period.closed' and entity_id = tests.lp(1)), 'first close', 'the close is audited');
-- ...and if two closes ever raced past the lock, the unique keys stop a second set of statements.
select throws_ok($$insert into statements (group_id, period_id, member_id, source) values (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 'close')$$,
  '23505', null, 'one statement per member per month, whatever happens');
select throws_ok($$insert into group_statements (group_id, period_id, excess_rate, source) values (tests.id('lg'), tests.lp(1), 0.10, 'close')$$,
  '23505', null, 'one group statement per month');
-- A closed month still previews (ledger:check replays them) and gives the same figures.
select tests.login_as(tests.id('admin'));
select is(close_month(tests.lp(1)) - 'committed', tests.kept('feb') - 'committed', 'a closed month replays to the same figures');
reset role;

-- March ------------------------------------------------------------------------------------------------
select tests.ledger_inputs(2);
select tests.login_as(tests.id('admin'));
select tests.keep('mar', close_month(tests.lp(2)));
reset role;
-- Cash. Payments 4.09 + 2,877.61 + 3,458.27 + 0.50 + 1.02 + 12 × 1.02 = 6,353.73. Opening = 299 + 6,353.73 = 6,652.73.
-- Savings 1,000 + 500 + 2,000 + 300 + 250 + 12 × 250 = 7,050. Loans: Fay 750. Idle = 6,652.73 + 7,050 − 750 = 12,952.73.
-- Excess = round(10% × 12,952.73, 2) = 1,295.27.
select is(tests.gfig('mar', 'received'), 6353.73, 'payments for February arrive in March''s window');
select is(tests.gfig('mar', 'opening_cash'), 6652.73, 'opening 6,652.73');
select is(tests.gfig('mar', 'idle_cash'), 12952.73, 'idle 12,952.73');
select is(tests.gfig('mar', 'excess_billed'), 1295.27, 'excess 1,295.27');
select is(tests.gfig('mar', 'fee_pot_balance'), 0.00, 'fee pot 5 − Fay''s loan fee 5 = 0');
select is(tests.gfig('mar', 'meeting_pot_balance'), 900.00, 'no membership due in March');
-- Cumulative savings: Ann 2,000, Ben 1,000, Cid 4,000, Dee 250, Eve 600, Fay 500, plain 500 each, Zed 0 → 14,350.
-- 1,295.27 / 14,350 per kwacha: Ann 180.5254 → 180.52; Ben 90.2627 → 90.26; Cid 361.0508 → 361.05; Dee 22.5656 → 22.56;
-- Eve 54.1576 → 54.15; Fay and plain 45.1313 → 45.13. Sum 180.52 + 90.26 + 361.05 + 22.56 + 54.15 + 13 × 45.13 = 1,295.23;
-- remainder 0.04 to Cid → 361.09.
select is(tests.gfig('mar', 'total_savings'), 14350.00, 'total savings 14,350');
select is(tests.fig('mar', 'Cid', 'excess_charged'), 361.09, 'Cid''s excess with the remainder');
select is(tests.fig('mar', 'Dee', 'excess_charged'), 22.56, 'a defaulter is still billed excess');
select is((select sum((m ->> 'excess_charged')::numeric) from jsonb_array_elements(tests.kept('mar') -> 'members') m), 1295.27,
  'March''s shares add up to the excess billed');

-- Payments, charges first: excess, then penalties, then interest, then principal.
-- Ben (minimum-only): excess due 2.04 + 90.26 = 92.30, interest 600.15, principal 4,001. He pays 2,877.61:
--   92.30 to excess, 600.15 to interest, 2,185.16 to principal. Closing = 4,603.19 + 90.26 − 2,877.61 = 1,815.84.
--   Oldest loan first: the 1,000 loan is paid off; the 3,001 loan has 3,001 − 1,185.16 = 1,815.84 left.
--   April instalment 1,725.58; minimum = 1,725.58 + 90.26 + unpaid 0 = 1,815.84, which is also all he owes.
select is(tests.fig('mar', 'Ben', 'paid_to_excess'), 92.30, 'Ben: excess first');
select is(tests.fig('mar', 'Ben', 'paid_to_interest'), 600.15, 'then interest');
select is(tests.fig('mar', 'Ben', 'paid_to_principal'), 2185.16, 'then principal');
select is(tests.fig('mar', 'Ben', 'closing_owed'), 1815.84, 'Ben owes 1,815.84');
select is(tests.fig('mar', 'Ben', 'unpaid_minimum'), 0.00, 'he paid his minimum');
select is(tests.fig('mar', 'Ben', 'next_minimum'), 1815.84, 'his April minimum');
-- Cid (full payer): excess due 8.27 + 361.09 = 369.36, interest 450. He pays 3,458.27:
--   369.36 + 450 + 2,638.91 to principal. Closing = 3,458.27 + 361.09 − 3,458.27 = 361.09, all on the loan.
--   No April instalment (a 1-month loan); minimum = 0 + 361.09 + 0 = 361.09.
select is(tests.fig('mar', 'Cid', 'paid_to_principal'), 2638.91, 'Cid''s payment reaches principal after this month''s excess');
select is(tests.fig('mar', 'Cid', 'closing_owed'), 361.09, 'Cid owes 361.09');
select is(tests.fig('mar', 'Cid', 'next_minimum'), 361.09, 'and must pay it');
-- Eve (partial): excess due 1.22 + 54.15; she pays 0.50. Closing = 1.22 + 54.15 − 0.50 = 54.87.
--   Unpaid minimum = 1.22 − 0.50 = 0.72; minimum = 0 + 54.15 + 0.72 = 54.87.
select is(tests.fig('mar', 'Eve', 'paid_to_excess'), 0.50, 'Eve''s 0.50 goes to excess');
select is(tests.fig('mar', 'Eve', 'unpaid_minimum'), 0.72, 'Eve is 0.72 short');
select is(tests.fig('mar', 'Eve', 'next_minimum'), 54.87, 'which joins her next minimum in full');
-- Dee (nil payer, penalty, defaulted): closing = 1.02 + 22.56 + 100 − 0 = 123.58; unpaid 1.02; minimum 22.56 + 1.02 = 23.58.
select is(tests.fig('mar', 'Dee', 'penalties_charged'), 100.00, 'Dee''s penalty');
select is(tests.fig('mar', 'Dee', 'closing_owed'), 123.58, 'Dee owes 123.58');
select is(tests.fig('mar', 'Dee', 'unpaid_minimum'), 1.02, 'she paid none of her minimum');
select is(tests.fig('mar', 'Dee', 'next_minimum'), 23.58, 'the minimum is instalments + excess + unpaid minimum, not the penalty');
-- Fay (zero-interest loan): 750 + 112.50 interest − 112.50 waived = 0 interest. Closing = 1.02 + 750 + 0 + 45.13 − 1.02 = 795.13.
--   Her April instalment was set at 862.50, but the loan now owes 750, so 750 is asked: minimum 750 + 45.13 = 795.13.
select is(tests.fig('mar', 'Fay', 'loan_interest_charged'), 0.00, 'the waived interest nets to zero');
select is(tests.fig('mar', 'Fay', 'closing_owed'), 795.13, 'Fay owes 795.13');
select is(tests.fig('mar', 'Fay', 'next_minimum'), 795.13, 'an instalment never asks for more than the loan owes');
-- Ann pays her 4.09; closing 180.52, minimum 180.52.
select is(tests.fig('mar', 'Ann', 'closing_owed'), 180.52, 'Ann owes March''s excess');
-- Total owed = 8,081.05 + charges (750 + 0 + 1,295.27 + 100) − 6,353.73 = 3,872.59.
select is(tests.gfig('mar', 'total_owed'), 3872.59, 'total owed 3,872.59');

-- Interest earned: collected = excess, penalties and interest paid: Ann 4.09 + Ben 692.45 + Cid 819.36 + Eve 0.50
--   + Fay 1.02 + 12 × 1.02 = 1,529.66. Dee is in default, so it is shared over 14,350 − 250 = 14,100:
--   1,529.66 / 14,100 per kwacha: Ann 2,000 → 216.9730 → 216.97; Ben 1,000 → 108.4865 → 108.48; Cid 4,000 → 433.9461 → 433.94;
--   Eve 600 → 65.0919 → 65.09; Fay and plain 500 → 54.2432 → 54.24. Sum 1,529.60; remainder 0.06 to Cid → 434.00.
select is(tests.gfig('mar', 'interest_collected'), 1529.66, 'interest collected 1,529.66');
select is(tests.fig('mar', 'Ann', 'interest_earned'), 216.97, 'Ann''s share');
select is(tests.fig('mar', 'Cid', 'interest_earned'), 434.00, 'Cid''s share with the remainder');
select is(tests.fig('mar', 'Fay', 'interest_earned'), 54.24, 'Fay''s share');
select is(tests.fig('mar', 'Dee', 'interest_earned'), 0.00, 'a defaulter earns no share');
select is(tests.fig('mar', 'Zed', 'interest_earned'), 0.00, 'nor does a member with no savings');
select is(tests.fig('mar', 'Ben', 'interest_earned_to_date'), 108.48, 'earned to date');
select is((select sum((m ->> 'interest_earned')::numeric) from jsonb_array_elements(tests.kept('mar') -> 'members') m), 1529.66,
  'the shares add up to the interest collected, to the ngwee');

select tests.login_as(tests.id('admin'));
select tests.keep('mar_commit', close_month(tests.lp(2), true));
reset role;
select is(tests.kept('mar_commit') - 'committed', tests.kept('mar') - 'committed', 'March: preview and commit agree');
select is((select array_agg(status order by sent_at) from loans where member_id = tests.lm('Ben')), array['repaid', 'open'],
  'Ben''s first loan is repaid, the second still runs');
select is((select status from loans where member_id = tests.lm('Cid')), 'open', 'Cid''s loan still has 361.09 on it');
select is((select count(*)::int from entries where period_id = tests.lp(2) and kind = 'interest_share'), 17,
  'one interest entry per member with a share (not Dee, not Zed)');

-- Review focus 2: a correction to a closed month --------------------------------------------------------
select tests.ledger_inputs(3);   -- opens April
select tests.login_as(tests.id('admin'));
select lives_ok($$select post_correction((select id from entries where member_id = tests.lm('Ann') and kind = 'saving' and period_id = tests.lp(1)),
  1100, 'Ann sent K1,100 in February, not K1,000')$$, 'the treasurer corrects February in April');
select tests.keep('apr', close_month(tests.lp(3)));
reset role;
select is((select period_id from entries where source = 'correction' and member_id = tests.lm('Ann')), tests.lp(3),
  'the correction is April''s entry');
select is((select saving || '/' || cum_savings from statements where period_id = tests.lp(1) and member_id = tests.lm('Ann')),
  '1000.00/1000.00', 'February''s statement is not rewritten');
select is((select cum_savings from statements where period_id = tests.lp(2) and member_id = tests.lm('Ann')), 2000.00,
  'nor March''s');
-- April: the +100 is April's saving; cumulative 1,000 + 1,000 + 100 = 2,100.
select is(tests.fig('apr', 'Ann', 'saving'), 100.00, 'April carries the K100');
select is(tests.fig('apr', 'Ann', 'cum_savings'), 2100.00, 'and the balance fixes forward');

-- A transfer fee bigger than the fee pot is paid anyway: the close books the pot negative and the audit says so.
-- March left the pot at 0; Gus's K100 loan in April costs a K10 fee.
select tests.login_as(tests.id('admin'));
select lives_ok($$select send_loan(tests.lm('Gus'), 100, tests.id('w_airtel'), null, 10)$$, 'a fee the pot cannot cover is not refused');
select tests.keep('apr_commit', close_month(tests.lp(3), true));
reset role;
select is(tests.gfig('apr_commit', 'fee_pot_balance'), -10.00, 'the fee pot shows −10');
select is((select fee_pot_balance from group_statements where period_id = tests.lp(3)), -10.00, 'and so does April''s group statement');
select is((select data ->> 'warning' from audit_log where action = 'period.closed' and entity_id = tests.lp(3)), 'fee_pot_short',
  'the close audit flags the short fee pot');
select is((select data ->> 'warning' from audit_log where action = 'period.closed' and entity_id = tests.lp(2)), null,
  'a month whose pot is not short carries no flag');

select * from finish();
rollback;
