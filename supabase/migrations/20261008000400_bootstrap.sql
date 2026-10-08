-- One-off setup functions. Schema "private" is not exposed through the API and
-- nothing in it is executable by app roles; run these from the SQL editor or psql.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.create_cycle(p_group uuid, p_label text, p_start date, p_end date, p_payout date)
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.cycles (group_id, label, starts_on, ends_on, payout_on)
  values (p_group, p_label, p_start, p_end, p_payout) returning id into v;
  insert into public.cycle_rules (cycle_id, loan_multiples, tenor_bands) values (
    v,
    '[{"from_month":1,"to_month":4,"multiple":3},{"from_month":5,"to_month":9,"multiple":2},{"from_month":10,"to_month":11,"multiple":1},{"from_month":12,"to_month":12,"multiple":0}]',
    '[{"max":3000,"months":1},{"max":5000,"months":2},{"max":9999.99,"months":3},{"max":null,"months":4}]'
  );
  return v;
end $$;

create or replace function private.bootstrap_premium_vb(p_owner uuid, p_owner_short_name text default 'Thompson')
returns uuid language plpgsql as $$
declare g uuid;
begin
  if exists (select 1 from public.groups where name = 'Premium Village Banking') then
    raise exception 'already_bootstrapped' using errcode = 'P0001';
  end if;

  insert into public.groups (name, owner_user_id) values ('Premium Village Banking', p_owner) returning id into g;

  insert into public.members (group_id, full_name, short_name)
  select g, f, s from (values
    ('Tafara', 'Tafara'), ('Nsama', 'Nsama'), ('Sapi Mulimbika', 'Sapi'), ('Changwe', 'Changwe'),
    ('Margaret', 'Margaret'), ('Raphael', 'Raphael'), ('Justin', 'Justin'), ('Thompson Manda', 'Thompson'),
    ('Kutemba', 'Kutemba'), ('Chimwemwe', 'Chimwemwe'), ('Mbachi', 'Mbachi'), ('Heri', 'Heri'),
    ('Gilbert Chisenga', 'Gilbert'), ('Nawiti', 'Nawiti'), ('Chisala', 'Chisala'), ('Charles', 'Charles'),
    ('Mulela', 'Mulela'), ('Nyasha', 'Nyasha')
  ) as t(f, s);

  update public.members
     set user_id = p_owner, role = 'admin', email = (select email from auth.users where id = p_owner)
   where group_id = g and short_name = p_owner_short_name;
  if not found then raise exception 'owner_member_not_found' using errcode = 'P0001'; end if;

  perform private.create_cycle(g, 'Cycle 2027', date '2027-02-15', date '2028-02-15', date '2028-02-05');
  return g;
end $$;

-- A throwaway group for Playwright accounts in production; it never mixes with real data.
-- Owner-only function, so the message below is for the human running it and never reaches the app.
create or replace function private.bootstrap_test_group(p_owner_email text, p_admin_email text, p_member_email text)
returns uuid language plpgsql as $$
declare g uuid; o uuid; a uuid; m uuid;
begin
  select id into o from auth.users where email = p_owner_email;
  select id into a from auth.users where email = p_admin_email;
  select id into m from auth.users where email = p_member_email;
  if o is null or a is null or m is null then
    raise exception 'create the three test accounts in Auth first' using errcode = 'P0001';
  end if;
  insert into public.groups (name, owner_user_id) values ('Playwright Test Group', o) returning id into g;
  insert into public.members (group_id, full_name, short_name) values
    (g, 'Test Owner', 'Owner'), (g, 'Test Admin', 'Admin'), (g, 'Test Member', 'Member');
  update public.members set user_id = o, role = 'admin', email = p_owner_email where group_id = g and short_name = 'Owner';
  update public.members set user_id = a, role = 'admin', email = p_admin_email where group_id = g and short_name = 'Admin';
  update public.members set user_id = m, email = p_member_email where group_id = g and short_name = 'Member';
  perform private.create_cycle(g, 'Test Cycle', date '2027-02-15', date '2028-02-15', date '2028-02-05');
  return g;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
