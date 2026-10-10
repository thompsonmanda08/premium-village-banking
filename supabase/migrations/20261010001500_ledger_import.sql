-- The 2026 history import (spec §7). bun run ledger:import reads the workbooks into a JSON bundle and calls this as
-- the database owner (no app role can execute anything in `private`). Months close through the app's own close code.
--
-- What is stored as the official record: the workbook's cumulative savings, excess charges, total payable (closing
-- owed), minimum and receipts. What the workbook lacks is computed by the ledger's rules: the payment split (paid to
-- excess, penalties, interest, principal), interest earned, and the group statement's cash and pots. The workbook's
-- group cash figures are kept in workbook_figures for the replay to compare.

create or replace function private.import_history(p_group uuid, p_bundle jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_through int;
  v_cycle uuid;
  v_map jsonb;
  v_bad text;
  v_month jsonb;
  v_row jsonb;
  v_period periods;
  v_next uuid;
  v_member uuid;
  v_parts numeric[];
  v_total numeric;
  v_interest numeric;
  v_given numeric;
  v_part_interest numeric;
  v_seq int := 0;
  v_loan loans;
  v_fig jsonb;
  v_l record;
  v_start int;
  v_end int;
  v_n int;
  v_summary jsonb;
begin
  -- A malformed bundle stops the import: months 1 to "through" (at most October), each once; every amount a JSON
  -- number from 0 to under 10^10 (workbook totals may be negative); every row named; real dates. Bad casts land here too.
  begin
    if jsonb_typeof(p_bundle -> 'through') is distinct from 'number'
       or (p_bundle -> 'through')::numeric not between 1 and 10 or (p_bundle -> 'through')::numeric % 1 <> 0 then
      v_bad := '"through" must be a month from 1 to 10';
    else
      v_through := (p_bundle -> 'through')::int;
      if jsonb_typeof(p_bundle -> 'months') is distinct from 'array'
         or (select array_agg((m -> 'month_index')::numeric order by (m -> 'month_index')::numeric)
             from jsonb_array_elements(p_bundle -> 'months') m)
            is distinct from (select array_agg(i::numeric order by i) from generate_series(1, v_through) i) then
        v_bad := 'The bundle must hold months 1 to "through", each once';
      end if;
    end if;

    if v_bad is null then
      with m as (select x as m from jsonb_array_elements(p_bundle -> 'months') x),
      r as (select y as r from m, jsonb_array_elements(m.m -> 'rows') y),
      a as (
        select m.m -> 'fee_spent' as v, false as signed from m
        union all select m.m -> 'group' -> f, true from m, unnest(array['opening_cash', 'idle_cash', 'excess_billed']) f
        union all select r.r -> f, false from r,
          unnest(array['saving', 'txn_fee', 'membership', 'interest', 'excess', 'penalty', 'received']) f
        union all select r.r -> f, true from r, unnest(array['cum_savings', 'total', 'minimum']) f
        union all select l, false from r,
          jsonb_array_elements(case when jsonb_typeof(r.r -> 'loans') = 'array' then r.r -> 'loans' else '[]' end) l
      )
      select case
        when exists (select 1 from r where jsonb_typeof(r.r -> 'name') is distinct from 'string' or trim(r.r ->> 'name') = '')
          then 'Every row needs a name'
        when exists (select 1 from r where coalesce(jsonb_typeof(r.r -> 'loans'), 'null') not in ('array', 'null'))
          then 'Loans must be a list of amounts'
        when exists (select 1 from a where case when a.v is null or jsonb_typeof(a.v) = 'null' then false
                                                 when jsonb_typeof(a.v) <> 'number' then true
                                                 else abs(round(a.v::numeric, 2)) >= 10000000000
                                                      or (not a.signed and a.v::numeric < 0) end)
          then 'Every amount must be a number from 0 to under 10^10'
        end
      into v_bad;
    end if;
    -- Loan interest is charged on the month's loans; interest with no loan would vanish.
    if v_bad is null and exists (
      select 1 from jsonb_array_elements(p_bundle -> 'months') m, jsonb_array_elements(m -> 'rows') r
      where round(coalesce((r ->> 'interest')::numeric, 0), 2) > 0
        and not exists (select 1 from jsonb_array_elements(coalesce(r -> 'loans', '[]')) l where round(l::numeric, 2) > 0)) then
      v_bad := 'Interest with no loan';
    end if;

    if v_bad is null and (
      exists (select 1 from unnest(array['starts_on', 'ends_on', 'payout_on']) f
              where coalesce(p_bundle -> 'cycle' ->> f, '') !~ '^\d{4}-\d{2}-\d{2}$')
      or ((p_bundle -> 'cycle' ->> 'ends_on')::date > (p_bundle -> 'cycle' ->> 'starts_on')::date
          and (p_bundle -> 'cycle' ->> 'payout_on')::date <= (p_bundle -> 'cycle' ->> 'ends_on')::date) is not true
      or exists (select 1 from jsonb_each_text(coalesce(p_bundle -> 'deadlines', '{}')) d
                 where d.key !~ '^([1-9]|1[0-2])$' or d.value !~ '^\d{4}-\d{2}-\d{2}$' or d.value::date is null)) then
      v_bad := 'Dates must be real YYYY-MM-DD dates, the cycle ending after it starts and paying out by its end';
    end if;
  exception when data_exception then
    v_bad := 'Malformed bundle: ' || sqlerrm;
  end;
  if v_bad is not null then
    raise exception 'invalid_amount' using errcode = 'P0001', detail = v_bad;
  end if;

  if not exists (select 1 from groups where id = p_group) then
    raise exception 'member_not_found' using errcode = 'P0001', detail = 'No such group';
  end if;
  -- Every workbook name matches exactly one member, by short or full name, ignoring case and outer spaces.
  with names as (
    select distinct lower(trim(r ->> 'name')) as name
    from jsonb_array_elements(p_bundle -> 'months') m, jsonb_array_elements(m -> 'rows') r
  )
  select string_agg(n.name, ', ' order by n.name) into v_bad
  from names n
  where (select count(*) from members x
         where x.group_id = p_group and (lower(x.short_name) = n.name or lower(x.full_name) = n.name)) <> 1;
  if v_bad is not null then
    raise exception 'member_not_found' using errcode = 'P0001', detail = 'No single member matches: ' || v_bad;
  end if;
  select jsonb_object_agg(n.name, x.id) into v_map
  from (select distinct lower(trim(r ->> 'name')) as name
        from jsonb_array_elements(p_bundle -> 'months') m, jsonb_array_elements(m -> 'rows') r) n
  join members x on x.group_id = p_group and (lower(x.short_name) = n.name or lower(x.full_name) = n.name);
  select string_agg(distinct m ->> 'month_index', ', ') into v_bad
  from jsonb_array_elements(p_bundle -> 'months') m
  where (select count(distinct v_map ->> lower(trim(r ->> 'name'))) from jsonb_array_elements(m -> 'rows') r)
        <> jsonb_array_length(m -> 'rows');
  if v_bad is not null then
    raise exception 'member_not_found' using errcode = 'P0001', detail = 'Two rows match one member in month ' || v_bad;
  end if;

  select id into v_cycle from cycles where group_id = p_group and label = p_bundle -> 'cycle' ->> 'label';
  if v_cycle is not null then
    -- Re-runnable until the app takes over: the cycle may hold nothing but the import's own rows.
    if exists (select 1 from periods where cycle_id = v_cycle and status in ('open', 'closing'))
       or exists (select 1 from statements s join periods p on p.id = s.period_id
                  where p.cycle_id = v_cycle and s.source <> 'import')
       or exists (select 1 from group_statements s join periods p on p.id = s.period_id
                  where p.cycle_id = v_cycle and s.source <> 'import')
       or exists (select 1 from entries e join periods p on p.id = e.period_id
                  where p.cycle_id = v_cycle and e.source <> 'import')
       or exists (select 1 from declarations d join periods p on p.id = d.period_id where p.cycle_id = v_cycle) then
      raise exception 'already_opened' using errcode = 'P0001';
    end if;
    perform set_config('ledger.import_reset', 'on', true);
    delete from workbook_figures where period_id in (select id from periods where cycle_id = v_cycle);
    delete from statements where period_id in (select id from periods where cycle_id = v_cycle);
    delete from group_statements where period_id in (select id from periods where cycle_id = v_cycle);
    delete from entries where period_id in (select id from periods where cycle_id = v_cycle);
    perform set_config('ledger.import_reset', 'off', true);
    delete from loans where period_id in (select id from periods where cycle_id = v_cycle);   -- instalments cascade
    delete from periods where cycle_id = v_cycle;
  else
    v_cycle := private.create_cycle(p_group, p_bundle -> 'cycle' ->> 'label', (p_bundle -> 'cycle' ->> 'starts_on')::date,
                                    (p_bundle -> 'cycle' ->> 'ends_on')::date, (p_bundle -> 'cycle' ->> 'payout_on')::date);
  end if;
  update cycles set status = 'active' where id = v_cycle and status <> 'active';

  insert into wallets (group_id, name) values (p_group, 'Airtel'), (p_group, 'MTN') on conflict (group_id, name) do nothing;
  perform private.ensure_periods(v_cycle);
  if exists (select 1 from jsonb_each_text(coalesce(p_bundle -> 'deadlines', '{}')) d
             join periods p on p.cycle_id = v_cycle and p.month_index = d.key::int
             where d.value::date < p.starts_on) then
    raise exception 'invalid_amount' using errcode = 'P0001', detail = 'A deadline falls before its month starts';
  end if;
  update periods p set deadline = d.value::date
    from jsonb_each_text(coalesce(p_bundle -> 'deadlines', '{}'::jsonb)) d
   where p.cycle_id = v_cycle and p.month_index = d.key::int;
  update periods set status = 'closed', closed_at = now() where cycle_id = v_cycle and month_index <= v_through;

  for v_month in select m from jsonb_array_elements(p_bundle -> 'months') m order by (m -> 'month_index')::int loop
    select * into v_period from periods where cycle_id = v_cycle and month_index = (v_month -> 'month_index')::int;
    select id into v_next from periods where cycle_id = v_cycle and month_index = v_period.month_index + 1;

    -- The month's loan transfer fees: paid from the fee pot in the ledger's model.
    if round(coalesce((v_month ->> 'fee_spent')::numeric, 0), 2) > 0 then
      insert into entries (group_id, period_id, kind, amount, source)
      values (p_group, v_period.id, 'payout_fee', round((v_month ->> 'fee_spent')::numeric, 2), 'import');
    end if;

    for v_row in select r from jsonb_array_elements(v_month -> 'rows') r loop
      v_member := (v_map ->> lower(trim(v_row ->> 'name')))::uuid;
      insert into entries (group_id, period_id, member_id, kind, amount, source)
      select p_group, v_period.id, v_member, x.kind, round(x.amount, 2), 'import'
      from (values ('saving', (v_row ->> 'saving')::numeric), ('membership', (v_row ->> 'membership')::numeric),
                   ('txn_fee', (v_row ->> 'txn_fee')::numeric), ('penalty', (v_row ->> 'penalty')::numeric),
                   ('excess_charge', (v_row ->> 'excess')::numeric)) as x(kind, amount)
      where round(coalesce(x.amount, 0), 2) > 0;
      -- What was received against this month's statement arrived in next month's window. The last imported month's
      -- receipts arrive in the first app month and are entered there.
      if v_period.month_index < v_through and round(coalesce((v_row ->> 'received')::numeric, 0), 2) > 0 then
        insert into entries (group_id, period_id, member_id, kind, amount, source)
        values (p_group, v_next, v_member, 'payment', round((v_row ->> 'received')::numeric, 2), 'import');
      end if;

      -- One row per loan (a cell typed as 4100+900+2600 is three loans). Interest as the workbook charged it,
      -- split across the month's loans by size, the last taking the remainder.
      select array_agg(round(t.x::numeric, 2) order by t.n) into v_parts
        from jsonb_array_elements_text(coalesce(v_row -> 'loans', '[]'::jsonb)) with ordinality as t(x, n)
       where round(t.x::numeric, 2) > 0;
      v_total := coalesce((select sum(p) from unnest(v_parts) as p), 0);
      v_interest := round(coalesce((v_row ->> 'interest')::numeric, 0), 2);
      v_given := 0;
      for i in 1 .. coalesce(array_length(v_parts, 1), 0) loop
        v_part_interest := case when i = array_length(v_parts, 1) then v_interest - v_given
                                else round(v_interest * v_parts[i] / v_total, 2) end;
        v_given := v_given + v_part_interest;
        v_seq := v_seq + 1;
        v_loan := private.schedule_loan(v_period.id, v_member, v_parts[i], greatest(v_part_interest, 0), null,
                                        v_period.starts_on + make_interval(secs => v_seq));
        insert into entries (group_id, period_id, member_id, kind, amount, loan_id, source)
        values (p_group, v_period.id, v_member, 'loan_sent', v_parts[i], v_loan.id, 'import');
        if v_part_interest > 0 then
          insert into entries (group_id, period_id, member_id, kind, amount, loan_id, source)
          values (p_group, v_period.id, v_member, 'loan_interest', v_part_interest, v_loan.id, 'import');
        end if;
      end loop;

      insert into workbook_figures (group_id, period_id, member_id, field, value)
      select p_group, v_period.id, v_member, x.field, round(x.value, 2)
      from (values ('cum_savings', (v_row ->> 'cum_savings')::numeric), ('excess_charged', (v_row ->> 'excess')::numeric),
                   ('closing_owed', (v_row ->> 'total')::numeric), ('next_minimum', (v_row ->> 'minimum')::numeric)) as x(field, value)
      where x.value is not null;
    end loop;

    insert into workbook_figures (group_id, period_id, member_id, field, value)
    select p_group, v_period.id, null, x.field, round(x.value, 2)
    from (values ('opening_cash', (v_month -> 'group' ->> 'opening_cash')::numeric),
                 ('idle_cash', (v_month -> 'group' ->> 'idle_cash')::numeric),
                 ('excess_billed', (v_month -> 'group' ->> 'excess_billed')::numeric)) as x(field, value)
    where x.value is not null;

    -- Close the month with the app's own code. Imported mode takes the workbook's excess shares and minimums; its
    -- cumulative savings and total payable replace the computed ones here, and the group totals follow them.
    v_fig := private.close_figures(v_period.id, true);
    v_fig := jsonb_set(v_fig, '{members}', (
      select coalesce(jsonb_agg(x.m || jsonb_strip_nulls(jsonb_build_object('cum_savings', cs.value, 'closing_owed', co.value))
                                order by x.n), '[]'::jsonb)
      from jsonb_array_elements(v_fig -> 'members') with ordinality as x(m, n)
      left join workbook_figures cs
        on cs.period_id = v_period.id and cs.member_id = (x.m ->> 'member_id')::uuid and cs.field = 'cum_savings'
      left join workbook_figures co
        on co.period_id = v_period.id and co.member_id = (x.m ->> 'member_id')::uuid and co.field = 'closing_owed'));
    v_fig := jsonb_set(v_fig, '{group}', (v_fig -> 'group') || jsonb_build_object(
      'total_savings', (select coalesce(sum((m ->> 'cum_savings')::numeric), 0) from jsonb_array_elements(v_fig -> 'members') m),
      'total_owed', (select coalesce(sum((m ->> 'closing_owed')::numeric), 0) from jsonb_array_elements(v_fig -> 'members') m)));
    perform private.write_close(v_period.id, v_fig, 'import');
  end loop;

  -- Every loan still owed gets equal instalments of what remains, from the first month the app asks for (the workbook's
  -- last minimum covers the month after the import) to the loan's original last month, at least one; the last
  -- instalment absorbs the ngwee remainder. Earlier instalments stay as they were, so replays of every imported month
  -- have them. What a loan still owes comes from the payment split (oldest loan first), never from loans.status.
  v_start := least(v_through + 2, 12);
  for v_l in select (x ->> 'loan_id')::uuid as id, (x ->> 'remaining')::numeric as remaining
             from jsonb_array_elements(v_fig -> 'loans') x loop
    delete from loan_instalments i using periods p
     where i.loan_id = v_l.id and p.id = i.period_id and p.month_index >= v_start;
    continue when v_l.remaining <= 0;
    select greatest(v_start, least(12, p.month_index + l.term_months)) into v_end
      from loans l join periods p on p.id = l.period_id where l.id = v_l.id;
    v_n := v_end - v_start + 1;
    insert into loan_instalments (group_id, loan_id, period_id, amount_due)
    select p_group, v_l.id, p.id,
           case when p.month_index = v_end then v_l.remaining - trunc(v_l.remaining / v_n, 2) * (v_n - 1)
                else trunc(v_l.remaining / v_n, 2) end
    from periods p where p.cycle_id = v_cycle and p.month_index between v_start and v_end;
  end loop;

  v_summary := jsonb_build_object(
    'cycle_id', v_cycle,
    'months', v_through,
    'members', (select count(*) from statements s where s.period_id = v_period.id),
    'entries', (select count(*) from entries e join periods p on p.id = e.period_id where p.cycle_id = v_cycle),
    'loans', (select count(*) from loans l join periods p on p.id = l.period_id where p.cycle_id = v_cycle),
    'open_loans', (select count(*) from jsonb_array_elements(v_fig -> 'loans') x where (x ->> 'remaining')::numeric > 0),
    'savings', (v_fig -> 'group' ->> 'total_savings')::numeric,
    'owed', (v_fig -> 'group' ->> 'total_owed')::numeric,
    'idle_cash', (v_fig -> 'group' ->> 'idle_cash')::numeric);
  perform private.audit(p_group, 'ledger.imported', 'cycles', v_cycle, v_summary - 'cycle_id');
  return v_summary;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
