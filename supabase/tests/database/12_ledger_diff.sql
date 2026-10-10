begin;
select * from no_plan();
select tests.ledger_fixture();
select tests.ledger_inputs(1);

-- No workbook figures yet: nothing to compare.
select tests.login_as(tests.id('admin'));
select tests.keep('plain', close_month(tests.lp(1)));
reset role;
select is(tests.kept('plain') -> 'diff', '[]'::jsonb, 'no workbook figures, no differences');
select is((tests.kept('plain') ->> 'unexplained')::int, 0, 'and nothing unexplained');

-- February's workbook figures as the import would store them (synthetic). The app's figures are the ones worked
-- by hand in 11_ledger_close.sql.
insert into workbook_figures (group_id, period_id, member_id, field, value) values
  -- Group. The workbook took Cid's K10 loan fee from lending cash; the app pays it from the fee pot.
  (tests.id('lg'), tests.lp(1), null, 'idle_cash', 289),                      -- app 299: +10, the month's fees → fee_pot_vs_cash
  (tests.id('lg'), tests.lp(1), null, 'excess_billed', 28.90),                -- app 29.90: +1.00 = 10% of 10 → fee_pot_vs_cash
  (tests.id('lg'), tests.lp(1), null, 'opening_cash', 0),                     -- app 0: same, not listed
  (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 'excess_charged', 4.10),     -- app 4.09: −0.01, against the fee's sign → workbook_rounded
  (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 'closing_owed', 4.10),       -- app 4.09: −0.01, all of it her excess → workbook_rounded
  (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 'excess_charged', 8.00),     -- app 8.27: +0.27, within the group's +1.00 → fee_pot_vs_cash
  (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 'closing_owed', 3458.00),    -- app 3,458.27: +0.27, all of it the excess → fee_pot_vs_cash
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'next_minimum', 1152.04),    -- app 2,877.61: +1,725.57, the 3,001 loan's first
                                                                              --   instalment → workbook_missed_loan
  (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 'next_minimum', 1737.27),    -- app 3,458.27: +1,721.00 and Cid owes principal
                                                                              --   → workbook_term_differs
  (tests.id('lg'), tests.lp(1), tests.lm('Fay'), 'next_minimum', 51.02),      -- app 1.02: −50.00, a membership fee → penalty_not_charged
  (tests.id('lg'), tests.lp(1), tests.lm('Dee'), 'next_minimum', 2.00),       -- app 1.02: −0.98 → workbook_rounded
  (tests.id('lg'), tests.lp(1), tests.lm('Eve'), 'cum_savings', 350),         -- app 300: −50 → unexplained
  (tests.id('lg'), tests.lp(1), tests.lm('Gus'), 'cum_savings', 250);         -- app 250: same, not listed

select tests.login_as(tests.id('admin'));
select tests.keep('feb', close_month(tests.lp(1)));
reset role;
select is(jsonb_array_length(tests.kept('feb') -> 'diff'), 11, 'eleven differences, the matching figures left out');
select is(tests.reason('feb', null, 'idle_cash'), 'fee_pot_vs_cash', 'idle cash differs by the loan fee');
select is(tests.reason('feb', null, 'excess_billed'), 'fee_pot_vs_cash', 'and the excess by 10% of it');
select is(tests.reason('feb', 'Ann', 'excess_charged'), 'workbook_rounded', 'a ngwee the other way is rounding');
select is(tests.reason('feb', 'Ann', 'closing_owed'), 'workbook_rounded', 'and so is what she owes');
select is(tests.reason('feb', 'Cid', 'excess_charged'), 'fee_pot_vs_cash', 'Cid''s share of the fee difference');
select is(tests.reason('feb', 'Cid', 'closing_owed'), 'fee_pot_vs_cash', 'carried into what he owes');
select is(tests.reason('feb', 'Ben', 'next_minimum'), 'workbook_missed_loan', 'the workbook left a new loan out of the minimum');
select is(tests.reason('feb', 'Cid', 'next_minimum'), 'workbook_term_differs', 'the workbook spread the loan differently');
select is(tests.reason('feb', 'Fay', 'next_minimum'), 'penalty_not_charged', 'the workbook asked for K50 the app does not charge');
select is(tests.reason('feb', 'Dee', 'next_minimum'), 'workbook_rounded', 'under K1 is rounding');
select is(tests.reason('feb', 'Eve', 'cum_savings'), 'unexplained', 'a savings difference nobody can explain');
select is((select d -> 'difference' from jsonb_array_elements(tests.kept('feb') -> 'diff') d where d ->> 'short_name' = 'Ben'),
  '1725.57'::jsonb, 'difference = app − workbook');
select is((tests.kept('feb') ->> 'unexplained')::int, 1, 'one unexplained difference');
select is((tests.kept('feb') -> 'diff' -> 0 ->> 'field'), 'excess_billed', 'group rows come first');

-- Committing with an unexplained difference needs the treasurer's reason on record.
select tests.login_as(tests.id('admin'));
select throws_ok($$select close_month(tests.lp(1), true)$$, 'P0001', 'unexplained_differences', 'no silent close over an unexplained difference');
select throws_ok($$select close_month(tests.lp(1), true, '  ')$$, 'P0001', 'unexplained_differences', 'a blank reason is no reason');
select lives_ok($$select close_month(tests.lp(1), true, 'Eve''s workbook row double-counts a deposit')$$, 'with a reason it closes');
reset role;
select is((select data ->> 'unexplained' || '/' || (data ->> 'differences') || '/' || (data ->> 'reason')
           from audit_log where action = 'period.closed' and entity_id = tests.lp(1)),
  '1/11/Eve''s workbook row double-counts a deposit', 'the counts and the reason are audited');

-- March: Fay's interest was waived; the workbook still charged it.
select tests.ledger_inputs(2);
insert into workbook_figures (group_id, period_id, member_id, field, value)
  values (tests.id('lg'), tests.lp(2), tests.lm('Fay'), 'closing_owed', 907.63);   -- app 795.13: −112.50 = the waiver → waiver
select tests.login_as(tests.id('admin'));
select tests.keep('mar', close_month(tests.lp(2)));
reset role;
select is(tests.reason('mar', 'Fay', 'closing_owed'), 'waiver', 'a waived charge explains the difference');
select is((tests.kept('mar') ->> 'unexplained')::int, 0, 'nothing unexplained in March');

-- ledger_check: every month that is not planned, with its stored group statement and its differences ----------
select tests.login_as(tests.id('admin'));
select tests.keep('check', ledger_check(tests.id('lg')));
reset role;
select is(tests.kept('check') ->> 'cycle_label', 'Ledger 2026', 'the active cycle');
select is(jsonb_array_length(tests.kept('check') -> 'periods'), 2, 'February (closed) and March (open)');
select is((tests.kept('check') -> 'periods' -> 0 -> 'group' ->> 'idle_cash')::numeric, 299.00, 'February''s stored group statement');
select is(jsonb_array_length(tests.kept('check') -> 'periods' -> 0 -> 'diff'), 11, 'a closed month replays to the same differences');
select is(tests.kept('check') -> 'periods' -> 0 -> 'diff', tests.kept('feb') -> 'diff',
  'the replay matches the list shown at close, though Dee has been marked a defaulter since');
select is(tests.kept('check') -> 'periods' -> 1 -> 'group', 'null'::jsonb, 'an open month has no group statement yet');
select is((tests.kept('check') -> 'periods' -> 1 ->> 'checked')::boolean, true, 'but it has workbook figures to check');
select tests.login_as(tests.id('owner'));
select is(jsonb_array_length(ledger_check(tests.id('lg')) -> 'periods'), 2, 'the owner can run the check');
select is(ledger_check(tests.id('group')) -> 'periods', '[]'::jsonb, 'a group without an open or closed month has nothing to check');
reset role;
select tests.login_as(tests.id('member'));
select throws_ok($$select ledger_check(tests.id('lg'))$$, '42501', 'not_admin', 'members cannot run the check');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select ledger_check(tests.id('lg'))$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select tests.login_anon();
select throws_ok($$select ledger_check(tests.id('lg'))$$, '42501', null, 'nor anon');
reset role;

-- The workbook's figures obey the same money guard as the ledger.
select throws_ok($$insert into workbook_figures (group_id, period_id, member_id, field, value)
                  values (tests.id('lg'), tests.lp(3), tests.lm('Ann'), 'cum_savings', 'NaN')$$,
  '23514', null, 'a NaN workbook figure is refused');

select * from finish();
rollback;
