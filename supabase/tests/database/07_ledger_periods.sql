begin;
select * from no_plan();
select tests.ledger_fixture();

-- ensure_periods through open_period, on the Test Group's planned 2027 cycle (no periods yet) -------------
select tests.login_as(tests.id('admin'));
select is((select status from open_period(tests.id('c_planned'), 1)), 'open', 'admin opens the first month of a new cycle');
reset role;
select is((select count(*)::int from periods where cycle_id = tests.id('c_planned')), 12, 'all twelve months exist');
select is((select array_agg(label order by month_index) from periods where cycle_id = tests.id('c_planned')),
  array['Feb 2027', 'Mar 2027', 'Apr 2027', 'May 2027', 'Jun 2027', 'Jul 2027', 'Aug 2027', 'Sep 2027', 'Oct 2027',
        'Nov 2027', 'Dec 2027', 'Jan 2028'], 'months are labelled Feb 2027 … Jan 2028');
select is((select deadline from periods where cycle_id = tests.id('c_planned') and month_index = 1), date '2027-02-07',
  'the deadline defaults to the 7th (the rules'' window_close_day)');
select is((select count(*)::int from periods where cycle_id = tests.id('c_planned') and status = 'planned'), 11, 'the rest are planned');
select lives_ok($$select private.ensure_periods(tests.id('c_planned'))$$, 'ensure_periods can run again');
select is((select count(*)::int from periods where cycle_id = tests.id('c_planned')), 12, 'and adds nothing the second time');
select tests.login_as(tests.id('admin'));
select throws_ok($$select open_period(tests.id('c_active'), 1)$$, 'P0001', 'previous_period_open',
  'a group has one open month at a time, across cycles');
reset role;

-- the ledger cycle --------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select open_period(tests.id('lcycle'), 1)$$, '42501', 'not_admin', 'members cannot open a month');
reset role;
select tests.login_as(tests.id('outsider'));
select throws_ok($$select open_period(tests.id('lcycle'), 1)$$, '42501', 'not_admin', 'outsiders cannot open a month');
select throws_ok($$select open_period(gen_random_uuid(), 1)$$, '42501', 'not_admin', 'an unknown cycle reveals nothing');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select open_period(tests.id('lcycle'), 1)$$, '42501', 'not_admin', 'another group''s admin cannot open it');
reset role;

select tests.login_as(tests.id('owner'));
select throws_ok($$select open_period(tests.id('lcycle'), 1, date '2026-01-31')$$, 'P0001', 'invalid_date',
  'a deadline before the month starts is refused');
select is((select deadline from open_period(tests.id('lcycle'), 1, date '2026-02-17')), date '2026-02-17',
  'the owner opens February with the announced deadline (17 Feb)');
select throws_ok($$select open_period(tests.id('lcycle'), 1)$$, 'P0001', 'already_opened', 'a month opens once');
select throws_ok($$select open_period(tests.id('lcycle'), 2)$$, 'P0001', 'previous_period_open', 'March waits for February to close');
select throws_ok($$select open_period(tests.id('lcycle'), 3)$$, 'P0001', 'previous_period_open', 'April waits for March');
select throws_ok($$select open_period(tests.id('lcycle'), 13)$$, 'P0001', 'period_not_open', 'there is no 13th month');
reset role;
select is((select count(*)::int from audit_log where action = 'period.opened' and group_id = tests.id('lg')), 1, 'opening is audited');
select is((select actor_user_id from audit_log where action = 'period.opened' and group_id = tests.id('lg')), tests.id('owner'),
  'with the person who did it');

update periods set status = 'closed' where id = tests.lp(1);   -- as if February had been closed
select tests.login_as(tests.id('admin'));
select is((select status from open_period(tests.id('lcycle'), 2)), 'open', 'March opens once February is closed');

-- set_deadline ----------------------------------------------------------------------------
select throws_ok($$select set_deadline(tests.lp(2), date '2026-03-10', '  ')$$, 'P0001', 'reason_required', 'an extension needs a reason');
select throws_ok($$select set_deadline(tests.lp(2), date '2026-02-28', 'typo')$$, 'P0001', 'invalid_date', 'not before the month starts');
select throws_ok($$select set_deadline(tests.lp(2), null, 'typo')$$, 'P0001', 'invalid_date', 'not empty');
select throws_ok($$select set_deadline(tests.lp(1), date '2026-02-20', 'too late')$$, 'P0001', 'period_not_open',
  'a closed month keeps its deadline');
select is((select deadline from set_deadline(tests.lp(2), date '2026-03-10', 'SIM limit reached on the 7th')), date '2026-03-10',
  'the treasurer extends March to the 10th');
select is((select deadline from set_deadline(tests.lp(4), date '2026-05-08', 'agreed at the meeting')), date '2026-05-08',
  'a planned month''s deadline can be set ahead');
reset role;
select is((select data ->> 'reason' from audit_log where action = 'period.deadline_changed' and entity_id = tests.lp(2)),
  'SIM limit reached on the 7th', 'the extension and its reason are audited');
select tests.login_as(tests.id('member'));
select throws_ok($$select set_deadline(tests.lp(2), date '2026-03-12', 'please')$$, '42501', 'not_admin', 'members cannot move a deadline');
reset role;
select tests.login_anon();
select throws_ok($$select open_period(tests.id('lcycle'), 3)$$, '42501', null, 'anon cannot call open_period');
select throws_ok($$select set_deadline(tests.lp(2), date '2026-03-12', 'x')$$, '42501', null, 'anon cannot call set_deadline');
reset role;

-- ledger_lines: effective amounts --------------------------------------------------------------
insert into entries (group_id, period_id, member_id, kind, amount, source)
  values (tests.id('lg'), tests.lp(2), tests.lm('Ann'), 'saving', 1000, 'app');
insert into entries (group_id, period_id, member_id, kind, amount, source, corrects_entry_id, reason)
  select tests.id('lg'), tests.lp(2), tests.lm('Ann'), 'adjustment', 300, 'correction', id, 'typo'
  from entries where member_id = tests.lm('Ann') and kind = 'saving';
select is((select sum(amount) from private.ledger_lines where member_id = tests.lm('Ann') and kind = 'saving'), 700.00,
  'an adjustment counts against the kind it corrects (1,000 − 300)');
select is((select cycle_id from private.ledger_lines limit 1), tests.id('lcycle'), 'lines carry their cycle');
select ok(not has_table_privilege('authenticated', 'private.ledger_lines', 'SELECT'), 'clients cannot read the lines view');

select * from finish();
rollback;
