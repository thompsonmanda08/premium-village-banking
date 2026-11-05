-- Workbook figures for a LIVE month. The 2026 import writes workbook_figures only for the months it imports; a month the
-- app runs itself (October onwards) had nothing to compare with. `ledger:figures` reads the treasurer's statement sheet
-- for that month and calls this as the database owner (no app role can execute anything in `private`).
--
-- Only comparison figures are written: no entry, statement or balance changes. The month must be one the app has taken
-- over: a planned month has nothing to compare and an imported month already has its figures from the import.
-- Loading again replaces the month's earlier figures (the treasurer corrected the sheet), and the load is audited.

create or replace function private.load_workbook_figures(p_group uuid, p_bundle jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_month int;
  v_cycle uuid;
  v_period periods;
  v_bad text;
  v_map jsonb;
  v_rows int;
  v_summary jsonb;
begin
  begin
    if jsonb_typeof(p_bundle -> 'month_index') is distinct from 'number'
       or (p_bundle -> 'month_index')::numeric not between 1 and 12 or (p_bundle -> 'month_index')::numeric % 1 <> 0 then
      v_bad := '"month_index" must be a month from 1 to 12';
    elsif jsonb_typeof(p_bundle -> 'rows') is distinct from 'array' or jsonb_array_length(p_bundle -> 'rows') = 0 then
      v_bad := 'The month needs a list of rows';
    elsif exists (select 1 from jsonb_array_elements(p_bundle -> 'rows') r
                  where jsonb_typeof(r) is distinct from 'object'
                     or jsonb_typeof(r -> 'name') is distinct from 'string' or trim(r ->> 'name') = '') then
      v_bad := 'Every row needs a name';
    else
      select case
        when exists (select 1 from jsonb_array_elements(p_bundle -> 'rows') r, unnest(array['cum_savings', 'excess', 'total', 'minimum']) f
                     where case when r -> f is null or jsonb_typeof(r -> f) = 'null' then false
                                when jsonb_typeof(r -> f) <> 'number' then true
                                else abs(round((r ->> f)::numeric, 2)) >= 10000000000 end)
          or exists (select 1 from unnest(array['opening_cash', 'idle_cash', 'excess_billed']) f
                     where case when p_bundle -> 'group' -> f is null or jsonb_typeof(p_bundle -> 'group' -> f) = 'null' then false
                                when jsonb_typeof(p_bundle -> 'group' -> f) <> 'number' then true
                                else abs(round((p_bundle -> 'group' ->> f)::numeric, 2)) >= 10000000000 end)
          then 'Every figure must be a number under 10^10'
        end into v_bad;
    end if;
  exception when data_exception then
    v_bad := 'Malformed bundle: ' || sqlerrm;
  end;
  if v_bad is not null then
    raise exception 'invalid_amount' using errcode = 'P0001', detail = v_bad;
  end if;
  v_month := (p_bundle -> 'month_index')::int;

  perform 1 from groups where id = p_group for no key update;
  if not found then
    raise exception 'not_admin' using errcode = '42501', detail = 'No such group';
  end if;

  -- The group's current cycle: the one holding a month that is not planned and not yet over, newest first.
  select c.id into v_cycle from cycles c where c.group_id = p_group and c.status = 'active' order by c.starts_on desc limit 1;
  if v_cycle is null then
    raise exception 'period_not_open' using errcode = 'P0001', detail = 'The group has no active cycle';
  end if;
  select * into v_period from periods where cycle_id = v_cycle and month_index = v_month for update;
  if not found or v_period.status = 'planned' then
    raise exception 'period_not_open' using errcode = 'P0001', detail = 'Open the month in the app first; a planned month has nothing to compare';
  end if;
  if exists (select 1 from statements s where s.period_id = v_period.id and s.source = 'import')
     or exists (select 1 from entries e where e.period_id = v_period.id and e.source = 'import') then
    raise exception 'already_closed' using errcode = 'P0001', detail = 'This month was imported and already has its workbook figures';
  end if;

  -- Every workbook name matches exactly one member, by short or full name, ignoring case and outer spaces.
  select string_agg(n.name, ', ' order by n.name) into v_bad
  from (select distinct lower(trim(r ->> 'name')) as name from jsonb_array_elements(p_bundle -> 'rows') r) n
  where (select count(*) from members x
         where x.group_id = p_group and (lower(x.short_name) = n.name or lower(x.full_name) = n.name)) <> 1;
  if v_bad is not null then
    raise exception 'member_not_found' using errcode = 'P0001', detail = 'No single member matches: ' || v_bad;
  end if;
  if exists (select 1 from jsonb_array_elements(p_bundle -> 'rows') r
             group by lower(trim(r ->> 'name')) having count(*) > 1) then
    raise exception 'invalid_amount' using errcode = 'P0001', detail = 'A member is listed twice';
  end if;
  select jsonb_object_agg(n.name, x.id) into v_map
  from (select distinct lower(trim(r ->> 'name')) as name from jsonb_array_elements(p_bundle -> 'rows') r) n
  join members x on x.group_id = p_group and (lower(x.short_name) = n.name or lower(x.full_name) = n.name);

  perform set_config('ledger.import_reset', 'on', true);
  delete from workbook_figures where period_id = v_period.id;
  perform set_config('ledger.import_reset', 'off', true);

  -- The same four member fields and three group fields the import stores, so close_month's diff reads them unchanged.
  insert into workbook_figures (group_id, period_id, member_id, field, value)
  select p_group, v_period.id, (v_map ->> lower(trim(r ->> 'name')))::uuid, x.field, round(x.value, 2)
  from jsonb_array_elements(p_bundle -> 'rows') r,
       lateral (values ('cum_savings', (r ->> 'cum_savings')::numeric), ('excess_charged', (r ->> 'excess')::numeric),
                       ('closing_owed', (r ->> 'total')::numeric), ('next_minimum', (r ->> 'minimum')::numeric)) as x(field, value)
  where x.value is not null;
  get diagnostics v_rows = row_count;

  insert into workbook_figures (group_id, period_id, member_id, field, value)
  select p_group, v_period.id, null, x.field, round(x.value, 2)
  from (values ('opening_cash', (p_bundle -> 'group' ->> 'opening_cash')::numeric),
               ('idle_cash', (p_bundle -> 'group' ->> 'idle_cash')::numeric),
               ('excess_billed', (p_bundle -> 'group' ->> 'excess_billed')::numeric)) as x(field, value)
  where x.value is not null;

  v_summary := jsonb_build_object(
    'period_id', v_period.id, 'month_index', v_month, 'label', v_period.label, 'status', v_period.status,
    'members', jsonb_array_length(p_bundle -> 'rows'),
    'member_figures', v_rows,
    'group_figures', (select count(*) from workbook_figures w where w.period_id = v_period.id and w.member_id is null));
  perform private.audit(p_group, 'ledger.figures_loaded', 'periods', v_period.id, v_summary - 'period_id');
  return v_summary;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
