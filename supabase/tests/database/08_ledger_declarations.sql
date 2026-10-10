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
select tests.remember('d_dee', (select id from declarations where member_id = tests.lm('Dee')));

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
select tests.login_as(tests.id('admin'));
select throws_ok($$select return_declaration(tests.id('d_dee'), '')$$, 'P0001', 'reason_required', 'returning needs a reason');
select is((select status || ': ' || return_reason from return_declaration(tests.id('d_dee'), 'Total does not match the POP')),
  'returned: Total does not match the POP', 'the treasurer returns a declaration with a reason');
select throws_ok($$select approve_declaration(tests.id('d_dee'))$$, 'P0001', 'declaration_not_found', 'a returned declaration cannot be approved');
select is((select supersedes_id from submit_declaration(tests.lp(1), tests.lm('Dee'), 250, 0, 0, 50, 0, 0, 0, tests.id('w_mtn'))),
  tests.id('d_dee'), 'the corrected resubmission replaces the returned one');
reset role;
select is((select count(*)::int from audit_log where action = 'declaration.returned' and entity_id = tests.id('d_dee')), 1, 'returns are audited');

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
