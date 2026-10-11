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
  (tests.id('lg'), tests.lp(1), tests.lm('Fay'), 'next_minimum', 51.02),      -- app 1.02: −50.00, one penalty_per_day → penalty_not_charged
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
select is(tests.reason('feb', 'Fay', 'next_minimum'), 'penalty_not_charged', 'the workbook asked for one penalty_per_day the app does not charge');
-- Confirm the threshold is penalty_per_day, not membership_fee: with membership_fee changed to K25,
-- Fay's −50.00 difference still equals penalty_per_day (K50) and must stay 'penalty_not_charged'.
update cycle_rules set membership_fee = 25 where cycle_id = tests.id('lcycle');
select tests.login_as(tests.id('admin'));
select tests.keep('feb2', close_month(tests.lp(1)));
reset role;
select is(tests.reason('feb2', 'Fay', 'next_minimum'), 'penalty_not_charged',
  'penalty_not_charged still fires when membership_fee ≠ penalty_per_day — threshold is penalty_per_day');
update cycle_rules set membership_fee = 50 where cycle_id = tests.id('lcycle');  -- restore for subsequent tests
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

-- March again, with more workbook figures. App figures (Task 6's hand-worked close): received 6,353.73, so opening cash
-- 299 + 6,353.73 = 6,652.73; idle 6,652.73 + 7,050 saved − 750 lent = 12,952.73; excess 1,295.27, a 500 saver's
-- share 45.13, which is also what she owes and her minimum. Ben's minimum is 1,815.84, all of it principal left.
-- The month's loan fees: February 10 (Cid), March 5 (Fay).
insert into members (group_id, full_name, short_name, status) values (tests.id('lg'), 'Xan Test', 'Xan', 'left');
insert into workbook_figures (group_id, period_id, member_id, field, value) values
  (tests.id('lg'), tests.lp(2), null, 'opening_cash', 6642.73),                  -- +10, February's fee → fee_pot_vs_cash
  (tests.id('lg'), tests.lp(2), null, 'idle_cash', 12942.73),                    -- +10, not a run ending in March (5, 15)
                                                                                 --   → unexplained
  (tests.id('lg'), tests.lp(2), tests.lm('Gus'), 'excess_charged', 43.13),       -- +2.00, no group excess figure → unexplained
  (tests.id('lg'), tests.lp(2), tests.lm('Hal'), 'closing_owed', 40.13),         -- +5.00, no excess or waiver → unexplained
  (tests.id('lg'), tests.lp(2), tests.lm('Ivy'), 'next_minimum', 40.13),         -- +5.00, no principal left → unexplained
  (tests.id('lg'), tests.lp(2), tests.lm('Ben'), 'next_minimum', 3815.84),       -- −2,000.00, more than the 1,815.84 left
                                                                                 --   → unexplained
  (tests.id('lg'), tests.lp(2), tests.lm('Jon'), 'next_minimum', -4.87),         -- +50.00: the app asking K50 more is not a
                                                                                 --   fee the workbook charged → unexplained
  ((select group_id from members where short_name = 'Xan'), tests.lp(2),
   (select id from members where short_name = 'Xan'), 'cum_savings', 100);       -- no app figure (left, no lines) → unexplained
select tests.login_as(tests.id('admin'));
select tests.keep('mar2', close_month(tests.lp(2)));
select throws_ok($$select close_month(tests.lp(2), false, repeat('x', 501))$$, 'P0001', 'invalid_note',
  'a reason over 500 characters is refused');
reset role;
select is(tests.reason('mar2', null, 'opening_cash'), 'fee_pot_vs_cash', 'opening cash differs by last month''s fee');
select is(tests.reason('mar2', null, 'idle_cash'), 'unexplained', 'a group difference no fee run explains');
select is(tests.reason('mar2', 'Gus', 'excess_charged'), 'unexplained', 'an excess difference of K2 is not rounding');
select is(tests.reason('mar2', 'Hal', 'closing_owed'), 'unexplained', 'nor is K5 owed with nothing to explain it');
select is(tests.reason('mar2', 'Ivy', 'next_minimum'), 'unexplained', 'no principal left, so no term to differ');
select is(tests.reason('mar2', 'Ben', 'next_minimum'), 'unexplained', 'a term cannot explain more than the principal left');
select is(tests.reason('mar2', 'Jon', 'next_minimum'), 'unexplained', 'the app higher by K50 is not a penalty left out');
select is(tests.reason('mar2', 'Xan', 'cum_savings'), 'unexplained', 'a workbook figure the app has no row for is shown');
select is((select d -> 'app' from jsonb_array_elements(tests.kept('mar2') -> 'diff') d where d ->> 'short_name' = 'Xan'),
  'null'::jsonb, 'with no app figure');
select is(tests.reason('mar2', 'Fay', 'closing_owed'), 'waiver', 'the waiver still explains Fay');
select is((tests.kept('mar2') ->> 'unexplained')::int, 7, 'seven unexplained in March now');

-- Structural workbook practices (synthetic). The treasurer's workbook (a) adds the month's penalty to the minimum,
-- (b) carries the fee-pot excess noise into it, and (c) sometimes sets the minimum to its own owed plus its own excess.
-- March again: penalties first (Kim, Lee, Ned: K30 each), then a preview 'pre' whose app figures the workbook rows are
-- built from. Workbook minus app is written out in each comment.
select tests.login_as(tests.id('admin'));
select apply_penalty(tests.lm(n), tests.lp(2), 30, 'other', 'synthetic') from unnest(array['Kim', 'Lee', 'Ned']) n;
select tests.keep('pre', close_month(tests.lp(2)));
reset role;
insert into workbook_figures (group_id, period_id, member_id, field, value)
select tests.id('lg'), tests.lp(2), tests.lm(r.who), r.field, tests.fig('pre', r.who, r.src) + r.delta
from (values
  -- the group's excess differs by 1.50 = 10% of the 15 of fees paid since February → fee_pot_vs_cash; members' shares
  -- of it (workbook lower by 1.20) follow
  ('Ned', 'excess_charged', 'excess_charged', -1.20),
  ('Oli', 'excess_charged', 'excess_charged', -1.20),
  ('Pam', 'excess_charged', 'excess_charged', -5.00),     -- far more than the group's 1.50 → unexplained
  -- penalty_in_minimum: workbook − app is the K30 penalty
  ('Kim', 'next_minimum', 'next_minimum', 30.00),         -- → penalty_in_minimum
  ('Lee', 'next_minimum', 'next_minimum', 32.00),         -- K2 off the penalty → unexplained
  ('Max', 'next_minimum', 'next_minimum', 30.00),         -- same K30 but Max has no penalty → unexplained
  ('Ned', 'next_minimum', 'next_minimum', 28.80),         -- penalty 30 less the −1.20 fee-pot excess → penalty_in_minimum
  -- fee-pot excess flowing into the minimum
  ('Oli', 'next_minimum', 'next_minimum', -1.20),         -- → fee_pot_vs_cash
  ('Pam', 'next_minimum', 'next_minimum', -5.00),         -- its excess difference is unexplained → unexplained
  -- workbook_counts_excess_twice: workbook minimum = workbook owed + workbook excess (both equal the app's)
  ('Quin', 'closing_owed', 'closing_owed', 0),
  ('Quin', 'excess_charged', 'excess_charged', 0),
  ('Roy', 'closing_owed', 'closing_owed', 0),
  ('Roy', 'excess_charged', 'excess_charged', 0)
) as r(who, field, src, delta);
insert into workbook_figures (group_id, period_id, member_id, field, value) values
  (tests.id('lg'), tests.lp(2), null, 'excess_billed', tests.gfig('pre', 'excess_billed') - 1.50),
  (tests.id('lg'), tests.lp(2), tests.lm('Quin'), 'next_minimum', tests.fig('pre', 'Quin', 'closing_owed') + tests.fig('pre', 'Quin', 'excess_charged')),
  (tests.id('lg'), tests.lp(2), tests.lm('Roy'), 'next_minimum', tests.fig('pre', 'Roy', 'closing_owed') + tests.fig('pre', 'Roy', 'excess_charged') + 0.50);
select tests.login_as(tests.id('admin'));
select tests.keep('mar3', close_month(tests.lp(2)));
reset role;
select is(tests.reason('mar3', 'Ned', 'excess_charged'), 'fee_pot_vs_cash', 'Ned''s excess differs by his share of the fee difference');
select is(tests.reason('mar3', 'Pam', 'excess_charged'), 'unexplained', 'Pam''s excess difference is more than the group''s');
select is(tests.reason('mar3', 'Kim', 'next_minimum'), 'penalty_in_minimum', 'the workbook put Kim''s K30 penalty in her minimum');
select is(tests.reason('mar3', 'Lee', 'next_minimum'), 'unexplained', 'K2 away from the penalty is not that penalty');
select is(tests.reason('mar3', 'Max', 'next_minimum'), 'unexplained', 'the same K30 without a penalty that month is unexplained');
select is(tests.reason('mar3', 'Ned', 'next_minimum'), 'penalty_in_minimum', 'penalty plus a small fee-pot excess difference');
select is(tests.reason('mar3', 'Oli', 'next_minimum'), 'fee_pot_vs_cash', 'the fee-pot excess difference flows into the minimum');
select is(tests.reason('mar3', 'Pam', 'next_minimum'), 'unexplained', 'but not when the excess difference is itself unexplained');
select is(tests.reason('mar3', 'Quin', 'next_minimum'), 'workbook_counts_excess_twice', 'the workbook''s minimum is its own owed plus its own excess');
select is(tests.reason('mar3', 'Roy', 'next_minimum'), 'unexplained', 'K0.50 off the double count is not a double count');

-- The workbook's figures obey the same money guard as the ledger.
select throws_ok($$insert into workbook_figures (group_id, period_id, member_id, field, value)
                  values (tests.id('lg'), tests.lp(3), tests.lm('Ann'), 'cum_savings', 'NaN')$$,
  '23514', null, 'a NaN workbook figure is refused');

select * from finish();
rollback;
