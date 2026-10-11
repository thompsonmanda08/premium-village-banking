begin;
select * from no_plan();
select tests.ledger_fixture();

-- privileges ---------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.loan_check(uuid, numeric)', 'EXECUTE'), 'anon has no execute on loan_check');
select ok(has_function_privilege('authenticated', 'public.loan_check(uuid, numeric)', 'EXECUTE'),
  'signed-in users may call it (the function checks for an admin)');

-- before any month is open ---------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select throws_ok($$select loan_check(tests.lm('Dee'))$$, 'P0001', 'period_not_open', 'no preview before a month is open');
select lives_ok($$select open_period(tests.id('lcycle'), 1)$$, 'February opens');
reset role;
select tests.ledger_feb_savings();   -- 7,300 saved: that is all the lending cash in the first month

-- who may ask --------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select loan_check(tests.lm('Dee'))$$, '42501', 'not_admin', 'members cannot ask');
reset role;
select tests.login_as(tests.id('outsider'));
select throws_ok($$select loan_check(tests.lm('Dee'))$$, '42501', 'not_admin', 'outsiders cannot ask');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select loan_check(tests.lm('Dee'))$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select tests.login_anon();
select throws_ok($$select loan_check(tests.lm('Dee'))$$, '42501', 'permission denied for function loan_check', 'anon cannot call it');
reset role;

-- refusals -----------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select throws_ok($$select loan_check(gen_random_uuid())$$, 'P0001', 'member_not_found', 'unknown member');
select throws_ok($$select loan_check(tests.lm('Dee'), 0)$$, 'P0001', 'invalid_amount', 'no zero loans');
select throws_ok($$select loan_check(tests.lm('Dee'), -5)$$, 'P0001', 'invalid_amount', 'no negative loans');
select throws_ok($$select loan_check(tests.lm('Dee'), 100.005)$$, 'P0001', 'invalid_amount', 'to the ngwee only');
select throws_ok($$select loan_check(tests.lm('Dee'), 'NaN'::numeric)$$, 'P0001', 'invalid_amount', 'NaN is not an amount');
select throws_ok($$select loan_check(tests.lm('Dee'), 'Infinity'::numeric)$$, 'P0001', 'invalid_amount', 'nor is Infinity');
select throws_ok($$select loan_check(tests.lm('Dee'), 10000000000)$$, 'P0001', 'invalid_amount', 'an amount past the column is refused with a code');
reset role;
update members set status = 'left' where id = tests.lm('Zed');
select tests.login_as(tests.id('admin'));
select throws_ok($$select loan_check(tests.lm('Zed'))$$, 'P0001', 'member_not_active', 'a member who left cannot borrow');
reset role;

-- the figures (month 1: multiple 3; Dee saved 250, so her cap is 750) ----------------------------
select tests.login_as(tests.id('admin'));
select is(loan_check(tests.lm('Dee')) ->> 'label', 'Feb 2026', 'it names the open month');
select is((loan_check(tests.lm('Dee')) ->> 'lending_cash')::numeric, 7300::numeric, 'lending cash is everything saved so far');
select is((loan_check(tests.lm('Dee')) ->> 'multiple')::numeric, 3::numeric, 'the month''s multiple');
select is((loan_check(tests.lm('Dee')) ->> 'cum_savings')::numeric, 250::numeric, 'her savings');
select is((loan_check(tests.lm('Dee')) ->> 'loans_owed')::numeric, 0::numeric, 'she owes nothing on loans');
select is((loan_check(tests.lm('Dee')) ->> 'cap')::numeric, 750::numeric, 'cap = 3 x 250');
select is((loan_check(tests.lm('Dee')) ->> 'headroom')::numeric, 750::numeric, 'headroom = cap - owed');
select ok((loan_check(tests.lm('Dee')) ->> 'loans_open')::boolean, 'loans are open in February');
select ok(loan_check(tests.lm('Dee')) -> 'arrears' = 'null'::jsonb, 'no arrears in the first month');
select ok(not (loan_check(tests.lm('Dee')) ? 'principal'), 'without an amount there is nothing about an amount');

-- with an amount: interest 15%, 1-month band up to 3,000 ---------------------------------------------
select is((loan_check(tests.lm('Dee'), 500) ->> 'interest')::numeric, 75::numeric, 'interest is 15% of the principal');
select is((loan_check(tests.lm('Dee'), 500) ->> 'term_months')::int, 1, 'K500 is the one-month band');
select is((loan_check(tests.lm('Dee'), 3001) ->> 'term_months')::int, 2, 'K3,001 is the two-month band');
select ok(not (loan_check(tests.lm('Dee'), 500) ->> 'over_cap')::boolean, 'K500 is inside her cap of 750');
select ok((loan_check(tests.lm('Dee'), 800) ->> 'over_cap')::boolean, 'K800 is over her cap of 750');
select ok(not (loan_check(tests.lm('Cid'), 6000) ->> 'over_cap')::boolean, 'Cid''s cap is 3 x 2,000 = 6,000, so 6,000 is inside it');
select ok((loan_check(tests.lm('Cid'), 7301) ->> 'insufficient_cash')::boolean, 'K7,301 is more than the K7,300 on hand');
select ok(not (loan_check(tests.lm('Cid'), 7300) ->> 'insufficient_cash')::boolean, 'K7,300 is exactly what is on hand');
reset role;

-- agreement with send_loan: the same facts, the same words ---------------------------------------
select tests.login_as(tests.id('admin'));
select tests.keep('eve', loan_check(tests.lm('Eve'), 500));      -- Eve saved 300, cap 900: inside it
select tests.keep('dee', loan_check(tests.lm('Dee'), 800));      -- Dee: over her cap of 750
select throws_ok($$select send_loan(tests.lm('Dee'), 800, tests.id('w_airtel'))$$, 'P0001', 'over_cap_needs_reason',
  'over_cap = true, and send_loan asks for a reason');
select lives_ok($$select send_loan(tests.lm('Dee'), 800, tests.id('w_airtel'), 'Approved by the group')$$, 'with a reason it goes');
select lives_ok($$select send_loan(tests.lm('Eve'), 500, tests.id('w_airtel'))$$, 'under the cap it goes without one');
reset role;
select ok((tests.kept('dee') ->> 'over_cap')::boolean and not (tests.kept('eve') ->> 'over_cap')::boolean,
  'loan_check said the same beforehand');
select is((select interest || '/' || term_months from loans where member_id = tests.lm('Eve')),
  (tests.kept('eve') ->> 'interest')::numeric || '/' || (tests.kept('eve') ->> 'term_months'), 'the loan''s interest and term equal the preview''s');
select is((select interest || '/' || term_months from loans where member_id = tests.lm('Dee')),
  (tests.kept('dee') ->> 'interest')::numeric || '/' || (tests.kept('dee') ->> 'term_months'), 'the same for an over-cap loan');

-- after 800 + 500 went out: cash is 6,000, and Dee is over her limit ---------------------------------
select tests.login_as(tests.id('admin'));
select is((loan_check(tests.lm('Gus')) ->> 'lending_cash')::numeric, 6000::numeric, 'cash on hand falls by what was sent');
select is((loan_check(tests.lm('Dee')) ->> 'loans_owed')::numeric, 920::numeric, 'Dee owes 800 + 120 interest');
select is((loan_check(tests.lm('Dee')) ->> 'headroom')::numeric, -170::numeric, 'and is 170 over her limit');
select ok((loan_check(tests.lm('Cid'), 6001) ->> 'insufficient_cash')::boolean, 'K6,001 is now more than is on hand');
select throws_ok($$select send_loan(tests.lm('Cid'), 6001, tests.id('w_airtel'), 'because')$$, 'P0001', 'insufficient_cash',
  'and send_loan agrees');
select ok(not (loan_check(tests.lm('Cid'), 6000) ->> 'insufficient_cash')::boolean, 'K6,000 is still affordable');
reset role;

-- arrears: the same sentence send_loan stores ----------------------------------------------------
select tests.ledger_jump(11);
insert into statements (group_id, period_id, member_id, next_minimum, unpaid_minimum, closing_owed, source)
values (tests.id('lg'), tests.lp(10), tests.lm('Lee'), 20, 20, 20, 'close');
select tests.ledger_pay('Lee', 11, 600, 0);
select tests.login_as(tests.id('admin'));
select tests.keep('lee', loan_check(tests.lm('Lee'), 500));
select lives_ok($$select send_loan(tests.lm('Lee'), 500, tests.id('w_airtel'))$$, 'Lee, in arrears, may still borrow');
reset role;
select is(tests.kept('lee') ->> 'arrears', (select arrears_warning from loans where member_id = tests.lm('Lee')),
  'the preview''s arrears sentence is the one the loan stores');
select ok(tests.kept('lee') ->> 'arrears' like 'K20.00 of last month''s minimum unpaid%', 'and it says what is unpaid');

-- no new loans in the last month ---------------------------------------------------------------------
select tests.ledger_jump(12);
select tests.login_as(tests.id('admin'));
select ok(not (loan_check(tests.lm('Dee'), 100) ->> 'loans_open')::boolean, 'January is closed to new loans');
select ok(loan_check(tests.lm('Dee'), 100) -> 'term_months' = 'null'::jsonb, 'so there is no term');
select throws_ok($$select send_loan(tests.lm('Dee'), 100, tests.id('w_airtel'))$$, 'P0001', 'loans_closed', 'and send_loan agrees');
reset role;

select * from finish();
rollback;
