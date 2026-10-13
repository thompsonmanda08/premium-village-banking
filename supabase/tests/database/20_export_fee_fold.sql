begin;
select * from no_plan();
select tests.ledger_fixture();

-- February: Dee pays a saving, a membership fee of 30 and a transfer fee of 10; then March is the open month.
select tests.ledger_jump(1);
select tests.ledger_pay('Dee', 1, 250, 0, 30, 10);
select tests.ledger_jump(2);
select tests.remember('fee', (select id from entries where member_id = tests.lm('Dee') and kind = 'txn_fee'));
select tests.remember('mem', (select id from entries where member_id = tests.lm('Dee') and kind = 'membership'));

select tests.login_as(tests.id('admin'));
select lives_ok($$select post_correction(tests.id('fee'), 6, 'Fee was 6')$$, 'the fee is corrected down to 6');
select lives_ok($$select post_correction(tests.id('mem'), 35, 'Membership was 35')$$, 'the membership is corrected up to 35');
reset role;

-- The engine's own view of a line: an adjustment or waiver counts negative under the kind of the entry it points at.
select is((select coalesce(sum(amount), 0) from private.ledger_lines
            where member_id = tests.lm('Dee') and kind = 'txn_fee' and month_index = 1), 10.00, 'February keeps its fee of 10');
select is((select coalesce(sum(amount), 0) from private.ledger_lines
            where member_id = tests.lm('Dee') and kind = 'txn_fee' and month_index = 2), -4.00, 'March carries the reduction as -4 under the fee kind');
select is((select coalesce(sum(amount), 0) from private.ledger_lines
            where member_id = tests.lm('Dee') and kind = 'txn_fee'), 6.00, 'the cycle total of the fee is 6');
select is((select coalesce(sum(amount), 0) from private.ledger_lines
            where member_id = tests.lm('Dee') and kind = 'membership' and month_index = 1), 30.00, 'February keeps its membership of 30');
select is((select coalesce(sum(amount), 0) from private.ledger_lines
            where member_id = tests.lm('Dee') and kind = 'membership' and month_index = 2), 5.00, 'March carries the increase as +5');
select is((select coalesce(sum(amount), 0) from private.ledger_lines
            where member_id = tests.lm('Dee') and kind = 'membership'), 35.00, 'the cycle total of the membership is 35');
select is((select array_agg(e.kind order by e.kind) from entries e where e.corrects_entry_id in (tests.id('fee'), tests.id('mem'))),
  array['adjustment', 'membership'], 'the reduction is stored as an adjustment and the increase as a membership entry');

select * from finish();
rollback;
