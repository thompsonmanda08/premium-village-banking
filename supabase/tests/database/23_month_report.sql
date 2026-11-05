begin;
select * from no_plan();
select tests.ledger_fixture();

-- February: Ben's 3,001 loan goes over the cap with a reason. Closed by the app.
select tests.ledger_inputs(1);
select tests.login_as(tests.id('admin'));
select close_month(tests.lp(1), true);
reset role;

-- March: Fay's interest waived, Dee penalised and flagged as defaulted (ledger_inputs), then the treasurer's further overrides.
select tests.ledger_inputs(2);
select tests.login_as(tests.id('admin'));
select post_waiver((select id from entries where member_id = tests.lm('Dee') and kind = 'penalty' and source = 'app'), 40, 'first offence');
select post_correction((select id from entries where member_id = tests.lm('Ann') and period_id = tests.lp(2) and kind = 'saving'), 900,
  'typed 1000, paid 900');
select set_default(tests.lm('Dee'), tests.id('lcycle'), false, 'paid up');
select set_deadline(tests.lp(2), date '2026-03-12', 'network outage');   -- 7 Mar to 12 Mar: an extension
select set_deadline(tests.lp(3), date '2026-04-05', 'meeting moved');    -- 7 Apr to 5 Apr: shortened, not an extension
reset role;
-- Audit rows are stamped now(); place them inside the fixture months (as the table owner).
update audit_log set created_at = case when data ->> 'defaulted' = 'true' then timestamptz '2026-03-10 12:00+02'
                                       else timestamptz '2026-03-20 12:00+02' end
 where group_id = tests.id('lg') and action in ('member.default_changed', 'period.deadline_changed');
-- A default flag set in February belongs to February's log, not March's.
insert into audit_log (group_id, action, entity, entity_id, data, created_at)
values (tests.id('lg'), 'member.default_changed', 'members', tests.lm('Gus'),
        jsonb_build_object('cycle_id', tests.id('lcycle'), 'from', false, 'defaulted', true, 'reason', 'missed the meeting'),
        timestamptz '2026-02-20 12:00+02');
-- Month boundaries in Lusaka time (UTC+2): 23:30 on 28 Feb is February; 00:30 on 1 Mar (22:30 UTC on 28 Feb) is March.
insert into audit_log (group_id, action, entity, entity_id, data, created_at) values
  (tests.id('lg'), 'member.default_changed', 'members', tests.lm('Hal'),
   jsonb_build_object('cycle_id', tests.id('lcycle'), 'from', false, 'defaulted', true, 'reason', 'late on the last day'),
   timestamptz '2026-02-28 23:30+02'),
  (tests.id('lg'), 'member.default_changed', 'members', tests.lm('Hal'),
   jsonb_build_object('cycle_id', tests.id('lcycle'), 'from', true, 'defaulted', false, 'reason', 'early on the first day'),
   timestamptz '2026-03-01 00:30+02');

-- refusals --------------------------------------------------------------------------------------------
select tests.login_anon();
select throws_ok($$select month_report(tests.lp(1))$$, '42501', 'permission denied for function month_report', 'anon cannot call month_report');
select throws_ok($$select month_overrides(tests.lp(1))$$, '42501', 'permission denied for function month_overrides', 'nor month_overrides');
reset role;
select ok(not has_function_privilege('anon', 'public.month_report(uuid)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.month_overrides(uuid)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.month_report(uuid)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.month_overrides(uuid)', 'EXECUTE'),
  'app roles: anon cannot execute, signed-in users can (the functions check membership)');
select tests.login_as(tests.id('outsider'));
select throws_ok($$select month_report(tests.lp(1))$$, '42501', 'not_admin', 'an outsider cannot read the report');
select throws_ok($$select month_overrides(tests.lp(1))$$, '42501', 'not_admin', 'nor the overrides');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select month_report(tests.lp(1))$$, '42501', 'not_admin', 'another group''s admin cannot read the report');
select throws_ok($$select month_overrides(tests.lp(1))$$, '42501', 'not_admin', 'nor the overrides');
reset role;
select tests.login_as(tests.id('member'));
select throws_ok($$select month_report(gen_random_uuid())$$, '42501', 'not_admin', 'an unknown month is not yours to read');
select throws_ok($$select month_report(tests.lp(2))$$, 'P0001', 'period_not_closed', 'an open month has no report yet');
select throws_ok($$select month_overrides(tests.lp(2))$$, 'P0001', 'period_not_closed', 'nor an overrides log');
select throws_ok($$select month_report(tests.lp(5))$$, 'P0001', 'period_not_closed', 'nor a planned month');
reset role;

select tests.login_as(tests.id('admin'));
select close_month(tests.lp(2), true);
reset role;
update periods set closed_at = timestamptz '2026-04-02 10:00+02' where id = tests.lp(2);

-- the overrides log, figures open ----------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select tests.keep('mar', month_overrides(tests.lp(2)));
select tests.keep('feb', month_overrides(tests.lp(1)));
reset role;

create temp view o as
  select k.name as log, x.* from tests.kept_json k
  cross join lateral jsonb_to_recordset(case when jsonb_typeof(k.v) = 'array' then k.v else '[]' end)
    as x(at timestamptz, kind text, member_id uuid, member text, amount numeric, reason text);

select is((select array_agg(kind || ':' || coalesce(member, '-') || ':' || coalesce(amount::text, 'null') order by kind, member)
           from o where log = 'mar'),
  array['correction:Ann:-100.00', 'deadline_extended:-:null', 'default_cleared:Dee:null', 'default_cleared:Hal:null',
        'default_set:Dee:null', 'penalty_applied:Dee:100.00', 'penalty_waived:Dee:40.00', 'waiver:Fay:112.50'],
  'March lists each override once: the correction (signed), the waivers, the penalty, the default changes and the extension');
select is((select reason from o where log = 'mar' and kind = 'penalty_waived'), 'first offence', 'with the treasurer''s reason');
select is((select reason from o where log = 'mar' and kind = 'deadline_extended'), 'network outage', 'the extension''s reason');
select is((select reason from o where log = 'mar' and kind = 'default_cleared' and member = 'Dee'), 'paid up', 'the default change''s reason');
select is((select reason from o where log = 'mar' and member = 'Hal'), 'early on the first day', '00:30 on 1 March (Lusaka) is March');
select is((select reason from o where log = 'feb' and member = 'Hal'), 'late on the last day', '23:30 on 28 February (Lusaka) is February');
select is((select member_id from o where log = 'mar' and kind = 'penalty_applied'), tests.lm('Dee'), 'and the member''s id');
select is((select array_agg(at order by ord) from (select (x ->> 'at')::timestamptz as at, ord from tests.kept_json k,
             jsonb_array_elements(k.v) with ordinality as e(x, ord) where k.name = 'mar') s),
          (select array_agg(at order by at) from o where log = 'mar'), 'ordered by when it happened');
select is((select array_agg(kind || ':' || member || ':' || coalesce(amount::text, 'null') || ':' || reason order by kind, member) from o where log = 'feb'),
  array['default_set:Gus:null:missed the meeting', 'default_set:Hal:null:late on the last day',
        'loan_over_cap:Ben:3001.00:agreed at the meeting'],
  'February: the loan over the cap (principal and reason) and the default flag dated in February');

-- private figures ------------------------------------------------------------------------------------
update groups set figures_visibility = 'private' where id = tests.id('lg');
select tests.login_as(tests.id('member'));   -- Ben
select tests.keep('mar_ben', month_overrides(tests.lp(2)));
select tests.keep('feb_ben', month_overrides(tests.lp(1)));
select tests.keep('rep_ben', month_report(tests.lp(2)));
reset role;
select tests.login_as(tests.id('other'));    -- Cid
select tests.keep('feb_cid', month_overrides(tests.lp(1)));
reset role;
select tests.login_as(tests.id('admin'));    -- Ann
select tests.keep('mar_ann', month_overrides(tests.lp(2)));
select tests.keep('rep_ann', month_report(tests.lp(2)));
reset role;

select is((select array_agg(kind order by kind) from o where log = 'mar_ben'),
  array['correction', 'deadline_extended', 'default_cleared', 'default_cleared', 'default_set', 'penalty_applied', 'penalty_waived', 'waiver'],
  'private: a member still sees when and what for every override');
select is((select count(*)::int from o where log = 'mar_ben' and kind <> 'deadline_extended'
            and (member is not null or member_id is not null or amount is not null or reason is not null)), 0,
  'but another member''s row has no name, id, amount or reason');
select ok((select bool_and(at is not null) from o where log = 'mar_ben'), 'the time stays on every row');
select is((select reason from o where log = 'mar_ben' and kind = 'deadline_extended'), 'network outage',
  'a row about no member keeps its reason');
select is((select member || ':' || member_id || ':' || amount || ':' || reason from o where log = 'feb_ben' and kind = 'loan_over_cap'),
  'Ben:' || tests.lm('Ben') || ':3001.00:agreed at the meeting', 'a member''s own row keeps everything');
select is((select count(*)::int from o where log = 'feb_cid'
            and (member is not null or member_id is not null or amount is not null or reason is not null)), 0,
  'another member sees none of it in Ben''s row');
select is((select count(*)::int from o where log = 'mar_ann' and member is not null), 7, 'an admin sees every name');
select is((select amount || ':' || reason from o where log = 'mar_ann' and kind = 'penalty_applied'),
  '100.00:late_declaration: declared 2 days late', 'and every amount and reason');
select is(tests.kept('rep_ben') -> 'overrides', tests.kept('mar_ben'), 'the report carries the same hidden rows');
select is(tests.kept('rep_ben') -> 'arrears' -> 'members', 'null'::jsonb, 'private: no arrears list for a member');
select is((tests.kept('rep_ben') -> 'arrears' ->> 'count')::int,
  (select count(*)::int from statements where period_id = tests.lp(2) and unpaid_minimum > 0), 'but the count is there');
select is((select array_agg(x ->> 'name' order by x ->> 'name') from jsonb_array_elements(tests.kept('rep_ann') -> 'arrears' -> 'members') x),
  (select array_agg(m.short_name order by m.short_name) from statements s join members m on m.id = s.member_id
    where s.period_id = tests.lp(2) and s.unpaid_minimum > 0), 'an admin sees the list');

-- the report, figures open ----------------------------------------------------------------------------
update groups set figures_visibility = 'open' where id = tests.id('lg');
-- Rule votes for the ledger cycle (March closed 2 Apr 2026), created_at set so "latest" is unambiguous.
insert into rule_ratifications (group_id, cycle_id, rule_key, decided_on, votes_for, votes_total, passed, created_at) values
  (tests.id('lg'), tests.id('lcycle'), 'saving_minimum',   '2026-03-20', 15, 18, true,  '2026-03-20 12:00+02'),
  (tests.id('lg'), tests.id('lcycle'), 'saving_minimum',   '2026-03-21', 16, 18, true,  '2026-03-21 12:00+02'),  -- same rule twice: one
  (tests.id('lg'), tests.id('lcycle'), 'penalty_basis', '2026-03-01', 5, 18, false,  '2026-03-01 12:00+02'),
  (tests.id('lg'), tests.id('lcycle'), 'penalty_basis', '2026-03-15', 14, 18, true,  '2026-03-15 12:00+02'),  -- failed, then passed
  (tests.id('lg'), tests.id('lcycle'), 'excess_charge',  '2026-03-01', 14, 18, true,  '2026-03-01 12:00+02'),
  (tests.id('lg'), tests.id('lcycle'), 'excess_charge',  '2026-03-25', 5, 18, false,  '2026-03-25 12:00+02'),  -- passed, then failed
  (tests.id('lg'), tests.id('lcycle'), 'loan_cap',     '2026-04-10', 14, 18, true,  '2026-04-10 12:00+02'),  -- after the close
  (tests.id('lg'), tests.id('lcycle'), 'loan_terms',    '2026-03-10', 14, 18, true,  '2026-03-10 12:00+02'),
  (tests.id('lg'), tests.id('lcycle'), 'loan_terms',    '2026-04-15', 5, 18, false,  '2026-04-15 12:00+02'),  -- failed after the close
  (tests.id('lg'), tests.id('lcycle'), 'deadlines_and_extensions',    '2026-04-02', 14, 18, true,  '2026-04-02 18:00+02'),  -- recorded after the close, same day
  (tests.id('lg'), tests.id('lcycle'), 'no_loans_last_month', '2026-03-30', 14, 18, true, '2026-05-01 12:00+02'),  -- backdated: dated before the close, recorded long after
  (tests.id('lg'), tests.id('lcycle'), 'foo_bar', '2026-03-01', 14, 18, true, '2026-03-01 12:00+02'),  -- not one of the app's rules
  (tests.id('group'), tests.id('c_active'), 'interest_rate', '2026-03-01', 3, 3, true, '2026-03-01 12:00+02'); -- another group
select tests.login_as(tests.id('other'));
select tests.keep('rep', month_report(tests.lp(2)));
select tests.keep('rep_feb', month_report(tests.lp(1)));
reset role;

select is(tests.kept('rep') -> 'period',
  jsonb_build_object('id', tests.lp(2), 'label', 'Mar 2026', 'month_index', 2, 'closed_at', timestamptz '2026-04-02 10:00+02'), 'the month');
select is(tests.kept('rep') -> 'group', (select to_jsonb(g) from group_statements g where g.period_id = tests.lp(2)), 'the group statement');
-- February (figures from 11_ledger_close.sql): Cid 3,000, Ben 1,000 and 3,001 sent, 7,001 in all; Fay's March loan is not
-- February's. Nothing paid yet, so the 18 savers each owe their excess share at least; Zed owes nothing. Owed 8,081.05.
select is(tests.kept('rep_feb') -> 'loans',
  '{"sent_count": 3, "sent_principal": 7001.00, "members_owing": 18, "total_owed": 8081.05}'::jsonb,
  'February''s loans: sent that month, and what was owed at its close');
select is((tests.kept('rep') -> 'loans' ->> 'sent_count')::int || ':' || (tests.kept('rep') -> 'loans' ->> 'sent_principal'), '1:750.00',
  'March: Fay''s 750 was the one loan sent');
select is((tests.kept('rep') -> 'arrears' ->> 'total')::numeric,
  (select sum(unpaid_minimum) from statements where period_id = tests.lp(2) and unpaid_minimum > 0), 'arrears total');
select ok((tests.kept('rep') -> 'arrears' ->> 'count')::int > 0, 'someone is in arrears in March');
select is((select array_agg(x ->> 'name' || ':' || (x ->> 'unpaid') order by x ->> 'name') from jsonb_array_elements(tests.kept('rep') -> 'arrears' -> 'members') x),
  (select array_agg(m.short_name || ':' || s.unpaid_minimum order by m.short_name) from statements s join members m on m.id = s.member_id
    where s.period_id = tests.lp(2) and s.unpaid_minimum > 0), 'open: the named list');
select is(tests.kept('rep') -> 'overrides', tests.kept('mar'), 'the month''s overrides');
select is(tests.kept('rep') -> 'overrides_recorded', 'true'::jsonb, 'a month the app closed has its overrides recorded');
select is(tests.kept('rep') -> 'rules', '{"ratified_by_close": 3}'::jsonb,
  'rules ratified by the close: saving_minimum, penalty_basis, loan_terms (its later failed vote came after the close); '
  'not excess_charge (its latest vote by the close failed), loan_cap (decided after the close), '
  'deadlines_and_extensions (recorded after the close, even on the same day), no_loans_last_month (backdated, recorded after the close) '
  'nor foo_bar (not a rule of the app)');

-- an imported month ------------------------------------------------------------------------------------
-- April as the 2026 import leaves it: closed, a statement marked imported. An app entry and an audit row inside it are ignored.
update periods set status = 'closed', closed_at = timestamptz '2026-05-02 10:00+02' where id = tests.lp(3);
insert into statements (group_id, period_id, member_id, source) values (tests.id('lg'), tests.lp(3), tests.lm('Ben'), 'import');
insert into entries (group_id, period_id, member_id, kind, amount, source, reason)
values (tests.id('lg'), tests.lp(3), tests.lm('Dee'), 'penalty', 50, 'app', 'other: synthetic');
insert into audit_log (group_id, action, entity, entity_id, data, created_at)
values (tests.id('lg'), 'member.default_changed', 'members', tests.lm('Dee'),
        jsonb_build_object('cycle_id', tests.id('lcycle'), 'from', false, 'defaulted', true, 'reason', 'x'), timestamptz '2026-04-20 12:00+02');
select tests.login_as(tests.id('member'));
select is(month_overrides(tests.lp(3)), '[]'::jsonb, 'an imported month has no overrides');
select is(month_report(tests.lp(3)) -> 'overrides', '[]'::jsonb, 'the report shows none');
select is(month_report(tests.lp(3)) -> 'overrides_recorded', 'false'::jsonb, 'and says they were not recorded');
reset role;
-- May: imported, known only by an entry marked imported (no statements). Its app penalty is ignored too.
update periods set status = 'closed', closed_at = timestamptz '2026-06-02 10:00+02' where id = tests.lp(4);
insert into entries (group_id, period_id, member_id, kind, amount, source) values
  (tests.id('lg'), tests.lp(4), tests.lm('Ben'), 'saving', 250, 'import');
insert into entries (group_id, period_id, member_id, kind, amount, source, reason)
values (tests.id('lg'), tests.lp(4), tests.lm('Dee'), 'penalty', 50, 'app', 'other: synthetic');
select tests.login_as(tests.id('member'));
select is(month_overrides(tests.lp(4)), '[]'::jsonb, 'an imported entry alone makes a month imported');
select is(month_report(tests.lp(4)) -> 'overrides_recorded', 'false'::jsonb, 'with its overrides not recorded');
reset role;

-- why this figure (minimum_breakdown) -------------------------------------------------------------------
select tests.login_anon();
select throws_ok($$select minimum_breakdown(tests.lm('Ben'), tests.lp(1))$$, '42501',
  'permission denied for function minimum_breakdown', 'anon cannot call minimum_breakdown');
reset role;
select ok(not has_function_privilege('anon', 'public.minimum_breakdown(uuid, uuid)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.minimum_breakdown(uuid, uuid)', 'EXECUTE'),
  'minimum_breakdown: anon cannot execute, signed-in users can');
select tests.login_as(tests.id('outsider'));
select throws_ok($$select minimum_breakdown(tests.lm('Ben'), tests.lp(1))$$, '42501', 'not_admin', 'an outsider cannot break a minimum down');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select minimum_breakdown(tests.lm('Ben'), tests.lp(1))$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok($$select minimum_breakdown(gen_random_uuid(), tests.lp(1))$$, '42501', 'not_admin', 'an unknown member is refused');
select throws_ok($$select minimum_breakdown(tests.lm('Ben'), gen_random_uuid())$$, '42501', 'not_admin', 'so is an unknown month');
select throws_ok($$select minimum_breakdown(tests.lm('Ben'), tests.lp(5))$$, 'P0001', 'period_not_closed', 'a month not closed has no breakdown');
-- Every statement of the two months the app closed (February and March), broken down.
select tests.keep('bd', (select jsonb_agg(jsonb_build_object('period_id', s.period_id, 'member_id', s.member_id,
                                                          'b', minimum_breakdown(s.member_id, s.period_id)))
                         from statements s where s.period_id in (tests.lp(1), tests.lp(2))));
reset role;

create temp view bd as
  select s.*, x -> 'b' as b, (x -> 'b' ->> 'instalments')::numeric as inst, (x -> 'b' ->> 'excess')::numeric as exc,
         (x -> 'b' ->> 'earlier_shortfall')::numeric as short, (x -> 'b' ->> 'capped_to_owed')::boolean as capped,
         (x -> 'b' ->> 'minimum')::numeric as minimum
  from jsonb_array_elements(tests.kept('bd')) x
  join statements s on s.period_id = (x ->> 'period_id')::uuid and s.member_id = (x ->> 'member_id')::uuid;

select is((select count(*)::int from bd), (select count(*)::int from statements where period_id in (tests.lp(1), tests.lp(2))),
  'one breakdown per statement');
select ok((select bool_and(array(select jsonb_object_keys(b) order by 1)
                           = array['capped_to_owed', 'earlier_shortfall', 'excess', 'instalments', 'minimum']) from bd),
  'each has the three terms, whether it was capped, and the minimum');
select ok((select bool_and(minimum = next_minimum) from bd), 'the minimum is the statement''s next_minimum');
select ok((select bool_and(exc = excess_charged and short = unpaid_minimum) from bd),
  'excess and earlier shortfall are the statement''s excess_charged and unpaid_minimum');
select ok((select bool_and(inst + exc + short = next_minimum) from bd where not capped),
  'uncapped: the three terms sum to the stored next_minimum');
select ok((select coalesce(bool_and(inst + exc + short > closing_owed and minimum = greatest(closing_owed, 0)), true) from bd where capped),
  'capped: the terms exceed what is owed, and the minimum is what is owed');
select ok((select count(*) from bd where not capped and inst > 0) > 0
      and (select count(*) from bd where not capped and short > 0) > 0
      and (select count(*) from bd where not capped and exc > 0) > 0,
  'the uncapped sums exercise every term (instalments, excess and an earlier shortfall)');
select is((select inst from bd where member_id = tests.lm('Ben') and period_id = tests.lp(1)),
  (select sum(i.amount_due) from loan_instalments i join loans l on l.id = i.loan_id
    where l.member_id = tests.lm('Ben') and i.period_id = tests.lp(2)),
  'Ben''s February instalments are his loans'' March instalments');

-- A minimum capped to what is owed (a synthetic statement: 30 excess and 40 shortfall, but nothing owed).
-- No fixture member pays a loan off early enough to cap an instalment by its remaining balance, so the replay path for a
-- capped instalment is covered by this synthetic statement alone (Nia has no loans: instalments are 0).
insert into members (group_id, full_name, short_name) values (tests.id('lg'), 'Nia Test', 'Nia');
-- Nia owes nothing and has no entries, so the close's replay agrees with next_minimum 0 (the drift guard compares against it).
insert into statements (group_id, period_id, member_id, excess_charged, unpaid_minimum, closing_owed, next_minimum, source)
values (tests.id('lg'), tests.lp(2), (select id from members where short_name = 'Nia'), 30, 40, 0, 0, 'close');
insert into members (group_id, full_name, short_name) values (tests.id('lg'), 'Ola Test', 'Ola');
select tests.login_as(tests.id('admin'));
select is(minimum_breakdown((select id from members where short_name = 'Nia'), tests.lp(2)),
  '{"instalments": 0, "excess": 30.00, "earlier_shortfall": 40.00, "capped_to_owed": true, "minimum": 0.00}'::jsonb,
  'capped: the terms come to 70 but nothing is owed, so the minimum is 0');
select is(minimum_breakdown((select id from members where short_name = 'Ola'), tests.lp(2)), '{"none": true}'::jsonb,
  'a member with no statement that month gets none, not an error');
select is(minimum_breakdown(tests.lm('Cid'), tests.lp(3)), '{"none": true}'::jsonb, 'nor in an imported month');
select is(minimum_breakdown(tests.lm('Ben'), tests.lp(3)),
  jsonb_build_object('imported', true, 'minimum', (select next_minimum from statements where period_id = tests.lp(3) and member_id = tests.lm('Ben'))),
  'an imported month: not itemised, only the minimum');
reset role;

-- private figures: your own breakdown, nobody else's
update groups set figures_visibility = 'private' where id = tests.id('lg');
select tests.login_as(tests.id('member'));   -- Ben
select tests.keep('bd_ben_own', minimum_breakdown(tests.lm('Ben'), tests.lp(1)));
select throws_ok($$select minimum_breakdown(tests.lm('Cid'), tests.lp(1))$$, '42501', 'not_admin',
  'private: another member''s breakdown is refused');
reset role;
select tests.login_as(tests.id('admin'));
select tests.keep('bd_ann_cid', minimum_breakdown(tests.lm('Cid'), tests.lp(1)));
reset role;
update groups set figures_visibility = 'open' where id = tests.id('lg');
select tests.login_as(tests.id('member'));
select tests.keep('bd_ben_cid', minimum_breakdown(tests.lm('Cid'), tests.lp(1)));
reset role;
select is(tests.kept('bd_ben_own'), (select b from bd where member_id = tests.lm('Ben') and period_id = tests.lp(1)),
  'private: a member sees their own breakdown');
select is(tests.kept('bd_ann_cid'), (select b from bd where member_id = tests.lm('Cid') and period_id = tests.lp(1)),
  'private: an admin sees anyone''s');
select is(tests.kept('bd_ben_cid'), (select b from bd where member_id = tests.lm('Cid') and period_id = tests.lp(1)),
  'open: another member''s breakdown is shown');

-- a former member ---------------------------------------------------------------------------------------
update members set status = 'left' where id = tests.lm('Cid');
select tests.login_as(tests.id('other'));
select throws_ok($$select month_report(tests.lp(2))$$, '42501', 'not_admin', 'a member who has left cannot read the report');
select throws_ok($$select month_overrides(tests.lp(2))$$, '42501', 'not_admin', 'nor the overrides');
reset role;

-- Deliberate: can_see_figures lets a former member read their OWN row (their record stays theirs, as with figure queries),
-- while month_report refuses them. Another member's row stays refused.
update groups set figures_visibility = 'private' where id = tests.id('lg');
select tests.login_as(tests.id('other'));
select is(minimum_breakdown(tests.lm('Cid'), tests.lp(1)), tests.kept('bd_ben_cid'),
  'a member who has left still sees their own breakdown');
select throws_ok($$select minimum_breakdown(tests.lm('Ben'), tests.lp(1))$$, '42501', 'not_admin', 'but not another member''s');
reset role;

-- A stored next_minimum that the replay no longer reproduces is an error, not terms that do not add up.
-- (Statements are append-only, so the drift is a synthetic statement the close would never have written.)
insert into members (group_id, full_name, short_name) values (tests.id('lg'), 'Pia Test', 'Pia');
insert into statements (group_id, period_id, member_id, next_minimum, source)
values (tests.id('lg'), tests.lp(2), (select id from members where short_name = 'Pia'), 99, 'close');
select tests.login_as(tests.id('admin'));
select throws_ok($$select minimum_breakdown((select id from members where short_name = 'Pia'), tests.lp(2))$$, 'P0001', 'statement_drifted',
  'a drifted statement is reported, not broken down');
reset role;

select * from finish();
rollback;
