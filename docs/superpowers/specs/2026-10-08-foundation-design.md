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

The template's own theme is kept (slate light, zinc dark, indigo accent, Inter) and cleaned up. Persisted as `DESIGN.md` plus `src/styles/tokens.css` during implementation.

### Problems in the template theme

| Problem | Evidence | Fix |
|---|---|---|
| Theme toggle and `dark:` classes disagree | Tailwind CDN runs with the default `darkMode: 'media'`, so ~1,480 `dark:` classes follow the OS, while 8 files switch on React `theme` state (`isLight ? … : …`). Toggling gives a half-light, half-dark screen | One mechanism: `data-theme` on `<html>`, Tailwind v4 `@custom-variant dark ([data-theme=dark] &)`; system by default, per-device override; delete every `isLight` ternary |
| Colours hardcoded per component | 1,000+ raw palette classes (`slate-200`, `zinc-800`, `indigo-500`, `white/5` …) | Components use semantic tokens only (`bg-surface`, `text-muted`, `border-line` …) |
| Muted text fails contrast | `slate-400` on white 2.56:1; `zinc-500` on zinc-900 3.67:1 | Muted text is `slate-600` (7.58:1) / `zinc-400` (6.91:1) |
| Text too small for phones | 262 uses of 9–11px text | Floor of 12px for metadata only; body 16px on phones, 14px dense desktop tables |
| Decorative effects | glow shadows (`shadow-indigo-500/20`, 29×), 60 gradients, glass `backdrop-blur` cards, noise overlay, indigo→purple→emerald logo | Removed. Blur only on sticky bars; flat surfaces; light mode uses `shadow-sm`, dark mode uses borders; solid indigo logo mark |
| Accent drifts | `indigo-400/500/600` and `purple-*` used interchangeably | One accent per mode (below); purple dropped |
| Hairline borders vanish in dark | `zinc-800` on `zinc-900` 1.19:1, `white/5` | Dark borders use `zinc-700` (1.70:1) for structure, `zinc-800` only inside surfaces |

### Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | slate-100 `#F1F5F9` | zinc-950 `#09090B` | app background |
| `surface` | white `#FFFFFF` | zinc-900 `#18181B` | cards, sheets, bars |
| `surface-2` | slate-50 `#F8FAFC` | zinc-800 `#27272A` | insets, table headers, chips |
| `line` | slate-200 `#E2E8F0` | zinc-700 `#3F3F46` | borders, dividers |
| `text` | slate-900 `#0F172A` | zinc-100 `#F4F4F5` | primary text (16.3:1 / 18.1:1) |
| `text-muted` | slate-600 `#475569` | zinc-400 `#A1A1AA` | secondary text (7.6:1 / 6.9:1) |
| `accent` | indigo-600 `#4F46E5` | indigo-400 `#818CF8` | links, active nav, focus ring (6.3:1 / 5.9:1) |
| `accent-solid` | indigo-600 | indigo-600 | filled buttons, white text 6.3:1 in both modes (indigo-500 is only 4.47:1, so it is not used) |
| `accent-soft` | indigo-50 | indigo-500 at 15% | selected rows, active nav pill |
| `success` | emerald-700 `#047857` | emerald-400 `#34D399` | logged, money in, on track (5.5:1 / 9.2:1) |
| `warning` | amber-700 `#B45309` | amber-400 `#FBBF24` | pending, owed, watch (5.0:1 / 10.6:1) |
| `danger` | rose-600 `#E11D48` | rose-400 `#FB7185` | overdue, penalties, destructive (4.7:1 / 6.6:1) |
| `info` | sky-700 | sky-400 | neutral notices |

Each semantic colour has a `-soft` background at 10% (light) / 15% (dark) for badges. Money conventions: savings and earnings in `success`, amounts owed in `warning`, penalties and losses in `danger`.

### Type, shape, motion

- **Type**: Inter (the template's font), weights 400/500/600/700, `font-variant-numeric: tabular-nums` on all figures. Scale: 12 (metadata), 14 (dense desktop tables), 16 (body), 20, 24, 32 (balances). Body ≥16px on phones.
- **Shape**: the template's radii: `rounded-xl` controls, `rounded-2xl` cards, full-pill badges and chips.
- **Motion**: 150–200ms ease-out for state changes; route transitions per §7; all disabled under `prefers-reduced-motion`.
- **Icons**: lucide-react only, never emoji; icon-only buttons carry `aria-label`.
- **Status**: never colour alone; every badge has a text label and a glyph.

## 5. Data model

All tables have `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()` unless noted.

```sql
groups (
  name text not null,
  currency text not null default 'ZMW',
  owner_user_id uuid not null references auth.users,
  figures_visibility text not null default 'open'
    check (figures_visibility in ('open','private'))   -- see §6
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
| groups | `is_member(id)` | update: `is_admin(id)` (includes `figures_visibility`) |
| members | Base table: `is_admin(group_id)` or `user_id = auth.uid()`. Other members read the group list through the view `group_members` (owned by a definer role, filtered by `is_member(group_id)`), which exposes only id, full_name, short_name, role, status and linked (bool), never email, phone or user_id | admins: insert, update name/contact/status. `role` and `user_id` change only via `set_admin` / `accept_invite` (column privileges revoked) |
| invites | `is_admin(group_id)` | via Edge Function / admins; revoke = update `revoked_at` |
| cycles, cycle_rules | `is_member(group_id)` | `is_admin(group_id)`; `cycle_rules` writable only while the cycle is `planned` |
| audit_log | `is_admin(group_id)` | none from clients; written by functions and triggers |

### Figures visibility (transparency now, privacy switch later)

The group currently shares every member's figures, as the workbook and the artifact do. That stays the default.

- `groups.figures_visibility` is `'open'` (default) or `'private'`.
- Foundation adds `can_see_figures(group_id, member_id) → bool` (`stable security definer`): true if the caller is an admin, or the member is the caller, or `figures_visibility = 'open'` and the caller `is_member(group_id)`.
- Every per-member ledger table and view in sub-projects 2–4 uses this function in its select policy, so switching to `'private'` needs no migration or code change. Group totals stay visible to all members in both modes.
- Only admins change the setting, from the gear drawer, with a confirmation step and an `audit_log` entry. Members see a one-line notice of the current mode on the Group screen.
- pgTAP covers both modes: in `'open'` a member reads another member's rows; in `'private'` they read only their own.

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
| `?settings=open` | gear drawer (admins): group details; figures visibility (open / private, with confirmation); admins (promote/demote); members (add, edit, mark left) and invites (send, resend, revoke, status); cycle rules (editable while `planned`) |
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
3. All pgTAP RLS tests pass, including both figures-visibility modes.
4. Lighthouse mobile: performance ≥90, accessibility ≥90; installable PWA; no horizontal scroll at 360px.
5. Production deploy is green, the keep-alive and backup jobs have run, and a restore has been tested.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Free project pauses after 7 idle days | Weekly keep-alive cron (§8) |
| No downloadable backups on the free tier | Nightly encrypted `pg_dump` (§8) |
| Resend free tier: 100 emails/day, 3,000/month | Ample for 18 members; magic links are rate-limited per address by Supabase |
| Members without Google or reliable email | Email + password works without Google; the treasurer can resend invites |
| Switching to private mode upsets members used to transparency | Default stays `open`; the switch is an admin decision, announced in-app, audited, and reversible |
| Only one Supabase project for prod; previews hit prod | Preview test accounts belong to no group, so RLS shows them nothing |
