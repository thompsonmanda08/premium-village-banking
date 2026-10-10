-- Ledger tables (spec §4). Clients get SELECT through RLS and nothing else: every write goes through the
-- security definer functions added by later migrations. entries, statements, group_statements and
-- workbook_figures are append-only (trigger at the end).

-- Composite keys so a ledger row can never point at another group's month, member, loan or wallet.
alter table public.members add constraint members_id_group_key unique (id, group_id);
alter table public.cycles add constraint cycles_id_group_key unique (id, group_id);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  holder_member_id uuid,
  active boolean not null default true,
  unique (group_id, name),
  unique (id, group_id),
  foreign key (holder_member_id, group_id) references public.members (id, group_id)
);

-- One per month of a cycle. All twelve exist from the first open_period (or the import); future months are planned.
create table public.periods (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  cycle_id uuid not null,
  month_index int not null check (month_index between 1 and 12),
  label text not null,
  starts_on date not null,
  deadline date not null,
  status text not null default 'planned' check (status in ('planned', 'open', 'closing', 'closed')),
  closed_at timestamptz,
  closed_by uuid references auth.users on delete set null,
  unique (cycle_id, month_index),
  unique (id, group_id),
  foreign key (cycle_id, group_id) references public.cycles (id, group_id) on delete cascade,
  check (deadline >= starts_on)
);
-- Corrections and loans go into "the" open month, so there is at most one per group.
create unique index periods_one_open_per_group on public.periods (group_id) where status in ('open', 'closing');

create table public.declarations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  period_id uuid not null,
  member_id uuid not null,
  saving numeric(12, 2) not null default 0 check (saving >= 0),
  loan_repayment numeric(12, 2) not null default 0 check (loan_repayment >= 0),
  excess numeric(12, 2) not null default 0 check (excess >= 0),
  membership numeric(12, 2) not null default 0 check (membership >= 0),
  penalty numeric(12, 2) not null default 0 check (penalty >= 0),
  txn_fee numeric(12, 2) not null default 0 check (txn_fee >= 0),
  borrowing_request numeric(12, 2) not null default 0 check (borrowing_request >= 0),
  wallet_id uuid,
  note text check (note is null or length(note) <= 500),
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'returned')),
  submitted_at timestamptz not null default now(),
  submitted_by uuid references auth.users on delete set null,
  decided_at timestamptz,
  decided_by uuid references auth.users on delete set null,
  return_reason text,
  supersedes_id uuid references public.declarations,
  unique (id, group_id),
  foreign key (period_id, group_id) references public.periods (id, group_id),
  foreign key (member_id, group_id) references public.members (id, group_id),
  foreign key (wallet_id, group_id) references public.wallets (id, group_id)
);
-- A resubmission replaces, never edits; two racing resubmissions cannot both replace the same row.
create unique index declarations_supersedes_once on public.declarations (supersedes_id) where supersedes_id is not null;
create index declarations_period_idx on public.declarations (period_id, member_id);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  member_id uuid not null,
  period_id uuid not null,
  principal numeric(12, 2) not null check (principal > 0),
  interest numeric(12, 2) not null check (interest >= 0),
  term_months int not null check (term_months between 1 and 4),
  sent_at timestamptz not null default now(),
  wallet_id uuid,
  cap_warning text,
  arrears_warning text,
  approved_reason text,
  status text not null default 'open' check (status in ('open', 'repaid', 'written_against_payout')),
  unique (id, group_id),
  foreign key (member_id, group_id) references public.members (id, group_id),
  foreign key (period_id, group_id) references public.periods (id, group_id),
  foreign key (wallet_id, group_id) references public.wallets (id, group_id)
);
create index loans_member_idx on public.loans (member_id, sent_at);

create table public.loan_instalments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  loan_id uuid not null,
  period_id uuid not null,
  amount_due numeric(12, 2) not null check (amount_due >= 0),
  unique (loan_id, period_id),
  foreign key (loan_id, group_id) references public.loans (id, group_id) on delete cascade,
  foreign key (period_id, group_id) references public.periods (id, group_id)
);

-- The ledger. Amounts are positive; the kind gives the direction. A correction is a new row pointing at the original.
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  period_id uuid not null,
  member_id uuid,
  kind text not null check (kind in ('saving', 'payment', 'membership', 'txn_fee', 'loan_sent', 'loan_interest',
    'excess_charge', 'penalty', 'interest_share', 'payout_fee', 'waiver', 'adjustment')),
  amount numeric(12, 2) not null check (amount > 0),
  loan_id uuid,
  wallet_id uuid,
  source text not null check (source in ('import', 'app', 'close', 'correction')),
  declaration_id uuid,
  corrects_entry_id uuid references public.entries,
  reason text,
  created_by uuid references auth.users on delete set null,
  foreign key (period_id, group_id) references public.periods (id, group_id),
  foreign key (member_id, group_id) references public.members (id, group_id),
  foreign key (loan_id, group_id) references public.loans (id, group_id),
  foreign key (wallet_id, group_id) references public.wallets (id, group_id),
  foreign key (declaration_id, group_id) references public.declarations (id, group_id),
  check ((source = 'correction') = (corrects_entry_id is not null)),
  check (source <> 'correction' or length(trim(coalesce(reason, ''))) > 0),
  check (kind not in ('waiver', 'adjustment') or source = 'correction')
);
create index entries_period_idx on public.entries (period_id, member_id);
create index entries_loan_idx on public.entries (loan_id) where loan_id is not null;
create index entries_corrects_idx on public.entries (corrects_entry_id) where corrects_entry_id is not null;

create table public.statements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  period_id uuid not null,
  member_id uuid not null,
  opening_owed numeric(12, 2) not null default 0,
  saving numeric(12, 2) not null default 0,
  cum_savings numeric(12, 2) not null default 0,
  loan_principal_sent numeric(12, 2) not null default 0,
  loan_interest_charged numeric(12, 2) not null default 0,
  excess_charged numeric(12, 2) not null default 0,
  penalties_charged numeric(12, 2) not null default 0,
  paid_total numeric(12, 2) not null default 0,
  paid_to_excess numeric(12, 2) not null default 0,
  paid_to_penalties numeric(12, 2) not null default 0,
  paid_to_interest numeric(12, 2) not null default 0,
  paid_to_principal numeric(12, 2) not null default 0,
  closing_owed numeric(12, 2) not null default 0,
  next_minimum numeric(12, 2) not null default 0,
  unpaid_minimum numeric(12, 2) not null default 0,
  interest_earned numeric(12, 2) not null default 0,
  interest_earned_to_date numeric(12, 2) not null default 0,
  source text not null check (source in ('import', 'close')),
  unique (period_id, member_id),
  foreign key (period_id, group_id) references public.periods (id, group_id),
  foreign key (member_id, group_id) references public.members (id, group_id)
);

create table public.group_statements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  period_id uuid not null unique,
  opening_cash numeric(12, 2) not null default 0,
  received numeric(12, 2) not null default 0,
  savings numeric(12, 2) not null default 0,
  loans_sent numeric(12, 2) not null default 0,
  idle_cash numeric(12, 2) not null default 0,
  excess_rate numeric(5, 4) not null,
  excess_billed numeric(12, 2) not null default 0,
  interest_collected numeric(12, 2) not null default 0,
  fee_pot_in numeric(12, 2) not null default 0,
  fee_pot_out numeric(12, 2) not null default 0,
  fee_pot_balance numeric(12, 2) not null default 0,
  meeting_pot_in numeric(12, 2) not null default 0,
  meeting_pot_balance numeric(12, 2) not null default 0,
  total_savings numeric(12, 2) not null default 0,
  total_owed numeric(12, 2) not null default 0,
  source text not null check (source in ('import', 'close')),
  foreign key (period_id, group_id) references public.periods (id, group_id)
);

-- The workbook's own figures, kept for comparison only. Group rows have no member.
create table public.workbook_figures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  period_id uuid not null,
  member_id uuid,
  field text not null check (field in ('cum_savings', 'excess_charged', 'closing_owed', 'next_minimum',
                                       'opening_cash', 'idle_cash', 'excess_billed')),
  value numeric(12, 2) not null,
  unique nulls not distinct (period_id, member_id, field),
  check ((member_id is null) = (field in ('opening_cash', 'idle_cash', 'excess_billed'))),
  foreign key (period_id, group_id) references public.periods (id, group_id),
  foreign key (member_id, group_id) references public.members (id, group_id)
);

create table public.member_status (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  member_id uuid not null,
  cycle_id uuid not null,
  defaulted boolean not null default false,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users on delete set null,
  reason text not null check (length(trim(reason)) > 0),
  unique (member_id, cycle_id),
  foreign key (member_id, group_id) references public.members (id, group_id),
  foreign key (cycle_id, group_id) references public.cycles (id, group_id) on delete cascade
);

-- Append-only ------------------------------------------------------------------------
-- The 2026 import may clear its own rows (source 'import', and the workbook copy) inside private.import_history,
-- which sets the switch for its transaction only. App roles hold no DELETE privilege, so the switch frees nothing for them.
create or replace function public.ledger_append_only() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if TG_OP = 'DELETE' and current_setting('ledger.import_reset', true) = 'on'
     and (TG_TABLE_NAME = 'workbook_figures' or to_jsonb(OLD) ->> 'source' = 'import') then
    return OLD;
  end if;
  raise exception 'append_only' using errcode = 'P0001';
end $$;

create trigger entries_append_only before update or delete on public.entries
  for each row execute function public.ledger_append_only();
create trigger statements_append_only before update or delete on public.statements
  for each row execute function public.ledger_append_only();
create trigger group_statements_append_only before update or delete on public.group_statements
  for each row execute function public.ledger_append_only();
create trigger workbook_figures_append_only before update or delete on public.workbook_figures
  for each row execute function public.ledger_append_only();
revoke execute on function public.ledger_append_only() from public, anon, authenticated;

-- RLS: read only, and only what can_see_figures / is_member / is_admin allow -----------------
alter table public.wallets enable row level security;
alter table public.periods enable row level security;
alter table public.declarations enable row level security;
alter table public.loans enable row level security;
alter table public.loan_instalments enable row level security;
alter table public.entries enable row level security;
alter table public.statements enable row level security;
alter table public.group_statements enable row level security;
alter table public.workbook_figures enable row level security;
alter table public.member_status enable row level security;

revoke all on public.wallets, public.periods, public.declarations, public.loans, public.loan_instalments, public.entries,
  public.statements, public.group_statements, public.workbook_figures, public.member_status from public, anon, authenticated;
grant select on public.wallets, public.periods, public.declarations, public.loans, public.loan_instalments, public.entries,
  public.statements, public.group_statements, public.workbook_figures, public.member_status to authenticated;

create policy wallets_select on public.wallets for select to authenticated using (public.is_member(group_id));
create policy periods_select on public.periods for select to authenticated using (public.is_member(group_id));
create policy group_statements_select on public.group_statements for select to authenticated using (public.is_member(group_id));
create policy declarations_select on public.declarations for select to authenticated
  using (public.can_see_figures(group_id, member_id));
create policy loans_select on public.loans for select to authenticated using (public.can_see_figures(group_id, member_id));
create policy loan_instalments_select on public.loan_instalments for select to authenticated
  using (exists (select 1 from public.loans l where l.id = loan_id and public.can_see_figures(l.group_id, l.member_id)));
create policy statements_select on public.statements for select to authenticated
  using (public.can_see_figures(group_id, member_id));
create policy member_status_select on public.member_status for select to authenticated
  using (public.can_see_figures(group_id, member_id));
-- Group-level entries (pot movements) are the group's, like the group statement.
create policy entries_select on public.entries for select to authenticated
  using (case when member_id is null then public.is_member(group_id) else public.can_see_figures(group_id, member_id) end);
create policy workbook_figures_select on public.workbook_figures for select to authenticated using (public.is_admin(group_id));
