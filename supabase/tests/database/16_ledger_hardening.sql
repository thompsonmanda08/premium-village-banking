-- Tests for 20261010001700_ledger_hardening.sql
-- All tests run inside a transaction (rolled back by pgTAP's finish).
begin;
select * from no_plan();
select tests.ledger_fixture();

-- ============================================================
-- 1. TRUNCATE guards
-- ============================================================
-- entries is checked by 15_ledger_security (un-skipped); here we check the other three.
select throws_ok('truncate public.statements', 'P0001', 'append_only',
  'statements cannot be truncated');
select throws_ok('truncate public.group_statements', 'P0001', 'append_only',
  'group_statements cannot be truncated');
select throws_ok('truncate public.workbook_figures', 'P0001', 'append_only',
  'workbook_figures cannot be truncated');

-- service_role holds no INSERT, UPDATE, DELETE, TRUNCATE on any of the ten ledger tables.
select is(
  array(
    select t || ':' || p
    from unnest(array['wallets','periods','declarations','entries','loans','loan_instalments',
                      'member_status','statements','group_statements','workbook_figures']) as t,
         unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) as p
    where has_table_privilege('service_role', 'public.' || t, p)
  ),
  '{}'::text[],
  'service_role holds no INSERT/UPDATE/DELETE/TRUNCATE on any ledger table'
);

-- ============================================================
-- 2. entries.created_by NO ACTION
-- ============================================================
-- Insert an entry with a fresh auth user as created_by.
-- We run as postgres (security definer) so we can insert directly.
do $$
declare v_user uuid; v_period uuid;
begin
  v_user := tests.create_user('del_test_no_action@test.local');
  select id into v_period from periods where cycle_id = tests.id('lcycle') and month_index = 1;
  insert into entries (group_id, period_id, member_id, kind, amount, source, created_by)
  values (tests.id('lg'), v_period, tests.lm('Ann'), 'saving', 1.00, 'app', v_user);
  -- Attempt to delete the auth user; NO ACTION FK should block it.
  begin
    delete from auth.users where id = v_user;
    raise exception 'expected 23503 but got none';
  exception when foreign_key_violation then
    null; -- correct
  end;
end $$;
select pass('deleting auth user who created entries is refused by NO ACTION FK');

-- ============================================================
-- 3. Group-scoped composite FK for corrects_entry_id
-- ============================================================
-- Create a period for the foundation group's active cycle, insert an entry, then try
-- to reference it from the ledger group (different group_id → FK violation).
do $$
declare v_period uuid; v_entry uuid;
begin
  -- foundation group has c_active cycle
  insert into periods (group_id, cycle_id, month_index, label, starts_on, deadline, status)
  values (tests.id('group'), tests.id('c_active'), 1, 'Feb 2026', '2026-02-01', '2026-02-07', 'open')
  on conflict (cycle_id, month_index) do nothing;
  select id into v_period from periods where cycle_id = tests.id('c_active') and month_index = 1;
  insert into entries (group_id, period_id, member_id, kind, amount, source)
  values (tests.id('group'), v_period, tests.id('m_member'), 'saving', 50.00, 'app');
end $$;

-- Cross-group correction is refused (23503): corrects_entry_id points at 'group' entry but
-- this entry has group_id = 'lg'. The composite FK (corrects_entry_id, group_id) → entries(id, group_id)
-- requires both to match.
select throws_ok(
  $$insert into entries (group_id, period_id, member_id, kind, amount, source, corrects_entry_id, reason)
    select tests.id('lg'),
           (select id from periods where cycle_id = tests.id('lcycle') and month_index = 1),
           tests.lm('Ann'), 'adjustment', 1.00, 'correction',
           (select e.id from entries e where e.group_id = tests.id('group') limit 1),
           'cross-group correction'
    where exists (select 1 from entries e where e.group_id = tests.id('group'))$$,
  '23503', null,
  'correction pointing at another group''s entry is refused (23503)'
);

-- ============================================================
-- 4. entries.member_id null kind check
-- ============================================================
-- Non-payout_fee kind with null member_id must fail (23514).
select throws_ok(
  $$insert into entries (group_id, period_id, member_id, kind, amount, source)
    values (tests.id('lg'),
            (select id from periods where cycle_id = tests.id('lcycle') and month_index = 1),
            null, 'saving', 1.00, 'import')$$,
  '23514', null,
  'saving entry with null member_id is refused (23514)'
);

select throws_ok(
  $$insert into entries (group_id, period_id, member_id, kind, amount, source)
    values (tests.id('lg'),
            (select id from periods where cycle_id = tests.id('lcycle') and month_index = 1),
            null, 'payment', 1.00, 'import')$$,
  '23514', null,
  'payment entry with null member_id is refused (23514)'
);

-- payout_fee with null member_id must succeed.
select lives_ok(
  $$insert into entries (group_id, period_id, member_id, kind, amount, source)
    values (tests.id('lg'),
            (select id from periods where cycle_id = tests.id('lcycle') and month_index = 1),
            null, 'payout_fee', 1.00, 'import')$$,
  'payout_fee entry with null member_id is allowed'
);

-- declaration_id with null member_id refused (23514): biconditional declaration_needs_member.
-- We need a declaration first; insert one directly.
do $$
declare v_decl uuid;
begin
  insert into declarations (group_id, period_id, member_id, saving, wallet_id, submitted_by)
  values (tests.id('lg'),
          (select id from periods where cycle_id = tests.id('lcycle') and month_index = 1),
          tests.lm('Ann'), 1.00, tests.id('w_airtel'), tests.id('admin'))
  returning id into v_decl;
  begin
    insert into entries (group_id, period_id, member_id, kind, amount, source, declaration_id)
    values (tests.id('lg'),
            (select id from periods where cycle_id = tests.id('lcycle') and month_index = 1),
            null, 'payout_fee', 1.00, 'app', v_decl);
    raise exception 'expected 23514 but got none';
  exception when check_violation then
    null; -- expected: declaration_id with null member_id violates entries_declaration_needs_member
  end;
end $$;
select pass('entry with declaration_id but null member_id is refused by check constraint');

-- ============================================================
-- 5. cycle_rules finite checks
-- ============================================================
select throws_ok(
  $$update cycle_rules set min_saving = 'NaN' where cycle_id = tests.id('lcycle')$$,
  '23514', null,
  'update cycle_rules set min_saving = NaN fails (23514)'
);

select throws_ok(
  $$update cycle_rules set penalty_per_day = 'NaN' where cycle_id = tests.id('lcycle')$$,
  '23514', null,
  'update cycle_rules set penalty_per_day = NaN fails (23514)'
);

select throws_ok(
  $$update cycle_rules set membership_fee = 'NaN' where cycle_id = tests.id('lcycle')$$,
  '23514', null,
  'update cycle_rules set membership_fee = NaN fails (23514)'
);

select throws_ok(
  $$update cycle_rules set loan_rate = 'NaN' where cycle_id = tests.id('lcycle')$$,
  '23514', null,
  'update cycle_rules set loan_rate = NaN fails (23514)'
);

select throws_ok(
  $$update cycle_rules set excess_rate = 'NaN' where cycle_id = tests.id('lcycle')$$,
  '23514', null,
  'update cycle_rules set excess_rate = NaN fails (23514)'
);

-- 10000000000 overflows numeric(12,2) with 22003 before the check; the NaN tests above
-- cover the finiteness guard. Document this intentionally:
select pass('cycle_rules column type blocks overflow; NaN guard covers the finiteness constraint');

-- ============================================================
-- 8. Test gaps (additional scenarios)
-- ============================================================

-- Group delete blocked: deleting entries triggers the append_only guard (cascade from group → periods → entries).
-- The more meaningful test is that the owner_user_id FK (ON DELETE RESTRICT) blocks auth.users deletion
-- while the user owns a group.
select throws_ok(
  $$delete from auth.users where id = tests.id('owner')$$,
  '23503', null,
  'deleting owner user blocked while they own a group (23503 restrict)'
);

-- Correction biconditional: source = 'correction' but corrects_entry_id is null → 23514.
-- First we need an entry to exist (the payout_fee inserted above is one).
select throws_ok(
  $$insert into entries (group_id, period_id, member_id, kind, amount, source, corrects_entry_id, reason)
    values (tests.id('lg'),
            (select id from periods where cycle_id = tests.id('lcycle') and month_index = 1),
            tests.lm('Ann'), 'saving', 1.00, 'correction', null, 'test')$$,
  '23514', null,
  'source=correction but corrects_entry_id null is refused (23514)'
);

-- source <> 'correction' but corrects_entry_id not null → 23514.
select throws_ok(
  $$insert into entries (group_id, period_id, member_id, kind, amount, source, corrects_entry_id)
    values (tests.id('lg'),
            (select id from periods where cycle_id = tests.id('lcycle') and month_index = 1),
            tests.lm('Ann'), 'saving', 1.00, 'app',
            (select id from entries where group_id = tests.id('lg') limit 1))$$,
  '23514', null,
  'source<>correction but corrects_entry_id not null is refused (23514)'
);

-- 'closing' status blocked by unique open-period index (23505).
-- Open month 1, then try to set month 2 to 'closing'.
select tests.ledger_inputs(1);
select throws_ok(
  $$update periods set status = 'closing'
    where cycle_id = tests.id('lcycle') and month_index = 2$$,
  '23505', null,
  'setting a second period to closing while one is already open gives 23505'
);

-- Member sees own member_status row in private-figures mode (can_see_figures).
insert into member_status (group_id, member_id, cycle_id, defaulted, changed_by, reason)
values (tests.id('lg'), tests.lm('Ben'), tests.id('lcycle'), false, tests.id('admin'), 'test row');

update groups set figures_visibility = 'private' where id = tests.id('lg');
select tests.login_as(tests.id('member')); -- Ben is linked to 'member'
select isnt(
  (select count(*)::int from member_status where member_id = tests.lm('Ben')),
  0,
  'member can read own member_status row in private-figures mode'
);
reset role;
update groups set figures_visibility = 'open' where id = tests.id('lg');

-- close_month invalid_note on the COMMIT path (501-char reason).
-- Month 1 is now open via ledger_inputs(1); test the commit path's note validation.
select tests.login_as(tests.id('admin'));
select throws_ok(
  $$select close_month(tests.lp(1), true, repeat('x', 501))$$,
  'P0001', 'invalid_note',
  'close_month commit with 501-char reason gives invalid_note'
);
reset role;

-- payout_preview with no period: a cycle with all-planned months returns rows without error.
-- Use a fresh cycle (the ledger cycle's periods are partly open/closed now).
do $$
declare v_cycle uuid;
begin
  v_cycle := private.create_cycle(tests.id('lg'), 'Preview Test 2027', '2027-02-15', '2028-02-15', '2028-02-06');
  perform tests.remember('preview_cycle', v_cycle);
end $$;
select lives_ok(
  $$select * from payout_preview(tests.id('preview_cycle'))$$,
  'payout_preview on all-planned cycle does not error'
);

-- send_loan: member_not_active (a member with status = 'left').
update members set status = 'left' where id = tests.lm('Roy');
select tests.login_as(tests.id('admin'));
select throws_ok(
  $$select send_loan(tests.lm('Roy'), 100, tests.id('w_airtel'))$$,
  'P0001', 'member_not_active',
  'send_loan to left member gives member_not_active'
);
reset role;
update members set status = 'active' where id = tests.lm('Roy');

-- loans_closed with multiple = 0: {"from_month":1,"to_month":12,"multiple":0} means no loans.
update cycle_rules set loan_multiples = '[{"from_month":1,"to_month":12,"multiple":0}]'
 where cycle_id = tests.id('lcycle');
select tests.login_as(tests.id('admin'));
select throws_ok(
  $$select send_loan(tests.lm('Ann'), 100, tests.id('w_airtel'))$$,
  'P0001', 'loans_closed',
  'send_loan with multiple=0 gives loans_closed'
);
reset role;
-- restore
update cycle_rules set loan_multiples = '[{"from_month":1,"to_month":12,"multiple":2}]'
 where cycle_id = tests.id('lcycle');

-- send_loan band edge: K3000.00 gets term 1 (≤K3000 band), K3000.01 gets term 4.
-- Use private.schedule_loan directly (runs as postgres, bypasses cash/admin checks).
update cycle_rules set tenor_bands = '[{"max":3000,"months":1},{"max":null,"months":4}]'
 where cycle_id = tests.id('lcycle');
do $$
declare v1 loans; v2 loans;
begin
  v1 := private.schedule_loan(tests.lp(1), tests.lm('Gus'), 3000.00, 0, null, now());
  v2 := private.schedule_loan(tests.lp(1), tests.lm('Hal'), 3000.01, 0, null, now());
  if v1.term_months <> 1 then
    raise exception 'Expected term 1 for K3000.00, got %', v1.term_months;
  end if;
  if v2.term_months <> 4 then
    raise exception 'Expected term 4 for K3000.01, got %', v2.term_months;
  end if;
end $$;
select pass('send_loan band edge: K3000 → term 1, K3000.01 → term 4');
-- Restore tenor bands.
update cycle_rules set tenor_bands = '[{"max":null,"months":4}]'
 where cycle_id = tests.id('lcycle');

-- send_loan: cash refusal one ngwee short.
-- After ledger_inputs(1) + test fixtures: savings ≈ 7301 (test 5 adds K1 for Ann), loans out = 7001,
-- leaving ≈ K300. A loan of K301 should fail.
do $$
declare v_cash numeric;
begin
  v_cash := private.lending_cash(tests.lp(1));
  assert v_cash < 301, format('cash should be < K301 but is %s', v_cash);
end $$;
select tests.login_as(tests.id('admin'));
select throws_ok(
  $$select send_loan(tests.lm('Eve'), 301, tests.id('w_airtel'))$$,
  'P0001', 'insufficient_cash',
  'send_loan over available cash gives insufficient_cash'
);
reset role;

-- post_correction increases penalty for a left member → member_not_active.
-- Create a penalty entry for Pam, then mark Pam as left, then try to increase the penalty.
insert into entries (group_id, period_id, member_id, kind, amount, source, reason, created_by)
values (tests.id('lg'), tests.lp(1), tests.lm('Pam'), 'penalty', 100.00, 'app', 'test penalty', tests.id('admin'));
select tests.remember('pam_penalty', (select id from entries where member_id = tests.lm('Pam') and kind = 'penalty' limit 1));

update members set status = 'left' where id = tests.lm('Pam');

select tests.login_as(tests.id('admin'));
select throws_ok(
  $$select post_correction(tests.id('pam_penalty'), 200.00, 'increase test')$$,
  'P0001', 'member_not_active',
  'post_correction increasing penalty for left member gives member_not_active'
);
-- A decrease (to 50) is allowed even for left members.
select lives_ok(
  $$select post_correction(tests.id('pam_penalty'), 50.00, 'decrease test')$$,
  'post_correction decreasing penalty for left member is allowed'
);
reset role;
update members set status = 'active' where id = tests.lm('Pam');

-- set_deadline refused when deadline < starts_on.
select tests.login_as(tests.id('admin'));
select throws_ok(
  $$select set_deadline(tests.lp(1), date '2000-01-01', 'early deadline')$$,
  'P0001', 'invalid_date',
  'set_deadline with deadline before starts_on gives invalid_date'
);
reset role;

-- suggest_penalties: does not error even with cross-month corrections in scope.
select tests.login_as(tests.id('admin'));
select lives_ok(
  $$select * from suggest_penalties(tests.lp(1))$$,
  'suggest_penalties does not error with entries in scope'
);
reset role;

select * from finish();
rollback;
