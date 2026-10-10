-- Declarations: what a member says they are sending. Screens arrive in 2b/2c; the rules live here.

create or replace function public.submit_declaration(
  p_period uuid, p_member uuid, p_saving numeric default 0, p_loan_repayment numeric default 0,
  p_excess numeric default 0, p_membership numeric default 0, p_penalty numeric default 0,
  p_txn_fee numeric default 0, p_borrowing_request numeric default 0, p_wallet uuid default null, p_note text default null)
returns public.declarations
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_m members;
  v_p periods;
  v_old uuid;
  v_sent numeric;
  v declarations;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  -- A member declares for themselves; the treasurer may type in any member's (WhatsApp) declaration.
  -- Anyone else learns nothing, not even whether the member exists.
  select * into v_m from members where id = p_member;
  if not found or not (v_m.user_id is not distinct from v_uid or is_admin(v_m.group_id)) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  select * into v_p from periods where id = p_period and group_id = v_m.group_id;
  if not found or v_p.status <> 'open' then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(array[p_saving, p_loan_repayment, p_excess, p_membership, p_penalty, p_txn_fee,
                                        p_borrowing_request]) as a
             where a is null or a < 0 or a <> round(a, 2)) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  v_sent := p_saving + p_loan_repayment + p_excess + p_membership + p_penalty + p_txn_fee;
  if v_sent = 0 and p_borrowing_request = 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;
  if (v_sent > 0 or p_wallet is not null)
     and not exists (select 1 from wallets w where w.id = p_wallet and w.group_id = v_m.group_id and w.active) then
    raise exception 'wallet_not_found' using errcode = 'P0001';
  end if;

  -- A resubmission replaces the member's waiting or returned declaration. An approved one stays; a new one stands beside it.
  select d.id into v_old from declarations d
   where d.period_id = p_period and d.member_id = p_member and d.status in ('submitted', 'returned')
     and not exists (select 1 from declarations n where n.supersedes_id = d.id)
   order by d.submitted_at desc
   limit 1
   for update;

  insert into declarations (group_id, period_id, member_id, saving, loan_repayment, excess, membership, penalty, txn_fee,
    borrowing_request, wallet_id, note, submitted_by, supersedes_id)
  values (v_m.group_id, p_period, p_member, p_saving, p_loan_repayment, p_excess, p_membership, p_penalty, p_txn_fee,
    p_borrowing_request, p_wallet, nullif(trim(p_note), ''), v_uid, v_old)
  returning * into v;
  return v;
end $$;

create or replace function public.return_declaration(p_declaration uuid, p_reason text)
returns public.declarations
language plpgsql security definer set search_path = public, pg_temp as $$
declare v declarations;
begin
  select * into v from declarations where id = p_declaration for update;
  if not found then raise exception 'declaration_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if v.status <> 'submitted' or exists (select 1 from declarations n where n.supersedes_id = v.id) then
    raise exception 'declaration_not_found' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;

  update declarations set status = 'returned', return_reason = trim(p_reason), decided_at = now(), decided_by = auth.uid()
   where id = v.id returning * into v;
  perform private.audit(v.group_id, 'declaration.returned', 'declarations', v.id,
    jsonb_build_object('member_id', v.member_id, 'reason', v.return_reason));
  return v;
end $$;

create or replace function public.approve_declaration(p_declaration uuid)
returns public.declarations
language plpgsql security definer set search_path = public, pg_temp as $$
declare v declarations; v_status text;
begin
  select * into v from declarations where id = p_declaration for update;
  if not found then raise exception 'declaration_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if v.status <> 'submitted' or exists (select 1 from declarations n where n.supersedes_id = v.id) then
    raise exception 'declaration_not_found' using errcode = 'P0001';
  end if;
  -- FOR SHARE: an approval waits for a close in progress (which locks the month FOR UPDATE), and the close waits for it.
  select status into v_status from periods where id = v.period_id for share;
  if v_status <> 'open' then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if v.saving + v.loan_repayment + v.excess + v.membership + v.penalty + v.txn_fee > 0
     and not exists (select 1 from wallets w where w.id = v.wallet_id and w.group_id = v.group_id and w.active) then
    raise exception 'wallet_not_found' using errcode = 'P0001';
  end if;

  update declarations set status = 'approved', decided_at = now(), decided_by = auth.uid() where id = v.id returning * into v;
  -- Repayment, excess and penalty are one payment: the payment order (excess, penalties, interest, principal)
  -- decides where it goes at month close, not the member's labels.
  insert into entries (group_id, period_id, member_id, kind, amount, wallet_id, source, declaration_id, created_by)
  select v.group_id, v.period_id, v.member_id, x.kind, x.amount, v.wallet_id, 'app', v.id, auth.uid()
  from (values ('saving', v.saving), ('payment', v.loan_repayment + v.excess + v.penalty),
               ('membership', v.membership), ('txn_fee', v.txn_fee)) as x(kind, amount)
  where x.amount > 0;
  perform private.audit(v.group_id, 'declaration.approved', 'declarations', v.id,
    jsonb_build_object('member_id', v.member_id, 'saving', v.saving, 'payment', v.loan_repayment + v.excess + v.penalty,
                       'membership', v.membership, 'txn_fee', v.txn_fee));
  return v;
end $$;

revoke execute on function
  public.submit_declaration(uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, uuid, text),
  public.return_declaration(uuid, text), public.approve_declaration(uuid)
  from public, anon, authenticated;
grant execute on function
  public.submit_declaration(uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, uuid, text),
  public.return_declaration(uuid, text), public.approve_declaration(uuid)
  to authenticated;
