begin;
select * from no_plan();
select tests.ledger_fixture();
-- private.load_workbook_figures: the treasurer's figures for a month the app runs live. Synthetic names and amounts only.

select tests.keep('figs', $json$
{
  "month_index": 2,
  "group": {"opening_cash": 1000, "idle_cash": 900.5, "excess_billed": 90.05},
  "rows": [
    {"name": "Ann", "cum_savings": 500, "excess": 40.25, "total": 840.25, "minimum": 300},
    {"name": " ben test ", "cum_savings": 250, "excess": 20, "total": 20, "minimum": 20},
    {"name": "Cid", "cum_savings": 250, "excess": null, "total": 10, "minimum": null}
  ]
}
$json$::jsonb);

-- only the owner (the script's database login) can run it
select ok(not has_function_privilege('authenticated', 'private.load_workbook_figures(uuid, jsonb)', 'EXECUTE'), 'app roles cannot load figures');
select ok(not has_function_privilege('anon', 'private.load_workbook_figures(uuid, jsonb)', 'EXECUTE'), 'nor can anon');
select tests.login_as(tests.id('admin'));
select throws_ok($$select private.load_workbook_figures(tests.id('lg'), tests.kept('figs'))$$, '42501', null, 'not even the treasurer, from the app');
reset role;

-- refusals before anything is written
select throws_ok($$select private.load_workbook_figures(gen_random_uuid(), tests.kept('figs'))$$, '42501', 'not_admin', 'an unknown group');
select throws_ok($$select private.load_workbook_figures(tests.id('lg'), tests.kept('figs'))$$, 'P0001', 'period_not_open',
  'a planned month has nothing to compare');
select tests.ledger_jump(2);   -- February closed, March open

select throws_ok(format($$select private.load_workbook_figures(tests.id('lg'), jsonb_set(tests.kept('figs'), %L, %L))$$, x.path, x.val),
  'P0001', 'invalid_amount', 'malformed: ' || x.what)
from (values
  ('{month_index}', '2.5', 'a fractional month'),
  ('{month_index}', '13', 'a thirteenth month'),
  ('{month_index}', 'null', 'no month'),
  ('{rows}', '[]', 'no rows'),
  ('{rows}', 'null', 'rows that are null'),
  ('{rows,0,name}', '"  "', 'a blank name'),
  ('{rows,0,total}', '"840"', 'a figure written as text'),
  ('{rows,0,total}', '10000000000', 'a figure past numeric(12,2)'),
  ('{group,idle_cash}', '"900"', 'a group figure written as text'),
  ('{rows,1,name}', '"ann"', 'a member listed twice')
) as x(path, val, what);
select throws_ok($$select private.load_workbook_figures(tests.id('lg'), jsonb_set(tests.kept('figs'), '{rows,0,name}', '"Zoe"'))$$,
  'P0001', 'member_not_found', 'a name that matches no member');
select is((select count(*)::int from workbook_figures where group_id = tests.id('lg')), 0, 'refusals write nothing');
-- an imported month already has its figures from the import
insert into entries (group_id, period_id, member_id, kind, amount, source) values (tests.id('lg'), tests.lp(1), tests.lm('ann'), 'saving', 100, 'import');
select throws_ok($$select private.load_workbook_figures(tests.id('lg'), jsonb_set(tests.kept('figs'), '{month_index}', '1'))$$,
  'P0001', 'already_closed', 'an imported month is refused');

-- load -------------------------------------------------------------------------------------------------
select tests.keep('summary', private.load_workbook_figures(tests.id('lg'), tests.kept('figs')));
select is(tests.kept('summary') ->> 'label', 'Mar 2026', 'the summary names the month');
select is((tests.kept('summary') ->> 'members')::int, 3, 'three members');
select is((select count(*)::int from workbook_figures where period_id = tests.lp(2) and member_id is not null), 10,
  'blank cells are skipped: Ann 4, Ben 4, Cid 2 (no excess or minimum)');
select is((select value from workbook_figures where period_id = tests.lp(2) and member_id = tests.lm('ben') and field = 'closing_owed'), 20.00,
  'names match by full name, ignoring case and spaces');
select is((select value from workbook_figures where period_id = tests.lp(2) and member_id = tests.lm('ann') and field = 'excess_charged'), 40.25,
  'excess is stored as excess_charged');
select is((select array_agg(field order by field) from workbook_figures where period_id = tests.lp(2) and member_id is null),
  array['excess_billed', 'idle_cash', 'opening_cash'], 'the three group figures');
select is((select count(*)::int from workbook_figures where period_id <> tests.lp(2) and group_id = tests.id('lg')), 0, 'no other month is touched');
select is((select count(*)::int from audit_log where action = 'ledger.figures_loaded' and entity_id = tests.lp(2)), 1, 'audited');
select is((select count(*)::int from entries where period_id = tests.lp(2)) + (select count(*)::int from statements where period_id = tests.lp(2)), 0,
  'no entry or statement was written');

-- the month close shows the difference
select tests.login_as(tests.id('admin'));
select tests.keep('preview', close_month(tests.lp(2)));
reset role;
select is((select count(*)::int from jsonb_array_elements(tests.kept('preview') -> 'diff') d
           where d ->> 'short_name' = 'Ann' and d ->> 'field' = 'cum_savings'), 1,
  'the close preview lists Ann''s cumulative savings against the workbook''s 500');

-- loading again replaces the month's figures
select private.load_workbook_figures(tests.id('lg'), jsonb_set(tests.kept('figs'), '{rows,0,total}', '999'));
select is((select value from workbook_figures where period_id = tests.lp(2) and member_id = tests.lm('ann') and field = 'closing_owed'), 999.00,
  'a second load replaces the first');
select is((select count(*)::int from workbook_figures where period_id = tests.lp(2)), 13, 'with no duplicates (10 member + 3 group)');
select is((select count(*)::int from audit_log where action = 'ledger.figures_loaded' and entity_id = tests.lp(2)), 2, 'both loads are audited');

select * from finish();
rollback;
