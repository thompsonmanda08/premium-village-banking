-- Proof of payment: a screenshot or PDF a member attaches to a month's declaration. The file itself lives in Cloudflare R2
-- (written and read only by api/proof.ts); this table is the record of what exists and who may see it.

create table public.declaration_proofs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  period_id uuid not null references public.periods on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  object_key text not null unique check (object_key like 'proofs/%'),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes int not null check (size_bytes between 1 and 4194304),
  created_by uuid references auth.users on delete set null
);
create index declaration_proofs_month_idx on public.declaration_proofs (period_id, member_id);

alter table public.declaration_proofs enable row level security;
revoke all on public.declaration_proofs from public, anon, authenticated;
grant select on public.declaration_proofs to authenticated;
-- The member and the treasurer see a member's proofs; in a group that keeps figures open, everyone does, like the declarations.
create policy declaration_proofs_select on public.declaration_proofs for select to authenticated
  using (public.can_see_figures(group_id, member_id));

-- Records a proof the caller is about to upload. A member attaches to their own month; the treasurer to anyone's. At most
-- five per member and month, only while the month is open. The key must sit under the group's own folder.
create or replace function public.add_proof(p_period uuid, p_member uuid, p_key text, p_type text, p_size int)
returns public.declaration_proofs
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_m members; v_p periods; v declaration_proofs;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select * into v_m from members where id = p_member;
  if not found or not ((v_m.user_id = v_uid and v_m.status = 'active') or is_admin(v_m.group_id)) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  select * into v_p from periods where id = p_period and group_id = v_m.group_id;
  if not found or v_p.status <> 'open' then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if p_type is null or p_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    raise exception 'invalid_file' using errcode = 'P0001';
  end if;
  if p_size is null or p_size not between 1 and 4194304 then raise exception 'file_too_large' using errcode = 'P0001'; end if;
  if p_key is null or p_key not like 'proofs/' || v_m.group_id || '/%' then raise exception 'invalid_file' using errcode = 'P0001'; end if;
  -- Serialise attaches for one member, so two phones cannot both slip under the limit.
  perform 1 from members where id = p_member for no key update;
  if (select count(*) from declaration_proofs where period_id = p_period and member_id = p_member) >= 5 then
    raise exception 'too_many_files' using errcode = 'P0001';
  end if;
  insert into declaration_proofs (group_id, period_id, member_id, object_key, content_type, size_bytes, created_by)
  values (v_m.group_id, p_period, p_member, p_key, p_type, p_size, v_uid) returning * into v;
  perform private.audit(v.group_id, 'proof.added', 'declaration_proofs', v.id, jsonb_build_object('member_id', p_member, 'period_id', p_period));
  return v;
end $$;
revoke execute on function public.add_proof(uuid, uuid, text, text, int) from public, anon, authenticated;
grant execute on function public.add_proof(uuid, uuid, text, text, int) to authenticated;

-- Undoes an attach whose upload failed: only its creator, and only within ten minutes.
create or replace function public.remove_proof(p_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from declaration_proofs where id = p_id and created_by = auth.uid() and created_at > now() - interval '10 minutes';
end $$;
revoke execute on function public.remove_proof(uuid) from public, anon, authenticated;
grant execute on function public.remove_proof(uuid) to authenticated;
