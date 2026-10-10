begin;
select * from no_plan();
select tests.ledger_fixture();

select tests.login_as(tests.id('admin'));
select throws_ok($$select send_loan(tests.lm('Cid'), 100, tests.id('w_airtel'))$$, 'P0001', 'period_not_open',
  'no loans before a month is open');
select lives_ok($$select open_period(tests.id('lcycle'), 1)$$, 'February opens');
reset role;
select tests.ledger_feb_savings();   -- 7,300 saved: that is all the lending cash in the first month

-- refusals ---------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'))$$, '42501', 'not_admin', 'members cannot send loans');
reset role;
select tests.login_as(tests.id('outsider'));
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'))$$, '42501', 'not_admin', 'outsiders cannot send loans');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'))$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select tests.login_anon();
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'))$$, '42501', 'permission denied for function send_loan',
  'anon cannot call send_loan');
reset role;
select ok(not has_function_privilege('anon', 'public.send_loan(uuid, numeric, uuid, text, numeric)', 'EXECUTE'),
  'anon has no execute on send_loan');
select ok(has_function_privilege('authenticated', 'public.send_loan(uuid, numeric, uuid, text, numeric)', 'EXECUTE'),
  'signed-in users may call it (the function checks for an admin)');
select ok(not has_function_privilege('authenticated', 'private.loans_owed(uuid, uuid)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'private.schedule_loan(uuid, uuid, numeric, numeric, uuid, timestamptz)', 'EXECUTE')
      and not has_function_privilege('anon', 'private.lending_cash(uuid)', 'EXECUTE')
      and not has_function_privilege('anon', 'private.member_balance(uuid, uuid)', 'EXECUTE'),
  'the loan helpers are not callable by app roles');
select tests.login_as(tests.id('admin'));
select throws_ok($$select send_loan(gen_random_uuid(), 100, tests.id('w_airtel'))$$, 'P0001', 'member_not_found', 'unknown member');
select throws_ok($$select send_loan(tests.lm('Ben'), 0, tests.id('w_airtel'))$$, 'P0001', 'invalid_amount', 'no zero loans');
select throws_ok($$select send_loan(tests.lm('Ben'), -5, tests.id('w_airtel'))$$, 'P0001', 'invalid_amount', 'no negative loans');
select throws_ok($$select send_loan(tests.lm('Ben'), 100.005, tests.id('w_airtel'))$$, 'P0001', 'invalid_amount', 'to the ngwee only');
select throws_ok($$select send_loan(tests.lm('Ben'), null, tests.id('w_airtel'))$$, 'P0001', 'invalid_amount', 'a loan needs an amount');
select throws_ok($$select send_loan(tests.lm('Ben'), 'NaN'::numeric, tests.id('w_airtel'))$$, 'P0001', 'invalid_amount', 'NaN is not an amount');
select throws_ok($$select send_loan(tests.lm('Ben'), 'Infinity'::numeric, tests.id('w_airtel'))$$, 'P0001', 'invalid_amount', 'nor is Infinity');
select throws_ok($$select send_loan(tests.lm('Ben'), 10000000000, tests.id('w_airtel'))$$, 'P0001', 'invalid_amount',
  'an amount past the column is refused with a code, not an overflow error');
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'), null, -1)$$, 'P0001', 'invalid_amount', 'no negative fee');
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'), null, 'NaN'::numeric)$$, 'P0001', 'invalid_amount', 'no NaN fee');
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'), null, 1.001)$$, 'P0001', 'invalid_amount', 'the fee is kept to the ngwee');
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'), null, null)$$, 'P0001', 'invalid_amount', 'a fee of nothing is 0, not null');
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'), repeat('x', 501))$$, 'P0001', 'invalid_note',
  'a reason is kept to 500 characters');
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_old'))$$, 'P0001', 'wallet_not_found', 'not from a retired wallet');
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_g2'))$$, 'P0001', 'wallet_not_found', 'not from another group''s wallet');
select throws_ok($$select send_loan(tests.lm('Ben'), 100, null)$$, 'P0001', 'wallet_not_found', 'a loan is sent from a wallet');
reset role;
select is((select count(*)::int from loans), 0, 'no refusal left a loan behind');

-- Cid: K3,000 is the 1-month band. Interest 15% = 450, charged now. One instalment of 3,450 in March.
-- Cap in month 1 is 3 × savings: 3 × 2,000 = 6,000 ≥ 0 owed + 3,000, so no warning. Transfer fee K10 from the fee pot.
select tests.login_as(tests.id('admin'));
select lives_ok($$select send_loan(tests.lm('Cid'), 3000, tests.id('w_airtel'), null, 10)$$, 'Cid''s loan is sent');
reset role;
select tests.remember('loan_cid', (select id from loans where member_id = tests.lm('Cid')));
select is((select principal || '/' || interest || '/' || term_months || '/' || status from loans where id = tests.id('loan_cid')),
  '3000.00/450.00/1/open', '3,000 at 15% over one month');
select is((select cap_warning from loans where id = tests.id('loan_cid')), null, 'within the cap');
select is((select array_agg(p.month_index || ':' || i.amount_due order by p.month_index)
           from loan_instalments i join periods p on p.id = i.period_id where i.loan_id = tests.id('loan_cid')),
  array['2:3450.00'], 'one instalment of 3,450 due in March');
select is((select array_agg(kind || ' ' || amount || ' ' || (member_id is not null) order by kind) from entries where loan_id = tests.id('loan_cid')),
  array['loan_interest 450.00 true', 'loan_sent 3000.00 true', 'payout_fee 10.00 false'],
  'principal and interest on Cid''s account; the transfer fee on the group''s fee pot');
select ok((select bool_and(wallet_id = tests.id('w_airtel')) from entries where loan_id = tests.id('loan_cid') and kind = 'loan_sent'),
  'the loan records the wallet it was sent from');
select is((select wallet_id from loans where id = tests.id('loan_cid')), tests.id('w_airtel'), 'and so does the loan row');
-- What Cid owes: the loan alone, 3,000 + 450.
select is(private.member_balance(tests.lm('Cid'), tests.lp(1)), 3450.00, 'Cid owes 3,450 in all');
select is(private.loans_owed(tests.lm('Cid'), tests.lp(1)), 3450.00, 'all of it on his loan');

-- Ben borrows twice in one month (split loans). First 1,000: owed 0 + 1,000 ≤ 3 × 500 = 1,500.
select tests.login_as(tests.id('admin'));
select lives_ok($$select send_loan(tests.lm('Ben'), 1000, tests.id('w_mtn'))$$, 'Ben''s first loan');
-- Second 3,001: owed 1,000 + 150 = 1,150, plus 3,001 = 4,151 > 1,500: over the cap, so a reason is required.
select throws_ok($$select send_loan(tests.lm('Ben'), 3001, tests.id('w_mtn'))$$, 'P0001', 'over_cap_needs_reason',
  'over the cap without a reason is refused');
select throws_ok($$select send_loan(tests.lm('Ben'), 3001, tests.id('w_mtn'), '   ')$$, 'P0001', 'over_cap_needs_reason',
  'a blank reason is no reason');
select lives_ok($$select send_loan(tests.lm('Ben'), 3001, tests.id('w_mtn'), 'agreed at the meeting')$$, 'with a reason it goes');
reset role;
select tests.remember('loan_ben2', (select id from loans where member_id = tests.lm('Ben') and principal = 3001));
select ok((select cap_warning like '%cap%' from loans where id = tests.id('loan_ben2')), 'the cap warning is recorded');
select is((select approved_reason from loans where id = tests.id('loan_ben2')), 'agreed at the meeting', 'with the reason');
-- 3,001 is the 2-month band. Interest 15% = 450.15. 3,451.15 / 2 = 1,725.575: 1,725.57 in March, 1,725.58 in April.
select is((select interest || '/' || term_months from loans where id = tests.id('loan_ben2')), '450.15/2', '3,001 over two months');
select is((select array_agg(i.amount_due order by p.month_index) from loan_instalments i join periods p on p.id = i.period_id
           where i.loan_id = tests.id('loan_ben2')), array[1725.57, 1725.58]::numeric[],
  'the last instalment absorbs the ngwee remainder');
select is((select sum(i.amount_due) from loan_instalments i where i.loan_id = tests.id('loan_ben2')), 3451.15,
  'instalments add up to principal + interest exactly');
-- Ben owes (1,000 + 150) + (3,001 + 450.15) = 4,601.15.
select is(private.loans_owed(tests.lm('Ben'), tests.lp(1)), 4601.15, 'Ben owes 4,601.15 on his two loans');

-- Lending cash: 7,300 saved − 3,000 − 1,000 − 3,001 = 299 left.
select is(private.lending_cash(tests.lp(1)), 299.00, 'lending cash on hand is 299');
select tests.login_as(tests.id('admin'));
select throws_ok($$select send_loan(tests.lm('Dee'), 300, tests.id('w_airtel'))$$, 'P0001', 'insufficient_cash',
  'a loan larger than the cash on hand is refused');
reset role;
select tests.login_as(tests.id('owner'));
select lives_ok($$select send_loan(tests.lm('Dee'), 299, tests.id('w_airtel'))$$, 'the owner can send exactly what is left');
select throws_ok($$select send_loan(tests.lm('Eve'), 0.01, tests.id('w_airtel'))$$, 'P0001', 'insufficient_cash', 'and then nothing more');
reset role;
select is(private.lending_cash(tests.lp(1)), 0.00, 'cash is exhausted, never negative');
select is((select count(*)::int from audit_log where action = 'loan.sent' and group_id = tests.id('lg')), 4, 'every loan is audited');
select is((select actor_user_id from audit_log where action = 'loan.sent' and entity_id = (select id from loans where member_id = tests.lm('Dee'))),
  tests.id('owner'), 'with the person who sent it');
select is((select data ->> 'fee' from audit_log where action = 'loan.sent' and entity_id = tests.id('loan_cid')), '10', 'including the transfer fee');

-- Payments reduce what is owed; an overpayment cannot make a negative loan balance.
select tests.ledger_pay('Cid', 1, 0, 500);   -- 500 repaid in February: all of it goes to the loan (Cid owes nothing else)
select is(private.loans_owed(tests.lm('Cid'), tests.lp(1)), 2950.00, 'Cid''s 500 payment leaves 2,950 on the loan');
select is(private.member_balance(tests.lm('Cid'), tests.lp(1)), 2950.00, 'and 2,950 owed in all');

-- Terms by size and a history loan with no wallet (the 2026 import writes none). schedule_loan only writes the loan and its
-- instalments, so these are Zed's loans with no entries, and cash and the audit trail above are untouched.
select is((select array_agg((private.schedule_loan(tests.lp(1), tests.lm('Zed'), x, 0, null, now())).term_months order by x)
           from unnest(array[5000, 5000.01, 9999.99, 10000]::numeric[]) x),
  array[2, 3, 3, 4], 'bands: ≤ 5,000 is 2 months, < 10,000 is 3, 10,000 is 4');
select ok((select bool_and(wallet_id is null) from loans where member_id = tests.lm('Zed')), 'imported history has no wallet');
select throws_ok($$select private.schedule_loan(tests.lp(12), tests.lm('Zed'), 100, 15, null, now())$$, 'P0001', 'loans_closed',
  'no instalment can fall after January');

-- Cap boundaries, at the real cap ------------------------------------------------------------
-- March (month 2), multiple 3. Cumulative savings include February's saving (250 / 300 from the shared helper), so the caps
-- are not round numbers.
--   Fay: 250 + 301.33 = 551.33;  cap 3 × 551.33 = 1,653.99
--   Eve: 300 + 100.11 = 400.11;  cap 3 × 400.11 = 1,200.33
--   Hal: 250 + 250    = 500.00;  cap 3 × 500.00 = 1,500.00
-- March cash (no February close here): 301.33 + 100.11 + 5,000 + 250 = 5,651.44.
select tests.ledger_jump(2);
select tests.ledger_pay('Fay', 2, 301.33, 0);
select tests.ledger_pay('Eve', 2, 100.11, 0);
select tests.ledger_pay('Gus', 2, 5000, 0);
select tests.ledger_pay('Hal', 2, 250, 0);
select is(private.lending_cash(tests.lp(2)), 5651.44, 'March cash is what came in during March');
select tests.login_as(tests.id('admin'));
-- Exactly at the cap: owed 0 + 1,653.99 = 1,653.99. No warning, no reason needed.
select lives_ok($$select send_loan(tests.lm('Fay'), 1653.99, tests.id('w_airtel'))$$, 'a loan exactly at the cap is accepted');
reset role;
select is((select cap_warning from loans where member_id = tests.lm('Fay') and principal = 1653.99), null,
  'no cap warning at the cap');
select is((select interest from loans where member_id = tests.lm('Fay') and principal = 1653.99), 248.10,
  '15% of 1,653.99 = 248.0985, to the ngwee 248.10');
-- One ngwee over the cap: 0 + 1,200.34 > 1,200.33.
select tests.login_as(tests.id('admin'));
select throws_ok($$select send_loan(tests.lm('Eve'), 1200.34, tests.id('w_airtel'))$$, 'P0001', 'over_cap_needs_reason',
  'one ngwee over the cap needs a reason');
select lives_ok($$select send_loan(tests.lm('Eve'), 1200.34, tests.id('w_airtel'), 'one ngwee over, agreed')$$, 'and goes with one');
reset role;
select is((select cap_warning from loans where member_id = tests.lm('Eve') and principal = 1200.34),
  'Over the cap: owes K0.00, new loan K1200.34, cap K1200.33 (3 x savings of K400.11)', 'the warning states the real cap');
-- Fay already owes 1,653.99 + 248.10 = 1,902.09, above her cap of 1,653.99: any further loan is over it.
select tests.login_as(tests.id('admin'));
select throws_ok($$select send_loan(tests.lm('Fay'), 0.01, tests.id('w_airtel'))$$, 'P0001', 'over_cap_needs_reason',
  'what she already owes counts against the cap');
reset role;
-- Hal owes 75 in charges (a 50 penalty and a 25 excess), which are not loans. His cap is 1,500: a loan of exactly 1,500 is at it.
insert into entries (group_id, period_id, member_id, kind, amount, source) values
  (tests.id('lg'), tests.lp(2), tests.lm('Hal'), 'penalty', 50, 'app'),
  (tests.id('lg'), tests.lp(2), tests.lm('Hal'), 'excess_charge', 25, 'app');
select is(private.member_balance(tests.lm('Hal'), tests.lp(2)), 75.00, 'Hal owes 75 in all, before any loan');
select is(private.loans_owed(tests.lm('Hal'), tests.lp(2)), 0.00, 'none of it on loans, so none of it counts against the cap');
select tests.login_as(tests.id('admin'));
select lives_ok($$select send_loan(tests.lm('Hal'), 1500, tests.id('w_mtn'))$$, 'Hal borrows exactly his cap');
reset role;
select is((select cap_warning from loans where member_id = tests.lm('Hal')), null, 'penalties and excess do not push him over');
select is(private.loans_owed(tests.lm('Hal'), tests.lp(2)), 1725.00, 'Hal owes 1,500 + 225 on loans');
select is(private.member_balance(tests.lm('Hal'), tests.lp(2)), 1800.00, 'and 75 more in charges');
-- 5,651.44 − 1,653.99 − 1,200.34 − 1,500 = 1,297.11
select is(private.lending_cash(tests.lp(2)), 1297.11, 'cash after the three March loans');

-- Late in the cycle -----------------------------------------------------------------------------
-- Month 10 (Nov): multiple 1. Max saves 6,000; borrows 5,001 (3-month band) — only Dec and Jan are left, so 2 months.
-- 5,001 × 15% = 750.15; 5,751.15 / 2 = 2,875.575: 2,875.57 then 2,875.58.
select tests.ledger_jump(10);
select tests.ledger_pay('Max', 10, 6000, 0);
select tests.login_as(tests.id('admin'));
select is((select term_months from send_loan(tests.lm('Max'), 5001, tests.id('w_airtel'))), 2, 'a November loan is shortened to end in January');
reset role;
select is((select array_agg(p.month_index || ':' || i.amount_due order by p.month_index)
           from loan_instalments i join periods p on p.id = i.period_id join loans l on l.id = i.loan_id where l.member_id = tests.lm('Max')),
  array['11:2875.57', '12:2875.58'], 'two instalments, the last in January');

-- Month 11 (Dec): Kim saves 10,000 and borrows 10,000 (4-month band, K10,000 is 4 months) — one month left, January.
-- Cap 1 × (250 in February + 10,000 now) = 10,250 ≥ 0 owed + 10,000: inside the cap, no warning.
-- Interest 1,500; one instalment of 11,500.
select tests.ledger_jump(11);
select tests.ledger_pay('Kim', 11, 10000, 0);
select tests.login_as(tests.id('admin'));
select is((select term_months || '/' || coalesce(cap_warning, 'none') from send_loan(tests.lm('Kim'), 10000, tests.id('w_airtel'))),
  '1/none', 'a December loan is due in full in January, inside the cap');
reset role;
select is((select i.amount_due from loan_instalments i join loans l on l.id = i.loan_id where l.member_id = tests.lm('Kim')), 11500.00,
  'one instalment of 11,500');

-- Arrears: Lee's November statement shows an unpaid minimum. He may still borrow; the loan records a warning.
-- Lee's cap: 1 × (250 + 600) = 850 ≥ 500, so only the arrears warning.
insert into statements (group_id, period_id, member_id, unpaid_minimum, closing_owed, source)
values (tests.id('lg'), tests.lp(10), tests.lm('Lee'), 20, 20, 'close');
select tests.ledger_pay('Lee', 11, 600, 0);
select tests.login_as(tests.id('admin'));
select ok((select arrears_warning is not null and cap_warning is null from send_loan(tests.lm('Lee'), 500, tests.id('w_airtel'))),
  'a member in arrears can borrow, with a warning');
reset role;
select is((select arrears_warning from loans where member_id = tests.lm('Lee')), 'K20.00 of last month''s minimum is unpaid; already owes K20.00 in all',
  'the warning says what is unpaid and what is owed in all');

-- What a member owes on loans, from the statements and this month's entries ---------------------
-- Roy took 1,000 + 150 interest in October (month 9, Nov is 10). The October statement shows 100 paid to interest and 200 to
-- principal (loans owed 1,150 − 300 = 850) and 40 of other charges still owed (closing owed 890). The November statement
-- shows another 20 + 80 paid to the loan: loans owed 750, closing owed 790 (the 40 still unpaid).
insert into entries (group_id, period_id, member_id, kind, amount, source) values
  (tests.id('lg'), tests.lp(9), tests.lm('Roy'), 'loan_sent', 1000, 'app'),
  (tests.id('lg'), tests.lp(9), tests.lm('Roy'), 'loan_interest', 150, 'app');
insert into statements (group_id, period_id, member_id, paid_to_interest, paid_to_principal, closing_owed, source) values
  (tests.id('lg'), tests.lp(9), tests.lm('Roy'), 100, 200, 890, 'close'),
  (tests.id('lg'), tests.lp(10), tests.lm('Roy'), 20, 80, 790, 'close');
select is(private.loans_owed(tests.lm('Roy'), tests.lp(9)), 850.00, 'closed month: loans charged less paid to interest and principal');
select is(private.loans_owed(tests.lm('Roy'), tests.lp(10)), 750.00, 'and the next closed month');
select is(private.member_balance(tests.lm('Roy'), tests.lp(10)), 790.00, 'a closed month''s balance is its statement''s closing owed');
select is(private.loans_owed(tests.lm('Roy'), tests.lp(11)), 750.00, 'open month with no entries yet: unchanged');
select is(private.member_balance(tests.lm('Roy'), tests.lp(11)), 790.00, 'and the balance is last month''s closing owed');
-- A payment of 100 clears the 40 of charges first, then 60 on the loan: 750 − 60 = 690.
select tests.ledger_pay('Roy', 11, 0, 100);
select is(private.loans_owed(tests.lm('Roy'), tests.lp(11)), 690.00, 'a payment clears other charges before the loan');
select is(private.member_balance(tests.lm('Roy'), tests.lp(11)), 690.00, 'owed in all: 790 − 100');
-- A 10 penalty this month also comes first: 100 − (40 + 10) = 50 on the loan, 750 − 50 = 700.
insert into entries (group_id, period_id, member_id, kind, amount, source)
values (tests.id('lg'), tests.lp(11), tests.lm('Roy'), 'penalty', 10, 'app');
select is(private.loans_owed(tests.lm('Roy'), tests.lp(11)), 700.00, 'a penalty is cleared before the loan too');
select is(private.member_balance(tests.lm('Roy'), tests.lp(11)), 700.00, 'owed in all: 790 + 10 − 100');
-- A new loan this month, 200 + 30: 750 + 230 − 50 = 930.
insert into entries (group_id, period_id, member_id, kind, amount, source) values
  (tests.id('lg'), tests.lp(11), tests.lm('Roy'), 'loan_sent', 200, 'app'),
  (tests.id('lg'), tests.lp(11), tests.lm('Roy'), 'loan_interest', 30, 'app');
select is(private.loans_owed(tests.lm('Roy'), tests.lp(11)), 930.00, 'a loan sent this month counts');
select is(private.member_balance(tests.lm('Roy'), tests.lp(11)), 930.00, 'owed in all: 790 + 10 + 230 − 100');
-- A waiver of the October interest (a correction posted this month) lowers what is owed: 930 − 150 = 780.
insert into entries (group_id, period_id, member_id, kind, amount, source, corrects_entry_id, reason)
select group_id, tests.lp(11), member_id, 'waiver', 150, 'correction', id, 'interest waived'
from entries where member_id = tests.lm('Roy') and kind = 'loan_interest' and period_id = tests.lp(9);
select is(private.loans_owed(tests.lm('Roy'), tests.lp(11)), 780.00, 'a waived interest lowers the loan balance');
select is(private.member_balance(tests.lm('Roy'), tests.lp(11)), 780.00, 'and the balance');
-- An overpayment reduces principal early and cannot take the loan balance below zero.
select tests.ledger_pay('Roy', 11, 0, 5000);
select is(private.loans_owed(tests.lm('Roy'), tests.lp(11)), 0.00, 'an overpayment never makes a negative loan balance');

-- Month 12 (Jan): repayments only.
select tests.ledger_jump(12);
select tests.ledger_pay('Ned', 12, 5000, 0);
select tests.login_as(tests.id('admin'));
select throws_ok($$select send_loan(tests.lm('Ned'), 100, tests.id('w_airtel'))$$, 'P0001', 'loans_closed', 'no new loans in the last month');
reset role;

select * from finish();
rollback;
