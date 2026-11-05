begin;
select * from no_plan();
select tests.ledger_fixture();
select tests.ledger_inputs(1);
select tests.login_as(tests.id('admin'));
select close_month(tests.lp(1), true);
reset role;
select tests.ledger_inputs(2);
select tests.login_as(tests.id('admin'));
select close_month(tests.lp(2), true);
reset role;

-- Committee position -------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
update members set position = 'treasurer' where id = tests.lm('Ann');
select throws_ok($$update members set position = 'king' where id = tests.lm('Ann')$$, '23514', null, 'only the listed positions');
reset role;
select is((select position from members where id = tests.lm('Ann')), 'treasurer', 'an admin sets a position');
select tests.login_as(tests.id('member'));
update members set position = 'chairperson' where id = tests.lm('Ben');
reset role;
select is((select position from members where id = tests.lm('Ben')), null, 'a member cannot give themselves one');
select tests.login_as(tests.id('member'));
select is((select position from group_members where short_name = 'Ann'), 'treasurer', 'every member sees the roster with positions');
reset role;

-- Loan purpose ------------------------------------------------------------------------------------
select tests.remember('loanb', (private.schedule_loan(tests.lp(1), tests.lm('Ben'), 500, 75, tests.id('w_airtel'), now())).id);
select tests.login_as(tests.id('admin'));
select is((select purpose from set_loan_purpose(tests.id('loanb'), 'business')), 'business', 'the treasurer sets the purpose');
select throws_ok($$select set_loan_purpose(tests.id('loanb'), 'holiday')$$, 'P0001', 'invalid_purpose', 'an unknown purpose');
reset role;
select tests.login_as(tests.id('member'));
select throws_ok($$select set_loan_purpose(tests.id('loanb'), 'education')$$, '42501', 'not_admin', 'a member cannot');
select is((select purpose || ':' || loans || ':' || principal from lending_by_purpose(tests.id('lcycle')) where purpose = 'business'),
  'business:1:500.00', 'every member sees what the group lends for, as totals');
reset role;
select tests.login_as(tests.id('outsider'));
select throws_ok($$select * from lending_by_purpose(tests.id('lcycle'))$$, '42501', 'not_admin', 'an outsider sees nothing');
reset role;

-- Pots and expenses -------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select is((select amount from record_expense(tests.id('lcycle'), 'hosting', 90, date '2026-03-14', 'Hall hire')), 90.00, 'the treasurer records spending');
select throws_ok($$select record_expense(tests.id('lcycle'), 'bank', 1, date '2026-03-14', 'x')$$, 'P0001', 'invalid_pot', 'unknown pot');
select throws_ok($$select record_expense(tests.id('lcycle'), 'hosting', 0, date '2026-03-14', 'x')$$, 'P0001', 'invalid_amount', 'zero');
select throws_ok($$select record_expense(tests.id('lcycle'), 'hosting', 1.234, date '2026-03-14', 'x')$$, 'P0001', 'invalid_amount', 'fractions of a ngwee');
select throws_ok($$select record_expense(tests.id('lcycle'), 'hosting', 5, date '2026-03-14', '  ')$$, 'P0001', 'invalid_note', 'a note is required');
reset role;
select throws_ok($$update expenses set note = 'changed'$$, 'P0001', 'append_only', 'spending is never edited');
select tests.login_as(tests.id('member'));
select throws_ok($$select record_expense(tests.id('lcycle'), 'hosting', 5, date '2026-03-14', 'x')$$, '42501', 'not_admin', 'a member cannot record spending');
select is((select remaining from pot_balances(tests.id('lcycle')) where pot = 'hosting'), 810.00, 'every member sees the hosting pot: 900 collected, 90 spent');
select is((select sum(remaining) from pot_balances(tests.id('lcycle'))), 810.00, 'and the fee pot is empty');
select is((select sum(pot_share) from payout_preview(tests.id('lcycle'))), 810.00, 'the payout shares what is left, by savings');
reset role;

-- A defaulter forfeits the interest already earned ------------------------------------------------
create temp table before_forfeit (short_name text, interest_earned numeric);
grant all on before_forfeit to authenticated;
select tests.login_as(tests.id('admin'));
insert into before_forfeit select short_name, interest_earned from payout_preview(tests.id('lcycle'));
reset role;
insert into entries (group_id, period_id, member_id, kind, amount, source)
values (tests.id('lg'), tests.lp(2), tests.lm('Dee'), 'interest_share', 100, 'import');
select tests.login_as(tests.id('admin'));
select is((select interest_earned from payout_preview(tests.id('lcycle')) where short_name = 'Dee'), 0::numeric, 'Dee is in default: her interest is forfeited');
select is((select p.interest_earned - b.interest_earned from payout_preview(tests.id('lcycle')) p join before_forfeit b using (short_name) where p.short_name = 'Ben'),
  7.09, 'Ben gets his share of it by savings: 100 x 1,000 / 14,100');
select is((select sum(p.interest_earned) from payout_preview(tests.id('lcycle')) p) - (select sum(interest_earned) from before_forfeit),
  100.00, 'all of it is re-shared, none lost');
reset role;

select * from finish();
rollback;
