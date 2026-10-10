-- Payout preview: what each member would receive if the cycle paid out now (spec §3 Payout and Default).

create or replace function public.payout_preview(p_cycle uuid)
returns table (member_id uuid, short_name text, savings numeric, interest_earned numeric, owed numeric, pot_share numeric, payout numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare v_c cycles; v_period uuid; v_pots numeric;
begin
  select * into v_c from cycles where id = p_cycle;
  if not found or not is_member(v_c.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  -- The month holding the latest figures: the open one, else the last closed one.
  select p.id into v_period from periods p
   where p.cycle_id = p_cycle and p.status <> 'planned'
   order by (p.status = 'open') desc, p.month_index desc
   limit 1;
  -- Whatever is left in the fee pot and the meeting pot is shared equally.
  select coalesce(sum(case when l.kind = 'payout_fee' then -l.amount else l.amount end), 0) into v_pots
    from private.ledger_lines l
   where l.cycle_id = p_cycle and l.kind in ('txn_fee', 'payout_fee', 'membership');

  return query
  with mem as (
    select m.id, m.short_name, row_number() over (order by m.short_name) as rn, count(*) over () as n
    from members m
    where m.group_id = v_c.group_id
      and (m.status = 'active' or exists (select 1 from private.ledger_lines x where x.member_id = m.id and x.cycle_id = p_cycle))
  ),
  fig as (
    select mem.id, mem.short_name,
      coalesce((select sum(l.amount) from private.ledger_lines l
                where l.cycle_id = p_cycle and l.member_id = mem.id and l.kind = 'saving'), 0) as savings,
      coalesce((select sum(l.amount) from private.ledger_lines l
                where l.cycle_id = p_cycle and l.member_id = mem.id and l.kind = 'interest_share'), 0) as interest,
      case when v_period is null then 0 else private.member_balance(mem.id, v_period) end as owed,
      trunc(v_pots / mem.n, 2) + case when mem.rn = 1 then v_pots - trunc(v_pots / mem.n, 2) * mem.n else 0 end as pot_share
    from mem
  )
  select fig.id, fig.short_name, fig.savings, fig.interest, fig.owed, fig.pot_share,
         fig.savings + fig.interest - fig.owed + fig.pot_share
  from fig
  where can_see_figures(v_c.group_id, fig.id)
  order by fig.short_name;
end $$;

revoke execute on function public.payout_preview(uuid) from public, anon, authenticated;
grant execute on function public.payout_preview(uuid) to authenticated;
