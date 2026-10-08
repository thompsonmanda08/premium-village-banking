-- Core tables for groups, members, invites, cycles, cycle rules and the audit log.
-- RLS is enabled on every table here; policies arrive in the next migration.

create extension if not exists pgcrypto with schema extensions;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 120),
  currency text not null default 'ZMW',
  owner_user_id uuid not null references auth.users on delete restrict,
  figures_visibility text not null default 'open' check (figures_visibility in ('open', 'private'))
);
create index groups_owner_idx on public.groups (owner_user_id);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  short_name text not null check (length(trim(short_name)) between 1 and 40),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  user_id uuid references auth.users on delete set null,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'active' check (status in ('active', 'left')),
  joined_on date not null default current_date,
  unique (group_id, user_id),
  unique (group_id, short_name)
);
create index members_user_idx on public.members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users on delete restrict
);
create index invites_member_idx on public.invites (member_id);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  label text not null check (length(trim(label)) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  payout_on date not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'closed')),
  check (ends_on > starts_on),
  check (payout_on <= ends_on)
);
create index cycles_group_idx on public.cycles (group_id, starts_on);

create table public.cycle_rules (
  cycle_id uuid primary key references public.cycles on delete cascade,
  created_at timestamptz not null default now(),
  min_saving numeric(12, 2) not null default 250 check (min_saving >= 0),
  loan_rate numeric(5, 4) not null default 0.15 check (loan_rate between 0 and 1),
  excess_rate numeric(5, 4) not null default 0.10 check (excess_rate between 0 and 1),
  penalty_per_day numeric(12, 2) not null default 50 check (penalty_per_day >= 0),
  membership_fee numeric(12, 2) not null default 50 check (membership_fee >= 0),
  window_open_day int not null default 5 check (window_open_day between 1 and 28),
  window_close_day int not null default 7 check (window_close_day between 1 and 28),
  loan_multiples jsonb not null check (jsonb_typeof(loan_multiples) = 'array'),
  tenor_bands jsonb not null check (jsonb_typeof(tenor_bands) = 'array'),
  check (window_close_day >= window_open_day)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid not null references public.groups on delete cascade,
  actor_user_id uuid references auth.users on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  data jsonb not null default '{}'
);
create index audit_log_group_idx on public.audit_log (group_id, created_at desc);

alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.cycles enable row level security;
alter table public.cycle_rules enable row level security;
alter table public.audit_log enable row level security;
