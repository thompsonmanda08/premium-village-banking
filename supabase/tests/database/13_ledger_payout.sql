begin;
select * from no_plan();
select tests.ledger_fixture();
select tests.ledger_inputs(1);
select tests.login_as(tests.id('admin'));
select close_month(tests.lp(1), true);
reset role;
select tests.ledger_inputs(2);
select tests.login_as(tests.id('admin'));
select close_month(tests.lp(2), true);

-- After March (figures from 11_ledger_close.sql). Pots: fee pot 15 − 10 − 5 = 0, meeting pot 900 → 900 shared by 19:
-- 900 / 19 = 47.368 → 47.36 each, 19 × 47.36 = 899.84, the 0.16 remainder to the first by name, Ann: 47.52.
-- Ann:  2,000 saved + 216.97 interest − 180.52 owed + 47.52 = 2,083.97
-- Ben:  1,000 + 108.48 − 1,815.84 + 47.36 = −660.00 (he owes the group)
-- Cid:  4,000 + 434.00 − 361.09 + 47.36 = 4,120.27
-- Dee (defaulted): 250 + 0 − 123.58 + 47.36 = 173.78 (her debt comes out of her savings)
-- Zed:  0 + 0 − 0 + 47.36 = 47.36
select is((select payout from payout_preview(tests.id('lcycle')) where short_name = 'Ann'), 2083.97, 'Ann''s payout');
select is((select pot_share from payout_preview(tests.id('lcycle')) where short_name = 'Ann'), 47.52, 'Ann takes the pot remainder');
select is((select payout from payout_preview(tests.id('lcycle')) where short_name = 'Ben'), -660.00, 'Ben would owe the group');
select is((select savings || '/' || interest_earned || '/' || owed from payout_preview(tests.id('lcycle')) where short_name = 'Cid'),
  '4000.00/434.00/361.09', 'Cid''s parts');
select is((select payout from payout_preview(tests.id('lcycle')) where short_name = 'Cid'), 4120.27, 'Cid''s payout');
select is((select payout from payout_preview(tests.id('lcycle')) where short_name = 'Dee'), 173.78, 'a defaulter''s debt is deducted from savings');
select is((select payout from payout_preview(tests.id('lcycle')) where short_name = 'Zed'), 47.36, 'Zed gets his share of the pots');
select is((select sum(pot_share) from payout_preview(tests.id('lcycle'))), 900.00, 'the pots are shared out exactly');
select is((select count(*)::int from payout_preview(tests.id('lcycle'))), 19, 'every member');
reset role;

-- Live: April open, Ben pays 1,000. Owed 1,815.84 − 1,000 = 815.84; payout 1,000 + 108.48 − 815.84 + 47.36 = 340.00.
select tests.ledger_inputs(3);
select tests.ledger_pay('Ben', 3, 0, 1000);
select tests.login_as(tests.id('member'));
select is((select payout from payout_preview(tests.id('lcycle')) where short_name = 'Ben'), 340.00, 'payments this month count at once');
select is((select count(*)::int from payout_preview(tests.id('lcycle'))), 19, 'figures open: a member sees everyone');
reset role;
update groups set figures_visibility = 'private' where id = tests.id('lg');
select tests.login_as(tests.id('member'));
select is((select array_agg(short_name) from payout_preview(tests.id('lcycle'))), array['Ben'], 'figures private: only their own row');
reset role;
select tests.login_as(tests.id('owner'));
select is((select count(*)::int from payout_preview(tests.id('lcycle'))), 19, 'the owner sees everyone');
reset role;
select tests.login_as(tests.id('outsider'));
select throws_ok($$select * from payout_preview(tests.id('lcycle'))$$, '42501', 'not_admin', 'outsiders see nothing');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select * from payout_preview(tests.id('lcycle'))$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok($$select * from payout_preview(gen_random_uuid())$$, '42501', 'not_admin', 'an unknown cycle is refused the same way');
reset role;
select tests.login_anon();
select throws_ok($$select * from payout_preview(tests.id('lcycle'))$$, '42501', null, 'nor anon');
reset role;

select * from finish();
rollback;
