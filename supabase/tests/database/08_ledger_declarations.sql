begin;
select * from no_plan();
select tests.ledger_fixture();
select tests.login_as(tests.id('admin'));
select open_period(tests.id('lcycle'), 1);
reset role;

-- submit -----------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));   -- Ben
select is((select status from submit_declaration(tests.lp(1), tests.lm('Ben'), 500, 0, 0, 50, 0, 5, 0, tests.id('w_airtel'), 'first try')),
  'submitted', 'a member declares for themselves');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Cid'), 500, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'member_not_found', 'a member cannot declare for someone else');
select throws_ok($$select submit_declaration(tests.lp(2), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'period_not_open', 'only the open month takes declarations');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), -1, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'invalid_amount', 'no negative amounts');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 1.001, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'invalid_amount', 'amounts are kept to the ngwee');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 0, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'invalid_amount', 'an empty declaration is refused');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 'NaN'::numeric, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'invalid_amount', 'NaN is not an amount');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 100, p_borrowing_request => 'NaN'::numeric, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'invalid_amount', 'nor is NaN a loan request');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 10000000000, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'invalid_amount', 'an amount past the column is refused with a code, not an overflow error');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 'Infinity'::numeric, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'invalid_amount', 'Infinity is not an amount');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 100, p_wallet => tests.id('w_airtel'), p_note => repeat('x', 501))$$,
  'P0001', 'invalid_note', 'a note is kept to 500 characters');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500)$$,
  'P0001', 'wallet_not_found', 'money sent needs the wallet it went to');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_old'))$$,
  'P0001', 'wallet_not_found', 'not a retired wallet');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_g2'))$$,
  'P0001', 'wallet_not_found', 'not another group''s wallet');
-- resubmitting replaces the waiting declaration, never edits it
select is((select supersedes_id is not null from submit_declaration(tests.lp(1), tests.lm('Ben'), 550, 0, 0, 50, 0, 5, 0, tests.id('w_airtel'))),
  true, 'a resubmission supersedes the first');
reset role;
select is((select count(*)::int from declarations where member_id = tests.lm('Ben')), 2, 'both rows are kept');
select is((select saving from declarations d where member_id = tests.lm('Ben')
           and not exists (select 1 from declarations n where n.supersedes_id = d.id)), 550.00, 'the live one is the resubmission');
select tests.remember('d_ben_old', (select id from declarations where member_id = tests.lm('Ben') and saving = 500));
select tests.remember('d_ben', (select id from declarations where member_id = tests.lm('Ben') and saving = 550));
select is((select count(*)::int from audit_log where action = 'declaration.submitted' and entity_id = tests.id('d_ben')
           and actor_user_id = tests.id('member') and data ->> 'member_id' = tests.lm('Ben')::text
           and data ->> 'period_id' = tests.lp(1)::text), 1, 'a submission is audited with the member who made it');

select tests.login_as(tests.id('outsider'));
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'member_not_found', 'outsiders learn nothing');
reset role;
select tests.login_anon();
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$,
  '42501', 'permission denied for function submit_declaration', 'anon cannot declare');
select ok(not has_function_privilege('anon', 'public.submit_declaration(uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, uuid, text)', 'EXECUTE'),
  'anon has no execute on submit_declaration');
select ok(not has_function_privilege('anon', 'public.return_declaration(uuid, text)', 'EXECUTE'), 'anon has no execute on return_declaration');
select ok(not has_function_privilege('anon', 'public.approve_declaration(uuid)', 'EXECUTE'), 'anon has no execute on approve_declaration');
reset role;

-- the treasurer enters a WhatsApp declaration; a loan request alone needs no wallet
select tests.login_as(tests.id('admin'));
select lives_ok($$select submit_declaration(tests.lp(1), tests.lm('Dee'), 250, 0, 0, 50, 0, 0, 0, tests.id('w_mtn'), 'from WhatsApp')$$,
  'the treasurer enters a member''s declaration');
select lives_ok($$select submit_declaration(tests.lp(1), tests.lm('Eve'), p_borrowing_request => 1500)$$, 'a loan request alone');
reset role;
select is((select submitted_by from declarations where member_id = tests.lm('Dee')), tests.id('admin'), 'it records who typed it');
select is((select count(*)::int from audit_log where action = 'declaration.submitted' and actor_user_id = tests.id('admin')
           and entity_id = (select id from declarations where member_id = tests.lm('Dee'))), 1, 'and audits the treasurer as the actor');
select tests.remember('d_dee', (select id from declarations where member_id = tests.lm('Dee')));

-- a second submission for the same member and month supersedes the first: one live declaration (true concurrency is not testable in pgTAP)
select tests.login_as(tests.id('admin'));
select is((select supersedes_id is not null from submit_declaration(tests.lp(1), tests.lm('Eve'), p_borrowing_request => 1600)), true,
  'a repeated submission supersedes the first');
reset role;
select is((select count(*)::int from declarations d where member_id = tests.lm('Eve') and not exists (select 1 from declarations n where n.supersedes_id = d.id)),
  1, 'only one declaration is live');

-- the group owner (no member row) and another group's admin
insert into cycles (group_id, label, starts_on, ends_on, payout_on, status)
  values (tests.id('group'), 'Foreign cycle', '2026-02-15', '2027-02-15', '2027-02-06', 'active');
insert into periods (group_id, cycle_id, month_index, label, starts_on, deadline, status)
  select tests.id('group'), id, 1, 'Foreign', date '2026-02-01', date '2026-02-07', 'open' from cycles where label = 'Foreign cycle';
select tests.remember('foreign_period', (select id from periods where label = 'Foreign'));
select tests.login_as(tests.id('admin'));
select throws_ok($$select submit_declaration(tests.id('foreign_period'), tests.lm('Ben'), 100, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'period_not_open', 'another group''s month is no month of this group');
reset role;
select tests.login_as(tests.id('owner'));
select lives_ok($$select submit_declaration(tests.lp(1), tests.lm('Jon'), 100, p_wallet => tests.id('w_airtel'))$$, 'the owner declares for a member');
select lives_ok($$select submit_declaration(tests.lp(1), tests.lm('Kim'), 100, p_wallet => tests.id('w_airtel'))$$, 'and for another');
reset role;
select tests.remember('d_jon', (select id from declarations where member_id = tests.lm('Jon')));
select tests.remember('d_kim', (select id from declarations where member_id = tests.lm('Kim')));
select tests.login_as(tests.id('owner2'));
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 100, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'member_not_found', 'another group''s admin cannot declare for this group');
reset role;
select tests.login_as(tests.id('owner'));
select is((select status from approve_declaration(tests.id('d_jon'))), 'approved', 'the owner approves');
select is((select status from return_declaration(tests.id('d_kim'), 'wrong wallet')), 'returned', 'and returns');
reset role;

-- approve ----------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select approve_declaration(tests.id('d_ben'))$$, '42501', 'not_admin', 'members cannot approve');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select approve_declaration(tests.id('d_ben'))$$, '42501', 'not_admin', 'another group''s admin cannot approve');
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok($$select approve_declaration(tests.id('d_ben_old'))$$, 'P0001', 'declaration_not_found', 'a superseded declaration cannot be approved');
select throws_ok($$select approve_declaration(gen_random_uuid())$$, 'P0001', 'declaration_not_found', 'nor an unknown one');
select is((select status from approve_declaration(tests.id('d_ben'))), 'approved', 'the treasurer approves the live one');
select throws_ok($$select approve_declaration(tests.id('d_ben'))$$, 'P0001', 'declaration_not_found', 'approval happens once');
reset role;
select is((select array_agg(kind || ' ' || amount order by kind) from entries where declaration_id = tests.id('d_ben')),
  array['membership 50.00', 'saving 550.00', 'txn_fee 5.00'], 'approval writes what was sent, kind by kind (no payment: none declared)');
select ok((select bool_and(wallet_id = tests.id('w_airtel') and source = 'app' and created_by = tests.id('admin'))
           from entries where declaration_id = tests.id('d_ben')), 'each entry records the wallet, the source and the approver');
select is((select decided_by from declarations where id = tests.id('d_ben')), tests.id('admin'), 'the decision is recorded');
select is((select count(*)::int from audit_log where action = 'declaration.approved' and entity_id = tests.id('d_ben')), 1, 'and audited');

-- repayment, excess and penalty become one payment; the payment order decides where it goes at close
insert into declarations (group_id, period_id, member_id, saving, loan_repayment, excess, penalty, wallet_id, submitted_by)
  values (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 300, 1000, 12.34, 50, tests.id('w_mtn'), tests.id('other'));
select tests.login_as(tests.id('admin'));
select lives_ok($$select approve_declaration((select id from declarations where member_id = tests.lm('Cid')))$$, 'approve Cid');
reset role;
select is((select amount from entries where member_id = tests.lm('Cid') and kind = 'payment'), 1062.34,
  'one payment of 1,000 + 12.34 + 50 = 1,062.34');

-- a second payment in the same month (daily SIM limit) stands beside the approved one
select tests.login_as(tests.id('member'));
select is((select supersedes_id from submit_declaration(tests.lp(1), tests.lm('Ben'), 0, 300, p_wallet => tests.id('w_mtn'))), null,
  'after approval a new declaration does not replace the approved one');
reset role;

-- return ------------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select return_declaration(tests.id('d_dee'), 'no')$$, '42501', 'not_admin', 'members cannot return');
reset role;
select tests.login_as(tests.id('outsider'));
select throws_ok($$select return_declaration(tests.id('d_dee'), 'no')$$, '42501', 'not_admin', 'outsiders cannot return');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select return_declaration(tests.id('d_dee'), 'no')$$, '42501', 'not_admin', 'another group''s admin cannot return');
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok($$select return_declaration(gen_random_uuid(), 'no')$$, 'P0001', 'declaration_not_found', 'an unknown declaration cannot be returned');
select throws_ok($$select return_declaration(tests.id('d_ben'), 'no')$$, 'P0001', 'declaration_not_found', 'an approved declaration cannot be returned');
select throws_ok($$select return_declaration(tests.id('d_ben_old'), 'no')$$, 'P0001', 'declaration_not_found', 'nor a superseded one');
select throws_ok($$select return_declaration(tests.id('d_dee'), '')$$, 'P0001', 'reason_required', 'returning needs a reason');
select throws_ok($$select return_declaration(tests.id('d_dee'), repeat('x', 501))$$, 'P0001', 'invalid_note', 'a reason is kept to 500 characters');
select is((select status || ': ' || return_reason from return_declaration(tests.id('d_dee'), 'Total does not match the POP')),
  'returned: Total does not match the POP', 'the treasurer returns a declaration with a reason');
select throws_ok($$select approve_declaration(tests.id('d_dee'))$$, 'P0001', 'declaration_not_found', 'a returned declaration cannot be approved');
select is((select supersedes_id from submit_declaration(tests.lp(1), tests.lm('Dee'), 250, 0, 0, 50, 0, 0, 0, tests.id('w_mtn'))),
  tests.id('d_dee'), 'the corrected resubmission replaces the returned one');
reset role;
select is((select count(*)::int from audit_log where action = 'declaration.returned' and entity_id = tests.id('d_dee')), 1, 'returns are audited');

-- approval needs a usable wallet, and a member who is still in the group
insert into declarations (group_id, period_id, member_id, saving, wallet_id, submitted_by)
  values (tests.id('lg'), tests.lp(1), tests.lm('Hal'), 100, tests.id('w_old'), tests.id('admin')),
         (tests.id('lg'), tests.lp(1), tests.lm('Ivy'), 100, null, tests.id('admin')),
         (tests.id('lg'), tests.lp(1), tests.lm('Gus'), 100, tests.id('w_airtel'), tests.id('admin'));
select tests.login_as(tests.id('admin'));
select throws_ok($$select approve_declaration((select id from declarations where member_id = tests.lm('Hal')))$$,
  'P0001', 'wallet_not_found', 'a retired wallet takes no approval');
select throws_ok($$select approve_declaration((select id from declarations where member_id = tests.lm('Ivy')))$$,
  'P0001', 'wallet_not_found', 'nor does a missing one');
reset role;
update members set status = 'left' where id in (tests.lm('Gus'), tests.lm('Cid'));
select tests.login_as(tests.id('admin'));
select throws_ok($$select approve_declaration((select id from declarations where member_id = tests.lm('Gus')))$$,
  'P0001', 'member_not_active', 'a member who has left cannot have a declaration approved');
reset role;
select tests.login_as(tests.id('other'));   -- Cid, who has left
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Cid'), 100, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'member_not_found', 'a member who has left cannot declare');
reset role;

-- no writer can store NaN or an overflow, whoever they are
select throws_ok($$insert into entries (group_id, period_id, member_id, kind, amount, wallet_id, source, created_by)
    values (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'saving', 'NaN', tests.id('w_airtel'), 'app', tests.id('admin'))$$,
  '23514', 'new row for relation "entries" violates check constraint "entries_amount_finite"', 'an entry cannot hold NaN');
select throws_ok($$insert into declarations (group_id, period_id, member_id, saving, wallet_id, submitted_by)
    values (tests.id('lg'), tests.lp(1), tests.lm('Roy'), 'NaN', tests.id('w_airtel'), tests.id('admin'))$$,
  '23514', 'new row for relation "declarations" violates check constraint "declarations_saving_finite"', 'nor a declaration');
select is((select count(*)::int from pg_constraint where contype = 'c' and conname in (
    'declarations_saving_finite', 'declarations_loan_repayment_finite', 'declarations_excess_finite', 'declarations_membership_finite',
    'declarations_penalty_finite', 'declarations_txn_fee_finite', 'declarations_borrowing_request_finite', 'entries_amount_finite',
    'loans_principal_finite', 'loans_interest_finite', 'loan_instalments_amount_due_finite')), 11, 'every money column is guarded');

-- a closed month takes no approvals
select tests.login_as(tests.id('admin'));
select lives_ok($$select submit_declaration(tests.lp(1), tests.lm('Fay'), 250, p_wallet => tests.id('w_airtel'))$$, 'Fay declares');
reset role;
update periods set status = 'closed' where id = tests.lp(1);
select tests.login_as(tests.id('admin'));
select throws_ok($$select approve_declaration((select id from declarations where member_id = tests.lm('Fay')))$$,
  'P0001', 'period_not_open', 'approvals only into an open month');
reset role;

select * from finish();
rollback;
