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
  array['correction:Ann:-100.00', 'deadline_extended:-:null', 'default_cleared:Dee:null', 'default_set:Dee:null',
        'penalty_applied:Dee:100.00', 'penalty_waived:Dee:40.00', 'waiver:Fay:112.50'],
  'March lists each override once: the correction (signed), the waivers, the penalty, both default changes and the extension');
select is((select reason from o where log = 'mar' and kind = 'penalty_waived'), 'first offence', 'with the treasurer''s reason');
select is((select reason from o where log = 'mar' and kind = 'deadline_extended'), 'network outage', 'the extension''s reason');
select is((select reason from o where log = 'mar' and kind = 'default_cleared'), 'paid up', 'the default change''s reason');
select is((select member_id from o where log = 'mar' and kind = 'penalty_applied'), tests.lm('Dee'), 'and the member''s id');
select is((select array_agg(at order by ord) from (select (x ->> 'at')::timestamptz as at, ord from tests.kept_json k,
             jsonb_array_elements(k.v) with ordinality as e(x, ord) where k.name = 'mar') s),
          (select array_agg(at order by at) from o where log = 'mar'), 'ordered by when it happened');
select is((select array_agg(kind || ':' || member || ':' || coalesce(amount::text, 'null') || ':' || reason order by kind) from o where log = 'feb'),
  array['default_set:Gus:null:missed the meeting', 'loan_over_cap:Ben:3001.00:agreed at the meeting'],
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

select is((select count(*)::int from o where log = 'mar_ben'), 7, 'private: a member still sees every override');
select is((select count(*)::int from o where log = 'mar_ben' and (member is not null or member_id is not null)), 0,
  'but no other member''s name or id');
select is((select member from o where log = 'feb_ben' and kind = 'loan_over_cap'), 'Ben', 'a member''s own row keeps the name');
select is((select member_id from o where log = 'feb_ben' and kind = 'loan_over_cap'), tests.lm('Ben'), 'and the id');
select is((select count(*)::int from o where log = 'feb_cid' and (member is not null or member_id is not null)), 0,
  'another member sees neither in Ben''s row');
select is((select count(*)::int from o where log = 'mar_ann' and member is not null), 6, 'an admin sees every name');
select is((select count(*)::int from members m
            where m.group_id = tests.id('lg') and m.id <> tests.lm('Ben')
              and (tests.kept('rep_ben')::text like '%' || m.short_name || '%' or tests.kept('rep_ben')::text like '%' || m.id || '%')), 0,
  'private: nowhere in Ben''s report is another member''s name or id');
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
  (tests.id('lg'), tests.id('lcycle'), 'min_saving',   '2026-03-20', 15, 18, true,  '2026-03-20 12:00+02'),
  (tests.id('lg'), tests.id('lcycle'), 'min_saving',   '2026-03-21', 16, 18, true,  '2026-03-21 12:00+02'),  -- same rule twice: one
  (tests.id('lg'), tests.id('lcycle'), 'penalty_late', '2026-03-01', 5, 18, false,  '2026-03-01 12:00+02'),
  (tests.id('lg'), tests.id('lcycle'), 'penalty_late', '2026-03-15', 14, 18, true,  '2026-03-15 12:00+02'),  -- failed, then passed
  (tests.id('lg'), tests.id('lcycle'), 'excess_rate',  '2026-03-01', 14, 18, true,  '2026-03-01 12:00+02'),
  (tests.id('lg'), tests.id('lcycle'), 'excess_rate',  '2026-03-25', 5, 18, false,  '2026-03-25 12:00+02'),  -- passed, then failed
  (tests.id('lg'), tests.id('lcycle'), 'loan_cap',     '2026-04-10', 14, 18, true,  '2026-04-10 12:00+02'),  -- after the close
  (tests.id('group'), tests.id('c_active'), 'interest_rate', '2026-03-01', 3, 3, true, '2026-03-01 12:00+02'); -- another group
select tests.login_as(tests.id('other'));
select tests.keep('rep', month_report(tests.lp(2)));
reset role;

select is(tests.kept('rep') -> 'period',
  jsonb_build_object('id', tests.lp(2), 'label', 'Mar 2026', 'month_index', 2, 'closed_at', timestamptz '2026-04-02 10:00+02'), 'the month');
select is(tests.kept('rep') -> 'group', (select to_jsonb(g) from group_statements g where g.period_id = tests.lp(2)), 'the group statement');
select is(tests.kept('rep') -> 'loans', (select jsonb_build_object(
    'sent_count', count(*) filter (where period_id = tests.lp(2)),
    'sent_principal', sum(principal) filter (where period_id = tests.lp(2)),
    'open_count', count(*) filter (where status = 'open'),
    'open_principal', sum(principal) filter (where status = 'open')) from loans where group_id = tests.id('lg')),
  'loans: sent in March, and still open in the cycle');
select is((tests.kept('rep') -> 'loans' ->> 'sent_principal')::numeric, 750.00, 'Fay''s 750 was the one March loan');
select is((tests.kept('rep') -> 'arrears' ->> 'total')::numeric,
  (select sum(unpaid_minimum) from statements where period_id = tests.lp(2) and unpaid_minimum > 0), 'arrears total');
select ok((tests.kept('rep') -> 'arrears' ->> 'count')::int > 0, 'someone is in arrears in March');
select is((select array_agg(x ->> 'name' || ':' || (x ->> 'unpaid') order by x ->> 'name') from jsonb_array_elements(tests.kept('rep') -> 'arrears' -> 'members') x),
  (select array_agg(m.short_name || ':' || s.unpaid_minimum order by m.short_name) from statements s join members m on m.id = s.member_id
    where s.period_id = tests.lp(2) and s.unpaid_minimum > 0), 'open: the named list');
select is(tests.kept('rep') -> 'overrides', tests.kept('mar'), 'the month''s overrides');
select is(tests.kept('rep') -> 'overrides_recorded', 'true'::jsonb, 'a month the app closed has its overrides recorded');
select is(tests.kept('rep') -> 'rules', '{"ratified_by_close": 2}'::jsonb,
  'rules ratified by the close: min_saving and penalty_late (excess_rate''s latest vote failed, loan_cap came after)');

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

select * from finish();
rollback;
