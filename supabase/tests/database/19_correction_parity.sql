begin;
select * from no_plan();
select tests.ledger_fixture();

select tests.login_as(tests.id('admin'));
select lives_ok($$select open_period(tests.id('lcycle'), 1)$$, 'February opens');
reset role;
select tests.ledger_feb_savings();

select tests.login_as(tests.id('admin'));
select lives_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 100, 'other', 'Missed the meeting')$$, 'a penalty of 100');
reset role;
select tests.remember('pen', (select id from entries where member_id = tests.lm('Dee') and kind = 'penalty'));

-- 100, waive 30, correct to 90, correct to 80 ------------------------------------------------------
select tests.login_as(tests.id('admin'));
select lives_ok($$select post_waiver(tests.id('pen'), 30, 'Slip found')$$, 'waive 30 (70 left)');
select lives_ok($$select post_correction(tests.id('pen'), 90, 'Treasurer raised it')$$, 'correct to 90: a +20 correction');
select lives_ok($$select post_correction(tests.id('pen'), 80, 'Settled on 80')$$, 'correct to 80: a -10 adjustment');
reset role;
select is((select array_agg(c.kind || ':' || c.amount order by c.amount desc) from entries c where c.corrects_entry_id = tests.id('pen')),
  array['waiver:30.00', 'penalty:20.00', 'adjustment:10.00'], 'the corrections are a waiver of 30, a penalty of 20 and an adjustment of 10');
select ok((select bool_and(c.source = 'correction' and c.period_id = tests.lp(1)) from entries c where c.corrects_entry_id = tests.id('pen')),
  'each lands in the open month, as a correction');

-- the engine's own view of the effective amount: 100 + 20 - 30 - 10 = 80 -----------------------------
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('pen'), 80, 'No change')$$, 'P0001', 'invalid_amount',
  'the effective amount is exactly 80: setting it to 80 changes nothing');
select throws_ok($$select post_waiver(tests.id('pen'), 80.01, 'Too much')$$, 'P0001', 'invalid_amount', 'only 80 is still charged');
select lives_ok($$select post_waiver(tests.id('pen'), 80, 'Waive the rest')$$, 'waiving exactly 80 is allowed');
select throws_ok($$select post_waiver(tests.id('pen'), 0.01, 'Nothing left')$$, 'P0001', 'invalid_amount', 'and then nothing is left to waive');
reset role;

-- what can and cannot be changed ---------------------------------------------------------------
select tests.remember('corr', (select id from entries where corrects_entry_id = tests.id('pen') order by amount desc limit 1));
select tests.remember('saving', (select id from entries where member_id = tests.lm('Dee') and kind = 'saving'));
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('corr'), 5, 'again')$$, 'P0001', 'entry_not_found', 'a correction is never corrected');
select throws_ok($$select post_waiver(tests.id('saving'), 10, 'no')$$, 'P0001', 'entry_not_found', 'a saving cannot be waived');
select lives_ok($$select post_correction(tests.id('saving'), 300, 'Paid 300, not 250')$$, 'a saving can be corrected');
select lives_ok($$select send_loan(tests.lm('Cid'), 3000, tests.id('w_airtel'))$$, 'a loan is sent');
reset role;
select tests.remember('loan_sent', (select id from entries where member_id = tests.lm('Cid') and kind = 'loan_sent'));
select tests.remember('loan_int', (select id from entries where member_id = tests.lm('Cid') and kind = 'loan_interest'));
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('loan_sent'), 1, 'no')$$, 'P0001', 'entry_not_found', 'a loan is not corrected');
select throws_ok($$select post_waiver(tests.id('loan_sent'), 1, 'no')$$, 'P0001', 'entry_not_found', 'a loan principal is not waived');
select lives_ok($$select post_waiver(tests.id('loan_int'), 100, 'Group agreed')$$, 'loan interest can be waived');
reset role;

-- who may, and what is needed ------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select post_correction(tests.id('saving'), 1, 'x')$$, '42501', 'not_admin', 'a member cannot correct');
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, 'x')$$, '42501', 'not_admin', 'a member cannot mark a default');
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('saving'), 1, ' ')$$, 'P0001', 'reason_required', 'a correction needs a reason');
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, ' ')$$, 'P0001', 'reason_required', 'a default needs a reason');
select lives_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, 'Missed three months')$$, 'mark a default');
reset role;
select is((select defaulted from member_status where member_id = tests.lm('Dee') and cycle_id = tests.id('lcycle')), true, 'Dee is defaulted');
select tests.login_as(tests.id('admin'));
select lives_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), false, 'Paid up')$$, 'reverse it');
reset role;
select is((select defaulted from member_status where member_id = tests.lm('Dee') and cycle_id = tests.id('lcycle')), false, 'Dee is back in good standing');
select is((select count(*)::int from member_status where member_id = tests.lm('Dee')), 1, 'still one row per member and cycle');

-- no open month: nothing can be posted ------------------------------------------------------------
update periods set status = 'closed' where id = tests.lp(1);
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('saving'), 10, 'late')$$, 'P0001', 'period_not_open', 'with no open month a correction is refused');
select throws_ok($$select post_waiver(tests.id('loan_int'), 1, 'late')$$, 'P0001', 'period_not_open', 'and so is a waiver');
reset role;

select * from finish();
rollback;
