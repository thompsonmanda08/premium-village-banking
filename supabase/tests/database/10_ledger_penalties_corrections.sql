begin;
select * from no_plan();
select tests.ledger_fixture();
select tests.login_as(tests.id('admin'));
select open_period(tests.id('lcycle'), 1);   -- February 2026, deadline 7 Feb: long past whenever this runs
reset role;
select tests.ledger_pay('Ann', 1, 1000, 0);
select tests.ledger_pay('Ben', 1, 500, 0);
select tests.ledger_pay('Dee', 1, 200, 0);
select tests.remember('e_ann_saving', (select id from entries where member_id = tests.lm('Ann') and kind = 'saving'));
select tests.remember('e_ben_saving', (select id from entries where member_id = tests.lm('Ben') and kind = 'saving'));

-- grants: every new function is closed to anon and open (with its own admin check) to signed-in users -------------
select tests.login_anon();
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50, 'other', 'x')$$, '42501', 'permission denied for function apply_penalty',
  'anon cannot call apply_penalty');
select throws_ok($$select * from suggest_penalties(tests.lp(1))$$, '42501', 'permission denied for function suggest_penalties',
  'anon cannot call suggest_penalties');
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, 'x')$$, '42501', 'permission denied for function set_default',
  'anon cannot call set_default');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 950, 'x')$$, '42501', 'permission denied for function post_correction',
  'anon cannot call post_correction');
select throws_ok($$select post_waiver(tests.id('e_ann_saving'), 10, 'x')$$, '42501', 'permission denied for function post_waiver',
  'anon cannot call post_waiver');
reset role;
select ok(not has_function_privilege('anon', 'public.apply_penalty(uuid, uuid, numeric, text, text)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.suggest_penalties(uuid)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.set_default(uuid, uuid, boolean, text)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.post_correction(uuid, numeric, text)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.post_waiver(uuid, numeric, text)', 'EXECUTE'), 'anon has no execute on any of them');
select ok(has_function_privilege('authenticated', 'public.apply_penalty(uuid, uuid, numeric, text, text)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.suggest_penalties(uuid)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.set_default(uuid, uuid, boolean, text)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.post_correction(uuid, numeric, text)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.post_waiver(uuid, numeric, text)', 'EXECUTE'),
  'signed-in users may call them (each checks for an admin)');

-- apply_penalty ---------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select is((select kind || ' ' || amount || ' ' || reason from apply_penalty(tests.lm('Dee'), tests.lp(1), 100, 'late_declaration', 'declared 2 days late')),
  'penalty 100.00 late_declaration: declared 2 days late', 'the treasurer applies a penalty with its ground and reason');
reset role;
select tests.remember('e_dee_pen', (select id from entries where member_id = tests.lm('Dee') and kind = 'penalty'));
select tests.login_as(tests.id('admin'));
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50, 'late_declaration', ' ')$$, 'P0001', 'reason_required', 'no penalty without a reason');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50, 'late_declaration', null)$$, 'P0001', 'reason_required', 'a null reason is no reason');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50, 'because', 'x')$$, 'P0001', 'reason_required', 'only the known grounds');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50, null, 'x')$$, 'P0001', 'reason_required', 'a ground is required');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50, 'other', repeat('x', 501))$$, 'P0001', 'invalid_note', 'a reason is kept to 500 characters');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 0, 'other', 'x')$$, 'P0001', 'invalid_amount', 'no zero penalty');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), -5, 'other', 'x')$$, 'P0001', 'invalid_amount', 'no negative penalty');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50.005, 'other', 'x')$$, 'P0001', 'invalid_amount', 'to the ngwee only');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), null, 'other', 'x')$$, 'P0001', 'invalid_amount', 'a penalty needs an amount');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 'NaN'::numeric, 'other', 'x')$$, 'P0001', 'invalid_amount', 'NaN is not an amount');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 'Infinity'::numeric, 'other', 'x')$$, 'P0001', 'invalid_amount', 'nor is Infinity');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 10000000000, 'other', 'x')$$, 'P0001', 'invalid_amount',
  'an amount past the column is refused with a code, not an overflow error');
select throws_ok($$select apply_penalty(gen_random_uuid(), tests.lp(1), 50, 'other', 'x')$$, 'P0001', 'member_not_found', 'unknown member');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(2), 50, 'other', 'x')$$, 'P0001', 'period_not_open', 'only into the open month');
select throws_ok($$select apply_penalty(tests.lm('Dee'), gen_random_uuid(), 50, 'other', 'x')$$, 'P0001', 'period_not_open', 'an unknown month is not open');
select throws_ok($$select apply_penalty(tests.lm('Dee'), (select id from periods where group_id = tests.id('group2') limit 1), 50, 'other', 'x')$$,
  'P0001', 'period_not_open', 'nor is another group''s month');
reset role;
select tests.login_as(tests.id('member'));
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50, 'other', 'x')$$, '42501', 'not_admin', 'members cannot apply penalties');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50, 'other', 'x')$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
update members set status = 'left' where id = tests.lm('Eve');
select tests.login_as(tests.id('admin'));
select throws_ok($$select apply_penalty(tests.lm('Eve'), tests.lp(1), 50, 'other', 'x')$$, 'P0001', 'member_not_active', 'no penalty for a member who has left');
reset role;
update members set status = 'active' where id = tests.lm('Eve');
select is((select count(*)::int from entries where kind = 'penalty' and group_id = tests.id('lg')), 1, 'no refusal left a penalty behind');
select is((select count(*)::int from audit_log where action = 'penalty.applied' and group_id = tests.id('lg')), 1, 'penalties are audited');
select is((select data ->> 'ground' || '|' || (data ->> 'reason') from audit_log where action = 'penalty.applied' and group_id = tests.id('lg')),
  'late_declaration|declared 2 days late', 'the audit row records the ground and the reason');

-- suggest_penalties -------------------------------------------------------------------------------
-- Ann declared on 9 Feb (2 days after the 7th): 2 × K50 = K100. Ben declared on the 6th: not late.
-- Cid has not declared at all: K50 × days since the 7th, counted to today in Lusaka.
-- After the deadline: Dee saved 200 (< 250) and Cid saved nothing → under_saving K50 each; Ann and Ben saved enough.
insert into declarations (group_id, period_id, member_id, saving, wallet_id, submitted_by, submitted_at) values
  (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 1000, tests.id('w_airtel'), tests.id('admin'), '2026-02-09 10:00:00+02'),
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 500, tests.id('w_airtel'), tests.id('member'), '2026-02-06 09:00:00+02');
select tests.keep('before', jsonb_build_object('entries', (select count(*) from entries), 'declarations', (select count(*) from declarations),
  'audit', (select count(*) from audit_log), 'status', (select count(*) from member_status)));
select tests.login_as(tests.id('admin'));
select is((select amount || ' ' || detail from suggest_penalties(tests.lp(1)) where short_name = 'Ann' and ground = 'late_declaration'),
  '100.00 Declared 2 days after the deadline', 'late by two days suggests K100');
select is((select count(*)::int from suggest_penalties(tests.lp(1)) where short_name = 'Ben' and ground = 'late_declaration'), 0, 'on time suggests nothing');
select is((select amount from suggest_penalties(tests.lp(1)) where short_name = 'Cid' and ground = 'late_declaration'),
  50 * ((now() at time zone 'Africa/Lusaka')::date - date '2026-02-07')::numeric, 'not declared: K50 for every day since the deadline');
select is((select amount from suggest_penalties(tests.lp(1)) where short_name = 'Dee' and ground = 'under_saving'), 50.00, 'saving under K250 suggests K50');
select is((select detail from suggest_penalties(tests.lp(1)) where short_name = 'Dee' and ground = 'under_saving'),
  'Saved K200.00 of the K250.00 minimum', 'and says by how much');
select is((select amount from suggest_penalties(tests.lp(1)) where short_name = 'Cid' and ground = 'under_saving'), 50.00, 'saving nothing suggests K50 too');
select is((select count(*)::int from suggest_penalties(tests.lp(1)) where short_name in ('Ann', 'Ben') and ground = 'under_saving'), 0,
  'enough saved suggests nothing');
select is((select count(*)::int from suggest_penalties(tests.lp(1)) where ground = 'missed_minimum'), 0, 'nothing was due in the first month');
reset role;
select is((select jsonb_build_object('entries', (select count(*) from entries), 'declarations', (select count(*) from declarations),
  'audit', (select count(*) from audit_log), 'status', (select count(*) from member_status))), tests.kept('before'),
  'suggesting writes nothing: no entries, declarations, statuses or audit rows');
select tests.login_as(tests.id('member'));
select throws_ok($$select * from suggest_penalties(tests.lp(1))$$, '42501', 'not_admin', 'suggestions are for admins');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select * from suggest_penalties(tests.lp(1))$$, '42501', 'not_admin', 'not even another group''s admin sees them');
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok($$select * from suggest_penalties(gen_random_uuid())$$, 'P0001', 'period_not_open', 'unknown month');
select throws_ok($$select * from suggest_penalties(tests.lp(2))$$, 'P0001', 'period_not_open', 'nothing to suggest for a month that is not open');
reset role;

-- set_default -----------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select is((select defaulted from set_default(tests.lm('Dee'), tests.id('lcycle'), true, 'no payments since February')), true, 'mark a defaulter');
select is((select defaulted || ' ' || reason from set_default(tests.lm('Dee'), tests.id('lcycle'), false, 'paid everything back')),
  'false paid everything back', 'and reverse it, with a reason');
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, '')$$, 'P0001', 'reason_required', 'a default needs a reason');
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, null)$$, 'P0001', 'reason_required', 'a null reason is no reason');
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), null, 'x')$$, 'P0001', 'reason_required', 'a default is marked or not, never unknown');
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, repeat('x', 501))$$, 'P0001', 'invalid_note', 'a reason is kept to 500 characters');
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('c_active'), true, 'x')$$, 'P0001', 'member_not_found',
  'the cycle must be the member''s group''s');
select throws_ok($$select set_default(tests.lm('Dee'), gen_random_uuid(), true, 'x')$$, 'P0001', 'member_not_found', 'an unknown cycle');
select throws_ok($$select set_default(gen_random_uuid(), tests.id('lcycle'), true, 'x')$$, 'P0001', 'member_not_found', 'an unknown member');
reset role;
select is((select count(*)::int from member_status where member_id = tests.lm('Dee')), 1, 'one status row per member and cycle');
select is((select defaulted from member_status where member_id = tests.lm('Dee')), false, 'the row holds the latest decision');
select is((select count(*)::int from audit_log where action = 'member.default_changed' and entity_id = tests.lm('Dee')), 2, 'both changes are audited');
select is((select data ->> 'reason' from audit_log where action = 'member.default_changed' and entity_id = tests.lm('Dee') and data ->> 'defaulted' = 'true'),
  'no payments since February', 'the audit row for the marking records its reason');
select is((select data ->> 'reason' from audit_log where action = 'member.default_changed' and entity_id = tests.lm('Dee') and data ->> 'defaulted' = 'false'),
  'paid everything back', 'and so does the reversal');
select is((select data ->> 'from' from audit_log where action = 'member.default_changed' and entity_id = tests.lm('Dee') and data ->> 'defaulted' = 'true'),
  'false', 'the audit row for the marking records the previous flag (not defaulted)');
select is((select data ->> 'from' from audit_log where action = 'member.default_changed' and entity_id = tests.lm('Dee') and data ->> 'defaulted' = 'false'),
  'true', 'and the reversal records that it was defaulted');
select tests.login_as(tests.id('member'));
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, 'x')$$, '42501', 'not_admin', 'members cannot mark defaults');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, 'x')$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select is((select count(*)::int from audit_log where action = 'member.default_changed' and entity_id = tests.lm('Dee')), 2, 'refusals are not audited');

-- post_correction ---------------------------------------------------------------------------------
-- Ann's saving is K1,000. After each correction the effective saving (the sum over the ledger lines) is the new amount.
select tests.login_as(tests.id('admin'));
select is((select kind || ' ' || amount || ' ' || source from post_correction(tests.id('e_ann_saving'), 1100, 'Ann sent K1,100')),
  'saving 100.00 correction', 'raising 1,000 to 1,100 posts +100 of the same kind');
reset role;
select is((select sum(amount) from private.ledger_lines where member_id = tests.lm('Ann') and kind = 'saving'), 1100.00, 'effective saving 1,100');
select tests.remember('e_ann_fix', (select id from entries where corrects_entry_id = tests.id('e_ann_saving')));
select tests.login_as(tests.id('admin'));
-- a second correction of the same original works from what is effective now (1,100), not from the original 1,000: −200, not −100
select is((select kind || ' ' || amount || ' ' || (corrects_entry_id = tests.id('e_ann_saving')) from post_correction(tests.id('e_ann_saving'), 900, 'it was K900')),
  'adjustment 200.00 true', 'lowering posts an adjustment against the original');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 900, 'again')$$, 'P0001', 'invalid_amount', 'no change, no correction');
select throws_ok($$select post_correction(tests.id('e_ann_fix'), 800, 'x')$$, 'P0001', 'entry_not_found', 'a correction is not itself corrected');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), -1, 'x')$$, 'P0001', 'invalid_amount', 'not below zero');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 1.234, 'x')$$, 'P0001', 'invalid_amount', 'to the ngwee');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), null, 'x')$$, 'P0001', 'invalid_amount', 'a correction needs an amount');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 'NaN'::numeric, 'x')$$, 'P0001', 'invalid_amount', 'NaN is not an amount');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 'Infinity'::numeric, 'x')$$, 'P0001', 'invalid_amount', 'nor is Infinity');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 10000000000, 'x')$$, 'P0001', 'invalid_amount', 'nor is an amount past the column');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 950, null)$$, 'P0001', 'reason_required', 'a correction needs a reason');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 950, '  ')$$, 'P0001', 'reason_required', 'a blank reason is no reason');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 950, repeat('x', 501))$$, 'P0001', 'invalid_note', 'a reason is kept to 500 characters');
select throws_ok($$select post_correction(gen_random_uuid(), 950, 'x')$$, 'P0001', 'entry_not_found', 'unknown entry');
reset role;
select is((select sum(amount) from private.ledger_lines where member_id = tests.lm('Ann') and kind = 'saving'), 900.00, 'effective saving 900');
select is((select count(*)::int from entries where corrects_entry_id = tests.id('e_ann_saving')), 2, 'no refusal left a correction behind');
select is((select amount from entries where id = tests.id('e_ann_saving')), 1000.00, 'the original entry is untouched');
select tests.login_as(tests.id('member'));
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 950, 'x')$$, '42501', 'not_admin', 'members cannot correct');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 950, 'x')$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select is((select count(*)::int from audit_log where action = 'entry.corrected' and entity_id = tests.id('e_ann_saving')), 2, 'corrections are audited');
select is((select (data ->> 'from') || '>' || (data ->> 'to') || ' ' || (data ->> 'reason') from audit_log
           where action = 'entry.corrected' and entity_id = tests.id('e_ann_saving') and data ->> 'to' = '900'),
  '1100.00>900 it was K900', 'the audit row records the effective amount before and after, and the reason');

-- a charge raised and lowered: Dee's penalty of 100 goes to 120 (a penalty entry of 20), then waivers bring it down
select tests.login_as(tests.id('admin'));
select is((select kind || ' ' || amount from post_correction(tests.id('e_dee_pen'), 120, 'the penalty was K120')), 'penalty 20.00', 'a charge raised posts the extra as the same kind');
reset role;
select tests.remember('e_dee_pen_fix', (select id from entries where corrects_entry_id = tests.id('e_dee_pen')));
select is((select sum(amount) from private.ledger_lines where member_id = tests.lm('Dee') and kind = 'penalty'), 120.00, 'effective penalty 120');

-- post_waiver ---------------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_waiver(tests.id('e_dee_pen'), 120.01, 'x')$$, 'P0001', 'invalid_amount', 'not more than the charge, raised amount included');
select throws_ok($$select post_waiver(tests.id('e_dee_pen_fix'), 5, 'x')$$, 'P0001', 'entry_not_found', 'a correction is not itself waived');
select is((select kind || ' ' || amount || ' ' || source from post_waiver(tests.id('e_dee_pen'), 30, 'first offence')), 'waiver 30.00 correction', 'part of a penalty is waived');
reset role;
select is((select sum(amount) from private.ledger_lines where member_id = tests.lm('Dee') and kind = 'penalty'), 90.00, 'effective penalty 90');
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_waiver(tests.id('e_dee_pen'), 90.01, 'x')$$, 'P0001', 'invalid_amount', 'not more than what is left of the charge');
-- Cid borrows 1,000 (cash 1,600; cap 0 saved → over the cap, so a reason). Interest 150, then waived in full.
select send_loan(tests.lm('Cid'), 1000, tests.id('w_airtel'), 'emergency, agreed by the trustees');
reset role;
select tests.remember('e_cid_interest', (select id from entries where member_id = tests.lm('Cid') and kind = 'loan_interest'));
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 150.01, 'x')$$, 'P0001', 'invalid_amount', 'not more than the interest');
select throws_ok($$select post_waiver(tests.id('e_ann_saving'), 10, 'x')$$, 'P0001', 'entry_not_found', 'only charges can be waived');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 150, '')$$, 'P0001', 'reason_required', 'a waiver needs a reason');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 150, repeat('x', 501))$$, 'P0001', 'invalid_note', 'a reason is kept to 500 characters');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 0, 'x')$$, 'P0001', 'invalid_amount', 'no waiver of nothing');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), -1, 'x')$$, 'P0001', 'invalid_amount', 'no negative waiver');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 1.005, 'x')$$, 'P0001', 'invalid_amount', 'to the ngwee');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), null, 'x')$$, 'P0001', 'invalid_amount', 'a waiver needs an amount');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 'NaN'::numeric, 'x')$$, 'P0001', 'invalid_amount', 'NaN is not an amount');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 'Infinity'::numeric, 'x')$$, 'P0001', 'invalid_amount', 'nor is Infinity');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 10000000000, 'x')$$, 'P0001', 'invalid_amount', 'nor is an amount past the column');
select throws_ok($$select post_waiver(gen_random_uuid(), 10, 'x')$$, 'P0001', 'entry_not_found', 'unknown entry');
select is((select kind || ' ' || amount from post_waiver(tests.id('e_cid_interest'), 150, 'zero-interest loan agreed by the group')),
  'waiver 150.00', 'the treasurer waives the interest');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 0.01, 'x')$$, 'P0001', 'invalid_amount', 'a charge waived in full cannot be waived again');
reset role;
select is((select sum(amount) from private.ledger_lines where loan_id = (select loan_id from entries where id = tests.id('e_cid_interest'))
           and kind = 'loan_interest'), 0.00, 'the loan''s effective interest is now zero');
select is((select loan_id from entries where kind = 'waiver' and corrects_entry_id = tests.id('e_cid_interest')),
  (select loan_id from entries where id = tests.id('e_cid_interest')), 'the waiver stays attached to the loan');
select tests.login_as(tests.id('member'));
select throws_ok($$select post_waiver(tests.id('e_dee_pen'), 10, 'x')$$, '42501', 'not_admin', 'members cannot waive');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select post_waiver(tests.id('e_dee_pen'), 10, 'x')$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select is((select count(*)::int from audit_log where action = 'entry.corrected' and entity_id = tests.id('e_cid_interest')), 1, 'waivers are audited');
select is((select (data ->> 'from') || '>' || (data ->> 'to') || ' waived ' || (data ->> 'waived') from audit_log
           where action = 'entry.corrected' and entity_id = tests.id('e_cid_interest')),
  '150.00>0.00 waived 150', 'the waiver audit row records the effective amount before and after');
select is((select (data ->> 'from') || '>' || (data ->> 'to') from audit_log
           where action = 'entry.corrected' and entity_id = tests.id('e_dee_pen') and data ->> 'waived' = '30'),
  '120.00>90.00', 'and for a part waiver of a raised charge');

-- a saving corrected down to nothing: the entry is voided by an adjustment, never deleted
select tests.login_as(tests.id('admin'));
select is((select kind || ' ' || amount from post_correction(tests.id('e_ben_saving'), 0, 'Ben''s transfer bounced')), 'adjustment 500.00',
  'a correction to zero cancels the whole amount');
reset role;
select is((select sum(amount) from private.ledger_lines where member_id = tests.lm('Ben') and kind = 'saving'), 0.00, 'effective saving 0');

-- only amounts the ledger alone decides can be corrected: loans and interest shares have their own writers ------------
insert into entries (group_id, period_id, member_id, kind, amount, source, created_by) values
  (tests.id('lg'), tests.lp(1), tests.lm('Eve'), 'interest_share', 10, 'close', tests.id('admin'));
select tests.remember('e_eve_share', (select id from entries where member_id = tests.lm('Eve') and kind = 'interest_share'));
select tests.remember('e_cid_sent', (select id from entries where member_id = tests.lm('Cid') and kind = 'loan_sent'));
select tests.keep('before_refused', jsonb_build_object('entries', (select count(*) from entries), 'audit', (select count(*) from audit_log)));
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('e_cid_sent'), 5000, 'x')$$, 'P0001', 'entry_not_found', 'a loan is not corrected here: it has a schedule and a cash check');
select throws_ok($$select post_correction(tests.id('e_cid_interest'), 0, 'x')$$, 'P0001', 'entry_not_found', 'loan interest is waived, not corrected');
select throws_ok($$select post_correction(tests.id('e_eve_share'), 500, 'x')$$, 'P0001', 'entry_not_found', 'an interest share is not corrected: it never came out of the pool');
reset role;
select is((select jsonb_build_object('entries', (select count(*) from entries), 'audit', (select count(*) from audit_log))), tests.kept('before_refused'),
  'the refusals wrote no entry and no audit row');

-- the allowed kinds, each with its effective total checked
insert into entries (group_id, period_id, member_id, kind, amount, wallet_id, source, created_by) values
  (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 'membership', 50, tests.id('w_airtel'), 'app', tests.id('admin')),
  (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 'txn_fee', 10, tests.id('w_airtel'), 'app', tests.id('admin')),
  (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 'payment', 100, tests.id('w_airtel'), 'app', tests.id('admin')),
  (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 'excess_charge', 80, null, 'close', tests.id('admin')),
  (tests.id('lg'), tests.lp(1), null, 'payout_fee', 10, tests.id('w_airtel'), 'app', tests.id('admin'));
select tests.remember('e_ann_mem', (select id from entries where member_id = tests.lm('Ann') and kind = 'membership'));
select tests.remember('e_ann_fee', (select id from entries where member_id = tests.lm('Ann') and kind = 'txn_fee'));
select tests.remember('e_ann_pay', (select id from entries where member_id = tests.lm('Ann') and kind = 'payment'));
select tests.remember('e_ann_exc', (select id from entries where member_id = tests.lm('Ann') and kind = 'excess_charge'));
select tests.remember('e_pot_fee', (select id from entries where member_id is null and kind = 'payout_fee' and group_id = tests.id('lg')));
select tests.login_as(tests.id('admin'));
select is((select kind || ' ' || amount from post_correction(tests.id('e_ann_mem'), 60, 'membership is K60 here')), 'membership 10.00', 'membership can be corrected');
select is((select kind || ' ' || amount from post_correction(tests.id('e_ann_fee'), 4, 'fee was K4')), 'adjustment 6.00', 'a transfer fee can be corrected');
select is((select kind || ' ' || amount from post_correction(tests.id('e_ann_pay'), 130, 'Ann paid K130')), 'payment 30.00', 'a payment can be corrected');
select is((select kind || ' ' || amount from post_correction(tests.id('e_ann_exc'), 100, 'excess re-billed')), 'excess_charge 20.00', 'an excess charge can be corrected');
select is((select kind || ' ' || amount from post_correction(tests.id('e_pot_fee'), 15, 'fee was K15')), 'payout_fee 5.00', 'a pot fee (no member) can be corrected');
reset role;
select is((select string_agg(kind || '=' || t, ' ' order by kind) from (select kind, sum(amount) t from private.ledger_lines
           where id in (select id from entries where member_id = tests.lm('Ann') or member_id is null) and group_id = tests.id('lg')
             and kind in ('membership', 'txn_fee', 'payment', 'excess_charge', 'payout_fee') group by kind) x),
  'excess_charge=100.00 membership=60.00 payment=130.00 payout_fee=15.00 txn_fee=4.00', 'every effective total is its new amount');

-- a correction to a closed month lands in the open month -----------------------------------------------
select tests.ledger_jump(2);
select tests.login_as(tests.id('admin'));
select lives_ok($$select post_correction(tests.id('e_ann_saving'), 950, 'Ann''s February saving was K950')$$, 'correct February from March');
reset role;
select is((select period_id from entries where corrects_entry_id = tests.id('e_ann_saving') and kind = 'saving' and amount = 50), tests.lp(2),
  'the correction is March''s entry, February is not touched');
select is((select period_id from entries where id = tests.id('e_ann_saving')), tests.lp(1), 'the original stays in February');
select is((select sum(amount) from private.ledger_lines where member_id = tests.lm('Ann') and kind = 'saving'), 950.00, 'effective saving 950');
select tests.login_as(tests.id('admin'));
select is((select kind || ' ' || amount from post_waiver(tests.id('e_dee_pen'), 90, 'waived in full by the group')), 'waiver 90.00', 'a waiver in March');
reset role;
select is((select period_id from entries where kind = 'waiver' and corrects_entry_id = tests.id('e_dee_pen') and amount = 90), tests.lp(2),
  'it too lands in the open month');
select is((select sum(amount) from private.ledger_lines where member_id = tests.lm('Dee') and kind = 'penalty'), 0.00, 'Dee''s effective penalty is nothing');

-- missed_minimum: February's statements ask for 400 from Ann and 300 from Ben; March payments are 400 and 100.
insert into statements (group_id, period_id, member_id, next_minimum, source) values
  (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 400, 'close'),
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 300, 'close');
select tests.ledger_pay('Ann', 2, 0, 400);
select tests.ledger_pay('Ben', 2, 0, 100);
-- Corrections of February that land in March are not March's saving: Eve saved 250 in March and her February saving of 100
-- was voided (−100 in March's lines), so she is not under the minimum. Fay's own March saving corrected down is.
select tests.ledger_pay('Eve', 1, 100, 0);
select tests.ledger_pay('Eve', 2, 250, 0);
select tests.ledger_pay('Fay', 2, 250, 0);
select tests.remember('e_eve_feb', (select id from entries where member_id = tests.lm('Eve') and kind = 'saving' and period_id = tests.lp(1)));
select tests.remember('e_fay_mar', (select id from entries where member_id = tests.lm('Fay') and kind = 'saving' and period_id = tests.lp(2)));
select tests.login_as(tests.id('admin'));
select post_correction(tests.id('e_eve_feb'), 0, 'Eve''s February transfer bounced');
select post_correction(tests.id('e_fay_mar'), 100, 'Fay sent K100');
reset role;
select is((select sum(amount) from private.ledger_lines where member_id = tests.lm('Eve') and period_id = tests.lp(2) and kind = 'saving'), 150.00,
  'March''s lines for Eve do net to 150 (250 less the February correction)');
select tests.login_as(tests.id('admin'));
select is((select count(*)::int from suggest_penalties(tests.lp(2)) where short_name = 'Eve' and ground = 'under_saving'), 0,
  'a correction of an earlier month does not make Eve under-saved');
select is((select detail from suggest_penalties(tests.lp(2)) where short_name = 'Fay' and ground = 'under_saving'),
  'Saved K100.00 of the K250.00 minimum', 'a correction of this month''s own entry does count');
select is((select count(*)::int from suggest_penalties(tests.lp(2)) where short_name = 'Ann' and ground = 'under_saving'), 1,
  'Ann saved nothing in March (her February top-up is not March''s saving)');
select is((select count(*)::int from suggest_penalties(tests.lp(2)) where ground = 'missed_minimum'), 1, 'one member paid under the minimum');
select is((select short_name || ' ' || amount || ' ' || detail from suggest_penalties(tests.lp(2)) where ground = 'missed_minimum'),
  'Ben 50.00 Paid K100.00 of the K300.00 minimum', 'Ben is suggested K50 and the shortfall is shown');
reset role;

update periods set status = 'closed' where id = tests.lp(2);
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 1000, 'x')$$, 'P0001', 'period_not_open', 'no open month, no correction');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 1, 'x')$$, 'P0001', 'period_not_open', 'no open month, no waiver');
reset role;

-- another cycle of the same group with an open month does not take the correction: it belongs to its own cycle's open month
select tests.remember('c2', private.create_cycle(tests.id('lg'), 'Second cycle', date '2028-02-15', date '2029-02-15', date '2029-02-06'));
select private.ensure_periods(tests.id('c2'));
update periods set status = 'open' where cycle_id = tests.id('c2') and month_index = 1;
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 1000, 'x')$$, 'P0001', 'period_not_open', 'another cycle''s open month is not this cycle''s');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 1, 'x')$$, 'P0001', 'period_not_open', 'nor for a waiver');
reset role;
select is((select count(*)::int from entries where period_id in (select id from periods where cycle_id = tests.id('c2'))), 0, 'nothing landed in the other cycle');

select * from finish();
rollback;
