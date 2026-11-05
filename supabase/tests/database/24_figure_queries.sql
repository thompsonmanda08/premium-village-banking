begin;
select * from no_plan();
select tests.ledger_fixture();
-- February and March closed, April open.
select tests.ledger_jump(3);

-- grants ----------------------------------------------------------------------------------------
select tests.login_anon();
select throws_ok($$select raise_query(tests.lp(1), 'cum_savings', 'why?')$$, '42501',
  'permission denied for function raise_query', 'anon cannot call raise_query');
select throws_ok($$select answer_query(gen_random_uuid(), 'because')$$, '42501',
  'permission denied for function answer_query', 'anon cannot call answer_query');
reset role;
select ok(not has_function_privilege('anon', 'public.raise_query(uuid, text, text)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.raise_query(uuid, text, text)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.answer_query(uuid, text)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.answer_query(uuid, text)', 'EXECUTE'),
  'app roles: anon cannot execute, signed-in users can (the functions check the caller)');
select ok(not has_table_privilege('authenticated', 'public.figure_queries', 'INSERT,UPDATE,DELETE,TRUNCATE')
      and not has_table_privilege('anon', 'public.figure_queries', 'SELECT'), 'no client writes, no anon read');

-- raising: refusals -------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select raise_query(tests.lp(3), 'cum_savings', 'why?')$$, 'P0001', 'period_not_closed', 'an open month');
select throws_ok($$select raise_query(tests.lp(4), 'cum_savings', 'why?')$$, 'P0001', 'period_not_closed', 'a planned month');
select throws_ok($$select raise_query(tests.lp(1), 'interest_rate', 'why?')$$, 'P0001', 'invalid_field', 'an unknown field');
select throws_ok($$select raise_query(tests.lp(1), null, 'why?')$$, 'P0001', 'invalid_field', 'a null field');
select throws_ok($$select raise_query(tests.lp(1), 'cum_savings', '   ')$$, 'P0001', 'invalid_note', 'a blank note');
select throws_ok($$select raise_query(tests.lp(1), 'cum_savings', null)$$, 'P0001', 'invalid_note', 'a null note');
select throws_ok($$select raise_query(tests.lp(1), 'cum_savings', repeat('x', 501))$$, 'P0001', 'invalid_note', 'a 501-character note');
select throws_ok($$select raise_query(gen_random_uuid(), 'cum_savings', 'why?')$$, '42501', 'not_admin', 'an unknown month is not yours');
reset role;
select tests.login_as(tests.id('owner'));
select throws_ok($$select raise_query(tests.lp(1), 'cum_savings', 'why?')$$, '42501', 'not_admin',
  'the owner with no member row has no figures to question');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select raise_query(tests.lp(1), 'cum_savings', 'why?')$$, '42501', 'not_admin', 'someone outside the group');
reset role;
select tests.login_as(tests.id('outsider'));
select throws_ok($$select raise_query(tests.lp(1), 'cum_savings', 'why?')$$, '42501', 'not_admin', 'a signed-in stranger');
reset role;
select is((select count(*)::int from figure_queries), 0, 'no refusal left a row behind');

-- raising -----------------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select is((select status from raise_query(tests.lp(1), 'cum_savings', '  I paid 500, not 250  ')), 'open', 'a member raises a query');
reset role;
select tests.remember('q1', (select id from figure_queries where member_id = tests.lm('Ben')));
select is((select member_id || '|' || group_id || '|' || period_id || '|' || field || '|' || note || '|' || status
           from figure_queries where id = tests.id('q1')),
  tests.lm('Ben') || '|' || tests.id('lg') || '|' || tests.lp(1) || '|cum_savings|I paid 500, not 250|open',
  'the query is on the caller''s own row, with the note trimmed, and starts open');
select is((select data::text from audit_log where action = 'query.raised' and entity_id = tests.id('q1')),
  jsonb_build_object('query_id', tests.id('q1'), 'field', 'cum_savings', 'period_id', tests.lp(1))::text,
  'raising writes a query.raised audit row without the note');
select is((select entity from audit_log where action = 'query.raised'), 'figure_queries', 'the audit row names the table');

select tests.login_as(tests.id('member'));
select lives_ok($$select raise_query(tests.lp(2), 'closing_owed', 'x')$$, 'a one-character note');
select lives_ok($$select raise_query(tests.lp(2), 'paid_total', repeat('x', 500))$$, 'a 500-character note');
select throws_ok($$select raise_query(tests.lp(2), 'next_minimum', 'and another')$$, 'P0001', 'too_many_queries',
  'a fourth open query');
reset role;
select is((select count(*)::int from figure_queries where member_id = tests.lm('Ben')), 3, 'three open queries, no fourth');

select tests.login_as(tests.id('other'));
select lives_ok($$select raise_query(tests.lp(1), 'excess_charged', 'why was I charged?')$$, 'Cid raises one');
reset role;
select tests.remember('q_cid', (select id from figure_queries where member_id = tests.lm('Cid')));
select tests.login_as(tests.id('admin'));
select lives_ok($$select raise_query(tests.lp(2), 'interest_earned_to_date', 'treasurer checking her own')$$,
  'the treasurer raises one on her own row');
reset role;

-- reading -----------------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select is((select count(*)::int from figure_queries), 3, 'a member sees their own queries');
select is((select count(*)::int from figure_queries where member_id <> tests.lm('Ben')), 0, 'and no one else''s');
reset role;
select tests.login_as(tests.id('other'));
select is((select count(*)::int from figure_queries), 1, 'another member of the group sees only their own');
select is((select count(*)::int from figure_queries where member_id = tests.lm('Ben')), 0, 'none of Ben''s');
reset role;
select tests.login_as(tests.id('admin'));
select is((select count(*)::int from figure_queries), 5, 'the treasurer sees every query of the group');
reset role;
select tests.login_as(tests.id('owner'));
select is((select count(*)::int from figure_queries), 5, 'the owner sees every query of the group');
reset role;
select tests.login_as(tests.id('owner2'));
select is((select count(*)::int from figure_queries), 0, 'another group''s owner sees none');
reset role;

-- answering ---------------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok(format('select answer_query(%L, %L)', tests.id('q1'), 'I say so'), '42501', 'not_admin',
  'a member cannot answer, even their own query');
select throws_ok(format('select answer_query(%L, %L)', tests.id('q_cid'), 'I say so'), '42501', 'not_admin',
  'nor another member''s');
select throws_ok($$select answer_query(gen_random_uuid(), 'x')$$, '42501', 'not_admin', 'an unknown id tells a member nothing');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok(format('select answer_query(%L, %L)', tests.id('q1'), 'not mine'), 'P0001', 'query_not_found',
  'another group''s admin cannot see the query to answer it');
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok(format('select answer_query(%L, %L)', tests.id('q1'), '  '), 'P0001', 'invalid_note', 'a blank reply');
select throws_ok(format('select answer_query(%L, null)', tests.id('q1')), 'P0001', 'invalid_note', 'a null reply');
select throws_ok(format('select answer_query(%L, %L)', tests.id('q1'), repeat('x', 501)), 'P0001', 'invalid_note', 'a 501-character reply');
select throws_ok($$select answer_query(gen_random_uuid(), 'x')$$, 'P0001', 'query_not_found', 'an admin answering an unknown id');
select is((select status || '|' || reply || '|' || answered_by from answer_query(tests.id('q1'), ' The 250 went to your loan. ')),
  'answered|The 250 went to your loan.|' || tests.id('admin'), 'the treasurer answers once');
select throws_ok(format('select answer_query(%L, %L)', tests.id('q1'), 'changed my mind'), 'P0001', 'already_answered',
  'a second answer is refused');
reset role;
select is((select reply from figure_queries where id = tests.id('q1')), 'The 250 went to your loan.', 'the first answer stands');
select ok((select answered_at is not null from figure_queries where id = tests.id('q1')), 'the answer is stamped');
select is((select data::text from audit_log where action = 'query.answered'),
  jsonb_build_object('query_id', tests.id('q1'), 'field', 'cum_savings', 'period_id', tests.lp(1))::text,
  'answering writes one query.answered audit row without the reply');
select is((select count(*)::int from audit_log where action = 'query.answered'), 1, 'the refused second answer wrote no audit row');

-- An answered query frees a slot.
select tests.login_as(tests.id('member'));
select lives_ok($$select raise_query(tests.lp(2), 'next_minimum', 'follow-up')$$, 'an answered query no longer counts toward the three');
select is((select reply from figure_queries where id = tests.id('q1')), 'The 250 went to your loan.', 'the member reads the reply');

-- no direct writes --------------------------------------------------------------------------------
select throws_ok($$insert into figure_queries (group_id, period_id, member_id, field, note)
  values (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'cum_savings', 'sneaky')$$, '42501', null, 'a member cannot insert directly');
select throws_ok(format('update figure_queries set reply = %L where id = %L', 'edited', tests.id('q1')), '42501', null,
  'a member cannot edit a query');
select throws_ok(format('delete from figure_queries where id = %L', tests.id('q1')), '42501', null, 'a member cannot delete a query');
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok(format('update figure_queries set reply = %L where id = %L', 'edited', tests.id('q1')), '42501', null,
  'the treasurer cannot edit an answer');
select throws_ok(format('delete from figure_queries where id = %L', tests.id('q1')), '42501', null, 'nor delete a query');
reset role;

-- a member who left -------------------------------------------------------------------------------
update members set status = 'left' where id = tests.lm('Cid');
select tests.login_as(tests.id('other'));
select throws_ok($$select raise_query(tests.lp(2), 'cum_savings', 'still here?')$$, '42501', 'not_admin', 'a member who left cannot raise a query');
-- Deliberate (spec section 11, item 8): leaving does not hide a member's own record.
select is((select count(*)::int from figure_queries), 1, 'a member who left still reads their own old queries');
reset role;

-- on the record for the owner too (this block runs as the table owner, not authenticated) -----------
select ok(not has_table_privilege('service_role', 'public.figure_queries', 'INSERT,UPDATE,DELETE,TRUNCATE'),
  'service_role cannot write the table');
select throws_ok(format('update figure_queries set reply = %L where id = %L', 'edited', tests.id('q1')), 'P0001', 'append_only',
  'the owner cannot edit an answered query');
select throws_ok(format('update figure_queries set status = %L where id = %L', 'open', tests.id('q1')), 'P0001', 'append_only',
  'nor reopen it');
select throws_ok(format('update figure_queries set note = %L where id = %L', 'rewritten', tests.id('q_cid')), 'P0001', 'append_only',
  'nor rewrite the note of an open query');
select throws_ok(format($$update figure_queries set status = 'answered', reply = 'x', answered_at = now(), note = 'rewritten'
  where id = %L$$, tests.id('q_cid')), 'P0001', 'append_only', 'nor change the note while answering');
select throws_ok(format('delete from figure_queries where id = %L', tests.id('q_cid')), 'P0001', 'append_only', 'nor delete a query');
select throws_ok('truncate figure_queries', 'P0001', 'append_only', 'nor truncate the table');
select tests.login_as(tests.id('admin'));
select is((select status from answer_query(tests.id('q_cid'), 'The excess is 10% of what was owed.')), 'answered',
  'answer_query still makes the open-to-answered change through the guard');
reset role;
select is((select note from figure_queries where id = tests.id('q_cid')), 'why was I charged?', 'the member''s note is untouched');

-- table shape -------------------------------------------------------------------------------------
select throws_ok(format($$insert into figure_queries (group_id, period_id, member_id, field, note)
  values (%L, %L, %L, 'cum_savings', 'x')$$, tests.id('group2'), tests.lp(1), tests.lm('Ben')), '23503', null,
  'a query''s month and member belong to its group');
select throws_ok(format($$insert into figure_queries (group_id, period_id, member_id, field, note, status)
  values (%L, %L, %L, 'cum_savings', 'x', 'closed')$$, tests.id('lg'), tests.lp(1), tests.lm('Ben')), '23514', null,
  'status is open or answered');

select * from finish();
rollback;
