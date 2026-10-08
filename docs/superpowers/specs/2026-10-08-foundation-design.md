# Premium Village Bank — Sub-project 1: Foundation

Date: 2026-10-08
Status: Draft for review

## 1. Context

Premium Village Banking is an 18-member savings group in Zambia (cycle 15 Feb – 15 Feb, payout early February). Today the treasurer runs the group from an Excel workbook and WhatsApp. A single-file claude.ai artifact ("Premium VB member passbook", https://claude.ai/artifact/5BSUm7Nk6cc2HKRMpKW8v9) prototyped the member passbook, monthly declaration, savings projection, treasurer desk, submit → approve → log flow, and group settings. It is the functional reference for this platform.

This repository (`village-banking`) currently holds a Google AI Studio dashboard template (Vite + React 19 + TypeScript, ~12.7k lines of unrelated ERP / EduTech / e-commerce views). It becomes the platform.

### Decisions already made

| Topic | Decision |
|---|---|
| Tenancy | One group (Premium VB) in the UI; schema is multi-group-ready (`group_id` everywhere, RLS by membership) |
| Source of truth | The app becomes the ledger (sub-project 2) |
| Cutover | New cycle starting February 2027. The current cycle finishes in the workbook; its history is imported read-only (sub-project 5) |
| Sign-in | Google, email magic link, and email + password, via Supabase Auth. Invite-only; no self-registration |
| Frontend | Vite + React SPA, installable PWA, deployed on Vercel |
| Backend | Supabase free tier (Postgres, Auth, Edge Functions, Storage) |
| Experience | Mobile-first and app-like for members; the treasurer desk adapts to phone, tablet and desktop |

### Platform roadmap (each sub-project gets its own spec → plan → build)

1. **Foundation** (this spec): clean-up, design system, app shell, auth, core schema, RLS, deploy, CI.
2. **Ledger engine**: declarations, payments, loans and instalments, month close in Postgres, interest sharing, tests against the workbook's Mar–Sep 2026 figures.
3. **Member app**: passbook, record, declaration (submit → approval), projection, group view, proof-of-payment upload.
4. **Treasurer desk**: approval queue, return, loan queue and disbursement, month close, reminders, Excel export.
5. **History and cutover**: import Feb 2026 – Jan 2027 as read-only history, opening balances, go-live checklist.

Target: 1–4 built by December 2026, 5 in January 2027, live for the first declarations on 5 February 2027.

## 2. Goal and scope

**Goal:** a deployed, installable, secure shell that real members can sign in to on their phones, with group membership, roles and rules in Postgres, ready for the ledger to be built on top.

**In scope**
- Repository clean-up and toolchain (Tailwind build, router, data layer, tests).
- Design tokens and the kept UI primitives, retokenised.
- Mobile-first app shell, navigation, PWA.
- Supabase schema for groups, members, invites, cycles, cycle rules, audit log; RLS; pgTAP tests.
- Auth: Google, magic link, email + password, invite acceptance, account page.
- Gear settings: admin roles, members and invites, cycle rules.
- Vercel deploy, GitHub Actions CI, keep-alive, encrypted backups.

**Out of scope (later sub-projects)**
- Any ledger figure: savings, loans, statements, interest, declarations, approvals, projection, exports.
- Proof-of-payment uploads, reminders/notifications, payment integrations.
- A UI for creating or switching between groups.

## 3. Architecture

### Stack

| Concern | Choice |
|---|---|
| Build | Vite 6, TypeScript strict |
| UI | React 19, Tailwind CSS v4 (Vite plugin, replacing the CDN script), lucide-react icons, recharts (kept for later sub-projects) |
| Routing | React Router 7 (data routers, lazy routes) |
| Server state | TanStack Query 5, persisted to IndexedDB for instant reopen |
| Backend client | supabase-js 2 |
| PWA | vite-plugin-pwa (Workbox): app-shell precache, manifest, update prompt |
| Tests | Vitest + Testing Library (unit/component), pgTAP (RLS), Playwright (smoke) |
| Lint | ESLint (typescript-eslint, react-hooks, jsx-a11y) |

### Repository layout after clean-up

```
src/
  app/            router, layouts (AppShell: top bar, bottom nav, sidebar), providers
  features/
    auth/         sign-in, invite acceptance, session guard, account page
    group/        group context, membership + role hooks
    settings/     gear drawer: group, admins, members and invites, rules
    home/ group/ rules/ desk/ passbook/ declare/ plan/ record/   route shells
  ui/             kept primitives (see below) + Sheet, Toast, PageHeader
  lib/            supabase client, query client, format helpers (fmt, zmw, pct, dates)
  styles/         tokens.css, fonts
supabase/
  migrations/     versioned SQL (schema, functions, RLS)
  functions/      invite-member (Edge Function)
  seed.sql        Premium VB group, 18 members, cycle Feb 2027 – Feb 2028 with rules
  tests/          pgTAP
e2e/              Playwright smoke tests
docs/superpowers/ specs and plans
```

### Removed from the template

All of `components/views/*` (Overview, Analytics, DataRecords, ProjectsBoard, ComponentShowcase, ActivityLogs, Settings, LearningCourses, Ecommerce, ErpWorkflow, EduTech), `components/{erp,learning,ecommerce,edutech}/*`, `components/modals/*`, `LoginPage`, `Sidebar`, `UserMenu`, `WelcomeCard`, `StreakCard`, `SupportCard`, `data/*`, unrelated types in `types.ts`, `metadata.json`, the importmap and Tailwind CDN in `index.html`, the Gemini `define` in `vite.config.ts`, and the AI Studio README.

### Kept and retokenised

`ui/` Button, Card, Badge, Modal, Drawer, Tabs, Input, Switch, Dropdown, Avatar, StatCard, ProgressBar, Skeleton, EmptyState, Alert, DataTable, Charts. Every hardcoded zinc / indigo / slate class becomes a token-based class so light and dark come from one source.

## 4. Design system

Carried over from the artifact; persisted with ui-ux-pro-max as `design-system/premium-vb/MASTER.md` during implementation.

- **Colour tokens** (CSS variables, light and dark): `paper` #EEF2EE / #0F1A16, `sheet` #FFFFFF / #16241F, `ink` #132A22 / #E4ECE7, `muted` #5E6F67 / #93A69C, `line` #D3DCD5 / #2A3B34, `malachite` #1D6B4E / #4FB58B, `malachite-soft`, `copper` #B5652A / #E08A4A, `copper-soft`, `red` #A63A2B / #E07A6A. Text on filled malachite uses `paper` (≥4.5:1 in both themes).
- **Type**: Bricolage Grotesque (headings, figures), Instrument Sans (body), tabular figures for money; body ≥16px on phones.
- **Theme**: system by default, with a light/dark override stored per device.
- **Icons**: lucide-react only, never emoji; icon-only buttons carry `aria-label`.
- **Status**: never colour alone; every badge has a text label and a glyph.

## 5. Data model

All tables have `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()` unless noted.

```sql
groups (
  name text not null,
  currency text not null default 'ZMW',
  owner_user_id uuid not null references auth.users
)

members (
  group_id uuid not null references groups,
  full_name text not null,
  short_name text not null,
  email text,
  phone text,
  user_id uuid references auth.users,          -- null until invite accepted
  role text not null default 'member' check (role in ('member','admin')),
  status text not null default 'active' check (status in ('active','left')),
  joined_on date not null default current_date,
  unique (group_id, user_id),
  unique (group_id, short_name)
)

invites (
  group_id uuid not null references groups,
  member_id uuid not null references members,
  email text not null,
  token_hash text not null unique,               -- sha256 of the emailed token
  expires_at timestamptz not null,               -- 14 days
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users
)

cycles (
  group_id uuid not null references groups,
  label text not null,                            -- "Cycle 2027"
  starts_on date not null,
  ends_on date not null,
  payout_on date not null,
  status text not null default 'planned' check (status in ('planned','active','closed'))
)

cycle_rules (
  cycle_id uuid primary key references cycles,
  min_saving numeric(12,2) not null default 250,
  loan_rate numeric(5,4) not null default 0.15,
  excess_rate numeric(5,4) not null default 0.10,
  penalty_per_day numeric(12,2) not null default 50,
  membership_fee numeric(12,2) not null default 50,
  window_open_day int not null default 5,
  window_close_day int not null default 7,
  loan_multiples jsonb not null,   -- [{"from_month":1,"to_month":4,"multiple":3}, ...]
  tenor_bands jsonb not null       -- [{"max":3000,"months":1}, {"max":5000,"months":2}, ...]
)

audit_log (
  group_id uuid not null references groups,
  actor_user_id uuid references auth.users,
  action text not null,            -- 'member.role_changed', 'invite.created', ...
  entity text not null,
  entity_id uuid,
  data jsonb not null default '{}'
)
```

Seed: the Premium VB group, the 18 members (full and short names as in the artifact), and the Feb 2027 cycle in `planned` status with the constitution's rules (loan multiples 3×/2×/1×/0 by cycle month; tenors ≤K3,000 1 month, ≤K5,000 2, <K10,000 3, otherwise 4).

### Functions (all `security definer`, `set search_path = public`)

| Function | Purpose |
|---|---|
| `is_member(group_id) → bool` | caller has an active `members` row with `user_id = auth.uid()` |
| `is_admin(group_id) → bool` | same, with `role = 'admin'`, or caller is `groups.owner_user_id` |
| `accept_invite(token text) → members` | hashes token, checks not expired/accepted/revoked and that the signed-in email matches the invite email (case-insensitive), sets `members.user_id`, marks accepted, audits. Fails if the account is already linked to another member of the group |
| `set_admin(member_id, make_admin bool)` | admins/owner only; refuses to demote the last admin; audits |

The `invite-member` Edge Function (service key held only in Edge Function secrets) verifies the caller is an admin, creates the invite row with a random token, and sends the email through Supabase Auth (`inviteUserByEmail` for new users, a magic link for existing ones) with the link `/invite/<token>`.

## 6. Row-level security

RLS is enabled on every table; there are no policies for `anon`.

| Table | Select | Insert / update / delete |
|---|---|---|
| groups | `is_member(id)` | update: `is_admin(id)` |
| members | Base table: `is_admin(group_id)` or `user_id = auth.uid()`. Other members read the group list through the view `group_members` (owned by a definer role, filtered by `is_member(group_id)`), which exposes only id, full_name, short_name, role, status and linked (bool), never email, phone or user_id | admins: insert, update name/contact/status. `role` and `user_id` change only via `set_admin` / `accept_invite` (column privileges revoked) |
| invites | `is_admin(group_id)` | via Edge Function / admins; revoke = update `revoked_at` |
| cycles, cycle_rules | `is_member(group_id)` | `is_admin(group_id)`; `cycle_rules` writable only while the cycle is `planned` |
| audit_log | `is_admin(group_id)` | none from clients; written by functions and triggers |

Privacy rule carried into later sub-projects: a member reads their own ledger rows and group aggregates; admins read all rows.

## 7. Screens and navigation

### Navigation

| Viewport | Layout |
|---|---|
| Phone (<768px) | Top app bar (title, gear for admins, avatar) + bottom nav. Members: **Home, Passbook, Declare, Plan, More**. Admins: **Home, Passbook, Declare, Desk (badge), More**; Plan moves into More |
| More sheet | My record, Group, Plan (admins), Rules, Account, Theme |
| Tablet / desktop (≥768px) | Left sidebar with all items, content max 1180px |

### Routes

| Route | Foundation behaviour |
|---|---|
| `/sign-in` | Google button, email magic link, email + password, forgot password. Redirects to the return-to path |
| `/invite/:token` | "You're invited to Premium Village Banking as Tafara". Sign in or create a password, then `accept_invite`. Clear messages for expired, revoked, used, or email-mismatch |
| `/` Home | group name, cycle dates, key upcoming dates from `cycle_rules` |
| `/passbook`, `/declare`, `/plan`, `/record` | shells with "Available when the February 2027 cycle opens" empty states |
| `/group` | members list: name, role, linked yes/no |
| `/desk` | admins only; empty state until sub-project 4. Non-admins get a 404-style "not available" screen |
| `/rules` | cycle rules and calendar |
| `?settings=open` | gear drawer (admins): group details; admins (promote/demote); members (add, edit, mark left) and invites (send, resend, revoke, status); cycle rules (editable while `planned`) |
| `/account` | name, email, linked sign-in methods, set/change password, sign out |

Unauthenticated users are redirected to `/sign-in`; authenticated users with no membership see "Your account isn't linked to a group. Ask your treasurer for an invite."

### Mobile feel (members)

- **Installed app**: standalone PWA, theme colour, splash, safe areas, `100dvh`, one-time "Add to home screen" hint after first sign-in.
- **Instant reopen**: query cache persisted to IndexedDB; last-known data renders immediately with a quiet refresh; layout-matching skeletons, no layout shift.
- **Motion**: View Transitions API for route changes (~200ms forward slide/fade, reversed on back); disabled under `prefers-reduced-motion`.
- **Touch**: ≥48px targets, pressed state (scale .97 + tint) on every control, `navigator.vibrate` only for confirmations on Android.
- **Gestures**: pull-to-refresh on lists; phone dialogs are bottom sheets with swipe-down to close; no horizontal swipe on main content; every gesture has a button equivalent.
- **Thumb zone**: primary actions in a sticky bottom bar; money inputs use `inputmode="decimal"` with quick-amount chips.
- **Offline**: banner when offline; money actions disabled with an explanation; no offline writes.

### Admin on phone and tablet (pattern fixed now, filled in sub-project 4)

| Viewport | Desk pattern |
|---|---|
| Phone | Card list + filter chips → full-height review sheet with Approve / Return / Next; sticky "Approve all clean" bar |
| Tablet | Two-pane master/detail; next item loads in place after an action |
| Desktop | Table + review drawer; shortcuts J/K (move), A (approve), R (return) |

### States

Every data view has loading (skeleton), error (message + retry), and empty (next action) states. Toasts confirm actions. Destructive actions (revoke invite, demote admin, mark member left) need a second tap. Postgres/RLS refusals map to plain language ("Only admins can do this"), never raw errors.

## 8. Deploy and operations

- **Vercel**: static SPA; `vercel.json` rewrites to `index.html` and sets CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, and `frame-ancestors 'none'`. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Preview deploy per PR.
- **Supabase**: one free project (prod); local development with the Supabase CLI (Docker). Auth providers: Google (OAuth client in Google Cloud), email magic link, email + password. SMTP via Resend free tier. Redirect URLs: prod domain, Vercel preview pattern, localhost.
- **Migrations**: `supabase/migrations` is the only way to change the schema; applied to prod with `supabase db push` after manual approval in a GitHub Actions environment.
- **Keep-alive**: weekly GitHub Actions cron calls a cheap read on the project so the free tier never pauses.
- **Backups**: nightly GitHub Action runs `pg_dump`, encrypts with `age`, stores as a private artifact (90-day retention). Restore runbook in `docs/ops/restore.md`, tested once before go-live.
- **Preview data**: previews point at prod with dedicated test accounts that belong to no real group, so they see only empty states.

## 9. CI

GitHub Actions on every pull request:
1. `tsc --noEmit`, ESLint, Vitest.
2. `supabase start` + `supabase test db` (pgTAP RLS suite).
3. Playwright smoke against the Vercel preview at 390×844 and 1280×900: sign-in page renders, invite page error states, member vs admin navigation (using seeded test accounts), no horizontal scroll at 360px.

Merge to `main` deploys the frontend to production.

## 10. Testing

- **pgTAP**: one test per policy cell in §6, run as anonymous, outsider (signed in, no membership), member, admin and owner; `accept_invite` (valid, expired, revoked, reused, email mismatch, already linked); `set_admin` (last-admin guard, non-admin caller).
- **Vitest**: format helpers, role/nav selection (member vs admin tabs), route guards, error-message mapping.
- **Playwright**: the smoke flows in §9.
- **Manual**: sign-in with each of the three methods on a real Android phone and an iPhone; install as PWA on both.

## 11. Success criteria

1. An invited member signs in on a phone with each of the three methods and is linked to the right member.
2. The owner promotes an admin; the admin sees Desk in the bottom nav and the gear; a member sees neither, and a member's attempt to call `set_admin` or write `cycle_rules` is refused by Postgres.
3. All pgTAP RLS tests pass.
4. Lighthouse mobile: performance ≥90, accessibility ≥90; installable PWA; no horizontal scroll at 360px.
5. Production deploy is green, the keep-alive and backup jobs have run, and a restore has been tested.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Free project pauses after 7 idle days | Weekly keep-alive cron (§8) |
| No downloadable backups on the free tier | Nightly encrypted `pg_dump` (§8) |
| Resend free tier: 100 emails/day, 3,000/month | Ample for 18 members; magic links are rate-limited per address by Supabase |
| Members without Google or reliable email | Email + password works without Google; the treasurer can resend invites |
| Privacy change from the artifact (members no longer see each other's figures) | Group-level aggregates stay visible; confirm with the group before cutover |
| Only one Supabase project for prod; previews hit prod | Preview test accounts belong to no group, so RLS shows them nothing |
