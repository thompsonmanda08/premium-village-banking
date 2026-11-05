begin;
select * from no_plan();
select tests.ledger_fixture();

-- grants ----------------------------------------------------------------------------------------
select tests.login_anon();
select throws_ok($$select record_ratification(tests.id('lcycle'), 'saving_minimum', current_date, 12, 18)$$, '42501',
  'permission denied for function record_ratification', 'anon cannot call record_ratification');
reset role;
select ok(not has_function_privilege('anon', 'public.record_ratification(uuid, text, date, int, int, text, text)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.record_ratification(uuid, text, date, int, int, text, text)', 'EXECUTE'),
  'app roles: anon cannot execute, signed-in users can (the function checks for an admin)');
select ok(not has_table_privilege('authenticated', 'public.rule_ratifications', 'INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon', 'public.rule_ratifications', 'SELECT'), 'no client writes, no anon read');

-- who may record ----------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select record_ratification(tests.id('lcycle'), 'saving_minimum', current_date, 12, 18)$$, '42501', 'not_admin',
  'a plain member cannot record a vote');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select record_ratification(tests.id('lcycle'), 'saving_minimum', current_date, 12, 18)$$, '42501', 'not_admin',
  'nor can another group''s admin');
reset role;

-- validation --------------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select throws_ok($$select record_ratification(tests.id('lcycle'), 'Bad Key', current_date, 12, 18)$$, 'P0001', 'invalid_rule', 'a key with capitals and a space');
select throws_ok($$select record_ratification(tests.id('lcycle'), 'ab', current_date, 12, 18)$$, 'P0001', 'invalid_rule', 'a key under three characters');
select throws_ok($$select record_ratification(tests.id('lcycle'), 'a' || repeat('b', 40), current_date, 12, 18)$$, 'P0001', 'invalid_rule', 'a 41-character key');
select throws_ok($$select record_ratification(tests.id('lcycle'), null, current_date, 12, 18)$$, 'P0001', 'invalid_rule', 'a null key');
select throws_ok($$select record_ratification(tests.id('lcycle'), 'foo_bar', current_date, 12, 18)$$, 'P0001', 'invalid_rule', 'a well-formed key that is not one of the app''s rules');
select throws_ok($$select record_ratification(tests.id('lcycle'), 'saving_minimum', current_date, 0, 0)$$, 'P0001', 'invalid_vote', '0 of 0');
select throws_ok($$select record_ratification(tests.id('lcycle'), 'saving_minimum', current_date, 5, 4)$$, 'P0001', 'invalid_vote', '5 of 4');
select throws_ok($$select record_ratification(tests.id('lcycle'), 'saving_minimum', current_date, -1, 4)$$, 'P0001', 'invalid_vote', '-1 of 4');
select throws_ok($$select record_ratification(tests.id('lcycle'), 'saving_minimum', current_date + 2, 3, 4)$$, 'P0001', 'invalid_vote', 'a vote dated in the future');
select throws_ok($$select record_ratification(tests.id('lcycle'), 'saving_minimum', null, 3, 4)$$, 'P0001', 'invalid_vote', 'a vote needs a date');
select throws_ok($$select record_ratification(tests.id('lcycle'), 'saving_minimum', current_date, null, 4)$$, 'P0001', 'invalid_vote', 'a vote needs a count');
select throws_ok($$select record_ratification(tests.id('lcycle'), 'saving_minimum', current_date, 12, 18, null, repeat('x', 501))$$, 'P0001', 'invalid_note', 'a 501-character note');
select throws_ok($$select record_ratification(tests.id('lcycle'), 'saving_minimum', current_date, 12, 18, repeat('x', 501))$$, 'P0001', 'invalid_note', 'a 501-character meeting reference');
select throws_ok($$select record_ratification(gen_random_uuid(), 'saving_minimum', current_date, 12, 18)$$, '42501', 'not_admin', 'an unknown cycle is not yours to record into');
reset role;
select is((select count(*)::int from rule_ratifications), 0, 'no refusal left a row behind');

-- recording ---------------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select is((select passed from record_ratification(tests.id('lcycle'), 'saving_minimum', current_date, 12, 18, 'AGM 2026', 'show of hands')), true, '12 of 18 passes');
select is((select passed from record_ratification(tests.id('lcycle'), 'saving_minimum', current_date, 11, 18)), false, '11 of 18 does not pass');
select is((select passed from record_ratification(tests.id('lcycle'), 'saving_minimum', current_date, 1, 1)), true, '1 of 1 passes');
reset role;
select is((select count(*)::int from rule_ratifications where rule_key = 'saving_minimum'), 3, 'a second vote on the same key is added, not replaced');
select is((select meeting_ref || '|' || note || '|' || recorded_by::text from rule_ratifications where votes_for = 12),
  'AGM 2026|show of hands|' || tests.id('admin')::text, 'the meeting, note and recorder are kept');
select is((select count(*)::int from audit_log where action = 'rule.ratified' and group_id = tests.id('lg')), 3, 'each call writes one rule.ratified audit row');
select is((select data::text from audit_log where action = 'rule.ratified' and (data ->> 'votes_for')::int = 1),
  jsonb_build_object('rule_key', 'saving_minimum', 'votes_for', 1, 'votes_total', 1, 'passed', true, 'decided_on', current_date)::text,
  'the audit row carries the vote');

-- append only -------------------------------------------------------------------------------------
select throws_ok($$update rule_ratifications set passed = not passed$$, 'P0001', 'append_only', 'a ratification cannot be updated');
select throws_ok($$delete from rule_ratifications$$, 'P0001', 'append_only', 'nor deleted');
select throws_ok('truncate rule_ratifications', 'P0001', 'append_only', 'nor truncated');
select ok(not has_table_privilege('service_role', 'public.rule_ratifications', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'service_role cannot write the table');
select throws_ok($$insert into rule_ratifications (group_id, cycle_id, rule_key, decided_on, votes_for, votes_total, passed)
  values (tests.id('lg'), tests.id('lcycle'), 'saving_minimum', current_date, 1, 3, true)$$, '23514', null, 'a forged passed is refused even for the table owner');
select throws_ok($$insert into rule_ratifications (group_id, cycle_id, rule_key, decided_on, votes_for, votes_total, passed)
  values (tests.id('lg'), tests.id('lcycle'), 'saving_minimum', current_date, 2, 3, false)$$, '23514', null, 'nor a vote that carried recorded as failed');

-- reading -----------------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select is((select count(*)::int from rule_ratifications), 3, 'a member of the group reads the votes');
reset role;
select tests.login_as(tests.id('owner2'));
select is((select count(*)::int from rule_ratifications), 0, 'a member of another group does not');
reset role;

select * from finish();
rollback;
