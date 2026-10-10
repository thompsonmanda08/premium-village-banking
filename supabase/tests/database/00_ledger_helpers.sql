-- Ledger test helpers: a synthetic group of made-up people and amounts (no real member data).
-- Sorted after 00_helpers.sql and, like it, run outside a transaction; db-test.mjs drops schema `tests` after the run.

-- "Ledger Group": 18 savers and Zed, who joined and never saves. Ann is the treasurer (admin, account `admin`),
-- Ben and Cid are linked to the accounts `member` and `other`. The owner account owns the group without a member row.
-- Cycle "Ledger 2026" runs Feb 2026 – Jan 2027 with the constitution's rules; its 12 periods start planned.
create or replace function tests.ledger_fixture() returns void
language plpgsql security definer set search_path = public, tests as $$
declare g uuid; c uuid; v uuid; n text;
begin
  perform tests.fixture();
  insert into groups (name, owner_user_id) values ('Ledger Group', tests.id('owner')) returning id into g;
  perform tests.remember('lg', g);
  foreach n in array array['Ann', 'Ben', 'Cid', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jon', 'Kim', 'Lee', 'Max', 'Ned',
                           'Oli', 'Pam', 'Quin', 'Roy', 'Zed'] loop
    insert into members (group_id, full_name, short_name) values (g, n || ' Test', n) returning id into v;
    perform tests.remember('lm_' || lower(n), v);
  end loop;
  update members set user_id = tests.id('admin'), role = 'admin', email = 'admin@test.local' where id = tests.id('lm_ann');
  update members set user_id = tests.id('member'), email = 'member@test.local' where id = tests.id('lm_ben');
  update members set user_id = tests.id('other'), email = 'other@test.local' where id = tests.id('lm_cid');

  c := private.create_cycle(g, 'Ledger 2026', date '2026-02-15', date '2027-02-15', date '2027-02-06');
  update cycles set status = 'active' where id = c;
  perform tests.remember('lcycle', c);
  insert into periods (group_id, cycle_id, month_index, label, starts_on, deadline)
  select g, c, i, to_char(m, 'Mon YYYY'), m, m + 6
  from generate_series(1, 12) as i
  cross join lateral (select (date '2026-02-01' + (i - 1) * interval '1 month')::date as m) x;

  insert into wallets (group_id, name, holder_member_id) values (g, 'Airtel', tests.id('lm_ann')) returning id into v;
  perform tests.remember('w_airtel', v);
  insert into wallets (group_id, name) values (g, 'MTN') returning id into v;
  perform tests.remember('w_mtn', v);
  insert into wallets (group_id, name, active) values (g, 'Old SIM', false) returning id into v;
  perform tests.remember('w_old', v);
  insert into wallets (group_id, name) values (tests.id('group2'), 'Other Airtel') returning id into v;
  perform tests.remember('w_g2', v);
end $$;

create or replace function tests.lm(p_short text) returns uuid language sql stable as $$
  select tests.id('lm_' || lower(p_short))
$$;

-- tests.lp(2) is the ledger cycle's March 2026 period.
create or replace function tests.lp(p_month int) returns uuid
language sql stable security definer set search_path = public, tests as $$
  select id from periods where cycle_id = tests.id('lcycle') and month_index = p_month
$$;

-- The twelve savers with no loans, no penalties and no surprises.
create or replace function tests.plain() returns text[] language sql immutable as $$
  select array['Gus', 'Hal', 'Ivy', 'Jon', 'Kim', 'Lee', 'Max', 'Ned', 'Oli', 'Pam', 'Quin', 'Roy']
$$;

-- What an approved declaration writes, without the declaration (approval has its own tests in 08).
create or replace function tests.ledger_pay(p_member text, p_month int, p_saving numeric, p_payment numeric,
  p_membership numeric default 0, p_txn_fee numeric default 0) returns void
language plpgsql security definer set search_path = public, tests as $$
begin
  insert into entries (group_id, period_id, member_id, kind, amount, wallet_id, source, created_by)
  select tests.id('lg'), tests.lp(p_month), tests.lm(p_member), x.kind, x.amount, tests.id('w_airtel'), 'app', tests.id('admin')
  from (values ('saving', p_saving), ('payment', p_payment), ('membership', p_membership), ('txn_fee', p_txn_fee)) as x(kind, amount)
  where x.amount > 0;
end $$;

-- Skip ahead: every earlier month closed (without statements), this one open.
create or replace function tests.ledger_jump(p_month int) returns void
language sql security definer set search_path = public, tests as $$
  update periods set status = 'closed', closed_at = now() where cycle_id = tests.id('lcycle') and month_index < p_month;
  update periods set status = 'open' where cycle_id = tests.id('lcycle') and month_index = p_month;
$$;

-- Keep a jsonb result (a close preview) between statements, whatever role is active.
create table if not exists tests.kept_json (name text primary key, v jsonb not null);
create or replace function tests.keep(p_name text, p_v jsonb) returns jsonb
language sql security definer set search_path = tests as $$
  insert into tests.kept_json values (p_name, p_v) on conflict (name) do update set v = excluded.v returning v
$$;
create or replace function tests.kept(p_name text) returns jsonb
language sql stable security definer set search_path = tests as $$
  select v from tests.kept_json where name = p_name
$$;
create or replace function tests.fig(p_name text, p_member text, p_field text) returns numeric language sql stable as $$
  select (m ->> p_field)::numeric from jsonb_array_elements(tests.kept(p_name) -> 'members') m where m ->> 'short_name' = p_member
$$;
create or replace function tests.gfig(p_name text, p_field text) returns numeric language sql stable as $$
  select (tests.kept(p_name) -> 'group' ->> p_field)::numeric
$$;

-- February in the synthetic group: savings 1,000 + 500 + 2,000 + 250 + 300 + 250 + 12 × 250 = 7,300;
-- membership 50 from each of the 18 savers (900); Ann and Ben declare transfer fees of 10 and 5.
create or replace function tests.ledger_feb_savings() returns void
language plpgsql security definer set search_path = public, tests as $$
declare n text;
begin
  perform tests.ledger_pay('Ann', 1, 1000, 0, 50, 10);
  perform tests.ledger_pay('Ben', 1, 500, 0, 50, 5);
  perform tests.ledger_pay('Cid', 1, 2000, 0, 50);
  perform tests.ledger_pay('Dee', 1, 250, 0, 50);
  perform tests.ledger_pay('Eve', 1, 300, 0, 50);
  perform tests.ledger_pay('Fay', 1, 250, 0, 50);
  foreach n in array tests.plain() loop
    perform tests.ledger_pay(n, 1, 250, 0, 50);
  end loop;
end $$;

-- Later tasks add helpers above this line.

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select pass('ledger test helpers installed');
select * from finish();
