begin;
select * from no_plan();
select tests.ledger_fixture();
select tests.ledger_jump(3);

-- The open month, and a key under the group's own folder.
create temp table pk as select ('proofs/' || tests.id('lg') || '/')::text as dir;
grant select on pk to authenticated;

-- A member attaches to their own month ----------------------------------------------------------------
select tests.login_as(tests.id('member'));
select is((select content_type from add_proof(tests.lp(3), tests.lm('Ben'), (select dir from pk) || 'a.jpg', 'image/jpeg', 1000)), 'image/jpeg', 'a member attaches a proof to their own month');
select throws_ok($$select add_proof(tests.lp(3), tests.lm('Cid'), (select dir from pk) || 'b.jpg', 'image/jpeg', 1000)$$, 'P0001', 'member_not_found', 'not to someone else''s');
select throws_ok($$select add_proof(tests.lp(3), tests.lm('Ben'), (select dir from pk) || 'c.exe', 'application/x-msdownload', 1000)$$, 'P0001', 'invalid_file', 'only images and PDF');
select throws_ok($$select add_proof(tests.lp(3), tests.lm('Ben'), (select dir from pk) || 'd.jpg', 'image/jpeg', 4194305)$$, 'P0001', 'file_too_large', 'at most 4 MB');
select throws_ok($$select add_proof(tests.lp(3), tests.lm('Ben'), 'proofs/other-group/e.jpg', 'image/jpeg', 10)$$, 'P0001', 'invalid_file', 'the key must sit in the group''s folder');
select throws_ok($$select add_proof(tests.lp(2), tests.lm('Ben'), (select dir from pk) || 'f.jpg', 'image/jpeg', 10)$$, 'P0001', 'period_not_open', 'not to a closed month');
select add_proof(tests.lp(3), tests.lm('Ben'), (select dir from pk) || 'g.jpg', 'image/jpeg', 10);
select add_proof(tests.lp(3), tests.lm('Ben'), (select dir from pk) || 'h.jpg', 'image/jpeg', 10);
select add_proof(tests.lp(3), tests.lm('Ben'), (select dir from pk) || 'i.jpg', 'image/jpeg', 10);
select add_proof(tests.lp(3), tests.lm('Ben'), (select dir from pk) || 'j.jpg', 'image/jpeg', 10);
select throws_ok($$select add_proof(tests.lp(3), tests.lm('Ben'), (select dir from pk) || 'k.jpg', 'image/jpeg', 10)$$, 'P0001', 'too_many_files', 'five at most');
reset role;

-- Who sees them ---------------------------------------------------------------------------------------
update groups set figures_visibility = 'private' where id = tests.id('lg');
select tests.login_as(tests.id('member'));
select is((select count(*)::int from declaration_proofs), 5, 'the member sees their own five');
reset role;
select tests.login_as(tests.id('other'));
select is((select count(*)::int from declaration_proofs), 0, 'another member sees none of them in a private group');
reset role;
select tests.login_as(tests.id('admin'));
select is((select count(*)::int from declaration_proofs), 5, 'the treasurer sees them');
select is((select content_type from add_proof(tests.lp(3), tests.lm('Cid'), (select dir from pk) || 'z.pdf', 'application/pdf', 500)), 'application/pdf', 'and attaches one for a member who sent it on WhatsApp');
reset role;
select tests.login_as(tests.id('outsider'));
select throws_ok($$select add_proof(tests.lp(3), tests.lm('Ben'), (select dir from pk) || 'y.jpg', 'image/jpeg', 10)$$, 'P0001', 'member_not_found', 'an outsider cannot attach');
select is((select count(*)::int from declaration_proofs), 0, 'nor see');
reset role;
select tests.login_anon();
select throws_ok($$select add_proof(tests.lp(3), tests.lm('Ben'), 'proofs/x/y.jpg', 'image/jpeg', 10)$$, '42501', null, 'anon cannot call it');
reset role;

-- No writes except through the functions -------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$insert into declaration_proofs (group_id, period_id, member_id, object_key, content_type, size_bytes) values (tests.id('lg'), tests.lp(3), tests.lm('Ben'), 'proofs/x/y', 'image/jpeg', 1)$$, '42501', null, 'no direct insert');
select throws_ok($$delete from declaration_proofs$$, '42501', null, 'no direct delete');
-- A failed upload is rolled back by its creator, not by anyone else.
select lives_ok($$select remove_proof((select id from declaration_proofs order by created_at limit 1))$$, 'the creator can remove it');
select is((select count(*)::int from declaration_proofs), 4, 'and it is gone');
reset role;

select * from finish();
rollback;
