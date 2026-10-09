# Premium Village Bank — Ledger Engine and 2026 Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Money tables, one month-close function, corrections, default handling and an import of Feb–Oct 2026 from the treasurer's workbooks, proven correct by pgTAP tests on synthetic data and by a local comparison against the real workbooks, plus one admin "ledger check" page.

**Architecture:** Every figure lives in Postgres. Ten new tables are readable through RLS and writable by nobody but `security definer` functions; four of them are append-only by trigger. One private function, `private.close_figures`, computes a month (cash, excess split, payment order, interest sharing, statements); `close_month` previews and commits with it, the 2026 import closes each imported month with it (taking the workbook's own excess and minimums), and `ledger:check` replays imported months through it to list differences with reason codes. The import script only reads cells (exceljs, dev dependency) and hands a JSON bundle to `private.import_history`, which does all the maths in SQL. The React app gains one read-only page that calls `ledger_check`.

**Tech Stack:** Bun 1.4, Postgres 15+ (Supabase), plpgsql, pgTAP, postgres.js 3, exceljs 4 (dev only), Vite 6.4, React 19.2, TypeScript 5.8 (strict), Tailwind CSS 4, React Router 7, TanStack Query 5, supabase-js 2, Vitest 3 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-10-ledger-engine-design.md` (read it before starting; this plan argues from it). Domain detail for Tasks 11 and 15 is in the git-ignored `data/private/workbook-model.md` and `data/private/rules-from-sources.md`; read them, never copy figures, names or phone numbers from them into a committed file.

## Global Constraints

From the spec (verbatim):

- "Amounts: Kept to the ngwee (2 dp, `numeric(12,2)`). Members pay what they pay; differences carry forward. No rounding, no write-offs."
- "All tables: `id uuid` PK, `group_id`, `created_at`; RLS enabled; `revoke all … from public, anon, authenticated`, then explicit grants (Foundation pattern). Clients have **no insert/update/delete** on any table here; every write goes through the functions in §6."
- "`entries`, `statements`, `group_statements` and `workbook_figures` are immutable: a trigger rejects UPDATE and DELETE (the import's own re-run, §7, deletes only its own `source='import'` rows inside its transaction, before November opens)."
- "Corrections after a period closes go into the **current open period** as entries pointing back at the original; balances fix forward and closed history is never rewritten."
- "Determinism: the same inputs always produce the same statements; preview and commit share one code path."
- "All `security definer`, `search_path = public, pg_temp`, admin-only unless stated, audited (`audit_log` actions in parentheses), errors as P0001 business codes mapped by `friendlyError`."
- "Every function in §6 checks the caller and the group itself, re-validates inputs in SQL, and revokes execute from `public, anon` (the 02_rls allowlist test must keep passing; `submit_declaration` is granted to `authenticated` and checks the caller owns the member row)."
- "Money maths only in SQL. The client never computes a figure that is stored."
- "The import connects with the database URL and refuses the production project unless `--target` names it; `db:reset`/`db:test` guards stay as they are."
- "No member figures, names beyond those already in the Foundation seed, or phone numbers appear in this spec, in tests, or anywhere committed."
- "Reads the workbooks with a maintained xlsx reader added as a **dev dependency**; it never runs in the browser bundle."

Still binding from the Foundation plan:

- Package manager is **Bun** (`bun.lock` is committed). Never commit `package-lock.json` or `yarn.lock`.
- TypeScript runs with `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`.
- Colour only through semantic tokens (`bg-canvas`, `bg-surface`, `bg-surface-2`, `border-line`, `text-fg`, `text-muted`, `text-accent`, `bg-accent-solid`, `text-on-accent`, `bg-accent-soft`, `text-success|warning|danger|info`, `bg-*-soft`, `bg-scrim`). `scripts/check-tokens.mjs` fails CI on raw palette classes, `isLight`, `dark:` colour variants, gradients, or text under 12px.
- Touch targets: primary controls `h-12` (48px); nothing interactive under 44px. Type 12px minimum (metadata only), `tabular-nums` (`tabular`) on figures. Money format through `money()`/`zmw()` in `src/lib/format.ts`.
- Every SQL `security definer` function sets `search_path = public, pg_temp` (`05_hardening.sql` checks the exact string) and calls `auth.uid()` fully qualified or through `is_admin`/`is_member`/`can_see_figures`.
- SQL business errors are raised with `errcode = 'P0001'` and the message set to an exact code (the Foundation list plus the codes in Task 10). Permission errors use `errcode = '42501'` (`not_admin`, `not_signed_in`).
- User-facing error text comes only from `friendlyError()` in `src/lib/errors.ts`.
- The Supabase service-role key exists only in Edge Function secrets and GitHub Actions secrets — never in `VITE_*` variables or browser code. The ledger scripts use `SUPABASE_DB_URL` from `.env.local`, which is never `VITE_`-prefixed.
- Commit messages: conventional prefix (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `ci:`), and **no `Co-Authored-By` trailer** (the user's global CLAUDE.md forbids it).
- Tests and fixtures use **synthetic data only** (made-up people and amounts). `data/content/` and `data/private/` are never committed (`.gitignore` already covers them and `*.xlsx`); `git status` must show nothing under `data/` before every commit.
- Work on branch `feat/ledger-engine` (created from `spec/ledger-engine`). Do not commit to `main`.
- `bun run db:test` runs against the development database from Task 0 (never production: `PROD_PROJECT_REF` must be set). CI runs it on its own local stack.
- Migrations are numbered after `20261009000600`, one per task that adds schema or functions; never edit a migration once it has been applied to production.

## Review Focus

Five ways this can hurt a real member that no ordinary happy-path test would catch. Each has its own test in the task named.

1. **A month closed twice concurrently** (two treasurers tap "Close" on two phones): both must not write statements and excess entries. `close_month` locks the period row `FOR UPDATE` before anything else, re-checks `closed`, and `statements`/`group_statements` have unique keys as a backstop. Pinned by the `already_closed` and duplicate-statement (`23505`) tests in **Task 6**.
2. **A correction to a closed month** (Ann's February saving was K1,100, not K1,000, noticed in April): the February and March statements must not change, and April must carry the K100. Pinned by the closed-month correction test in **Task 6** (functions from Task 5).
3. **Ngwee remainders not summing** (29.90 split over 19 members): the shares must add up to the excess billed and the interest collected exactly, and instalments to principal + interest. Pinned by the share-sum tests in **Task 6** and the instalment test in **Task 4**.
4. **A member with zero cumulative savings in the share split** (Zed joined and never saved): no division by zero, no excess billed, no interest share, and the remainder still goes to the largest saver. Pinned by the Zed tests in **Task 6**.
5. **A loan sent when lending cash is short** (Dee asks for K300 when K299 is left; two sends at once): refused with `insufficient_cash`, and sends are serialised by a row lock on the open period. Pinned by the cash tests in **Task 4**.

## Decisions this plan adds to the spec

Each one resolves a gap or ambiguity in the spec; each is cheap to revisit.

- **Period status `planned`.** All 12 periods of a cycle exist from the first `open_period` (or the import); future months are `planned`. That lets `loan_instalments` point at future months and lets the import leave November `planned` (the re-run guard is "November is not `open`"). `open_period` flips `planned` → `open`; a partial unique index allows one open month per group. Nothing in 2a sets `closing`; the value stays in the check for 2b.
- **`close_month(p_period, p_commit, p_reason)`**: a third, optional argument, because "committing a close with `unexplained` differences requires a reason" needs somewhere to put it. It is stored in the `period.closed` audit row.
- **`send_loan(…, p_fee)`**: an optional transfer fee, written as a group-level `payout_fee` entry, because the fee pot pays loan transfer fees and 2a has no other way to record one.
- **`submit_declaration` also accepts an admin** entering a member's declaration (the spec's November fallback has the treasurer enter WhatsApp declarations). Anyone else gets `member_not_found`.
- **Payment allocation keeps no per-loan balances.** Payments always clear the oldest loan first, so the cumulative amounts paid to interest and to principal fill the member's loans in order of sending; `close_figures` derives each loan's remaining balance from that. "Principal oldest loan first, then early principal oldest first" is one pass.
- **Charges before payments** (spec step order 3 then 4): a payment made in month *t* can clear month *t*'s excess. Totals owed are the same either way; only the bucket split, and so the interest collected, depends on it.
- **Corrections are deltas.** `post_correction` writes the difference between the new amount and the entry's current effective amount: an increase as an entry of the same kind, a decrease as `adjustment`. `post_waiver` writes `waiver` against a charge only (`loan_interest`, `excess_charge`, `penalty`). Both always point at the original entry, never at another correction. A waived loan keeps its schedule; each instalment asked for is capped at what the loan still owes.
- **The import's maths is SQL** (`private.import_history`), shared with the close: each imported month is closed by `close_figures` in "imported" mode, which takes the workbook's excess shares and minimums as the official record and computes everything else (payment split, interest earned Feb–Oct under the §3 rule, pots). Lending cash follows the app's model (loan fees from the fee pot), so the workbook's idle cash from April on differs by the fees, explained as `fee_pot_vs_cash`.
- **The `Interest ` sheet is not imported.** Its pooled projection uses a different method that no reason code covers; the parser uses its cumulative-savings columns only as a cross-check of the column mapping.
- **Rebuilt schedules start in the month after November.** The workbook's October minimum is the official ask for the November window, so every loan still owed after the last imported month *L* gets equal instalments of its remaining balance from month *L*+2 to its original last month (at least one). Earlier instalments stay as §3 schedules so replays have something to compare.
- **Compared fields and reason rules are fixed** (Task 7): members `cum_savings`, `excess_charged`, `closing_owed`, `next_minimum`; group `opening_cash`, `idle_cash`, `excess_billed`. Each difference gets the first matching code; anything else is `unexplained`.
- **Extra business codes** beyond the spec's list: `already_opened` (named in spec §7), `invalid_amount`, `invalid_date`, `wallet_not_found`, `declaration_not_found`, `append_only`.
- **Synthetic group:** 18 savers plus Zed, who never saves. Patterns are spread over February–April of app operation (and a late-cycle jump for months 10–12) rather than nine imported months, so every expected figure can be worked by hand in a comment. The import is tested with a three-member, two-month bundle.
- **`ledger_check(p_group)`**: a read-only admin function (not in spec §6) that returns every non-planned month's group statement and difference list for the page; `ledger:check` calls the same `private.check_cycle`.
- **Wallets** Airtel and MTN are created by the import; wallet management belongs to 2b.
- **Penalty suggestions:** late declaration = per-day rate × days late; missed minimum and saving under the minimum each suggest the per-day rate once (K50). The treasurer decides.
- **Default status is read at close time**, not stored per month.
- **Comparing November onward** with the parallel workbook (loading its figures after November opens) is not in 2a.
- **`04_bootstrap.sql`** renames the seeded Premium VB group inside its transaction instead of deleting it, because a group with ledger entries cannot be deleted any more.

---

## File Structure

```
supabase/migrations/20261010000700_ledger_tables.sql            tables, composite keys, append-only trigger, RLS, grants
supabase/migrations/20261010000800_ledger_periods.sql           private.audit, private.ledger_lines, private.ensure_periods, open_period, set_deadline
supabase/migrations/20261010000900_ledger_declarations.sql      submit_declaration, return_declaration, approve_declaration
supabase/migrations/20261010001000_ledger_loans.sql             private.schedule_loan, private.lending_cash, private.member_balance, send_loan
supabase/migrations/20261010001100_ledger_penalties_corrections.sql  apply_penalty, suggest_penalties, set_default, post_correction, post_waiver
supabase/migrations/20261010001200_ledger_close.sql             private.close_figures, private.write_close, close_month
supabase/migrations/20261010001300_ledger_diff_check.sql        private.close_diff, private.check_cycle, close_month (with diff), ledger_check
supabase/migrations/20261010001400_ledger_payout.sql            payout_preview
supabase/migrations/20261010001500_ledger_import.sql            private.import_history
supabase/tests/database/00_ledger_helpers.sql                   synthetic ledger group and test helpers
supabase/tests/database/04_bootstrap.sql                        (modify) rename instead of delete
supabase/tests/database/06_ledger_tables.sql … 15_ledger_security.sql
scripts/ledger-workbook.mjs(+test)                              workbook → import bundle (exceljs)
scripts/ledger-import.mjs(+test)                                bun run ledger:import
scripts/ledger-check.mjs                                        bun run ledger:check
scripts/seed-guard.mjs(+test)                                   (modify) importRefusal
src/lib/errors.ts(+test)                                        (modify) ledger business codes
src/lib/database.types.ts                                       regenerated
src/features/desk/useLedgerCheck.ts                             query hook
src/features/desk/LedgerCheckPage.tsx(+test)                    /desk/ledger-check
src/features/desk/DeskPage.tsx(+test)                           (modify) link to the check page
src/app/router.tsx                                              (modify) route
eslint.config.js                                                (modify) exceljs banned in src/
package.json, bun.lock                                          exceljs dev dependency, ledger scripts
README.md, SECURITY.md                                          (modify) dev database, ledger commands, ledger rules
```

---

### Task 0: A development database (prerequisite, no code)

The hosted Supabase project is production and holds real data. `bun run db:test` and `bun run db:reset` refuse it (`PROD_PROJECT_REF`), and this machine has no Docker yet. Every later task runs `bun run db:test` against a development database; set one up first. Pick **one** option.

**Interfaces:**
- Consumes: `.env.example`, `scripts/seed-guard.mjs` guards.
- Produces: `.env.local` with `SUPABASE_DB_URL` (and `SUPABASE_PROJECT_REF` for option b) pointing at a development database, `PROD_PROJECT_REF` set to production; `bun run db:test` green on it.

- [ ] **Step 1: Make sure the production guard is armed**

`.env.local` must contain `PROD_PROJECT_REF=<the production project ref>` (the subdomain of the production project URL). Without it the guards do nothing.

- [ ] **Step 2 (option a): Docker and the local stack**

```bash
# Docker Engine for Ubuntu (https://docs.docker.com/engine/install/ubuntu/), then run docker without sudo
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"     # then log out and back in
docker run --rm hello-world         # Expected: "Hello from Docker!"
bun run db:start                    # first run downloads images; prints API URL, DB URL and keys
```

In `.env.local`: `SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`, `VITE_SUPABASE_URL=http://127.0.0.1:54321`, `VITE_SUPABASE_ANON_KEY=<anon key from bun x supabase status>`. Keep `SUPABASE_PROJECT_REF` as it is (types for option a come from the local stack, Task 10). Migrations apply with `bun run db:reset` (local only; it also loads `supabase/seed.sql`, which creates the Premium VB group with the 18 short names the import matches).

- [ ] **Step 2 (option b): a second free Supabase project as "dev"**

1. Supabase dashboard → New project → name `pvb-dev`, same organisation and region as production, a new strong database password. (Free projects pause after a week idle; restore from the dashboard.)
2. Note its ref (the subdomain of its URL). In `.env.local` set `SUPABASE_DB_URL` to the dev project's **Session pooler** URL (Dashboard → Connect), `SUPABASE_PROJECT_REF=<dev ref>`, `SUPABASE_DB_PASSWORD=<dev password>`, and `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` to the dev project's values. Leave `PROD_PROJECT_REF=<production ref>`.
3. Check the URL is not production before anything else:
   ```bash
   bun -e "const u=process.env.SUPABASE_DB_URL??'', p=process.env.PROD_PROJECT_REF; console.log(p && !u.toLowerCase().includes(p.toLowerCase()) ? 'dev ok' : 'STOP: production URL or PROD_PROJECT_REF unset')"
   ```
   Expected: `dev ok`.
4. Apply the existing migrations: `bun run db:push`. Expected: the six Foundation migrations listed as applied.
5. For Task 15 only: Dashboard → Authentication → Add user (your own email), copy its user id, then in the dev SQL editor run `select private.bootstrap_premium_vb('<that user id>');`.
6. Later migrations apply with `bun run db:push`; to start the dev database over, `bun run db:reset -- --allow-hosted` (it refuses production whatever you pass).

- [ ] **Step 3: Run the suite**

```bash
bun run db:test
```
Expected:
```
00_helpers.sql .. ok
01_schema.sql .. ok
02_rls.sql .. ok
03_invites_admins.sql .. ok
04_bootstrap.sql .. ok
05_hardening.sql .. ok
```

Nothing to commit. CI keeps running the suite on its own local stack (`.github/workflows/ci.yml`, job `db`).

---

### Task 1: Ledger tables, append-only trigger, RLS and grants

**Files:**
- Create: `supabase/migrations/20261010000700_ledger_tables.sql`, `supabase/tests/database/00_ledger_helpers.sql`, `supabase/tests/database/06_ledger_tables.sql`
- Modify: `supabase/tests/database/04_bootstrap.sql`

**Interfaces:**
- Consumes: `public.is_member`, `public.is_admin`, `public.can_see_figures`, `private.create_cycle`, `tests.fixture()` and friends from `00_helpers.sql`.
- Produces: tables `wallets`, `periods`, `declarations`, `loans`, `loan_instalments`, `entries`, `statements`, `group_statements`, `workbook_figures`, `member_status` (columns as in the migration); unique keys `members (id, group_id)` and `cycles (id, group_id)`; trigger function `public.ledger_append_only()` (honours `set_config('ledger.import_reset', 'on', true)` for `source = 'import'` rows and `workbook_figures` only); test helpers `tests.ledger_fixture()`, `tests.lm(short_name) → uuid`, `tests.lp(month_index) → uuid`, `tests.plain() → text[]`, `tests.ledger_pay(member, month, saving, payment, membership, txn_fee)`, `tests.ledger_jump(month)`, `tests.keep(name, jsonb)`, `tests.kept(name)`, `tests.fig(name, member, field)`, `tests.gfig(name, field)`. Ids remembered: `lg` (group), `lcycle` (cycle "Ledger 2026", Feb 2026–Jan 2027, constitution rules, active), `lm_<name>` (members), `w_airtel`, `w_mtn`, `w_old` (inactive), `w_g2` (Other Group's wallet).

- [ ] **Step 1: Write the test helpers**

`supabase/tests/database/00_ledger_helpers.sql`:
```sql
-- Ledger test helpers: a synthetic group of made-up people and amounts (no real member data).
-- Sorted after 00_helpers.sql and, like it, run outside a transaction; db-test.mjs drops schema `tests` after the run.

-- "Ledger Group": 18 savers and Zed, who joined and never saves. Ann is the treasurer (admin, account `admin`),
-- Ben and Cid are linked to the accounts `member` and `other`. The owner account owns the group without a member row.
-- Cycle "Ledger 2026" runs Feb 2026 – Jan 2027 with the constitution's rules; its 12 periods start planned.
create or replace function tests.ledger_fixture() returns void
language plpgsql security definer set search_path = public, tests as $$
declare g uuid; c uuid; v uuid; n text;
begin
  perform tests.fixture();
  insert into groups (name, owner_user_id) values ('Ledger Group', tests.id('owner')) returning id into g;
  perform tests.remember('lg', g);
  foreach n in array array['Ann', 'Ben', 'Cid', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jon', 'Kim', 'Lee', 'Max', 'Ned',
                           'Oli', 'Pam', 'Quin', 'Roy', 'Zed'] loop
    insert into members (group_id, full_name, short_name) values (g, n || ' Test', n) returning id into v;
    perform tests.remember('lm_' || lower(n), v);
  end loop;
  update members set user_id = tests.id('admin'), role = 'admin', email = 'admin@test.local' where id = tests.id('lm_ann');
  update members set user_id = tests.id('member'), email = 'member@test.local' where id = tests.id('lm_ben');
  update members set user_id = tests.id('other'), email = 'other@test.local' where id = tests.id('lm_cid');

  c := private.create_cycle(g, 'Ledger 2026', date '2026-02-15', date '2027-02-15', date '2027-02-06');
  update cycles set status = 'active' where id = c;
  perform tests.remember('lcycle', c);
  insert into periods (group_id, cycle_id, month_index, label, starts_on, deadline)
  select g, c, i, to_char(m, 'Mon YYYY'), m, m + 6
  from generate_series(1, 12) as i
  cross join lateral (select (date '2026-02-01' + (i - 1) * interval '1 month')::date as m) x;

  insert into wallets (group_id, name, holder_member_id) values (g, 'Airtel', tests.id('lm_ann')) returning id into v;
  perform tests.remember('w_airtel', v);
  insert into wallets (group_id, name) values (g, 'MTN') returning id into v;
  perform tests.remember('w_mtn', v);
  insert into wallets (group_id, name, active) values (g, 'Old SIM', false) returning id into v;
  perform tests.remember('w_old', v);
  insert into wallets (group_id, name) values (tests.id('group2'), 'Other Airtel') returning id into v;
  perform tests.remember('w_g2', v);
end $$;

create or replace function tests.lm(p_short text) returns uuid language sql stable as $$
  select tests.id('lm_' || lower(p_short))
$$;

-- tests.lp(2) is the ledger cycle's March 2026 period.
create or replace function tests.lp(p_month int) returns uuid
language sql stable security definer set search_path = public, tests as $$
  select id from periods where cycle_id = tests.id('lcycle') and month_index = p_month
$$;

-- The twelve savers with no loans, no penalties and no surprises.
create or replace function tests.plain() returns text[] language sql immutable as $$
  select array['Gus', 'Hal', 'Ivy', 'Jon', 'Kim', 'Lee', 'Max', 'Ned', 'Oli', 'Pam', 'Quin', 'Roy']
$$;

-- What an approved declaration writes, without the declaration (approval has its own tests in 08).
create or replace function tests.ledger_pay(p_member text, p_month int, p_saving numeric, p_payment numeric,
  p_membership numeric default 0, p_txn_fee numeric default 0) returns void
language plpgsql security definer set search_path = public, tests as $$
begin
  insert into entries (group_id, period_id, member_id, kind, amount, wallet_id, source, created_by)
  select tests.id('lg'), tests.lp(p_month), tests.lm(p_member), x.kind, x.amount, tests.id('w_airtel'), 'app', tests.id('admin')
  from (values ('saving', p_saving), ('payment', p_payment), ('membership', p_membership), ('txn_fee', p_txn_fee)) as x(kind, amount)
  where x.amount > 0;
end $$;

-- Skip ahead: every earlier month closed (without statements), this one open.
create or replace function tests.ledger_jump(p_month int) returns void
language sql security definer set search_path = public, tests as $$
  update periods set status = 'closed', closed_at = now() where cycle_id = tests.id('lcycle') and month_index < p_month;
  update periods set status = 'open' where cycle_id = tests.id('lcycle') and month_index = p_month;
$$;

-- Keep a jsonb result (a close preview) between statements, whatever role is active.
create table if not exists tests.kept_json (name text primary key, v jsonb not null);
create or replace function tests.keep(p_name text, p_v jsonb) returns jsonb
language sql security definer set search_path = tests as $$
  insert into tests.kept_json values (p_name, p_v) on conflict (name) do update set v = excluded.v returning v
$$;
create or replace function tests.kept(p_name text) returns jsonb
language sql stable security definer set search_path = tests as $$
  select v from tests.kept_json where name = p_name
$$;
create or replace function tests.fig(p_name text, p_member text, p_field text) returns numeric language sql stable as $$
  select (m ->> p_field)::numeric from jsonb_array_elements(tests.kept(p_name) -> 'members') m where m ->> 'short_name' = p_member
$$;
create or replace function tests.gfig(p_name text, p_field text) returns numeric language sql stable as $$
  select (tests.kept(p_name) -> 'group' ->> p_field)::numeric
$$;

-- Later tasks add helpers above this line.

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select pass('ledger test helpers installed');
select * from finish();
```

- [ ] **Step 2: Write the failing tests**

`supabase/tests/database/06_ledger_tables.sql`:
```sql
begin;
select * from no_plan();
select tests.ledger_fixture();

-- tables and RLS ------------------------------------------------------------------
select has_table('public', t, t || ' exists')
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
select ok((select relrowsecurity from pg_class where oid = ('public.' || t)::regclass), 'RLS is enabled on ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;

-- privileges: clients read through RLS and write nothing ---------------------------
select ok(has_table_privilege('authenticated', 'public.' || t, 'SELECT'), 'authenticated can read ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
select ok(not has_any_column_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,REFERENCES')
          and not has_table_privilege('authenticated', 'public.' || t, 'DELETE,TRUNCATE,TRIGGER'),
  'authenticated cannot write ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
select ok(not has_any_column_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,REFERENCES')
          and not has_table_privilege('anon', 'public.' || t, 'DELETE,TRUNCATE,TRIGGER'),
  'anon holds no privilege on ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
select ok(not has_function_privilege(r, 'public.ledger_append_only()', 'EXECUTE'), r || ' cannot execute ledger_append_only')
from unnest(array['anon', 'authenticated']) as r;

-- sample rows, written as the migration role (as the definer functions will) -----
insert into entries (group_id, period_id, member_id, kind, amount, wallet_id, source) values
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'saving', 500, tests.id('w_airtel'), 'app'),
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'saving', 1, null, 'import'),
  (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 'saving', 700, tests.id('w_airtel'), 'app'),
  (tests.id('lg'), tests.lp(1), null, 'payout_fee', 10, null, 'app');
insert into statements (group_id, period_id, member_id, closing_owed, source) values
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 100, 'close'),
  (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 200, 'close');
insert into group_statements (group_id, period_id, idle_cash, excess_rate, source)
  values (tests.id('lg'), tests.lp(1), 1000, 0.10, 'close');
insert into workbook_figures (group_id, period_id, member_id, field, value) values
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'closing_owed', 100),
  (tests.id('lg'), tests.lp(1), null, 'idle_cash', 990);
with l as (insert into loans (group_id, member_id, period_id, principal, interest, term_months)
           values (tests.id('lg'), tests.lm('Ben'), tests.lp(1), 1000, 150, 1) returning id)
select tests.remember('loan_ben', id) from l;
insert into loan_instalments (group_id, loan_id, period_id, amount_due)
  values (tests.id('lg'), tests.id('loan_ben'), tests.lp(2), 1150);
insert into member_status (group_id, member_id, cycle_id, defaulted, reason)
  values (tests.id('lg'), tests.lm('Cid'), tests.id('lcycle'), true, 'synthetic default');
insert into declarations (group_id, period_id, member_id, saving, wallet_id, submitted_by) values
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 500, tests.id('w_airtel'), tests.id('member')),
  (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 700, tests.id('w_airtel'), tests.id('other'));

-- integrity -----------------------------------------------------------------------
select throws_ok($$insert into entries (group_id, period_id, kind, amount, source)
  values (tests.id('group2'), tests.lp(1), 'saving', 1, 'app')$$, '23503', null, 'an entry cannot point at another group''s month');
select throws_ok($$insert into entries (group_id, period_id, member_id, kind, amount, source)
  values (tests.id('lg'), tests.lp(1), tests.id('m_g2'), 'saving', 1, 'app')$$, '23503', null, 'an entry cannot point at another group''s member');
select throws_ok($$insert into entries (group_id, period_id, member_id, kind, amount, source)
  values (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'saving', 0, 'app')$$, '23514', null, 'entry amounts are positive');
select throws_ok($$insert into entries (group_id, period_id, member_id, kind, amount, source)
  values (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'waiver', 5, 'app')$$, '23514', null, 'a waiver only exists as a correction');
select throws_ok($$insert into entries (group_id, period_id, member_id, kind, amount, source, corrects_entry_id)
  select tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'saving', 5, 'correction', id from entries where amount = 500$$,
  '23514', null, 'a correction needs a reason');
select throws_ok($$insert into statements (group_id, period_id, member_id, source)
  values (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'close')$$, '23505', null, 'one statement per member per month');
select throws_ok($$insert into workbook_figures (group_id, period_id, member_id, field, value)
  values (tests.id('lg'), tests.lp(1), null, 'idle_cash', 1)$$, '23505', null, 'one workbook figure per field, group rows included');
update periods set status = 'open' where id = tests.lp(1);
select throws_ok($$update periods set status = 'open' where id = tests.lp(2)$$, '23505', null, 'one open month per group');
update periods set status = 'planned' where id = tests.lp(1);

-- reads by role -------------------------------------------------------------------
select tests.login_anon();
select throws_ok('select count(*) from ' || t, '42501', null, 'anon cannot read ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
reset role;

select tests.login_as(tests.id('outsider'));
select results_eq('select count(*)::int from ' || t, 'values (0)', 'outsider reads no ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
reset role;

-- figures open (the default): a member reads the whole group's ledger, never the workbook copy
select tests.login_as(tests.id('member'));
select is((select count(*)::int from entries), 4, 'member reads every entry, group-level ones included');
select is((select count(*)::int from statements), 2, 'member reads every statement');
select is((select count(*)::int from declarations), 2, 'member reads every declaration');
select is((select count(*)::int from member_status), 1, 'member reads default flags');
select is((select count(*)::int from loans), 1, 'member reads loans');
select is((select count(*)::int from loan_instalments), 1, 'member reads instalments');
select is((select count(*)::int from periods), 12, 'member reads the months');
select is((select count(*)::int from wallets), 3, 'member reads the wallets');
select is((select count(*)::int from group_statements), 1, 'member reads the group statement');
select is((select count(*)::int from workbook_figures), 0, 'members never read the workbook copy');
reset role;

-- figures private: own rows plus group-level ones
update groups set figures_visibility = 'private' where id = tests.id('lg');
select tests.login_as(tests.id('member'));
select is((select count(*)::int from entries), 3, 'private: own entries and group-level ones');
select is((select count(*)::int from statements), 1, 'private: own statement only');
select is((select count(*)::int from declarations), 1, 'private: own declaration only');
select is((select count(*)::int from member_status), 0, 'private: not another member''s default flag');
select is((select count(*)::int from loans), 1, 'private: own loan');
select is((select count(*)::int from loan_instalments), 1, 'private: own instalments');
select is((select count(*)::int from group_statements), 1, 'private: the group statement is still the group''s');
reset role;
select tests.login_as(tests.id('other'));
select is((select count(*)::int from loans), 0, 'private: not another member''s loan');
select is((select count(*)::int from loan_instalments), 0, 'private: not another member''s instalments');
reset role;

select tests.login_as(tests.id('admin'));
select is((select count(*)::int from entries), 4, 'admin reads every entry');
select is((select count(*)::int from statements), 2, 'admin reads every statement');
select is((select count(*)::int from member_status), 1, 'admin reads default flags');
select is((select count(*)::int from workbook_figures), 2, 'admin reads the workbook copy');
reset role;
select tests.login_as(tests.id('owner'));
select is((select count(*)::int from entries), 4, 'owner reads every entry');
select is((select count(*)::int from workbook_figures), 2, 'owner reads the workbook copy');
reset role;
select tests.login_as(tests.id('owner2'));
select results_eq('select count(*)::int from ' || t || ' where group_id = tests.id(''lg'')', 'values (0)',
  'another group''s admin reads no ' || t || ' of this group')
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
reset role;
update groups set figures_visibility = 'open' where id = tests.id('lg');

-- no client writes, not even for admins ---------------------------------------------
select tests.login_as(tests.id('admin'));
select throws_ok('insert into ' || t || ' default values', '42501', null, 'admin cannot insert into ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
select throws_ok('update ' || t || ' set created_at = now()', '42501', null, 'admin cannot update ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
select throws_ok('delete from ' || t, '42501', null, 'admin cannot delete from ' || t)
from unnest(array['wallets', 'periods', 'declarations', 'loans', 'loan_instalments', 'entries', 'statements',
                  'group_statements', 'workbook_figures', 'member_status']) as t;
reset role;

-- append-only, even for the table owner ----------------------------------------------
select throws_ok('update ' || t || ' set created_at = now()', 'P0001', 'append_only', t || ' rows cannot be edited')
from unnest(array['entries', 'statements', 'group_statements', 'workbook_figures']) as t;
select throws_ok('delete from ' || t, 'P0001', 'append_only', t || ' rows cannot be deleted')
from unnest(array['entries', 'statements', 'group_statements', 'workbook_figures']) as t;
-- the import's switch frees only the import's own rows
select set_config('ledger.import_reset', 'on', true);
select throws_ok($$delete from entries where source = 'app'$$, 'P0001', 'append_only', 'the import switch never frees app rows');
select throws_ok($$delete from statements$$, 'P0001', 'append_only', 'nor closed statements');
select lives_ok($$delete from entries where source = 'import'$$, 'the import switch frees import rows');
select lives_ok($$delete from workbook_figures$$, 'and workbook figures');
select set_config('ledger.import_reset', 'off', true);
select throws_ok($$delete from entries where source = 'app'$$, 'P0001', 'append_only', 'switched off again');

select * from finish();
rollback;
```

- [ ] **Step 3: Run it to see it fail**

```bash
bun run db:test
```
Expected: `00_ledger_helpers.sql .. FAILED` (relation "periods" does not exist) and `06_ledger_tables.sql .. FAILED`; `00`–`05` still `ok`.

- [ ] **Step 4: Write the migration**

`supabase/migrations/20261010000700_ledger_tables.sql`:
```sql
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
```

- [ ] **Step 5: Keep 04_bootstrap working once a ledger exists**

In `supabase/tests/database/04_bootstrap.sql`, replace
```sql
-- The local seed already created Premium VB; remove it inside this transaction.
delete from public.groups where name = 'Premium Village Banking';
```
with
```sql
-- The local seed already created Premium VB. Rename it inside this transaction rather than deleting it: on a database
-- where the 2026 import has run, its ledger rows are append-only and would block the delete.
update public.groups set name = 'Premium Village Banking (moved aside by 04_bootstrap)' where name = 'Premium Village Banking';
```

- [ ] **Step 6: Apply and run**

```bash
bun run db:reset    # local stack (option a); on the hosted dev project (option b) use: bun run db:push
bun run db:test
```
Expected: every file `ok`, including `00_ledger_helpers.sql .. ok` and `06_ledger_tables.sql .. ok`.

- [ ] **Step 7: Commit**

```bash
git status --short data/    # Expected: no output
git add supabase
git commit -m "feat: add ledger tables with append-only entries and read-only RLS"
```

---
### Task 2: Periods — audit helper, effective-lines view, open_period, set_deadline

**Files:**
- Create: `supabase/migrations/20261010000800_ledger_periods.sql`, `supabase/tests/database/07_ledger_periods.sql`

**Interfaces:**
- Consumes: Task 1 tables and helpers.
- Produces:
  - `private.audit(p_group uuid, p_action text, p_entity text, p_id uuid, p_data jsonb) → void` (actor = `auth.uid()`).
  - View `private.ledger_lines (id, group_id, cycle_id, month_index, period_id, member_id, loan_id, source, kind, amount)`: one row per entry, with `waiver`/`adjustment` rows carrying the corrected entry's kind and a negative amount, so `sum(amount) … where kind = K` is the effective total of K.
  - `private.ensure_periods(p_cycle uuid) → void`: the cycle's 12 periods (label `Mon YYYY`, `starts_on` the 1st, deadline the rules' `window_close_day`, default 7th), idempotent.
  - `public.open_period(p_cycle uuid, p_month_index int, p_deadline date default null) → public.periods` (`period.opened`). Refusals: `not_admin` (42501, also for an unknown cycle), `period_not_open` (no such month), `already_opened`, `previous_period_open` (earlier month not closed, or another month of the group open), `invalid_date`.
  - `public.set_deadline(p_period uuid, p_deadline date, p_reason text) → public.periods` (`period.deadline_changed`). Refusals: `period_not_open` (unknown, closing or closed month), `not_admin`, `reason_required`, `invalid_date`.

- [ ] **Step 1: Write the failing tests**

`supabase/tests/database/07_ledger_periods.sql`:
```sql
begin;
select * from no_plan();
select tests.ledger_fixture();

-- ensure_periods through open_period, on the Test Group's planned 2027 cycle (no periods yet) -------------
select tests.login_as(tests.id('admin'));
select is((select status from open_period(tests.id('c_planned'), 1)), 'open', 'admin opens the first month of a new cycle');
reset role;
select is((select count(*)::int from periods where cycle_id = tests.id('c_planned')), 12, 'all twelve months exist');
select is((select array_agg(label order by month_index) from periods where cycle_id = tests.id('c_planned')),
  array['Feb 2027', 'Mar 2027', 'Apr 2027', 'May 2027', 'Jun 2027', 'Jul 2027', 'Aug 2027', 'Sep 2027', 'Oct 2027',
        'Nov 2027', 'Dec 2027', 'Jan 2028'], 'months are labelled Feb 2027 … Jan 2028');
select is((select deadline from periods where cycle_id = tests.id('c_planned') and month_index = 1), date '2027-02-07',
  'the deadline defaults to the 7th (the rules'' window_close_day)');
select is((select count(*)::int from periods where cycle_id = tests.id('c_planned') and status = 'planned'), 11, 'the rest are planned');
select lives_ok($$select private.ensure_periods(tests.id('c_planned'))$$, 'ensure_periods can run again');
select is((select count(*)::int from periods where cycle_id = tests.id('c_planned')), 12, 'and adds nothing the second time');
select tests.login_as(tests.id('admin'));
select throws_ok($$select open_period(tests.id('c_active'), 1)$$, 'P0001', 'previous_period_open',
  'a group has one open month at a time, across cycles');
reset role;

-- the ledger cycle --------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select open_period(tests.id('lcycle'), 1)$$, '42501', 'not_admin', 'members cannot open a month');
reset role;
select tests.login_as(tests.id('outsider'));
select throws_ok($$select open_period(tests.id('lcycle'), 1)$$, '42501', 'not_admin', 'outsiders cannot open a month');
select throws_ok($$select open_period(gen_random_uuid(), 1)$$, '42501', 'not_admin', 'an unknown cycle reveals nothing');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select open_period(tests.id('lcycle'), 1)$$, '42501', 'not_admin', 'another group''s admin cannot open it');
reset role;

select tests.login_as(tests.id('owner'));
select throws_ok($$select open_period(tests.id('lcycle'), 1, date '2026-01-31')$$, 'P0001', 'invalid_date',
  'a deadline before the month starts is refused');
select is((select deadline from open_period(tests.id('lcycle'), 1, date '2026-02-17')), date '2026-02-17',
  'the owner opens February with the announced deadline (17 Feb)');
select throws_ok($$select open_period(tests.id('lcycle'), 1)$$, 'P0001', 'already_opened', 'a month opens once');
select throws_ok($$select open_period(tests.id('lcycle'), 2)$$, 'P0001', 'previous_period_open', 'March waits for February to close');
select throws_ok($$select open_period(tests.id('lcycle'), 3)$$, 'P0001', 'previous_period_open', 'April waits for March');
select throws_ok($$select open_period(tests.id('lcycle'), 13)$$, 'P0001', 'period_not_open', 'there is no 13th month');
reset role;
select is((select count(*)::int from audit_log where action = 'period.opened' and group_id = tests.id('lg')), 1, 'opening is audited');
select is((select actor_user_id from audit_log where action = 'period.opened' and group_id = tests.id('lg')), tests.id('owner'),
  'with the person who did it');

update periods set status = 'closed' where id = tests.lp(1);   -- as if February had been closed
select tests.login_as(tests.id('admin'));
select is((select status from open_period(tests.id('lcycle'), 2)), 'open', 'March opens once February is closed');

-- set_deadline ----------------------------------------------------------------------------
select throws_ok($$select set_deadline(tests.lp(2), date '2026-03-10', '  ')$$, 'P0001', 'reason_required', 'an extension needs a reason');
select throws_ok($$select set_deadline(tests.lp(2), date '2026-02-28', 'typo')$$, 'P0001', 'invalid_date', 'not before the month starts');
select throws_ok($$select set_deadline(tests.lp(2), null, 'typo')$$, 'P0001', 'invalid_date', 'not empty');
select throws_ok($$select set_deadline(tests.lp(1), date '2026-02-20', 'too late')$$, 'P0001', 'period_not_open',
  'a closed month keeps its deadline');
select is((select deadline from set_deadline(tests.lp(2), date '2026-03-10', 'SIM limit reached on the 7th')), date '2026-03-10',
  'the treasurer extends March to the 10th');
select is((select deadline from set_deadline(tests.lp(4), date '2026-05-08', 'agreed at the meeting')), date '2026-05-08',
  'a planned month''s deadline can be set ahead');
reset role;
select is((select data ->> 'reason' from audit_log where action = 'period.deadline_changed' and entity_id = tests.lp(2)),
  'SIM limit reached on the 7th', 'the extension and its reason are audited');
select tests.login_as(tests.id('member'));
select throws_ok($$select set_deadline(tests.lp(2), date '2026-03-12', 'please')$$, '42501', 'not_admin', 'members cannot move a deadline');
reset role;
select tests.login_anon();
select throws_ok($$select open_period(tests.id('lcycle'), 3)$$, '42501', null, 'anon cannot call open_period');
select throws_ok($$select set_deadline(tests.lp(2), date '2026-03-12', 'x')$$, '42501', null, 'anon cannot call set_deadline');
reset role;

-- ledger_lines: effective amounts --------------------------------------------------------------
insert into entries (group_id, period_id, member_id, kind, amount, source)
  values (tests.id('lg'), tests.lp(2), tests.lm('Ann'), 'saving', 1000, 'app');
insert into entries (group_id, period_id, member_id, kind, amount, source, corrects_entry_id, reason)
  select tests.id('lg'), tests.lp(2), tests.lm('Ann'), 'adjustment', 300, 'correction', id, 'typo'
  from entries where member_id = tests.lm('Ann') and kind = 'saving';
select is((select sum(amount) from private.ledger_lines where member_id = tests.lm('Ann') and kind = 'saving'), 700.00,
  'an adjustment counts against the kind it corrects (1,000 − 300)');
select is((select cycle_id from private.ledger_lines limit 1), tests.id('lcycle'), 'lines carry their cycle');
select ok(not has_table_privilege('authenticated', 'private.ledger_lines', 'SELECT'), 'clients cannot read the lines view');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to see it fail**

```bash
bun run db:test
```
Expected: `07_ledger_periods.sql .. FAILED` (function open_period does not exist); everything else `ok`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261010000800_ledger_periods.sql`:
```sql
-- Months of a cycle, the shared audit helper and the effective-amount view every ledger function reads.

-- Audit rows for ledger actions (the Foundation's write_audit trigger covers only its own tables).
create or replace function private.audit(p_group uuid, p_action text, p_entity text, p_id uuid, p_data jsonb)
returns void language sql set search_path = public, pg_temp as $$
  insert into public.audit_log (group_id, actor_user_id, action, entity, entity_id, data)
  values (p_group, auth.uid(), p_action, p_entity, p_id, coalesce(p_data, '{}'::jsonb));
$$;

-- One line per entry with its effective sign: waivers and adjustments count against the kind they correct.
-- Corrections always point at the original entry, so one join is enough.
create view private.ledger_lines as
  select e.id, e.group_id, p.cycle_id, p.month_index, e.period_id, e.member_id, e.loan_id, e.source,
         coalesce(r.kind, e.kind) as kind,
         case when e.kind in ('waiver', 'adjustment') then -e.amount else e.amount end as amount
  from public.entries e
  join public.periods p on p.id = e.period_id
  left join public.entries r on r.id = e.corrects_entry_id and e.kind in ('waiver', 'adjustment');
revoke all on private.ledger_lines from public, anon, authenticated;

-- The cycle's twelve months: Feb … Jan for a cycle starting in February. Idempotent.
create or replace function private.ensure_periods(p_cycle uuid) returns void
language sql set search_path = public, pg_temp as $$
  insert into public.periods (group_id, cycle_id, month_index, label, starts_on, deadline)
  select c.group_id, c.id, i, to_char(x.m, 'Mon YYYY'), x.m, x.m + (coalesce(r.window_close_day, 7) - 1)
  from public.cycles c
  left join public.cycle_rules r on r.cycle_id = c.id
  cross join generate_series(1, 12) as i
  cross join lateral (select (date_trunc('month', c.starts_on) + (i - 1) * interval '1 month')::date as m) x
  where c.id = p_cycle
  on conflict (cycle_id, month_index) do nothing;
$$;

create or replace function public.open_period(p_cycle uuid, p_month_index int, p_deadline date default null)
returns public.periods
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_c cycles; v periods;
begin
  select * into v_c from cycles where id = p_cycle;
  if not found or not is_admin(v_c.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  perform private.ensure_periods(p_cycle);
  select * into v from periods where cycle_id = p_cycle and month_index = p_month_index for update;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if v.status <> 'planned' then raise exception 'already_opened' using errcode = 'P0001'; end if;
  if exists (select 1 from periods where cycle_id = p_cycle and month_index < p_month_index and status <> 'closed')
     or exists (select 1 from periods where group_id = v.group_id and status in ('open', 'closing')) then
    raise exception 'previous_period_open' using errcode = 'P0001';
  end if;
  if p_deadline is not null and p_deadline < v.starts_on then raise exception 'invalid_date' using errcode = 'P0001'; end if;

  update periods set status = 'open', deadline = coalesce(p_deadline, deadline) where id = v.id returning * into v;
  perform private.audit(v.group_id, 'period.opened', 'periods', v.id, jsonb_build_object('label', v.label, 'deadline', v.deadline));
  return v;
end $$;

create or replace function public.set_deadline(p_period uuid, p_deadline date, p_reason text)
returns public.periods
language plpgsql security definer set search_path = public, pg_temp as $$
declare v periods; v_old date;
begin
  select * into v from periods where id = p_period for update;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if not is_admin(v.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if v.status not in ('planned', 'open') then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
  if p_deadline is null or p_deadline < v.starts_on then raise exception 'invalid_date' using errcode = 'P0001'; end if;

  v_old := v.deadline;
  update periods set deadline = p_deadline where id = v.id returning * into v;
  perform private.audit(v.group_id, 'period.deadline_changed', 'periods', v.id,
    jsonb_build_object('label', v.label, 'from', v_old, 'to', p_deadline, 'reason', trim(p_reason)));
  return v;
end $$;

revoke execute on function public.open_period(uuid, int, date), public.set_deadline(uuid, date, text) from public, anon, authenticated;
grant execute on function public.open_period(uuid, int, date), public.set_deadline(uuid, date, text) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
```

- [ ] **Step 4: Apply and run**

```bash
bun run db:reset    # or, hosted dev: bun run db:push
bun run db:test
```
Expected: every file `ok` (`02_rls.sql` still passes its anon-execute allowlist; `04_bootstrap.sql` still finds nothing executable in `private`).

- [ ] **Step 5: Commit**

```bash
git status --short data/    # Expected: no output
git add supabase
git commit -m "feat: open months and record deadline extensions"
```

---

### Task 3: Declarations — submit, return, approve

**Files:**
- Create: `supabase/migrations/20261010000900_ledger_declarations.sql`, `supabase/tests/database/08_ledger_declarations.sql`

**Interfaces:**
- Consumes: Tasks 1–2 (`open_period`, `private.audit`).
- Produces:
  - `public.submit_declaration(p_period uuid, p_member uuid, p_saving numeric default 0, p_loan_repayment numeric default 0, p_excess numeric default 0, p_membership numeric default 0, p_penalty numeric default 0, p_txn_fee numeric default 0, p_borrowing_request numeric default 0, p_wallet uuid default null, p_note text default null) → public.declarations`. Callable by the member who owns the row or an admin; supersedes the member's live `submitted`/`returned` declaration for the month. Refusals: `not_signed_in` (42501), `member_not_found`, `period_not_open`, `invalid_amount`, `wallet_not_found`.
  - `public.return_declaration(p_declaration uuid, p_reason text) → public.declarations` (`declaration.returned`). Refusals: `declaration_not_found`, `not_admin`, `reason_required`.
  - `public.approve_declaration(p_declaration uuid) → public.declarations` (`declaration.approved`): writes `saving`, `payment` (repayment + excess + penalty), `membership`, `txn_fee` entries with the wallet, `source='app'`. Refusals: `declaration_not_found`, `not_admin`, `period_not_open`, `wallet_not_found`.
  - A declaration is **live** when no other declaration supersedes it.

- [ ] **Step 1: Write the failing tests**

`supabase/tests/database/08_ledger_declarations.sql`:
```sql
begin;
select * from no_plan();
select tests.ledger_fixture();
select tests.login_as(tests.id('admin'));
select open_period(tests.id('lcycle'), 1);
reset role;

-- submit -----------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));   -- Ben
select is((select status from submit_declaration(tests.lp(1), tests.lm('Ben'), 500, 0, 0, 50, 0, 5, 0, tests.id('w_airtel'), 'first try')),
  'submitted', 'a member declares for themselves');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Cid'), 500, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'member_not_found', 'a member cannot declare for someone else');
select throws_ok($$select submit_declaration(tests.lp(2), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'period_not_open', 'only the open month takes declarations');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), -1, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'invalid_amount', 'no negative amounts');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 1.001, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'invalid_amount', 'amounts are kept to the ngwee');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 0, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'invalid_amount', 'an empty declaration is refused');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500)$$,
  'P0001', 'wallet_not_found', 'money sent needs the wallet it went to');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_old'))$$,
  'P0001', 'wallet_not_found', 'not a retired wallet');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_g2'))$$,
  'P0001', 'wallet_not_found', 'not another group''s wallet');
-- resubmitting replaces the waiting declaration, never edits it
select is((select supersedes_id is not null from submit_declaration(tests.lp(1), tests.lm('Ben'), 550, 0, 0, 50, 0, 5, 0, tests.id('w_airtel'))),
  true, 'a resubmission supersedes the first');
reset role;
select is((select count(*)::int from declarations where member_id = tests.lm('Ben')), 2, 'both rows are kept');
select is((select saving from declarations d where member_id = tests.lm('Ben')
           and not exists (select 1 from declarations n where n.supersedes_id = d.id)), 550.00, 'the live one is the resubmission');
select tests.remember('d_ben_old', (select id from declarations where member_id = tests.lm('Ben') and saving = 500));
select tests.remember('d_ben', (select id from declarations where member_id = tests.lm('Ben') and saving = 550));

select tests.login_as(tests.id('outsider'));
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'member_not_found', 'outsiders learn nothing');
reset role;
select tests.login_anon();
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$,
  '42501', null, 'anon cannot declare');
reset role;

-- the treasurer enters a WhatsApp declaration; a loan request alone needs no wallet
select tests.login_as(tests.id('admin'));
select lives_ok($$select submit_declaration(tests.lp(1), tests.lm('Dee'), 250, 0, 0, 50, 0, 0, 0, tests.id('w_mtn'), 'from WhatsApp')$$,
  'the treasurer enters a member''s declaration');
select lives_ok($$select submit_declaration(tests.lp(1), tests.lm('Eve'), p_borrowing_request => 1500)$$, 'a loan request alone');
reset role;
select is((select submitted_by from declarations where member_id = tests.lm('Dee')), tests.id('admin'), 'it records who typed it');
select tests.remember('d_dee', (select id from declarations where member_id = tests.lm('Dee')));

-- approve ----------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select approve_declaration(tests.id('d_ben'))$$, '42501', 'not_admin', 'members cannot approve');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select approve_declaration(tests.id('d_ben'))$$, '42501', 'not_admin', 'another group''s admin cannot approve');
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok($$select approve_declaration(tests.id('d_ben_old'))$$, 'P0001', 'declaration_not_found', 'a superseded declaration cannot be approved');
select throws_ok($$select approve_declaration(gen_random_uuid())$$, 'P0001', 'declaration_not_found', 'nor an unknown one');
select is((select status from approve_declaration(tests.id('d_ben'))), 'approved', 'the treasurer approves the live one');
select throws_ok($$select approve_declaration(tests.id('d_ben'))$$, 'P0001', 'declaration_not_found', 'approval happens once');
reset role;
select is((select array_agg(kind || ' ' || amount order by kind) from entries where declaration_id = tests.id('d_ben')),
  array['membership 50.00', 'saving 550.00', 'txn_fee 5.00'], 'approval writes what was sent, kind by kind (no payment: none declared)');
select ok((select bool_and(wallet_id = tests.id('w_airtel') and source = 'app' and created_by = tests.id('admin'))
           from entries where declaration_id = tests.id('d_ben')), 'each entry records the wallet, the source and the approver');
select is((select decided_by from declarations where id = tests.id('d_ben')), tests.id('admin'), 'the decision is recorded');
select is((select count(*)::int from audit_log where action = 'declaration.approved' and entity_id = tests.id('d_ben')), 1, 'and audited');

-- repayment, excess and penalty become one payment; the payment order decides where it goes at close
insert into declarations (group_id, period_id, member_id, saving, loan_repayment, excess, penalty, wallet_id, submitted_by)
  values (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 300, 1000, 12.34, 50, tests.id('w_mtn'), tests.id('other'));
select tests.login_as(tests.id('admin'));
select lives_ok($$select approve_declaration((select id from declarations where member_id = tests.lm('Cid')))$$, 'approve Cid');
reset role;
select is((select amount from entries where member_id = tests.lm('Cid') and kind = 'payment'), 1062.34,
  'one payment of 1,000 + 12.34 + 50 = 1,062.34');

-- a second payment in the same month (daily SIM limit) stands beside the approved one
select tests.login_as(tests.id('member'));
select is((select supersedes_id from submit_declaration(tests.lp(1), tests.lm('Ben'), 0, 300, p_wallet => tests.id('w_mtn'))), null,
  'after approval a new declaration does not replace the approved one');
reset role;

-- return ------------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select throws_ok($$select return_declaration(tests.id('d_dee'), '')$$, 'P0001', 'reason_required', 'returning needs a reason');
select is((select status || ': ' || return_reason from return_declaration(tests.id('d_dee'), 'Total does not match the POP')),
  'returned: Total does not match the POP', 'the treasurer returns a declaration with a reason');
select throws_ok($$select approve_declaration(tests.id('d_dee'))$$, 'P0001', 'declaration_not_found', 'a returned declaration cannot be approved');
select is((select supersedes_id from submit_declaration(tests.lp(1), tests.lm('Dee'), 250, 0, 0, 50, 0, 0, 0, tests.id('w_mtn'))),
  tests.id('d_dee'), 'the corrected resubmission replaces the returned one');
reset role;
select is((select count(*)::int from audit_log where action = 'declaration.returned' and entity_id = tests.id('d_dee')), 1, 'returns are audited');

-- a closed month takes no approvals
select tests.login_as(tests.id('admin'));
select lives_ok($$select submit_declaration(tests.lp(1), tests.lm('Fay'), 250, p_wallet => tests.id('w_airtel'))$$, 'Fay declares');
reset role;
update periods set status = 'closed' where id = tests.lp(1);
select tests.login_as(tests.id('admin'));
select throws_ok($$select approve_declaration((select id from declarations where member_id = tests.lm('Fay')))$$,
  'P0001', 'period_not_open', 'approvals only into an open month');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to see it fail**

```bash
bun run db:test
```
Expected: `08_ledger_declarations.sql .. FAILED` (function submit_declaration does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261010000900_ledger_declarations.sql`:
```sql
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
```

- [ ] **Step 4: Apply and run**

```bash
bun run db:reset    # or, hosted dev: bun run db:push
bun run db:test
```
Expected: every file `ok`.

- [ ] **Step 5: Commit**

```bash
git status --short data/    # Expected: no output
git add supabase
git commit -m "feat: submit, return and approve monthly declarations"
```

---

### Task 4: Loans — schedule, lending cash, send_loan

**Files:**
- Create: `supabase/migrations/20261010001000_ledger_loans.sql`, `supabase/tests/database/09_ledger_loans.sql`
- Modify: `supabase/tests/database/00_ledger_helpers.sql` (add `tests.ledger_feb_savings()`)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `private.schedule_loan(p_period uuid, p_member uuid, p_principal numeric, p_interest numeric, p_wallet uuid, p_sent_at timestamptz) → public.loans`: term from the cycle's tenor bands (≤3,000 → 1; ≤5,000 → 2; ≤9,999.99 → 3; else 4), shortened to `12 − month_index` so the last instalment falls by January; equal instalments of (principal + interest) ÷ term cut to the ngwee, the last absorbing the remainder, in months `month_index + 1 … + term`. Raises `loans_closed` if no month is left.
  - `private.lending_cash(p_period uuid) → numeric`: previous month's idle cash + this month's payments + savings − loans sent.
  - `private.member_balance(p_member uuid, p_period uuid) → numeric`: what the member owes now (closed month: its statement's `closing_owed`; open month: last statement + this month's charges − payments).
  - `public.send_loan(p_member uuid, p_principal numeric, p_wallet uuid, p_reason text default null, p_fee numeric default 0) → public.loans` (`loan.sent`): 15% (cycle `loan_rate`) interest entry at send time, `loan_sent` entry, optional group-level `payout_fee` entry, cap and arrears warnings. Refusals: `member_not_found`, `not_admin`, `period_not_open`, `loans_closed` (month 12 or multiple 0), `invalid_amount`, `wallet_not_found`, `insufficient_cash`, `over_cap_needs_reason`.
  - Test helper `tests.ledger_feb_savings()`: February savings, membership and fees of the synthetic group (7,300 saved).

- [ ] **Step 1: Add the February savings helper**

In `supabase/tests/database/00_ledger_helpers.sql`, above the line `-- Later tasks add helpers above this line.`, add:
```sql
-- February in the synthetic group: savings 1,000 + 500 + 2,000 + 250 + 300 + 250 + 12 × 250 = 7,300;
-- membership 50 from each of the 18 savers (900); Ann and Ben declare transfer fees of 10 and 5.
create or replace function tests.ledger_feb_savings() returns void
language plpgsql security definer set search_path = public, tests as $$
declare n text;
begin
  perform tests.ledger_pay('Ann', 1, 1000, 0, 50, 10);
  perform tests.ledger_pay('Ben', 1, 500, 0, 50, 5);
  perform tests.ledger_pay('Cid', 1, 2000, 0, 50);
  perform tests.ledger_pay('Dee', 1, 250, 0, 50);
  perform tests.ledger_pay('Eve', 1, 300, 0, 50);
  perform tests.ledger_pay('Fay', 1, 250, 0, 50);
  foreach n in array tests.plain() loop
    perform tests.ledger_pay(n, 1, 250, 0, 50);
  end loop;
end $$;
```

- [ ] **Step 2: Write the failing tests**

`supabase/tests/database/09_ledger_loans.sql`:
```sql
begin;
select * from no_plan();
select tests.ledger_fixture();

select tests.login_as(tests.id('admin'));
select throws_ok($$select send_loan(tests.lm('Cid'), 100, tests.id('w_airtel'))$$, 'P0001', 'period_not_open',
  'no loans before a month is open');
select lives_ok($$select open_period(tests.id('lcycle'), 1)$$, 'February opens');
reset role;
select tests.ledger_feb_savings();   -- 7,300 saved: that is all the lending cash in the first month

-- refusals ---------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'))$$, '42501', 'not_admin', 'members cannot send loans');
reset role;
select tests.login_as(tests.id('outsider'));
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'))$$, '42501', 'not_admin', 'outsiders cannot send loans');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'))$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select tests.login_anon();
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'))$$, '42501', null, 'anon cannot call send_loan');
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok($$select send_loan(gen_random_uuid(), 100, tests.id('w_airtel'))$$, 'P0001', 'member_not_found', 'unknown member');
select throws_ok($$select send_loan(tests.lm('Ben'), 0, tests.id('w_airtel'))$$, 'P0001', 'invalid_amount', 'no zero loans');
select throws_ok($$select send_loan(tests.lm('Ben'), -5, tests.id('w_airtel'))$$, 'P0001', 'invalid_amount', 'no negative loans');
select throws_ok($$select send_loan(tests.lm('Ben'), 100.005, tests.id('w_airtel'))$$, 'P0001', 'invalid_amount', 'to the ngwee only');
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_airtel'), null, -1)$$, 'P0001', 'invalid_amount', 'no negative fee');
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_old'))$$, 'P0001', 'wallet_not_found', 'not from a retired wallet');
select throws_ok($$select send_loan(tests.lm('Ben'), 100, tests.id('w_g2'))$$, 'P0001', 'wallet_not_found', 'not from another group''s wallet');

-- Cid: K3,000 is the 1-month band. Interest 15% = 450, charged now. One instalment of 3,450 in March.
-- Cap in month 1 is 3 × savings: 3 × 2,000 = 6,000 ≥ 0 owed + 3,000, so no warning. Transfer fee K10 from the fee pot.
select lives_ok($$select send_loan(tests.lm('Cid'), 3000, tests.id('w_airtel'), null, 10)$$, 'Cid''s loan is sent');
reset role;
select tests.remember('loan_cid', (select id from loans where member_id = tests.lm('Cid')));
select is((select principal || '/' || interest || '/' || term_months || '/' || status from loans where id = tests.id('loan_cid')),
  '3000.00/450.00/1/open', '3,000 at 15% over one month');
select is((select cap_warning from loans where id = tests.id('loan_cid')), null, 'within the cap');
select is((select array_agg(p.month_index || ':' || i.amount_due order by p.month_index)
           from loan_instalments i join periods p on p.id = i.period_id where i.loan_id = tests.id('loan_cid')),
  array['2:3450.00'], 'one instalment of 3,450 due in March');
select is((select array_agg(kind || ' ' || amount || ' ' || (member_id is not null) order by kind) from entries where loan_id = tests.id('loan_cid')),
  array['loan_interest 450.00 true', 'loan_sent 3000.00 true', 'payout_fee 10.00 false'],
  'principal and interest on Cid''s account; the transfer fee on the group''s fee pot');
select ok((select bool_and(wallet_id = tests.id('w_airtel')) from entries where loan_id = tests.id('loan_cid') and kind = 'loan_sent'),
  'the loan records the wallet it was sent from');

-- Ben borrows twice in one month (split loans). First 1,000: owed 0 + 1,000 ≤ 3 × 500 = 1,500.
select tests.login_as(tests.id('admin'));
select lives_ok($$select send_loan(tests.lm('Ben'), 1000, tests.id('w_mtn'))$$, 'Ben''s first loan');
-- Second 3,001: owed 1,000 + 150 = 1,150, plus 3,001 = 4,151 > 1,500: over the cap, so a reason is required.
select throws_ok($$select send_loan(tests.lm('Ben'), 3001, tests.id('w_mtn'))$$, 'P0001', 'over_cap_needs_reason',
  'over the cap without a reason is refused');
select lives_ok($$select send_loan(tests.lm('Ben'), 3001, tests.id('w_mtn'), 'agreed at the meeting')$$, 'with a reason it goes');
reset role;
select tests.remember('loan_ben2', (select id from loans where member_id = tests.lm('Ben') and principal = 3001));
select ok((select cap_warning like '%cap%' from loans where id = tests.id('loan_ben2')), 'the cap warning is recorded');
select is((select approved_reason from loans where id = tests.id('loan_ben2')), 'agreed at the meeting', 'with the reason');
-- 3,001 is the 2-month band. Interest 15% = 450.15. 3,451.15 / 2 = 1,725.575: 1,725.57 in March, 1,725.58 in April.
select is((select interest || '/' || term_months from loans where id = tests.id('loan_ben2')), '450.15/2', '3,001 over two months');
select is((select array_agg(i.amount_due order by p.month_index) from loan_instalments i join periods p on p.id = i.period_id
           where i.loan_id = tests.id('loan_ben2')), array[1725.57, 1725.58]::numeric[],
  'the last instalment absorbs the ngwee remainder');
select is((select sum(i.amount_due) from loan_instalments i where i.loan_id = tests.id('loan_ben2')), 3451.15,
  'instalments add up to principal + interest exactly');

-- Lending cash: 7,300 saved − 3,000 − 1,000 − 3,001 = 299 left.
select is(private.lending_cash(tests.lp(1)), 299.00, 'lending cash on hand is 299');
select tests.login_as(tests.id('admin'));
select throws_ok($$select send_loan(tests.lm('Dee'), 300, tests.id('w_airtel'))$$, 'P0001', 'insufficient_cash',
  'a loan larger than the cash on hand is refused');
reset role;
select tests.login_as(tests.id('owner'));
select lives_ok($$select send_loan(tests.lm('Dee'), 299, tests.id('w_airtel'))$$, 'the owner can send exactly what is left');
select throws_ok($$select send_loan(tests.lm('Eve'), 0.01, tests.id('w_airtel'))$$, 'P0001', 'insufficient_cash', 'and then nothing more');
reset role;
select is(private.lending_cash(tests.lp(1)), 0.00, 'cash is exhausted, never negative');
select is((select count(*)::int from audit_log where action = 'loan.sent' and group_id = tests.id('lg')), 4, 'every loan is audited');
select is((select actor_user_id from audit_log where action = 'loan.sent' and entity_id = (select id from loans where member_id = tests.lm('Dee'))),
  tests.id('owner'), 'with the person who sent it');

-- Late in the cycle -----------------------------------------------------------------------------
-- Month 10 (Nov): multiple 1. Max saves 6,000; borrows 5,001 (3-month band) — only Dec and Jan are left, so 2 months.
-- 5,001 × 15% = 750.15; 5,751.15 / 2 = 2,875.575: 2,875.57 then 2,875.58.
select tests.ledger_jump(10);
select tests.ledger_pay('Max', 10, 6000, 0);
select tests.login_as(tests.id('admin'));
select is((select term_months from send_loan(tests.lm('Max'), 5001, tests.id('w_airtel'))), 2, 'a November loan is shortened to end in January');
reset role;
select is((select array_agg(p.month_index || ':' || i.amount_due order by p.month_index)
           from loan_instalments i join periods p on p.id = i.period_id join loans l on l.id = i.loan_id where l.member_id = tests.lm('Max')),
  array['11:2875.57', '12:2875.58'], 'two instalments, the last in January');

-- Month 11 (Dec): Kim saves 10,000 and borrows 10,000 (4-month band, K10,000 is 4 months) — one month left, January.
-- Cap 1 × 10,000 = 10,000 = 0 owed + 10,000: exactly at the cap, no warning. Interest 1,500; one instalment of 11,500.
select tests.ledger_jump(11);
select tests.ledger_pay('Kim', 11, 10000, 0);
select tests.login_as(tests.id('admin'));
select is((select term_months || '/' || coalesce(cap_warning, 'none') from send_loan(tests.lm('Kim'), 10000, tests.id('w_airtel'))),
  '1/none', 'a December loan is due in full in January; at the cap is not over it');
reset role;
select is((select i.amount_due from loan_instalments i join loans l on l.id = i.loan_id where l.member_id = tests.lm('Kim')), 11500.00,
  'one instalment of 11,500');

-- Arrears: Lee's November statement shows an unpaid minimum. He may still borrow; the loan records a warning.
insert into statements (group_id, period_id, member_id, unpaid_minimum, source) values (tests.id('lg'), tests.lp(10), tests.lm('Lee'), 20, 'close');
select tests.ledger_pay('Lee', 11, 600, 0);
select tests.login_as(tests.id('admin'));
select ok((select arrears_warning is not null and cap_warning is null from send_loan(tests.lm('Lee'), 500, tests.id('w_airtel'))),
  'a member in arrears can borrow, with a warning');
reset role;

-- Month 12 (Jan): repayments only.
select tests.ledger_jump(12);
select tests.ledger_pay('Ned', 12, 5000, 0);
select tests.login_as(tests.id('admin'));
select throws_ok($$select send_loan(tests.lm('Ned'), 100, tests.id('w_airtel'))$$, 'P0001', 'loans_closed', 'no new loans in the last month');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 3: Run it to see it fail**

```bash
bun run db:test
```
Expected: `09_ledger_loans.sql .. FAILED` (function send_loan does not exist).

- [ ] **Step 4: Write the migration**

`supabase/migrations/20261010001000_ledger_loans.sql`:
```sql
-- Loans: schedule by size, cash on hand, member balance, and send_loan.

-- A loan's own schedule: term by size from the cycle's tenor bands, shortened so the last instalment falls by
-- month 12 (January); equal instalments of (principal + interest) / term cut to the ngwee, the last one absorbing
-- the remainder. Shared by send_loan and the 2026 import.
create or replace function private.schedule_loan(p_period uuid, p_member uuid, p_principal numeric, p_interest numeric,
  p_wallet uuid, p_sent_at timestamptz)
returns public.loans language plpgsql set search_path = public, pg_temp as $$
declare v_p periods; v_term int; v loans; v_total numeric; v_each numeric;
begin
  select * into v_p from periods where id = p_period;
  select (b ->> 'months')::int into v_term
    from cycle_rules r, jsonb_array_elements(r.tenor_bands) with ordinality as x(b, i)
   where r.cycle_id = v_p.cycle_id and (b ->> 'max' is null or p_principal <= (b ->> 'max')::numeric)
   order by i
   limit 1;
  v_term := least(coalesce(v_term, 1), 12 - v_p.month_index);
  if v_term < 1 then raise exception 'loans_closed' using errcode = 'P0001'; end if;

  insert into loans (group_id, member_id, period_id, principal, interest, term_months, sent_at, wallet_id)
  values (v_p.group_id, p_member, p_period, p_principal, p_interest, v_term, p_sent_at, p_wallet)
  returning * into v;

  v_total := p_principal + p_interest;
  v_each := trunc(v_total / v_term, 2);
  insert into loan_instalments (group_id, loan_id, period_id, amount_due)
  select v_p.group_id, v.id, p.id,
         case when p.month_index = v_p.month_index + v_term then v_total - v_each * (v_term - 1) else v_each end
  from periods p
  where p.cycle_id = v_p.cycle_id and p.month_index between v_p.month_index + 1 and v_p.month_index + v_term;
  return v;
end $$;

-- Lending cash on hand in a month: last month's idle cash + payments and savings in so far − loans out so far.
-- Membership and transfer fees sit in their own pots and never count.
create or replace function private.lending_cash(p_period uuid) returns numeric
language sql stable set search_path = public, pg_temp as $$
  select coalesce((select gs.idle_cash from periods p
                   join periods prev on prev.cycle_id = p.cycle_id and prev.month_index = p.month_index - 1
                   join group_statements gs on gs.period_id = prev.id
                   where p.id = p_period), 0)
       + coalesce((select sum(case when l.kind = 'loan_sent' then -l.amount else l.amount end)
                   from private.ledger_lines l
                   where l.period_id = p_period and l.kind in ('payment', 'saving', 'loan_sent')), 0)
$$;

-- What a member owes as of a month: a closed month's statement, or the last statement plus the open month's
-- charges so far less its payments so far.
create or replace function private.member_balance(p_member uuid, p_period uuid) returns numeric
language sql stable set search_path = public, pg_temp as $$
  select case when p.status = 'closed' then
           coalesce((select s.closing_owed from statements s where s.period_id = p.id and s.member_id = p_member), 0)
         else
           coalesce((select s.closing_owed from periods prev join statements s on s.period_id = prev.id and s.member_id = p_member
                     where prev.cycle_id = p.cycle_id and prev.month_index = p.month_index - 1), 0)
           + coalesce((select sum(case when l.kind = 'payment' then -l.amount else l.amount end) from private.ledger_lines l
                       where l.period_id = p.id and l.member_id = p_member
                         and l.kind in ('loan_sent', 'loan_interest', 'excess_charge', 'penalty', 'payment')), 0)
         end
  from periods p where p.id = p_period
$$;

create or replace function public.send_loan(p_member uuid, p_principal numeric, p_wallet uuid,
  p_reason text default null, p_fee numeric default 0)
returns public.loans
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_m members;
  v_p periods;
  v_r cycle_rules;
  v_multiple numeric;
  v_cum numeric;
  v_owed numeric;
  v_unpaid numeric;
  v_cap_warning text;
  v_arrears text;
  v_interest numeric;
  v loans;
begin
  select * into v_m from members where id = p_member;
  if not found then raise exception 'member_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v_m.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  -- One send at a time per group: the lock makes the cash check and the send a single step, so two treasurers
  -- sending at once cannot both spend the same kwacha. close_month takes the same lock.
  select * into v_p from periods where group_id = v_m.group_id and status = 'open' for update;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  select * into v_r from cycle_rules where cycle_id = v_p.cycle_id;
  select (x ->> 'multiple')::numeric into v_multiple
    from jsonb_array_elements(v_r.loan_multiples) x
   where v_p.month_index between (x ->> 'from_month')::int and (x ->> 'to_month')::int
   limit 1;
  if v_p.month_index >= 12 or coalesce(v_multiple, 0) = 0 then raise exception 'loans_closed' using errcode = 'P0001'; end if;
  if p_principal is null or p_principal <= 0 or p_principal <> round(p_principal, 2)
     or p_fee is null or p_fee < 0 or p_fee <> round(p_fee, 2) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if not exists (select 1 from wallets w where w.id = p_wallet and w.group_id = v_m.group_id and w.active) then
    raise exception 'wallet_not_found' using errcode = 'P0001';
  end if;
  if p_principal > private.lending_cash(v_p.id) then raise exception 'insufficient_cash' using errcode = 'P0001'; end if;

  -- Cap: everything still owed + this loan ≤ multiple × cumulative savings including this month's saving.
  v_cum := coalesce((select sum(l.amount) from private.ledger_lines l
                     where l.member_id = p_member and l.cycle_id = v_p.cycle_id and l.kind = 'saving'
                       and l.month_index <= v_p.month_index), 0);
  v_owed := greatest(private.member_balance(p_member, v_p.id), 0);
  if v_owed + p_principal > v_multiple * v_cum then
    v_cap_warning := format('Over the cap: owes K%s, new loan K%s, cap K%s (%s x savings of K%s)',
                            v_owed, p_principal, v_multiple * v_cum, v_multiple, v_cum);
    if coalesce(trim(p_reason), '') = '' then raise exception 'over_cap_needs_reason' using errcode = 'P0001'; end if;
  end if;
  -- Arrears: still owing from last month's minimum. Allowed, with a warning.
  select s.unpaid_minimum into v_unpaid
    from periods prev join statements s on s.period_id = prev.id and s.member_id = p_member
   where prev.cycle_id = v_p.cycle_id and prev.month_index = v_p.month_index - 1;
  if coalesce(v_unpaid, 0) > 0 then
    v_arrears := format('K%s of last month''s minimum is unpaid', v_unpaid);
  end if;

  v_interest := round(p_principal * v_r.loan_rate, 2);
  v := private.schedule_loan(v_p.id, p_member, p_principal, v_interest, p_wallet, clock_timestamp());
  update loans set cap_warning = v_cap_warning, arrears_warning = v_arrears, approved_reason = nullif(trim(p_reason), '')
   where id = v.id returning * into v;

  insert into entries (group_id, period_id, member_id, kind, amount, loan_id, wallet_id, source, created_by)
  values (v_m.group_id, v_p.id, p_member, 'loan_sent', p_principal, v.id, p_wallet, 'app', auth.uid());
  if v_interest > 0 then
    insert into entries (group_id, period_id, member_id, kind, amount, loan_id, source, created_by)
    values (v_m.group_id, v_p.id, p_member, 'loan_interest', v_interest, v.id, 'app', auth.uid());
  end if;
  -- The transfer fee is paid from the fee pot (members' declared fees), never from lending cash.
  if p_fee > 0 then
    insert into entries (group_id, period_id, member_id, kind, amount, loan_id, wallet_id, source, created_by)
    values (v_m.group_id, v_p.id, null, 'payout_fee', p_fee, v.id, p_wallet, 'app', auth.uid());
  end if;

  perform private.audit(v_m.group_id, 'loan.sent', 'loans', v.id, jsonb_build_object(
    'member_id', p_member, 'principal', p_principal, 'interest', v_interest, 'term_months', v.term_months,
    'fee', p_fee, 'cap_warning', v_cap_warning, 'arrears_warning', v_arrears, 'reason', nullif(trim(p_reason), '')));
  return v;
end $$;

revoke execute on function public.send_loan(uuid, numeric, uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.send_loan(uuid, numeric, uuid, text, numeric) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
```

- [ ] **Step 5: Apply and run**

```bash
bun run db:reset    # or, hosted dev: bun run db:push
bun run db:test
```
Expected: every file `ok`.

- [ ] **Step 6: Commit**

```bash
git status --short data/    # Expected: no output
git add supabase
git commit -m "feat: send loans from cash on hand with their own schedules and cap warnings"
```

---
### Task 5: Penalties, defaults, corrections and waivers

**Files:**
- Create: `supabase/migrations/20261010001100_ledger_penalties_corrections.sql`, `supabase/tests/database/10_ledger_penalties_corrections.sql`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `public.apply_penalty(p_member uuid, p_period uuid, p_amount numeric, p_ground text, p_reason text) → public.entries` (`penalty.applied`). Grounds: `late_declaration`, `missed_minimum`, `under_saving`, `other`; the entry's `reason` is `"<ground>: <reason>"`. Refusals: `member_not_found`, `not_admin`, `period_not_open`, `reason_required` (unknown ground or blank reason), `invalid_amount`.
  - `public.suggest_penalties(p_period uuid) → table (member_id uuid, short_name text, ground text, amount numeric, detail text)`, read-only, admin-only. Late: rules' `penalty_per_day` × days between the deadline and the first declaration (or today, Africa/Lusaka, if none yet). After the deadline: `under_saving` (saved under `min_saving`) and `missed_minimum` (paid under last month's `next_minimum`) each suggest `penalty_per_day` once.
  - `public.set_default(p_member uuid, p_cycle uuid, p_defaulted boolean, p_reason text) → public.member_status` (`member.default_changed`). Refusals: `member_not_found` (also for a cycle of another group), `not_admin`, `reason_required`.
  - `public.post_correction(p_entry uuid, p_new_amount numeric, p_reason text) → public.entries` and `public.post_waiver(p_entry uuid, p_amount numeric, p_reason text) → public.entries` (both `entry.corrected`). The new entry lands in the cycle's **open** month and points at the original (`corrects_entry_id`, never at another correction). Refusals: `entry_not_found` (unknown entry; for a waiver, also an entry that is not a charge), `not_admin`, `reason_required`, `invalid_amount` (negative, more than 2 dp, no change, or a waiver above the charge), `period_not_open`.

- [ ] **Step 1: Write the failing tests**

`supabase/tests/database/10_ledger_penalties_corrections.sql`:
```sql
begin;
select * from no_plan();
select tests.ledger_fixture();
select tests.login_as(tests.id('admin'));
select open_period(tests.id('lcycle'), 1);   -- February 2026, deadline 7 Feb: long past whenever this runs
reset role;
select tests.ledger_pay('Ann', 1, 1000, 0);
select tests.ledger_pay('Ben', 1, 500, 0);
select tests.ledger_pay('Dee', 1, 200, 0);
select tests.remember('e_ann_saving', (select id from entries where member_id = tests.lm('Ann') and kind = 'saving'));

-- apply_penalty ---------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select is((select kind || ' ' || amount || ' ' || reason from apply_penalty(tests.lm('Dee'), tests.lp(1), 100, 'late_declaration', 'declared 2 days late')),
  'penalty 100.00 late_declaration: declared 2 days late', 'the treasurer applies a penalty with its ground and reason');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50, 'late_declaration', ' ')$$, 'P0001', 'reason_required', 'no penalty without a reason');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50, 'because', 'x')$$, 'P0001', 'reason_required', 'only the known grounds');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 0, 'other', 'x')$$, 'P0001', 'invalid_amount', 'no zero penalty');
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(2), 50, 'other', 'x')$$, 'P0001', 'period_not_open', 'only into the open month');
reset role;
select tests.login_as(tests.id('member'));
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50, 'other', 'x')$$, '42501', 'not_admin', 'members cannot apply penalties');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 50, 'other', 'x')$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select is((select count(*)::int from audit_log where action = 'penalty.applied' and group_id = tests.id('lg')), 1, 'penalties are audited');

-- suggest_penalties -------------------------------------------------------------------------------
-- Ann declared on 9 Feb (2 days after the 7th): 2 × K50 = K100. Ben declared on the 6th: not late.
-- Cid has not declared at all: K50 × days since the 7th, counted to today in Lusaka.
-- After the deadline: Dee saved 200 (< 250) and Cid saved nothing → under_saving K50 each; Ann and Ben saved enough.
insert into declarations (group_id, period_id, member_id, saving, wallet_id, submitted_by, submitted_at) values
  (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 1000, tests.id('w_airtel'), tests.id('admin'), '2026-02-09 10:00:00+02'),
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 500, tests.id('w_airtel'), tests.id('member'), '2026-02-06 09:00:00+02');
select tests.login_as(tests.id('admin'));
select is((select amount || ' ' || detail from suggest_penalties(tests.lp(1)) where short_name = 'Ann' and ground = 'late_declaration'),
  '100.00 Declared 2 days after the deadline', 'late by two days suggests K100');
select is((select count(*)::int from suggest_penalties(tests.lp(1)) where short_name = 'Ben' and ground = 'late_declaration'), 0, 'on time suggests nothing');
select is((select amount from suggest_penalties(tests.lp(1)) where short_name = 'Cid' and ground = 'late_declaration'),
  50 * ((now() at time zone 'Africa/Lusaka')::date - date '2026-02-07')::numeric, 'not declared: K50 for every day since the deadline');
select is((select amount from suggest_penalties(tests.lp(1)) where short_name = 'Dee' and ground = 'under_saving'), 50.00, 'saving under K250 suggests K50');
select is((select count(*)::int from suggest_penalties(tests.lp(1)) where short_name in ('Ann', 'Ben') and ground = 'under_saving'), 0,
  'enough saved suggests nothing');
select is((select count(*)::int from suggest_penalties(tests.lp(1)) where ground = 'missed_minimum'), 0, 'nothing was due in the first month');
reset role;
select tests.login_as(tests.id('member'));
select throws_ok($$select * from suggest_penalties(tests.lp(1))$$, '42501', 'not_admin', 'suggestions are for admins');
reset role;

-- set_default -----------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select is((select defaulted from set_default(tests.lm('Dee'), tests.id('lcycle'), true, 'no payments since February')), true, 'mark a defaulter');
select is((select defaulted || ' ' || reason from set_default(tests.lm('Dee'), tests.id('lcycle'), false, 'paid everything back')),
  'false paid everything back', 'and reverse it, with a reason');
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, '')$$, 'P0001', 'reason_required', 'a default needs a reason');
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('c_active'), true, 'x')$$, 'P0001', 'member_not_found',
  'the cycle must be the member''s group''s');
reset role;
select is((select count(*)::int from member_status where member_id = tests.lm('Dee')), 1, 'one status row per member and cycle');
select is((select count(*)::int from audit_log where action = 'member.default_changed' and entity_id = tests.lm('Dee')), 2, 'both changes are audited');
select tests.login_as(tests.id('member'));
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, 'x')$$, '42501', 'not_admin', 'members cannot mark defaults');
reset role;

-- post_correction ---------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select is((select kind || ' ' || amount || ' ' || source from post_correction(tests.id('e_ann_saving'), 1100, 'Ann sent K1,100')),
  'saving 100.00 correction', 'raising 1,000 to 1,100 posts +100 of the same kind');
reset role;
select is((select sum(amount) from private.ledger_lines where member_id = tests.lm('Ann') and kind = 'saving'), 1100.00, 'effective saving 1,100');
select tests.remember('e_ann_fix', (select id from entries where corrects_entry_id = tests.id('e_ann_saving')));
select tests.login_as(tests.id('admin'));
-- correcting the correction corrects the original: effective 1,100 → 900 is −200
select is((select kind || ' ' || amount || ' ' || (corrects_entry_id = tests.id('e_ann_saving')) from post_correction(tests.id('e_ann_fix'), 900, 'it was K900')),
  'adjustment 200.00 true', 'lowering posts an adjustment against the original');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 900, 'again')$$, 'P0001', 'invalid_amount', 'no change, no correction');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), -1, 'x')$$, 'P0001', 'invalid_amount', 'not below zero');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 1.234, 'x')$$, 'P0001', 'invalid_amount', 'to the ngwee');
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 950, null)$$, 'P0001', 'reason_required', 'a correction needs a reason');
select throws_ok($$select post_correction(gen_random_uuid(), 950, 'x')$$, 'P0001', 'entry_not_found', 'unknown entry');
reset role;
select is((select sum(amount) from private.ledger_lines where member_id = tests.lm('Ann') and kind = 'saving'), 900.00, 'effective saving 900');
select tests.login_as(tests.id('member'));
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 950, 'x')$$, '42501', 'not_admin', 'members cannot correct');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 950, 'x')$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select is((select count(*)::int from audit_log where action = 'entry.corrected' and entity_id = tests.id('e_ann_saving')), 2, 'corrections are audited');

-- post_waiver ---------------------------------------------------------------------------------------
-- Cid borrows 1,000 (cash 1,700; cap 0 saved → over the cap, so a reason). Interest 150, then waived in full.
select tests.login_as(tests.id('admin'));
select send_loan(tests.lm('Cid'), 1000, tests.id('w_airtel'), 'emergency, agreed by the trustees');
reset role;
select tests.remember('e_cid_interest', (select id from entries where member_id = tests.lm('Cid') and kind = 'loan_interest'));
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 150.01, 'x')$$, 'P0001', 'invalid_amount', 'not more than the charge');
select throws_ok($$select post_waiver(tests.id('e_ann_saving'), 10, 'x')$$, 'P0001', 'entry_not_found', 'only charges can be waived');
select throws_ok($$select post_waiver(tests.id('e_cid_interest'), 150, '')$$, 'P0001', 'reason_required', 'a waiver needs a reason');
select is((select kind || ' ' || amount from post_waiver(tests.id('e_cid_interest'), 150, 'zero-interest loan agreed by the group')),
  'waiver 150.00', 'the treasurer waives the interest');
reset role;
select is((select sum(amount) from private.ledger_lines where loan_id = (select loan_id from entries where id = tests.id('e_cid_interest'))
           and kind = 'loan_interest'), 0.00, 'the loan''s effective interest is now zero');
select is((select loan_id from entries where kind = 'waiver'), (select loan_id from entries where id = tests.id('e_cid_interest')),
  'the waiver stays attached to the loan');

-- a correction to a closed month lands in the open month -----------------------------------------------
select tests.ledger_jump(2);
select tests.login_as(tests.id('admin'));
select lives_ok($$select post_correction(tests.id('e_ann_saving'), 950, 'Ann''s February saving was K950')$$, 'correct February from March');
reset role;
select is((select period_id from entries where corrects_entry_id = tests.id('e_ann_saving') and kind = 'saving' and amount = 50), tests.lp(2),
  'the correction is March''s entry, February is not touched');
update periods set status = 'closed' where id = tests.lp(2);
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('e_ann_saving'), 1000, 'x')$$, 'P0001', 'period_not_open', 'no open month, no correction');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to see it fail**

```bash
bun run db:test
```
Expected: `10_ledger_penalties_corrections.sql .. FAILED` (function apply_penalty does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261010001100_ledger_penalties_corrections.sql`:
```sql
-- Penalties (suggested, then applied or not), default flags, and append-only corrections and waivers.

create or replace function public.apply_penalty(p_member uuid, p_period uuid, p_amount numeric, p_ground text, p_reason text)
returns public.entries
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_m members; v_p periods; v entries;
begin
  select * into v_m from members where id = p_member;
  if not found then raise exception 'member_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v_m.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  select * into v_p from periods where id = p_period and group_id = v_m.group_id for share;
  if not found or v_p.status <> 'open' then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  -- The ground is the first half of the reason: without a known ground and a written reason there is no penalty.
  if p_ground is null or p_ground not in ('late_declaration', 'missed_minimum', 'under_saving', 'other')
     or coalesce(trim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  insert into entries (group_id, period_id, member_id, kind, amount, source, reason, created_by)
  values (v_m.group_id, p_period, p_member, 'penalty', p_amount, 'app', p_ground || ': ' || trim(p_reason), auth.uid())
  returning * into v;
  perform private.audit(v_m.group_id, 'penalty.applied', 'entries', v.id,
    jsonb_build_object('member_id', p_member, 'amount', p_amount, 'ground', p_ground, 'reason', trim(p_reason)));
  return v;
end $$;

create or replace function public.suggest_penalties(p_period uuid)
returns table (member_id uuid, short_name text, ground text, amount numeric, detail text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_p periods;
  v_r cycle_rules;
  v_today date := (now() at time zone 'Africa/Lusaka')::date;
begin
  select * into v_p from periods where id = p_period;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if not is_admin(v_p.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  select * into v_r from cycle_rules where cycle_id = v_p.cycle_id;

  return query
  with mem as (
    select m.id, m.short_name from members m where m.group_id = v_p.group_id and m.status = 'active'
  ),
  late as (
    select mem.id, mem.short_name,
           exists (select 1 from declarations d where d.period_id = p_period and d.member_id = mem.id) as declared,
           coalesce((select min((d.submitted_at at time zone 'Africa/Lusaka')::date) from declarations d
                     where d.period_id = p_period and d.member_id = mem.id), v_today) - v_p.deadline as days
    from mem
  ),
  paid as (
    select mem.id, mem.short_name,
           coalesce((select sum(l.amount) from private.ledger_lines l
                     where l.period_id = p_period and l.member_id = mem.id and l.kind = 'saving'), 0) as saving,
           coalesce((select sum(l.amount) from private.ledger_lines l
                     where l.period_id = p_period and l.member_id = mem.id and l.kind = 'payment'), 0) as payment,
           coalesce((select s.next_minimum from periods prev join statements s on s.period_id = prev.id and s.member_id = mem.id
                     where prev.cycle_id = v_p.cycle_id and prev.month_index = v_p.month_index - 1), 0) as minimum
    from mem
  )
  select l.id, l.short_name, 'late_declaration'::text, (l.days * v_r.penalty_per_day)::numeric,
         case when l.declared then format('Declared %s days after the deadline', l.days)
              else format('Not declared, %s days after the deadline', l.days) end
  from late l where l.days > 0
  union all
  select p.id, p.short_name, 'under_saving'::text, v_r.penalty_per_day,
         format('Saved K%s of the K%s minimum', p.saving, v_r.min_saving)
  from paid p where v_today > v_p.deadline and p.saving < v_r.min_saving
  union all
  select p.id, p.short_name, 'missed_minimum'::text, v_r.penalty_per_day,
         format('Paid K%s of the K%s minimum', p.payment, p.minimum)
  from paid p where v_today > v_p.deadline and p.payment < p.minimum
  order by 2, 3;
end $$;

create or replace function public.set_default(p_member uuid, p_cycle uuid, p_defaulted boolean, p_reason text)
returns public.member_status
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_m members; v member_status;
begin
  select * into v_m from members where id = p_member;
  if not found then raise exception 'member_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v_m.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if not exists (select 1 from cycles c where c.id = p_cycle and c.group_id = v_m.group_id) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
  if p_defaulted is null or coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;

  insert into member_status (group_id, member_id, cycle_id, defaulted, changed_by, reason)
  values (v_m.group_id, p_member, p_cycle, p_defaulted, auth.uid(), trim(p_reason))
  on conflict (member_id, cycle_id) do update
    set defaulted = excluded.defaulted, changed_at = now(), changed_by = excluded.changed_by, reason = excluded.reason
  returning * into v;
  perform private.audit(v_m.group_id, 'member.default_changed', 'members', p_member,
    jsonb_build_object('cycle_id', p_cycle, 'defaulted', p_defaulted, 'reason', trim(p_reason)));
  return v;
end $$;

-- Corrections and waivers land in the cycle's open month and point at the original entry, so closed months are
-- never rewritten and balances fix forward. Locking the open month makes a correction wait for a close in progress.
create or replace function public.post_correction(p_entry uuid, p_new_amount numeric, p_reason text)
returns public.entries
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_e entries; v_root entries; v_open periods; v_eff numeric; v_delta numeric; v entries;
begin
  select * into v_e from entries where id = p_entry;
  if not found then raise exception 'entry_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v_e.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
  if p_new_amount is null or p_new_amount < 0 or p_new_amount <> round(p_new_amount, 2) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  select * into v_root from entries where id = coalesce(v_e.corrects_entry_id, v_e.id);
  select p.* into v_open from periods p join periods o on o.cycle_id = p.cycle_id
   where o.id = v_root.period_id and p.status = 'open' for update of p;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;

  select v_root.amount + coalesce(sum(case when c.kind in ('waiver', 'adjustment') then -c.amount else c.amount end), 0)
    into v_eff from entries c where c.corrects_entry_id = v_root.id;
  v_delta := p_new_amount - v_eff;
  if v_delta = 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;

  insert into entries (group_id, period_id, member_id, kind, amount, loan_id, wallet_id, source, corrects_entry_id, reason, created_by)
  values (v_root.group_id, v_open.id, v_root.member_id, case when v_delta > 0 then v_root.kind else 'adjustment' end,
          abs(v_delta), v_root.loan_id, v_root.wallet_id, 'correction', v_root.id, trim(p_reason), auth.uid())
  returning * into v;
  perform private.audit(v_root.group_id, 'entry.corrected', 'entries', v_root.id, jsonb_build_object(
    'kind', v_root.kind, 'from', v_eff, 'to', p_new_amount, 'reason', trim(p_reason), 'correction_id', v.id));
  return v;
end $$;

create or replace function public.post_waiver(p_entry uuid, p_amount numeric, p_reason text)
returns public.entries
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_e entries; v_root entries; v_open periods; v_eff numeric; v entries;
begin
  select * into v_e from entries where id = p_entry;
  if not found then raise exception 'entry_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v_e.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  select * into v_root from entries where id = coalesce(v_e.corrects_entry_id, v_e.id);
  if v_root.kind not in ('loan_interest', 'excess_charge', 'penalty') then
    raise exception 'entry_not_found' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
  select v_root.amount + coalesce(sum(case when c.kind in ('waiver', 'adjustment') then -c.amount else c.amount end), 0)
    into v_eff from entries c where c.corrects_entry_id = v_root.id;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) or p_amount > v_eff then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  select p.* into v_open from periods p join periods o on o.cycle_id = p.cycle_id
   where o.id = v_root.period_id and p.status = 'open' for update of p;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;

  insert into entries (group_id, period_id, member_id, kind, amount, loan_id, source, corrects_entry_id, reason, created_by)
  values (v_root.group_id, v_open.id, v_root.member_id, 'waiver', p_amount, v_root.loan_id, 'correction', v_root.id,
          trim(p_reason), auth.uid())
  returning * into v;
  perform private.audit(v_root.group_id, 'entry.corrected', 'entries', v_root.id, jsonb_build_object(
    'kind', v_root.kind, 'waived', p_amount, 'reason', trim(p_reason), 'correction_id', v.id));
  return v;
end $$;

revoke execute on function
  public.apply_penalty(uuid, uuid, numeric, text, text), public.suggest_penalties(uuid),
  public.set_default(uuid, uuid, boolean, text), public.post_correction(uuid, numeric, text),
  public.post_waiver(uuid, numeric, text)
  from public, anon, authenticated;
grant execute on function
  public.apply_penalty(uuid, uuid, numeric, text, text), public.suggest_penalties(uuid),
  public.set_default(uuid, uuid, boolean, text), public.post_correction(uuid, numeric, text),
  public.post_waiver(uuid, numeric, text)
  to authenticated;
```

- [ ] **Step 4: Apply and run**

```bash
bun run db:reset    # or, hosted dev: bun run db:push
bun run db:test
```
Expected: every file `ok`.

- [ ] **Step 5: Commit**

```bash
git status --short data/    # Expected: no output
git add supabase
git commit -m "feat: penalties with suggestions, default flags, corrections and waivers"
```

---
### Task 6: Month close — cash, charges, payments, interest, statements

**Files:**
- Create: `supabase/migrations/20261010001200_ledger_close.sql`, `supabase/tests/database/11_ledger_close.sql`
- Modify: `supabase/tests/database/00_ledger_helpers.sql` (add `tests.ledger_inputs(month)`)

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces:
  - `private.close_figures(p_period uuid, p_imported boolean default false) → jsonb`, read-only:
    `{period_id, label, month_index, committed: false, group: {opening_cash, received, savings, loans_sent, idle_cash, excess_rate, excess_billed, interest_collected, fee_pot_in, fee_pot_out, fee_pot_balance, meeting_pot_in, meeting_pot_balance, total_savings, total_owed}, members: [{member_id, short_name, opening_owed, saving, cum_savings, loan_principal_sent, loan_interest_charged, excess_charged, penalties_charged, paid_total, paid_to_excess, paid_to_penalties, paid_to_interest, paid_to_principal, closing_owed, next_minimum, unpaid_minimum, interest_earned, interest_earned_to_date, excess_share, interest_share}] (by short_name), loans: [{loan_id, remaining}]}`.
    In imported mode the month's excess shares are the `excess_charge` entries with `source='import'` and `next_minimum` is the workbook's (`workbook_figures`) where present.
  - `private.write_close(p_period uuid, p_figures jsonb, p_source text) → void`: writes `excess_charge` (only for `source='close'`) and `interest_share` entries, statements, the group statement, and marks paid-off loans `repaid`.
  - `public.close_month(p_period uuid, p_commit boolean default false, p_reason text default null) → jsonb` (`period.closed`): the figures; with `p_commit` they are written and the month is `closed` (the result has `committed: true`). Refusals: `period_not_open` (unknown or planned), `not_admin`, `already_closed` (commit only), `previous_period_open`, `declarations_pending`. Task 7 adds the difference list and `unexplained_differences`.
  - Test helper `tests.ledger_inputs(p_month int)`: opens month 1, 2 or 3 of the synthetic scenario as the treasurer and enters its inputs (below).

The scenario (synthetic, worked by hand in the test comments):
- **February:** savings 7,300 (Ann 1,000, Ben 500, Cid 2,000, Dee 250, Eve 300, Fay 250, twelve plain savers 250 each, Zed nothing); membership 50 × 18; Ann and Ben declare fees of 10 and 5. Loans: Cid 3,000 (fee 10), Ben 1,000 and Ben 3,001 (over the cap, with a reason).
- **March:** Ann pays her minimum 4.09 (full payer), Ben his minimum 2,877.61 (minimum-only), Cid his full 3,458.27, Eve 0.50 of 1.22 (partial), Dee nothing (nil payer), Fay and the plain savers 1.02; everyone but Dee and Zed saves again. Fay borrows 750 (fee 5) and the interest is waived (zero-interest loan); Dee gets a K100 late penalty and is marked defaulted.
- **April:** opened only, for the closed-month correction.

- [ ] **Step 1: Add the scenario helper**

In `supabase/tests/database/00_ledger_helpers.sql`, above `-- Later tasks add helpers above this line.`, add:
```sql
-- The close scenario's inputs, entered as the treasurer (Ann). Role switching is not allowed inside a security
-- definer function, but the JWT claims are: auth.uid() reads them, so is_admin() sees the treasurer.
create or replace function tests.ledger_inputs(p_month int) returns void
language plpgsql security definer set search_path = public, tests as $$
declare n text; v_loan uuid;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.id('admin'), 'role', 'authenticated', 'email', 'admin@test.local')::text, true);
  perform open_period(tests.id('lcycle'), p_month);
  if p_month = 1 then
    perform tests.ledger_feb_savings();
    perform send_loan(tests.lm('Cid'), 3000, tests.id('w_airtel'), null, 10);
    perform send_loan(tests.lm('Ben'), 1000, tests.id('w_mtn'));
    perform send_loan(tests.lm('Ben'), 3001, tests.id('w_mtn'), 'agreed at the meeting');
  elsif p_month = 2 then
    perform tests.ledger_pay('Ann', 2, 1000, 4.09);
    perform tests.ledger_pay('Ben', 2, 500, 2877.61);
    perform tests.ledger_pay('Cid', 2, 2000, 3458.27);
    perform tests.ledger_pay('Eve', 2, 300, 0.50);
    perform tests.ledger_pay('Fay', 2, 250, 1.02);
    foreach n in array tests.plain() loop
      perform tests.ledger_pay(n, 2, 250, 1.02);
    end loop;
    v_loan := (send_loan(tests.lm('Fay'), 750, tests.id('w_airtel'), null, 5)).id;
    perform post_waiver((select id from entries where loan_id = v_loan and kind = 'loan_interest'), 112.50,
                        'zero-interest loan agreed by the group');
    perform apply_penalty(tests.lm('Dee'), tests.lp(2), 100, 'late_declaration', 'declared 2 days late');
    perform set_default(tests.lm('Dee'), tests.id('lcycle'), true, 'no payments since February');
  end if;
end $$;
```

- [ ] **Step 2: Write the failing tests**

`supabase/tests/database/11_ledger_close.sql`:
```sql
begin;
select * from no_plan();
select tests.ledger_fixture();
-- Every expected figure below is worked by hand in the comments; none comes from calling the function under test.

-- previous_period_open: March open while February is not closed (set up directly; open_period would refuse it)
update periods set status = 'open' where id = tests.lp(2);
select tests.login_as(tests.id('admin'));
select throws_ok($$select close_month(tests.lp(2))$$, 'P0001', 'previous_period_open', 'a month closes only after the one before');
reset role;
update periods set status = 'planned' where id = tests.lp(2);

select tests.ledger_inputs(1);

-- refusals --------------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select throws_ok($$select close_month(tests.lp(2))$$, 'P0001', 'period_not_open', 'a planned month cannot be closed');
select throws_ok($$select close_month(gen_random_uuid())$$, 'P0001', 'period_not_open', 'nor an unknown one');
reset role;
select tests.login_as(tests.id('member'));
select throws_ok($$select close_month(tests.lp(1))$$, '42501', 'not_admin', 'members cannot preview a close');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select close_month(tests.lp(1))$$, '42501', 'not_admin', 'another group''s admin cannot preview this close');
reset role;
select tests.login_anon();
select throws_ok($$select close_month(tests.lp(1))$$, '42501', null, 'anon cannot call close_month');
reset role;
select tests.login_as(tests.id('admin'));
select lives_ok($$select submit_declaration(tests.lp(1), tests.lm('Zed'), p_borrowing_request => 500)$$, 'Zed asks to borrow');
select throws_ok($$select close_month(tests.lp(1))$$, 'P0001', 'declarations_pending', 'a waiting declaration blocks the close');
select throws_ok($$select close_month(tests.lp(1), true)$$, 'P0001', 'declarations_pending', 'and the commit');
select lives_ok($$select return_declaration((select id from declarations where member_id = tests.lm('Zed')), 'no savings yet')$$,
  'the treasurer returns it');

-- February preview ---------------------------------------------------------------------------------
select tests.keep('feb', close_month(tests.lp(1)));
select tests.keep('feb_again', close_month(tests.lp(1)));
reset role;
select is(tests.kept('feb'), tests.kept('feb_again'), 'determinism: the same inputs give the same figures');
select is((select count(*)::int from statements where period_id = tests.lp(1)), 0, 'a preview writes no statements');
select is((select count(*)::int from entries where period_id = tests.lp(1) and source = 'close'), 0, 'and no entries');
select is((select status from periods where id = tests.lp(1)), 'open', 'and leaves the month open');

-- Cash. No payments in the first month: opening = 0 + 0 = 0.
-- Savings 1,000 + 500 + 2,000 + 250 + 300 + 250 + 12 × 250 = 7,300. Loans 3,000 + 1,000 + 3,001 = 7,001.
-- Idle = 0 + 7,300 − 7,001 = 299. Excess = round(10% × 299, 2) = 29.90.
select is(tests.gfig('feb', 'opening_cash'), 0.00, 'opening cash 0');
select is(tests.gfig('feb', 'savings'), 7300.00, 'savings 7,300');
select is(tests.gfig('feb', 'loans_sent'), 7001.00, 'loans 7,001');
select is(tests.gfig('feb', 'idle_cash'), 299.00, 'idle cash 299');
select is(tests.gfig('feb', 'excess_billed'), 29.90, 'excess billed 29.90');
-- Pots, apart from lending cash: fee pot 10 + 5 in, Cid's loan fee 10 out → 5. Meeting pot 18 × 50 = 900.
select is(tests.gfig('feb', 'fee_pot_in'), 15.00, 'members'' declared fees go to the fee pot');
select is(tests.gfig('feb', 'fee_pot_out'), 10.00, 'the loan transfer fee comes out of it');
select is(tests.gfig('feb', 'fee_pot_balance'), 5.00, 'fee pot 5');
select is(tests.gfig('feb', 'meeting_pot_balance'), 900.00, 'membership goes to the meeting pot');
-- Owed: loans 7,001 + interest (450 + 150 + 450.15 = 1,050.15) + excess 29.90 = 8,081.05.
select is(tests.gfig('feb', 'total_owed'), 8081.05, 'total owed 8,081.05');
select is(tests.gfig('feb', 'total_savings'), 7300.00, 'total savings 7,300');
select is(tests.gfig('feb', 'interest_collected'), 0.00, 'nothing paid yet, nothing to share');

-- Excess split by cumulative savings, 29.90 / 7,300 per kwacha, each share cut to the ngwee:
--   Ann 1,000 → 4.0958 → 4.09; Ben 500 → 2.0479 → 2.04; Cid 2,000 → 8.1917 → 8.19; Eve 300 → 1.2287 → 1.22;
--   Dee, Fay and the twelve plain savers 250 → 1.0239 → 1.02; Zed 0 → 0.
--   Sum 4.09 + 2.04 + 8.19 + 1.22 + 14 × 1.02 = 29.82; the 0.08 remainder goes to the largest saver, Cid: 8.27.
select is(tests.fig('feb', 'Ann', 'excess_charged'), 4.09, 'Ann''s excess 4.09');
select is(tests.fig('feb', 'Ben', 'excess_charged'), 2.04, 'Ben''s excess 2.04');
select is(tests.fig('feb', 'Cid', 'excess_charged'), 8.27, 'Cid, the largest saver, takes the ngwee remainder: 8.27');
select is(tests.fig('feb', 'Eve', 'excess_charged'), 1.22, 'Eve''s excess 1.22');
select is(tests.fig('feb', 'Gus', 'excess_charged'), 1.02, 'a plain saver''s excess 1.02');
select is((select sum((m ->> 'excess_charged')::numeric) from jsonb_array_elements(tests.kept('feb') -> 'members') m), 29.90,
  'the shares add up to the excess billed, to the ngwee');
-- Zed: nothing saved, so no share of the excess, nothing owed, and no division by zero.
select is(tests.fig('feb', 'Zed', 'excess_charged'), 0.00, 'Zed (no savings) is billed no excess');
select is(tests.fig('feb', 'Zed', 'closing_owed'), 0.00, 'and owes nothing');
-- Ben: 1,000 (1 month, interest 150) and 3,001 (2 months, interest 450.15).
--   closing = 0 + 4,001 + 600.15 + 2.04 − 0 = 4,603.19
--   March instalments 1,150 + 1,725.57 = 2,875.57; minimum = 2,875.57 + 2.04 + 0 = 2,877.61 (below 4,603.19)
select is(tests.fig('feb', 'Ben', 'loan_principal_sent'), 4001.00, 'Ben''s two loans');
select is(tests.fig('feb', 'Ben', 'loan_interest_charged'), 600.15, 'interest charged when sent');
select is(tests.fig('feb', 'Ben', 'closing_owed'), 4603.19, 'Ben owes 4,603.19');
select is(tests.fig('feb', 'Ben', 'next_minimum'), 2877.61, 'Ben''s minimum 2,877.61');
-- Cid: 3,000 + 450 + 8.27 = 3,458.27 owed; minimum = 3,450 (all of the 1-month loan) + 8.27 = 3,458.27.
select is(tests.fig('feb', 'Cid', 'closing_owed'), 3458.27, 'Cid owes 3,458.27');
select is(tests.fig('feb', 'Cid', 'next_minimum'), 3458.27, 'and must pay all of it');
-- Ann owes only her excess, and that is her minimum.
select is(tests.fig('feb', 'Ann', 'closing_owed'), 4.09, 'Ann owes 4.09');
select is(tests.fig('feb', 'Ann', 'next_minimum'), 4.09, 'her minimum is her excess');

-- Commit February ---------------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select tests.keep('feb_commit', close_month(tests.lp(1), true, 'first close'));
-- Review focus 1: a second close of the same month (another phone) is refused...
select throws_ok($$select close_month(tests.lp(1), true)$$, 'P0001', 'already_closed', 'a month cannot be closed twice');
reset role;
select is(tests.kept('feb_commit') - 'committed', tests.kept('feb') - 'committed', 'preview and commit give the same figures');
select is((tests.kept('feb_commit') ->> 'committed')::boolean, true, 'the commit says so');
select is((select status from periods where id = tests.lp(1)), 'closed', 'February is closed');
select is((select closed_by from periods where id = tests.lp(1)), tests.id('admin'), 'by the treasurer');
select is((select count(*)::int from statements where period_id = tests.lp(1)), 19, 'one statement per member, Zed included');
select is((select closing_owed from statements where period_id = tests.lp(1) and member_id = tests.lm('Ben')), 4603.19, 'Ben''s statement');
select is((select idle_cash || '/' || excess_billed from group_statements where period_id = tests.lp(1)), '299.00/29.90', 'the group statement');
select is((select sum(amount) from entries where period_id = tests.lp(1) and kind = 'excess_charge' and source = 'close'), 29.90,
  'the excess is booked as entries');
select is((select count(*)::int from entries where period_id = tests.lp(1) and kind = 'excess_charge'), 18,
  'one excess entry per member with a share (not Zed)');
select is((select data ->> 'reason' from audit_log where action = 'period.closed' and entity_id = tests.lp(1)), 'first close', 'the close is audited');
-- ...and if two closes ever raced past the lock, the unique keys stop a second set of statements.
select throws_ok($$insert into statements (group_id, period_id, member_id, source) values (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 'close')$$,
  '23505', null, 'one statement per member per month, whatever happens');
select throws_ok($$insert into group_statements (group_id, period_id, excess_rate, source) values (tests.id('lg'), tests.lp(1), 0.10, 'close')$$,
  '23505', null, 'one group statement per month');
-- A closed month still previews (ledger:check replays them) and gives the same figures.
select tests.login_as(tests.id('admin'));
select is(close_month(tests.lp(1)) - 'committed', tests.kept('feb') - 'committed', 'a closed month replays to the same figures');
reset role;

-- March ------------------------------------------------------------------------------------------------
select tests.ledger_inputs(2);
select tests.login_as(tests.id('admin'));
select tests.keep('mar', close_month(tests.lp(2)));
reset role;
-- Cash. Payments 4.09 + 2,877.61 + 3,458.27 + 0.50 + 1.02 + 12 × 1.02 = 6,353.73. Opening = 299 + 6,353.73 = 6,652.73.
-- Savings 1,000 + 500 + 2,000 + 300 + 250 + 12 × 250 = 7,050. Loans: Fay 750. Idle = 6,652.73 + 7,050 − 750 = 12,952.73.
-- Excess = round(10% × 12,952.73, 2) = 1,295.27.
select is(tests.gfig('mar', 'received'), 6353.73, 'payments for February arrive in March''s window');
select is(tests.gfig('mar', 'opening_cash'), 6652.73, 'opening 6,652.73');
select is(tests.gfig('mar', 'idle_cash'), 12952.73, 'idle 12,952.73');
select is(tests.gfig('mar', 'excess_billed'), 1295.27, 'excess 1,295.27');
select is(tests.gfig('mar', 'fee_pot_balance'), 0.00, 'fee pot 5 − Fay''s loan fee 5 = 0');
select is(tests.gfig('mar', 'meeting_pot_balance'), 900.00, 'no membership due in March');
-- Cumulative savings: Ann 2,000, Ben 1,000, Cid 4,000, Dee 250, Eve 600, Fay 500, plain 500 each, Zed 0 → 14,350.
-- 1,295.27 / 14,350 per kwacha: Ann 180.5254 → 180.52; Ben 90.2627 → 90.26; Cid 361.0508 → 361.05; Dee 22.5656 → 22.56;
-- Eve 54.1576 → 54.15; Fay and plain 45.1313 → 45.13. Sum 180.52 + 90.26 + 361.05 + 22.56 + 54.15 + 13 × 45.13 = 1,295.23;
-- remainder 0.04 to Cid → 361.09.
select is(tests.gfig('mar', 'total_savings'), 14350.00, 'total savings 14,350');
select is(tests.fig('mar', 'Cid', 'excess_charged'), 361.09, 'Cid''s excess with the remainder');
select is(tests.fig('mar', 'Dee', 'excess_charged'), 22.56, 'a defaulter is still billed excess');
select is((select sum((m ->> 'excess_charged')::numeric) from jsonb_array_elements(tests.kept('mar') -> 'members') m), 1295.27,
  'March''s shares add up to the excess billed');

-- Payments, charges first: excess, then penalties, then interest, then principal.
-- Ben (minimum-only): excess due 2.04 + 90.26 = 92.30, interest 600.15, principal 4,001. He pays 2,877.61:
--   92.30 to excess, 600.15 to interest, 2,185.16 to principal. Closing = 4,603.19 + 90.26 − 2,877.61 = 1,815.84.
--   Oldest loan first: the 1,000 loan is paid off; the 3,001 loan has 3,001 − 1,185.16 = 1,815.84 left.
--   April instalment 1,725.58; minimum = 1,725.58 + 90.26 + unpaid 0 = 1,815.84, which is also all he owes.
select is(tests.fig('mar', 'Ben', 'paid_to_excess'), 92.30, 'Ben: excess first');
select is(tests.fig('mar', 'Ben', 'paid_to_interest'), 600.15, 'then interest');
select is(tests.fig('mar', 'Ben', 'paid_to_principal'), 2185.16, 'then principal');
select is(tests.fig('mar', 'Ben', 'closing_owed'), 1815.84, 'Ben owes 1,815.84');
select is(tests.fig('mar', 'Ben', 'unpaid_minimum'), 0.00, 'he paid his minimum');
select is(tests.fig('mar', 'Ben', 'next_minimum'), 1815.84, 'his April minimum');
-- Cid (full payer): excess due 8.27 + 361.09 = 369.36, interest 450. He pays 3,458.27:
--   369.36 + 450 + 2,638.91 to principal. Closing = 3,458.27 + 361.09 − 3,458.27 = 361.09, all on the loan.
--   No April instalment (a 1-month loan); minimum = 0 + 361.09 + 0 = 361.09.
select is(tests.fig('mar', 'Cid', 'paid_to_principal'), 2638.91, 'Cid''s payment reaches principal after this month''s excess');
select is(tests.fig('mar', 'Cid', 'closing_owed'), 361.09, 'Cid owes 361.09');
select is(tests.fig('mar', 'Cid', 'next_minimum'), 361.09, 'and must pay it');
-- Eve (partial): excess due 1.22 + 54.15; she pays 0.50. Closing = 1.22 + 54.15 − 0.50 = 54.87.
--   Unpaid minimum = 1.22 − 0.50 = 0.72; minimum = 0 + 54.15 + 0.72 = 54.87.
select is(tests.fig('mar', 'Eve', 'paid_to_excess'), 0.50, 'Eve''s 0.50 goes to excess');
select is(tests.fig('mar', 'Eve', 'unpaid_minimum'), 0.72, 'Eve is 0.72 short');
select is(tests.fig('mar', 'Eve', 'next_minimum'), 54.87, 'which joins her next minimum in full');
-- Dee (nil payer, penalty, defaulted): closing = 1.02 + 22.56 + 100 − 0 = 123.58; unpaid 1.02; minimum 22.56 + 1.02 = 23.58.
select is(tests.fig('mar', 'Dee', 'penalties_charged'), 100.00, 'Dee''s penalty');
select is(tests.fig('mar', 'Dee', 'closing_owed'), 123.58, 'Dee owes 123.58');
select is(tests.fig('mar', 'Dee', 'unpaid_minimum'), 1.02, 'she paid none of her minimum');
select is(tests.fig('mar', 'Dee', 'next_minimum'), 23.58, 'the minimum is instalments + excess + unpaid minimum, not the penalty');
-- Fay (zero-interest loan): 750 + 112.50 interest − 112.50 waived = 0 interest. Closing = 1.02 + 750 + 0 + 45.13 − 1.02 = 795.13.
--   Her April instalment was set at 862.50, but the loan now owes 750, so 750 is asked: minimum 750 + 45.13 = 795.13.
select is(tests.fig('mar', 'Fay', 'loan_interest_charged'), 0.00, 'the waived interest nets to zero');
select is(tests.fig('mar', 'Fay', 'closing_owed'), 795.13, 'Fay owes 795.13');
select is(tests.fig('mar', 'Fay', 'next_minimum'), 795.13, 'an instalment never asks for more than the loan owes');
-- Ann pays her 4.09; closing 180.52, minimum 180.52.
select is(tests.fig('mar', 'Ann', 'closing_owed'), 180.52, 'Ann owes March''s excess');
-- Total owed = 8,081.05 + charges (750 + 0 + 1,295.27 + 100) − 6,353.73 = 3,872.59.
select is(tests.gfig('mar', 'total_owed'), 3872.59, 'total owed 3,872.59');

-- Interest earned: collected = excess, penalties and interest paid: Ann 4.09 + Ben 692.45 + Cid 819.36 + Eve 0.50
--   + Fay 1.02 + 12 × 1.02 = 1,529.66. Dee is in default, so it is shared over 14,350 − 250 = 14,100:
--   1,529.66 / 14,100 per kwacha: Ann 2,000 → 216.9730 → 216.97; Ben 1,000 → 108.4865 → 108.48; Cid 4,000 → 433.9461 → 433.94;
--   Eve 600 → 65.0919 → 65.09; Fay and plain 500 → 54.2432 → 54.24. Sum 1,529.60; remainder 0.06 to Cid → 434.00.
select is(tests.gfig('mar', 'interest_collected'), 1529.66, 'interest collected 1,529.66');
select is(tests.fig('mar', 'Ann', 'interest_earned'), 216.97, 'Ann''s share');
select is(tests.fig('mar', 'Cid', 'interest_earned'), 434.00, 'Cid''s share with the remainder');
select is(tests.fig('mar', 'Fay', 'interest_earned'), 54.24, 'Fay''s share');
select is(tests.fig('mar', 'Dee', 'interest_earned'), 0.00, 'a defaulter earns no share');
select is(tests.fig('mar', 'Zed', 'interest_earned'), 0.00, 'nor does a member with no savings');
select is(tests.fig('mar', 'Ben', 'interest_earned_to_date'), 108.48, 'earned to date');
select is((select sum((m ->> 'interest_earned')::numeric) from jsonb_array_elements(tests.kept('mar') -> 'members') m), 1529.66,
  'the shares add up to the interest collected, to the ngwee');

select tests.login_as(tests.id('admin'));
select tests.keep('mar_commit', close_month(tests.lp(2), true));
reset role;
select is(tests.kept('mar_commit') - 'committed', tests.kept('mar') - 'committed', 'March: preview and commit agree');
select is((select array_agg(status order by sent_at) from loans where member_id = tests.lm('Ben')), array['repaid', 'open'],
  'Ben''s first loan is repaid, the second still runs');
select is((select status from loans where member_id = tests.lm('Cid')), 'open', 'Cid''s loan still has 361.09 on it');
select is((select count(*)::int from entries where period_id = tests.lp(2) and kind = 'interest_share'), 17,
  'one interest entry per member with a share (not Dee, not Zed)');

-- Review focus 2: a correction to a closed month --------------------------------------------------------
select tests.ledger_inputs(3);   -- opens April
select tests.login_as(tests.id('admin'));
select lives_ok($$select post_correction((select id from entries where member_id = tests.lm('Ann') and kind = 'saving' and period_id = tests.lp(1)),
  1100, 'Ann sent K1,100 in February, not K1,000')$$, 'the treasurer corrects February in April');
select tests.keep('apr', close_month(tests.lp(3)));
reset role;
select is((select period_id from entries where source = 'correction' and member_id = tests.lm('Ann')), tests.lp(3),
  'the correction is April''s entry');
select is((select saving || '/' || cum_savings from statements where period_id = tests.lp(1) and member_id = tests.lm('Ann')),
  '1000.00/1000.00', 'February''s statement is not rewritten');
select is((select cum_savings from statements where period_id = tests.lp(2) and member_id = tests.lm('Ann')), 2000.00,
  'nor March''s');
-- April: the +100 is April's saving; cumulative 1,000 + 1,000 + 100 = 2,100.
select is(tests.fig('apr', 'Ann', 'saving'), 100.00, 'April carries the K100');
select is(tests.fig('apr', 'Ann', 'cum_savings'), 2100.00, 'and the balance fixes forward');

select * from finish();
rollback;
```

- [ ] **Step 3: Run it to see it fail**

```bash
bun run db:test
```
Expected: `00_ledger_helpers.sql .. ok` (plpgsql bodies are not resolved until called) and `11_ledger_close.sql .. FAILED` (function close_month does not exist).

- [ ] **Step 4: Write the migration**

`supabase/migrations/20261010001200_ledger_close.sql`:
```sql
-- Month close (spec §5). close_figures computes; write_close writes; close_month previews or commits.
-- The 2026 import closes its months through the same two functions.

create or replace function private.close_figures(p_period uuid, p_imported boolean default false) returns jsonb
language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_p periods;
  v_r cycle_rules;
  v_prev_id uuid;
  v_prev_gs group_statements;
  v_received numeric;
  v_savings numeric;
  v_loans numeric;
  v_fee_in numeric;
  v_fee_out numeric;
  v_meet_in numeric;
  v_opening numeric;
  v_idle numeric;
  v_excess numeric;
  v_out jsonb;
begin
  select * into v_p from periods where id = p_period;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  select * into v_r from cycle_rules where cycle_id = v_p.cycle_id;
  select id into v_prev_id from periods where cycle_id = v_p.cycle_id and month_index = v_p.month_index - 1;
  select * into v_prev_gs from group_statements where period_id = v_prev_id;

  -- Step 2, cash. Payments for last month's statement arrive in this month's window. Transfer fees and membership
  -- sit in their own pots and never touch lending cash.
  select coalesce(sum(amount) filter (where kind = 'payment'), 0),
         coalesce(sum(amount) filter (where kind = 'saving'), 0),
         coalesce(sum(amount) filter (where kind = 'loan_sent'), 0),
         coalesce(sum(amount) filter (where kind = 'txn_fee'), 0),
         coalesce(sum(amount) filter (where kind = 'payout_fee'), 0),
         coalesce(sum(amount) filter (where kind = 'membership'), 0)
    into v_received, v_savings, v_loans, v_fee_in, v_fee_out, v_meet_in
    from private.ledger_lines where period_id = p_period;
  v_opening := coalesce(v_prev_gs.idle_cash, 0) + v_received;
  v_idle := v_opening + v_savings - v_loans;
  -- Step 3, the excess charge: the cycle's rate (10%) of idle lending cash, to the ngwee.
  v_excess := round(v_r.excess_rate * greatest(v_idle, 0), 2);

  with mem as (
    select m.id, m.short_name, coalesce(ms.defaulted, false) as defaulted
    from members m
    left join member_status ms on ms.member_id = m.id and ms.cycle_id = v_p.cycle_id
    where m.group_id = v_p.group_id
      and (m.status = 'active'
           or exists (select 1 from private.ledger_lines x where x.member_id = m.id and x.cycle_id = v_p.cycle_id))
  ),
  lines as (
    select l.* from private.ledger_lines l
    where l.cycle_id = v_p.cycle_id and l.month_index <= v_p.month_index and l.member_id is not null
  ),
  sums as (
    select mem.id, mem.short_name, mem.defaulted,
      coalesce(sum(l.amount) filter (where l.kind = 'saving' and l.month_index = v_p.month_index), 0) as saving,
      coalesce(sum(l.amount) filter (where l.kind = 'saving'), 0) as cum_savings,
      coalesce(sum(l.amount) filter (where l.kind = 'payment' and l.month_index = v_p.month_index), 0) as paid_total,
      coalesce(sum(l.amount) filter (where l.kind = 'loan_sent' and l.month_index = v_p.month_index), 0) as principal_sent,
      coalesce(sum(l.amount) filter (where l.kind = 'loan_interest' and l.month_index = v_p.month_index), 0) as interest_charged,
      coalesce(sum(l.amount) filter (where l.kind = 'penalty' and l.month_index = v_p.month_index), 0) as penalties_charged,
      -- This month's excess and interest shares are what the close produces, so a replay of a closed month ignores
      -- the ones already booked; only corrections posted this month (and an import's own excess) are inputs.
      coalesce(sum(l.amount) filter (where l.kind = 'excess_charge' and l.month_index = v_p.month_index
                                       and l.source = 'correction'), 0) as excess_adjust,
      coalesce(sum(l.amount) filter (where l.kind = 'excess_charge' and l.month_index = v_p.month_index
                                       and l.source = 'import'), 0) as excess_imported,
      coalesce(sum(l.amount) filter (where l.kind = 'interest_share' and l.month_index = v_p.month_index
                                       and l.source = 'correction'), 0) as share_adjust,
      coalesce(sum(l.amount) filter (where l.kind = 'excess_charge' and l.month_index < v_p.month_index), 0) as excess_before,
      coalesce(sum(l.amount) filter (where l.kind = 'penalty'), 0) as penalties_to_date,
      coalesce(sum(l.amount) filter (where l.kind = 'loan_interest'), 0) as interest_to_date
    from mem left join lines l on l.member_id = mem.id
    group by mem.id, mem.short_name, mem.defaulted
  ),
  -- What earlier statements of this cycle already applied, bucket by bucket.
  earlier as (
    select s.member_id,
           sum(s.paid_to_excess) as exc_paid, sum(s.paid_to_penalties) as pen_paid,
           sum(s.paid_to_interest) as int_paid, sum(s.paid_to_principal) as pri_paid
    from statements s join periods p on p.id = s.period_id
    where p.cycle_id = v_p.cycle_id and p.month_index < v_p.month_index
    group by s.member_id
  ),
  prev as (
    select s.member_id, s.closing_owed, s.next_minimum, s.interest_earned_to_date
    from statements s where s.period_id = v_prev_id
  ),
  -- Step 3, the split: by cumulative savings including this month's deposit, every member billed (arrears and
  -- defaulters too), each share cut to the ngwee; the remainder goes to the largest saver so the parts sum exactly.
  ex1 as (
    select s.id,
           case when p_imported then s.excess_imported
                else coalesce(trunc(v_excess * s.cum_savings / nullif(sum(s.cum_savings) over (), 0), 2), 0) end as share,
           row_number() over (order by s.cum_savings desc, s.short_name) as rnk,
           sum(s.cum_savings) over () as total_cum
    from sums s
  ),
  ex as (
    select ex1.id,
           ex1.share + case when ex1.rnk = 1 and not p_imported and ex1.total_cum > 0
                            then v_excess - sum(ex1.share) over () else 0 end as share
    from ex1
  ),
  due as (
    select s.*, ex.share as excess_share, ex.share + s.excess_adjust as excess_charged,
           s.excess_before + ex.share + s.excess_adjust - coalesce(pr.exc_paid, 0) as exc_due,
           s.penalties_to_date - coalesce(pr.pen_paid, 0) as pen_due,
           s.interest_to_date - coalesce(pr.int_paid, 0) as int_due,
           coalesce(pr.int_paid, 0) as int_paid_before,
           coalesce(pr.pri_paid, 0) as pri_paid_before
    from sums s join ex on ex.id = s.id left join earlier pr on pr.member_id = s.id
  ),
  -- Step 4, payments: excess, then penalties, then loan interest, then principal. Whatever is left (or a reversal,
  -- when a correction makes the month's payments negative) goes to principal; beyond the debt it is a credit.
  a1 as (select d.*, case when d.paid_total > 0 then least(d.paid_total, greatest(d.exc_due, 0)) else 0 end as to_exc from due d),
  a2 as (select a1.*, case when a1.paid_total > 0 then least(a1.paid_total - a1.to_exc, greatest(a1.pen_due, 0)) else 0 end as to_pen
         from a1),
  a3 as (select a2.*, case when a2.paid_total > 0 then least(a2.paid_total - a2.to_exc - a2.to_pen, greatest(a2.int_due, 0)) else 0 end
                as to_int
         from a2),
  alloc as (select a3.*, a3.paid_total - a3.to_exc - a3.to_pen - a3.to_int as to_pri from a3),
  -- Payments always clear the oldest loan first, so everything paid to interest and to principal so far fills the
  -- member's loans in the order they were sent. That gives each loan's remaining balance without storing one.
  loan_amounts as (
    select l.id as loan_id, l.member_id, l.sent_at,
           coalesce(sum(x.amount) filter (where x.kind = 'loan_sent'), 0) as principal,
           coalesce(sum(x.amount) filter (where x.kind = 'loan_interest'), 0) as interest
    from loans l
    join periods lp on lp.id = l.period_id
    left join private.ledger_lines x on x.loan_id = l.id and x.month_index <= v_p.month_index
    where lp.cycle_id = v_p.cycle_id and lp.month_index <= v_p.month_index
    group by l.id, l.member_id, l.sent_at
  ),
  loan_left as (
    select la.loan_id, la.member_id, la.sent_at,
           (la.interest - least(la.interest, greatest(0, a.int_paid_before + a.to_int - coalesce(sum(la.interest) over w, 0))))
         + (la.principal - least(la.principal, greatest(0, a.pri_paid_before + a.to_pri - coalesce(sum(la.principal) over w, 0))))
           as remaining
    from loan_amounts la join alloc a on a.id = la.member_id
    window w as (partition by la.member_id order by la.sent_at, la.loan_id rows between unbounded preceding and 1 preceding)
  ),
  -- Next month's instalments on loans still owing, each capped at what that loan still owes (a waiver or an early
  -- payment shortens the schedule rather than asking for money that is not owed).
  next_due as (
    select ll.member_id, sum(least(i.amount_due, greatest(ll.remaining, 0))) as amount
    from loan_left ll
    join loan_instalments i on i.loan_id = ll.loan_id
    join periods np on np.id = i.period_id and np.month_index = v_p.month_index + 1
    group by ll.member_id
  ),
  -- Step 5, interest earned: what was collected this month (paid to excess, penalties and loan interest), shared by
  -- cumulative savings among members not in default; the remainder to the largest share.
  pool as (select coalesce(sum(a.to_exc + a.to_pen + a.to_int), 0) as collected from alloc a),
  sh1 as (
    select a.id,
           case when a.defaulted then 0
                else coalesce(trunc(pool.collected * a.cum_savings
                                    / nullif(sum(a.cum_savings) filter (where not a.defaulted) over (), 0), 2), 0) end as share,
           row_number() over (order by a.defaulted, a.cum_savings desc, a.short_name) as rnk,
           coalesce(sum(a.cum_savings) filter (where not a.defaulted) over (), 0) as total_cum
    from alloc a cross join pool
  ),
  sh as (
    select sh1.id,
           sh1.share + case when sh1.rnk = 1 and sh1.total_cum > 0
                            then (select collected from pool) - sum(sh1.share) over () else 0 end as share
    from sh1
  ),
  -- Step 6, statements.
  final as (
    select a.id as member_id, a.short_name,
           coalesce(pv.closing_owed, 0) as opening_owed,
           a.saving, a.cum_savings,
           a.principal_sent as loan_principal_sent, a.interest_charged as loan_interest_charged,
           a.excess_charged, a.penalties_charged, a.paid_total,
           a.to_exc as paid_to_excess, a.to_pen as paid_to_penalties, a.to_int as paid_to_interest, a.to_pri as paid_to_principal,
           coalesce(pv.closing_owed, 0) + a.principal_sent + a.interest_charged + a.excess_charged + a.penalties_charged
             - a.paid_total as closing_owed,
           greatest(0, coalesce(pv.next_minimum, 0) - a.paid_total) as unpaid_minimum,
           coalesce(nd.amount, 0) as next_due,
           a.excess_share,
           sh.share as interest_share,
           sh.share + a.share_adjust as interest_earned,
           coalesce(pv.interest_earned_to_date, 0) + sh.share + a.share_adjust as interest_earned_to_date
    from alloc a
    join sh on sh.id = a.id
    left join prev pv on pv.member_id = a.id
    left join next_due nd on nd.member_id = a.id
  ),
  final2 as (
    select f.*,
           case when p_imported and wf.value is not null then wf.value
                else greatest(0, least(f.closing_owed, f.next_due + f.excess_charged + f.unpaid_minimum)) end as next_minimum
    from final f
    left join workbook_figures wf on wf.period_id = p_period and wf.member_id = f.member_id and wf.field = 'next_minimum'
  )
  select jsonb_build_object(
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'member_id', member_id, 'short_name', short_name, 'opening_owed', opening_owed, 'saving', saving,
        'cum_savings', cum_savings, 'loan_principal_sent', loan_principal_sent, 'loan_interest_charged', loan_interest_charged,
        'excess_charged', excess_charged, 'penalties_charged', penalties_charged, 'paid_total', paid_total,
        'paid_to_excess', paid_to_excess, 'paid_to_penalties', paid_to_penalties, 'paid_to_interest', paid_to_interest,
        'paid_to_principal', paid_to_principal, 'closing_owed', closing_owed, 'next_minimum', next_minimum,
        'unpaid_minimum', unpaid_minimum, 'interest_earned', interest_earned, 'interest_earned_to_date', interest_earned_to_date,
        'excess_share', excess_share, 'interest_share', interest_share) order by short_name), '[]'::jsonb) from final2),
    'loans', (select coalesce(jsonb_agg(jsonb_build_object('loan_id', loan_id, 'remaining', remaining)
                                        order by sent_at, loan_id), '[]'::jsonb) from loan_left),
    'collected', (select collected from pool))
  into v_out;

  return jsonb_build_object(
    'period_id', p_period, 'label', v_p.label, 'month_index', v_p.month_index, 'committed', false,
    'group', jsonb_build_object(
      'opening_cash', v_opening, 'received', v_received, 'savings', v_savings, 'loans_sent', v_loans,
      'idle_cash', v_idle, 'excess_rate', v_r.excess_rate,
      'excess_billed', (select coalesce(sum((m ->> 'excess_share')::numeric), 0) from jsonb_array_elements(v_out -> 'members') m),
      'interest_collected', (v_out ->> 'collected')::numeric,
      'fee_pot_in', v_fee_in, 'fee_pot_out', v_fee_out,
      'fee_pot_balance', coalesce(v_prev_gs.fee_pot_balance, 0) + v_fee_in - v_fee_out,
      'meeting_pot_in', v_meet_in, 'meeting_pot_balance', coalesce(v_prev_gs.meeting_pot_balance, 0) + v_meet_in,
      'total_savings', (select coalesce(sum((m ->> 'cum_savings')::numeric), 0) from jsonb_array_elements(v_out -> 'members') m),
      'total_owed', (select coalesce(sum((m ->> 'closing_owed')::numeric), 0) from jsonb_array_elements(v_out -> 'members') m)),
    'members', v_out -> 'members',
    'loans', v_out -> 'loans');
end $$;

create or replace function private.write_close(p_period uuid, p_figures jsonb, p_source text) returns void
language plpgsql set search_path = public, pg_temp as $$
declare v_p periods;
begin
  select * into v_p from periods where id = p_period;
  -- The month's outputs as ledger entries. An import already carries the workbook's excess charges.
  insert into entries (group_id, period_id, member_id, kind, amount, source, created_by)
  select v_p.group_id, p_period, (m ->> 'member_id')::uuid, x.kind, x.amount, p_source, auth.uid()
  from jsonb_array_elements(p_figures -> 'members') m
  cross join lateral (values ('excess_charge', (m ->> 'excess_share')::numeric),
                             ('interest_share', (m ->> 'interest_share')::numeric)) as x(kind, amount)
  where x.amount > 0 and (x.kind = 'interest_share' or p_source = 'close');

  insert into statements (group_id, period_id, member_id, opening_owed, saving, cum_savings, loan_principal_sent,
    loan_interest_charged, excess_charged, penalties_charged, paid_total, paid_to_excess, paid_to_penalties,
    paid_to_interest, paid_to_principal, closing_owed, next_minimum, unpaid_minimum, interest_earned,
    interest_earned_to_date, source)
  select v_p.group_id, p_period, r.member_id, r.opening_owed, r.saving, r.cum_savings, r.loan_principal_sent,
    r.loan_interest_charged, r.excess_charged, r.penalties_charged, r.paid_total, r.paid_to_excess, r.paid_to_penalties,
    r.paid_to_interest, r.paid_to_principal, r.closing_owed, r.next_minimum, r.unpaid_minimum, r.interest_earned,
    r.interest_earned_to_date, p_source
  from jsonb_array_elements(p_figures -> 'members') m
  cross join lateral jsonb_populate_record(null::public.statements, m) r;

  insert into group_statements (group_id, period_id, opening_cash, received, savings, loans_sent, idle_cash, excess_rate,
    excess_billed, interest_collected, fee_pot_in, fee_pot_out, fee_pot_balance, meeting_pot_in, meeting_pot_balance,
    total_savings, total_owed, source)
  select v_p.group_id, p_period, r.opening_cash, r.received, r.savings, r.loans_sent, r.idle_cash, r.excess_rate,
    r.excess_billed, r.interest_collected, r.fee_pot_in, r.fee_pot_out, r.fee_pot_balance, r.meeting_pot_in,
    r.meeting_pot_balance, r.total_savings, r.total_owed, p_source
  from jsonb_populate_record(null::public.group_statements, p_figures -> 'group') r;

  update loans set status = 'repaid'
   where status = 'open'
     and id in (select (x ->> 'loan_id')::uuid from jsonb_array_elements(p_figures -> 'loans') x
                where (x ->> 'remaining')::numeric <= 0);
end $$;

create or replace function public.close_month(p_period uuid, p_commit boolean default false, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_p periods; v jsonb;
begin
  -- A commit locks the month before anything else: a second close (another phone) waits here, then finds it closed.
  -- send_loan, approvals, penalties and corrections take the same row lock, so nothing lands mid-close.
  if p_commit then
    select * into v_p from periods where id = p_period for update;
  else
    select * into v_p from periods where id = p_period;
  end if;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if not is_admin(v_p.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_commit and v_p.status = 'closed' then raise exception 'already_closed' using errcode = 'P0001'; end if;
  if v_p.status = 'planned' then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if v_p.month_index > 1 and not exists (select 1 from periods
                                          where cycle_id = v_p.cycle_id and month_index = v_p.month_index - 1 and status = 'closed') then
    raise exception 'previous_period_open' using errcode = 'P0001';
  end if;
  if exists (select 1 from declarations d
             where d.period_id = p_period and d.status = 'submitted'
               and not exists (select 1 from declarations n where n.supersedes_id = d.id)) then
    raise exception 'declarations_pending' using errcode = 'P0001';
  end if;

  -- Preview and commit share this one computation.
  v := private.close_figures(p_period, false);
  if not p_commit then return v; end if;

  perform private.write_close(p_period, v, 'close');
  update periods set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = p_period;
  perform private.audit(v_p.group_id, 'period.closed', 'periods', p_period, jsonb_build_object(
    'label', v_p.label, 'excess_billed', v -> 'group' -> 'excess_billed',
    'interest_collected', v -> 'group' -> 'interest_collected', 'reason', nullif(trim(p_reason), '')));
  return jsonb_set(v, '{committed}', 'true'::jsonb);
end $$;

revoke execute on function public.close_month(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.close_month(uuid, boolean, text) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
```

- [ ] **Step 5: Apply and run**

```bash
bun run db:reset    # or, hosted dev: bun run db:push
bun run db:test
```
Expected: every file `ok`. If a figure in `11_ledger_close.sql` fails, re-check the hand arithmetic in its comment before touching the function; the comment, not the function, is the reference.

- [ ] **Step 6: Commit**

```bash
git status --short data/    # Expected: no output
git add supabase
git commit -m "feat: preview and commit a month close with statements, excess and interest shares"
```

---
### Task 7: Workbook differences, reason codes and the check function

**Files:**
- Create: `supabase/migrations/20261010001300_ledger_diff_check.sql`, `supabase/tests/database/12_ledger_diff.sql`
- Modify: `supabase/tests/database/00_ledger_helpers.sql` (add `tests.reason`)

**Interfaces:**
- Consumes: Task 6 (`private.close_figures`, `private.write_close`).
- Produces:
  - `private.close_diff(p_period uuid, p_figures jsonb) → jsonb`: `[{member_id, short_name, field, app, workbook, difference, reason_code}]` ordered by `short_name` (group rows first) then `field`, for every compared field where the app's figure differs from `workbook_figures`. `difference = app − workbook`. Reason rules, first match wins:
    - group `idle_cash` / `opening_cash`: difference equals (±0.05) the loan fees paid from the fee pot over some run of months ending this month / last month → `fee_pot_vs_cash`; `excess_billed`: equals the rate × such a run → `fee_pot_vs_cash`.
    - member `excess_charged`: the group's excess difference is `fee_pot_vs_cash` and this one has the same sign and is no larger (+0.01) → `fee_pot_vs_cash`.
    - member `closing_owed`: within K1 of the member's excess difference → that difference's code (or `workbook_rounded`); app lower by this month's waivers (±K1) → `waiver`.
    - member `next_minimum`: app higher by the first instalment of a loan sent this month (±K1) → `workbook_missed_loan`; workbook higher by the membership fee (±K1) → `penalty_not_charged`; member still owes principal → `workbook_term_differs`.
    - anything under K1 → `workbook_rounded`; everything else → `unexplained`.
  - `public.close_month(…)` replaced: the result gains `diff` and `unexplained` (count); committing with `unexplained > 0` and no reason raises `unexplained_differences`; the audit row records the counts and the reason.
  - `private.check_cycle(p_cycle uuid) → jsonb`: `{cycle_id, cycle_label, periods: [{id, label, month_index, status, group (stored group statement or null), checked (workbook figures exist), diff}]}` for every non-planned month.
  - `public.ledger_check(p_group uuid) → jsonb`, read-only, admin-only (`not_admin`): `private.check_cycle` of the group's latest active cycle, or `{cycle_id: null, cycle_label: null, periods: []}`.
  - Test helper `tests.reason(name, member, field) → text`.

- [ ] **Step 1: Add the helper**

In `supabase/tests/database/00_ledger_helpers.sql`, above `-- Later tasks add helpers above this line.`, add:
```sql
-- The reason code a kept close preview gives one difference (member null for group fields).
create or replace function tests.reason(p_name text, p_member text, p_field text) returns text language sql stable as $$
  select d ->> 'reason_code' from jsonb_array_elements(tests.kept(p_name) -> 'diff') d
  where d ->> 'short_name' is not distinct from p_member and d ->> 'field' = p_field
$$;
```

- [ ] **Step 2: Write the failing tests**

`supabase/tests/database/12_ledger_diff.sql`:
```sql
begin;
select * from no_plan();
select tests.ledger_fixture();
select tests.ledger_inputs(1);

-- No workbook figures yet: nothing to compare.
select tests.login_as(tests.id('admin'));
select tests.keep('plain', close_month(tests.lp(1)));
reset role;
select is(tests.kept('plain') -> 'diff', '[]'::jsonb, 'no workbook figures, no differences');
select is((tests.kept('plain') ->> 'unexplained')::int, 0, 'and nothing unexplained');

-- February's workbook figures as the import would store them (synthetic). The app's figures are the ones worked
-- by hand in 11_ledger_close.sql.
insert into workbook_figures (group_id, period_id, member_id, field, value) values
  -- Group. The workbook took Cid's K10 loan fee from lending cash; the app pays it from the fee pot.
  (tests.id('lg'), tests.lp(1), null, 'idle_cash', 289),                      -- app 299: +10, the month's fees → fee_pot_vs_cash
  (tests.id('lg'), tests.lp(1), null, 'excess_billed', 28.90),                -- app 29.90: +1.00 = 10% of 10 → fee_pot_vs_cash
  (tests.id('lg'), tests.lp(1), null, 'opening_cash', 0),                     -- app 0: same, not listed
  (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 'excess_charged', 4.10),     -- app 4.09: −0.01, against the fee's sign → workbook_rounded
  (tests.id('lg'), tests.lp(1), tests.lm('Ann'), 'closing_owed', 4.10),       -- app 4.09: −0.01, all of it her excess → workbook_rounded
  (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 'excess_charged', 8.00),     -- app 8.27: +0.27, within the group's +1.00 → fee_pot_vs_cash
  (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 'closing_owed', 3458.00),    -- app 3,458.27: +0.27, all of it the excess → fee_pot_vs_cash
  (tests.id('lg'), tests.lp(1), tests.lm('Ben'), 'next_minimum', 1152.04),    -- app 2,877.61: +1,725.57, the 3,001 loan's first
                                                                              --   instalment → workbook_missed_loan
  (tests.id('lg'), tests.lp(1), tests.lm('Cid'), 'next_minimum', 1737.27),    -- app 3,458.27: +1,721.00 and Cid owes principal
                                                                              --   → workbook_term_differs
  (tests.id('lg'), tests.lp(1), tests.lm('Fay'), 'next_minimum', 51.02),      -- app 1.02: −50.00, a membership fee → penalty_not_charged
  (tests.id('lg'), tests.lp(1), tests.lm('Dee'), 'next_minimum', 2.00),       -- app 1.02: −0.98 → workbook_rounded
  (tests.id('lg'), tests.lp(1), tests.lm('Eve'), 'cum_savings', 350),         -- app 300: −50 → unexplained
  (tests.id('lg'), tests.lp(1), tests.lm('Gus'), 'cum_savings', 250);         -- app 250: same, not listed

select tests.login_as(tests.id('admin'));
select tests.keep('feb', close_month(tests.lp(1)));
reset role;
select is(jsonb_array_length(tests.kept('feb') -> 'diff'), 11, 'eleven differences, the matching figures left out');
select is(tests.reason('feb', null, 'idle_cash'), 'fee_pot_vs_cash', 'idle cash differs by the loan fee');
select is(tests.reason('feb', null, 'excess_billed'), 'fee_pot_vs_cash', 'and the excess by 10% of it');
select is(tests.reason('feb', 'Ann', 'excess_charged'), 'workbook_rounded', 'a ngwee the other way is rounding');
select is(tests.reason('feb', 'Ann', 'closing_owed'), 'workbook_rounded', 'and so is what she owes');
select is(tests.reason('feb', 'Cid', 'excess_charged'), 'fee_pot_vs_cash', 'Cid''s share of the fee difference');
select is(tests.reason('feb', 'Cid', 'closing_owed'), 'fee_pot_vs_cash', 'carried into what he owes');
select is(tests.reason('feb', 'Ben', 'next_minimum'), 'workbook_missed_loan', 'the workbook left a new loan out of the minimum');
select is(tests.reason('feb', 'Cid', 'next_minimum'), 'workbook_term_differs', 'the workbook spread the loan differently');
select is(tests.reason('feb', 'Fay', 'next_minimum'), 'penalty_not_charged', 'the workbook asked for K50 the app does not charge');
select is(tests.reason('feb', 'Dee', 'next_minimum'), 'workbook_rounded', 'under K1 is rounding');
select is(tests.reason('feb', 'Eve', 'cum_savings'), 'unexplained', 'a savings difference nobody can explain');
select is((select d -> 'difference' from jsonb_array_elements(tests.kept('feb') -> 'diff') d where d ->> 'short_name' = 'Ben'),
  '1725.57'::jsonb, 'difference = app − workbook');
select is((tests.kept('feb') ->> 'unexplained')::int, 1, 'one unexplained difference');
select is((tests.kept('feb') -> 'diff' -> 0 ->> 'field'), 'excess_billed', 'group rows come first');

-- Committing with an unexplained difference needs the treasurer's reason on record.
select tests.login_as(tests.id('admin'));
select throws_ok($$select close_month(tests.lp(1), true)$$, 'P0001', 'unexplained_differences', 'no silent close over an unexplained difference');
select throws_ok($$select close_month(tests.lp(1), true, '  ')$$, 'P0001', 'unexplained_differences', 'a blank reason is no reason');
select lives_ok($$select close_month(tests.lp(1), true, 'Eve''s workbook row double-counts a deposit')$$, 'with a reason it closes');
reset role;
select is((select data ->> 'unexplained' || '/' || (data ->> 'differences') || '/' || (data ->> 'reason')
           from audit_log where action = 'period.closed' and entity_id = tests.lp(1)),
  '1/11/Eve''s workbook row double-counts a deposit', 'the counts and the reason are audited');

-- March: Fay's interest was waived; the workbook still charged it.
select tests.ledger_inputs(2);
insert into workbook_figures (group_id, period_id, member_id, field, value)
  values (tests.id('lg'), tests.lp(2), tests.lm('Fay'), 'closing_owed', 907.63);   -- app 795.13: −112.50 = the waiver → waiver
select tests.login_as(tests.id('admin'));
select tests.keep('mar', close_month(tests.lp(2)));
reset role;
select is(tests.reason('mar', 'Fay', 'closing_owed'), 'waiver', 'a waived charge explains the difference');
select is((tests.kept('mar') ->> 'unexplained')::int, 0, 'nothing unexplained in March');

-- ledger_check: every month that is not planned, with its stored group statement and its differences ----------
select tests.login_as(tests.id('admin'));
select tests.keep('check', ledger_check(tests.id('lg')));
reset role;
select is(tests.kept('check') ->> 'cycle_label', 'Ledger 2026', 'the active cycle');
select is(jsonb_array_length(tests.kept('check') -> 'periods'), 2, 'February (closed) and March (open)');
select is((tests.kept('check') -> 'periods' -> 0 -> 'group' ->> 'idle_cash')::numeric, 299.00, 'February''s stored group statement');
select is(jsonb_array_length(tests.kept('check') -> 'periods' -> 0 -> 'diff'), 11, 'a closed month replays to the same differences');
select is(tests.kept('check') -> 'periods' -> 1 -> 'group', 'null'::jsonb, 'an open month has no group statement yet');
select is((tests.kept('check') -> 'periods' -> 1 ->> 'checked')::boolean, true, 'but it has workbook figures to check');
select tests.login_as(tests.id('owner'));
select is(jsonb_array_length(ledger_check(tests.id('lg')) -> 'periods'), 2, 'the owner can run the check');
select is(ledger_check(tests.id('group')) -> 'periods', '[]'::jsonb, 'a group without an open or closed month has nothing to check');
reset role;
select tests.login_as(tests.id('member'));
select throws_ok($$select ledger_check(tests.id('lg'))$$, '42501', 'not_admin', 'members cannot run the check');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select ledger_check(tests.id('lg'))$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select tests.login_anon();
select throws_ok($$select ledger_check(tests.id('lg'))$$, '42501', null, 'nor anon');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 3: Run it to see it fail**

```bash
bun run db:test
```
Expected: `12_ledger_diff.sql .. FAILED` (`diff` is null: `close_month` has no difference list yet).

- [ ] **Step 4: Write the migration**

`supabase/migrations/20261010001300_ledger_diff_check.sql`:
```sql
-- Step 7 of the close: compare with the workbook's figures and explain each difference with a fixed reason code.

create or replace function private.close_diff(p_period uuid, p_figures jsonb) returns jsonb
language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_p periods;
  v_r cycle_rules;
  v_fees numeric[];
  v_fees_before numeric[];
  v_out jsonb;
begin
  select * into v_p from periods where id = p_period;
  select * into v_r from cycle_rules where cycle_id = v_p.cycle_id;
  -- Loan transfer fees: the app pays them from the fee pot, the workbook took them from lending cash from some month
  -- on. So idle cash may differ by the fees of any run of months ending this month (opening cash: ending last month).
  select coalesce(array_agg(y.s) filter (where y.s > 0), '{}') into v_fees
    from (select sum(x.f) over (order by x.month_index desc) as s
          from (select p.month_index, coalesce(sum(l.amount), 0) as f
                from periods p left join private.ledger_lines l on l.period_id = p.id and l.kind = 'payout_fee'
                where p.cycle_id = v_p.cycle_id and p.month_index <= v_p.month_index
                group by p.month_index) x) y;
  select coalesce(array_agg(y.s) filter (where y.s > 0), '{}') into v_fees_before
    from (select sum(x.f) over (order by x.month_index desc) as s
          from (select p.month_index, coalesce(sum(l.amount), 0) as f
                from periods p left join private.ledger_lines l on l.period_id = p.id and l.kind = 'payout_fee'
                where p.cycle_id = v_p.cycle_id and p.month_index <= v_p.month_index - 1
                group by p.month_index) x) y;

  with app as (
    select (m ->> 'member_id')::uuid as member_id, m ->> 'short_name' as short_name, f.field, (m ->> f.field)::numeric as app
    from jsonb_array_elements(p_figures -> 'members') m
    cross join unnest(array['cum_savings', 'excess_charged', 'closing_owed', 'next_minimum']) as f(field)
    union all
    select null::uuid, null::text, f.field, (p_figures -> 'group' ->> f.field)::numeric
    from unnest(array['opening_cash', 'idle_cash', 'excess_billed']) as f(field)
  ),
  d as (
    select a.member_id, a.short_name, a.field, a.app, w.value as workbook, a.app - w.value as difference
    from app a
    join workbook_figures w on w.period_id = p_period and w.member_id is not distinct from a.member_id and w.field = a.field
    where a.app <> w.value
  ),
  g as (
    select d.*, case
      when d.field = 'idle_cash' and exists (select 1 from unnest(v_fees) s where abs(d.difference - s) < 0.05)
        then 'fee_pot_vs_cash'
      when d.field = 'opening_cash' and exists (select 1 from unnest(v_fees_before) s where abs(d.difference - s) < 0.05)
        then 'fee_pot_vs_cash'
      when d.field = 'excess_billed'
           and exists (select 1 from unnest(v_fees) s where abs(d.difference - round(v_r.excess_rate * s, 2)) < 0.05)
        then 'fee_pot_vs_cash'
      when abs(d.difference) < 1 then 'workbook_rounded'
      else 'unexplained' end as reason_code
    from d where d.member_id is null
  ),
  gx as (select g.difference, g.reason_code from g where g.field = 'excess_billed'),
  mx as (
    select d.*, case
      when (select gx.reason_code from gx) = 'fee_pot_vs_cash'
           and sign(d.difference) = sign((select gx.difference from gx))
           and abs(d.difference) <= abs((select gx.difference from gx)) + 0.01 then 'fee_pot_vs_cash'
      when abs(d.difference) < 1 then 'workbook_rounded'
      else 'unexplained' end as reason_code
    from d where d.member_id is not null and d.field = 'excess_charged'
  ),
  extra as (
    select (m ->> 'member_id')::uuid as member_id,
           coalesce((select sum(e.amount) from entries e
                     where e.period_id = p_period and e.member_id = (m ->> 'member_id')::uuid and e.kind = 'waiver'), 0) as waived,
           coalesce((select sum(l.amount) from private.ledger_lines l
                     where l.cycle_id = v_p.cycle_id and l.month_index <= v_p.month_index
                       and l.member_id = (m ->> 'member_id')::uuid and l.kind = 'loan_sent'), 0)
           - coalesce((select sum(s.paid_to_principal) from statements s join periods p on p.id = s.period_id
                       where p.cycle_id = v_p.cycle_id and p.month_index < v_p.month_index
                         and s.member_id = (m ->> 'member_id')::uuid), 0)
           - (m ->> 'paid_to_principal')::numeric as principal_left
    from jsonb_array_elements(p_figures -> 'members') m
  ),
  -- the first instalment of each loan sent this month
  firsts as (
    select l.member_id, i.amount_due
    from loans l
    join loan_instalments i on i.loan_id = l.id
    join periods ip on ip.id = i.period_id and ip.month_index = v_p.month_index + 1
    where l.period_id = p_period
  ),
  mo as (
    select d.*, case
      when d.field = 'cum_savings' then case when abs(d.difference) < 1 then 'workbook_rounded' else 'unexplained' end
      when d.field = 'closing_owed' then case
        when abs(d.difference - coalesce(x.difference, 0)) < 1
          then coalesce(case when abs(coalesce(x.difference, 0)) >= 0.01 then x.reason_code end, 'workbook_rounded')
        when e.waived > 0 and abs(d.difference - coalesce(x.difference, 0) + e.waived) < 1 then 'waiver'
        else 'unexplained' end
      else case
        when abs(d.difference) < 1 then 'workbook_rounded'
        when d.difference > 0 and exists (select 1 from firsts f
                                          where f.member_id = d.member_id and abs(d.difference - f.amount_due) < 1)
          then 'workbook_missed_loan'
        when abs(d.difference + v_r.membership_fee) < 1 then 'penalty_not_charged'
        when e.principal_left > 0 then 'workbook_term_differs'
        else 'unexplained' end
      end as reason_code
    from d
    left join mx x on x.member_id = d.member_id
    left join extra e on e.member_id = d.member_id
    where d.member_id is not null and d.field <> 'excess_charged'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'member_id', r.member_id, 'short_name', r.short_name, 'field', r.field, 'app', r.app, 'workbook', r.workbook,
           'difference', r.difference, 'reason_code', r.reason_code) order by r.short_name nulls first, r.field), '[]'::jsonb)
    into v_out
  from (select * from g union all select * from mx union all select * from mo) r;
  return v_out;
end $$;

create or replace function public.close_month(p_period uuid, p_commit boolean default false, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_p periods; v jsonb; v_diff jsonb; v_unexplained int;
begin
  -- A commit locks the month before anything else: a second close (another phone) waits here, then finds it closed.
  -- send_loan, approvals, penalties and corrections take the same row lock, so nothing lands mid-close.
  if p_commit then
    select * into v_p from periods where id = p_period for update;
  else
    select * into v_p from periods where id = p_period;
  end if;
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if not is_admin(v_p.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_commit and v_p.status = 'closed' then raise exception 'already_closed' using errcode = 'P0001'; end if;
  if v_p.status = 'planned' then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  if v_p.month_index > 1 and not exists (select 1 from periods
                                          where cycle_id = v_p.cycle_id and month_index = v_p.month_index - 1 and status = 'closed') then
    raise exception 'previous_period_open' using errcode = 'P0001';
  end if;
  if exists (select 1 from declarations d
             where d.period_id = p_period and d.status = 'submitted'
               and not exists (select 1 from declarations n where n.supersedes_id = d.id)) then
    raise exception 'declarations_pending' using errcode = 'P0001';
  end if;

  -- Preview and commit share this one computation.
  v := private.close_figures(p_period, false);
  v_diff := private.close_diff(p_period, v);
  v_unexplained := (select count(*)::int from jsonb_array_elements(v_diff) x where x ->> 'reason_code' = 'unexplained');
  v := v || jsonb_build_object('diff', v_diff, 'unexplained', v_unexplained);
  if not p_commit then return v; end if;

  if v_unexplained > 0 and coalesce(trim(p_reason), '') = '' then
    raise exception 'unexplained_differences' using errcode = 'P0001';
  end if;
  perform private.write_close(p_period, v, 'close');
  update periods set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = p_period;
  perform private.audit(v_p.group_id, 'period.closed', 'periods', p_period, jsonb_build_object(
    'label', v_p.label, 'excess_billed', v -> 'group' -> 'excess_billed',
    'interest_collected', v -> 'group' -> 'interest_collected',
    'differences', jsonb_array_length(v_diff), 'unexplained', v_unexplained, 'reason', nullif(trim(p_reason), '')));
  return jsonb_set(v, '{committed}', 'true'::jsonb);
end $$;

-- Every month that is not planned: its stored group statement and, where workbook figures exist, the replayed differences.
-- Used by ledger_check (the admin page) and by `bun run ledger:check`.
create or replace function private.check_cycle(p_cycle uuid) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'cycle_id', c.id,
    'cycle_label', c.label,
    'periods', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'label', p.label, 'month_index', p.month_index, 'status', p.status,
               'group', (select to_jsonb(gs) - 'id' - 'group_id' - 'period_id' - 'created_at' - 'source'
                         from group_statements gs where gs.period_id = p.id),
               'checked', exists (select 1 from workbook_figures w where w.period_id = p.id),
               'diff', case when exists (select 1 from workbook_figures w where w.period_id = p.id)
                            then private.close_diff(p.id, private.close_figures(p.id, false)) else '[]'::jsonb end)
             order by p.month_index)
      from periods p where p.cycle_id = c.id and p.status <> 'planned'), '[]'::jsonb))
  from cycles c where c.id = p_cycle
$$;

create or replace function public.ledger_check(p_group uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_cycle uuid;
begin
  if not is_admin(p_group) then raise exception 'not_admin' using errcode = '42501'; end if;
  select id into v_cycle from cycles where group_id = p_group and status = 'active' order by starts_on desc limit 1;
  if v_cycle is null then
    return jsonb_build_object('cycle_id', null, 'cycle_label', null, 'periods', '[]'::jsonb);
  end if;
  return private.check_cycle(v_cycle);
end $$;

revoke execute on function public.ledger_check(uuid) from public, anon, authenticated;
grant execute on function public.ledger_check(uuid) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
```

- [ ] **Step 5: Apply and run**

```bash
bun run db:reset    # or, hosted dev: bun run db:push
bun run db:test
```
Expected: every file `ok` (including `11_ledger_close.sql`, whose previews now also carry `diff: []`).

- [ ] **Step 6: Commit**

```bash
git status --short data/    # Expected: no output
git add supabase
git commit -m "feat: explain differences from the workbook with reason codes and a ledger check"
```

---

### Task 8: Payout preview

**Files:**
- Create: `supabase/migrations/20261010001400_ledger_payout.sql`, `supabase/tests/database/13_ledger_payout.sql`

**Interfaces:**
- Consumes: Tasks 4 (`private.member_balance`) and 6.
- Produces: `public.payout_preview(p_cycle uuid) → table (member_id uuid, short_name text, savings numeric, interest_earned numeric, owed numeric, pot_share numeric, payout numeric)`, read-only, callable by any member of the cycle's group (`not_admin` otherwise), rows filtered by `can_see_figures`. `savings` = effective savings in the cycle; `interest_earned` = effective `interest_share` entries; `owed` = `member_balance` at the open month (else the last closed one); `pot_share` = (fee pot + meeting pot) shared equally, the ngwee remainder to the first member by short name; `payout = savings + interest_earned − owed + pot_share` (a defaulter's debt comes out of their savings the same way).

- [ ] **Step 1: Write the failing tests**

`supabase/tests/database/13_ledger_payout.sql`:
```sql
begin;
select * from no_plan();
select tests.ledger_fixture();
select tests.ledger_inputs(1);
select tests.login_as(tests.id('admin'));
select close_month(tests.lp(1), true);
reset role;
select tests.ledger_inputs(2);
select tests.login_as(tests.id('admin'));
select close_month(tests.lp(2), true);

-- After March (figures from 11_ledger_close.sql). Pots: fee pot 15 − 10 − 5 = 0, meeting pot 900 → 900 shared by 19:
-- 900 / 19 = 47.368 → 47.36 each, 19 × 47.36 = 899.84, the 0.16 remainder to the first by name, Ann: 47.52.
-- Ann:  2,000 saved + 216.97 interest − 180.52 owed + 47.52 = 2,083.97
-- Ben:  1,000 + 108.48 − 1,815.84 + 47.36 = −660.00 (he owes the group)
-- Cid:  4,000 + 434.00 − 361.09 + 47.36 = 4,120.27
-- Dee (defaulted): 250 + 0 − 123.58 + 47.36 = 173.78 (her debt comes out of her savings)
-- Zed:  0 + 0 − 0 + 47.36 = 47.36
select is((select payout from payout_preview(tests.id('lcycle')) where short_name = 'Ann'), 2083.97, 'Ann''s payout');
select is((select pot_share from payout_preview(tests.id('lcycle')) where short_name = 'Ann'), 47.52, 'Ann takes the pot remainder');
select is((select payout from payout_preview(tests.id('lcycle')) where short_name = 'Ben'), -660.00, 'Ben would owe the group');
select is((select savings || '/' || interest_earned || '/' || owed from payout_preview(tests.id('lcycle')) where short_name = 'Cid'),
  '4000.00/434.00/361.09', 'Cid''s parts');
select is((select payout from payout_preview(tests.id('lcycle')) where short_name = 'Cid'), 4120.27, 'Cid''s payout');
select is((select payout from payout_preview(tests.id('lcycle')) where short_name = 'Dee'), 173.78, 'a defaulter''s debt is deducted from savings');
select is((select payout from payout_preview(tests.id('lcycle')) where short_name = 'Zed'), 47.36, 'Zed gets his share of the pots');
select is((select sum(pot_share) from payout_preview(tests.id('lcycle'))), 900.00, 'the pots are shared out exactly');
select is((select count(*)::int from payout_preview(tests.id('lcycle'))), 19, 'every member');
reset role;

-- Live: April open, Ben pays 1,000. Owed 1,815.84 − 1,000 = 815.84; payout 1,000 + 108.48 − 815.84 + 47.36 = 340.00.
select tests.ledger_inputs(3);
select tests.ledger_pay('Ben', 3, 0, 1000);
select tests.login_as(tests.id('member'));
select is((select payout from payout_preview(tests.id('lcycle')) where short_name = 'Ben'), 340.00, 'payments this month count at once');
select is((select count(*)::int from payout_preview(tests.id('lcycle'))), 19, 'figures open: a member sees everyone');
reset role;
update groups set figures_visibility = 'private' where id = tests.id('lg');
select tests.login_as(tests.id('member'));
select is((select array_agg(short_name) from payout_preview(tests.id('lcycle'))), array['Ben'], 'figures private: only their own row');
reset role;
select tests.login_as(tests.id('owner'));
select is((select count(*)::int from payout_preview(tests.id('lcycle'))), 19, 'the owner sees everyone');
reset role;
select tests.login_as(tests.id('outsider'));
select throws_ok($$select * from payout_preview(tests.id('lcycle'))$$, '42501', 'not_admin', 'outsiders see nothing');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select * from payout_preview(tests.id('lcycle'))$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select tests.login_anon();
select throws_ok($$select * from payout_preview(tests.id('lcycle'))$$, '42501', null, 'nor anon');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to see it fail**

```bash
bun run db:test
```
Expected: `13_ledger_payout.sql .. FAILED` (function payout_preview does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261010001400_ledger_payout.sql`:
```sql
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
```

- [ ] **Step 4: Apply and run**

```bash
bun run db:reset    # or, hosted dev: bun run db:push
bun run db:test
```
Expected: every file `ok`.

- [ ] **Step 5: Commit**

```bash
git status --short data/    # Expected: no output
git add supabase
git commit -m "feat: payout preview with debts netted and pots shared equally"
```

---
### Task 9: The 2026 import in SQL

**Files:**
- Create: `supabase/migrations/20261010001500_ledger_import.sql`, `supabase/tests/database/14_ledger_import.sql`

**Interfaces:**
- Consumes: `private.create_cycle`, `private.ensure_periods`, `private.schedule_loan`, `private.close_figures`, `private.write_close`, `private.close_diff`.
- Produces: `private.import_history(p_group uuid, p_bundle jsonb) → jsonb` (owner/script only; app roles cannot execute anything in `private`). Bundle (what Task 11's parser returns):
  ```
  { cycle: {label, starts_on, ends_on, payout_on}, through: <last imported month, 1–10>,
    deadlines: {"<month_index>": "YYYY-MM-DD", …},
    months: [ { month_index, fee_spent, group: {opening_cash|null, idle_cash|null, excess_billed|null},
                rows: [ {name, saving, cum_savings, txn_fee, membership, loans: [principal, …], interest, excess, penalty,
                         total, minimum, received|null, …} ] } ]  // months 1..through, each once
  }
  ```
  It creates or reuses the cycle (status `active`), the Airtel and MTN wallets, all 12 periods with the given deadlines (months ≤ `through` closed, the rest planned); per month writes `source='import'` entries (saving, membership, txn_fee, penalty, the workbook's excess, loans one row each with the workbook's interest, a group-level `payout_fee` for the month's loan fees, and each row's `received` as a `payment` in the **next** month), the workbook figures (`cum_savings`, `excess_charged`, `closing_owed` = total payable, `next_minimum`, group `opening_cash`, `idle_cash`, `excess_billed`), then closes the month with `close_figures(…, true)` + `write_close(…, 'import')`. Afterwards every loan still owed gets a fresh schedule of its remaining balance from month `through + 2` to its original last month. Returns `{cycle_id, months, members, entries, loans, open_loans, savings, owed, idle_cash}` (counts and totals only). Refusals: `member_not_found` (a name matching no member or several, or two rows of a month matching one member; the DETAIL lists the names), `invalid_amount` (malformed bundle), `already_opened` (the cycle has anything but import rows: an open month, an app entry, a closed statement, a declaration). A re-run first deletes the cycle's import rows under the `ledger.import_reset` switch.

- [ ] **Step 1: Write the failing tests**

`supabase/tests/database/14_ledger_import.sql`:
```sql
begin;
select * from no_plan();
select tests.fixture();

-- A small synthetic group and a made-up two-month bundle shaped like the parser's output (Task 11).
with g as (insert into groups (name, owner_user_id) values ('Import Group', tests.id('owner2')) returning id)
select tests.remember('ig', id) from g;
insert into members (group_id, full_name, short_name) values
  (tests.id('ig'), 'Ann Alpha', 'Ann'), (tests.id('ig'), 'Ben Beta', 'Ben'), (tests.id('ig'), 'Cid Gamma', 'Cid');

-- February: savings 3,000 + 500 + 500 = 4,000; Ben borrows 1,000 + 2,000 (one cell, two loans) at 15% = 450.
--   Idle 4,000 − 3,000 = 1,000 (the workbook did not take February's K20 loan fee out); excess 100 split 75 / 12.50 / 12.50.
--   Received against February (paid in March's window): Ann 75, Ben 2,000, Cid 0.
-- March: savings 0 + 500 + 250; Cid borrows 600 at 15% = 90; loan fee K10, which the workbook took from cash:
--   workbook opening 1,000 + 2,075 = 3,075; idle 3,075 + 750 − 600 − 10 = 3,215; excess 321.50 split by 3,000/1,000/750
--   of 4,750: 203.0526…, 67.6842…, 50.7631… Names are matched ignoring case and spaces, by short or full name.
select tests.keep('bundle', $json$
{
  "cycle": {"label": "Cycle 2026", "starts_on": "2026-02-15", "ends_on": "2027-02-15", "payout_on": "2027-02-06"},
  "through": 2,
  "deadlines": {"1": "2026-02-17"},
  "months": [
    {"month_index": 1, "fee_spent": 20,
     "group": {"opening_cash": null, "idle_cash": 1000, "excess_billed": 100},
     "rows": [
       {"name": "Ann", "saving": 3000, "cum_savings": 3000, "txn_fee": 10, "membership": 50, "loans": [], "interest": 0,
        "excess": 75, "penalty": 0, "total": 75, "minimum": 75, "received": 75},
       {"name": "ben", "saving": 500, "cum_savings": 500, "txn_fee": 0, "membership": 50, "loans": [1000, 2000], "interest": 450,
        "excess": 12.5, "penalty": 0, "total": 3462.5, "minimum": 3462.5, "received": 2000},
       {"name": " Cid Gamma ", "saving": 500, "cum_savings": 500, "txn_fee": 0, "membership": 0, "loans": [], "interest": 0,
        "excess": 12.5, "penalty": 0, "total": 12.5, "minimum": 12.5, "received": 0}
     ]},
    {"month_index": 2, "fee_spent": 10,
     "group": {"opening_cash": 3075, "idle_cash": 3215, "excess_billed": 321.5},
     "rows": [
       {"name": "Ann", "saving": 0, "cum_savings": 3000, "txn_fee": 0, "membership": 0, "loans": [], "interest": 0,
        "excess": 203.0526315789, "penalty": 0, "total": 203.0526315789, "minimum": 203.05, "received": null},
       {"name": "ben", "saving": 500, "cum_savings": 1000, "txn_fee": 0, "membership": 0, "loans": [], "interest": 0,
        "excess": 67.6842105263, "penalty": 0, "total": 1530.1842105263, "minimum": 800, "received": null},
       {"name": " Cid Gamma ", "saving": 250, "cum_savings": 750, "txn_fee": 0, "membership": 0, "loans": [600], "interest": 90,
        "excess": 50.7631578947, "penalty": 0, "total": 753.2631578947, "minimum": 753.26, "received": null}
     ]}
  ]
}
$json$::jsonb);

-- only the owner (the script's database login) can run it
select ok(not has_function_privilege('authenticated', 'private.import_history(uuid, jsonb)', 'EXECUTE'), 'app roles cannot import');
select tests.login_as(tests.id('owner2'));
select throws_ok($$select private.import_history(tests.id('ig'), tests.kept('bundle'))$$, '42501', null, 'not even the group owner, from the app');
reset role;

-- refusals before anything is written
select throws_ok($$select private.import_history(tests.id('ig'), jsonb_set(tests.kept('bundle'), '{months,0,rows,0,name}', '"Zoe"'))$$,
  'P0001', 'member_not_found', 'a workbook name that matches no member stops the import');
select throws_ok($$select private.import_history(tests.id('ig'), jsonb_set(tests.kept('bundle'), '{months,0,rows,1,name}', '"ann"'))$$,
  'P0001', 'member_not_found', 'two rows of one month on the same member stop it');
select throws_ok($$select private.import_history(tests.id('ig'), jsonb_set(tests.kept('bundle'), '{through}', '3'))$$,
  'P0001', 'invalid_amount', 'the bundle must hold months 1 to through');
select is((select count(*)::int from cycles where group_id = tests.id('ig')), 0, 'a refused import leaves nothing behind');

-- import --------------------------------------------------------------------------------------------------
select tests.keep('summary', private.import_history(tests.id('ig'), tests.kept('bundle')));
select tests.remember('icycle', (select id from cycles where group_id = tests.id('ig') and label = 'Cycle 2026'));
create function pg_temp.ip(m int) returns uuid language sql as $$
  select id from public.periods where cycle_id = tests.id('icycle') and month_index = m
$$;

select is((select status || ' ' || starts_on || ' ' || payout_on from cycles where id = tests.id('icycle')), 'active 2026-02-15 2027-02-06',
  'Cycle 2026 is created and active');
select is((select count(*)::int from cycle_rules where cycle_id = tests.id('icycle')), 1, 'with the constitution''s rules');
select is((select array_agg(status order by month_index) from periods where cycle_id = tests.id('icycle') and month_index <= 3),
  array['closed', 'closed', 'planned'], 'imported months are closed; the next one is ready to open');
select is((select count(*)::int from periods where cycle_id = tests.id('icycle')), 12, 'all twelve months exist');
select is((select deadline from periods where id = pg_temp.ip(1)), date '2026-02-17', 'February''s announced deadline');
select is((select deadline from periods where id = pg_temp.ip(2)), date '2026-03-07', 'otherwise the 7th');
select is((select array_agg(name order by name) from wallets where group_id = tests.id('ig')), array['Airtel', 'MTN'], 'the two wallets');
select is((select count(*)::int from entries e join periods p on p.id = e.period_id
           where p.cycle_id = tests.id('icycle') and e.source <> 'import'), 0, 'every row is marked as imported');

-- Payments move to the month they arrived in.
select is((select array_agg(m.short_name || ' ' || e.amount order by m.short_name) from entries e join members m on m.id = e.member_id
           where e.period_id = pg_temp.ip(2) and e.kind = 'payment'), array['Ann 75.00', 'Ben 2000.00'],
  'February''s receipts are March''s payments');
-- Ben's cell of two loans is two loans, each with its share of the 450 interest: 150 and 300.
select is((select array_agg(principal || '/' || interest order by sent_at) from loans where member_id = (select id from members where group_id = tests.id('ig') and short_name = 'Ben')),
  array['1000.00/150.00', '2000.00/300.00'], 'one row per loan, interest as the workbook charged it');

-- February statements (official = workbook excess and minimum; the rest by the ledger's rules)
select is((select closing_owed || '/' || next_minimum from statements s join members m on m.id = s.member_id
           where s.period_id = pg_temp.ip(1) and m.short_name = 'Ben'), '3462.50/3462.50', 'Ben: 3,000 + 450 + 12.50');
select is((select idle_cash || '/' || excess_billed || '/' || fee_pot_balance || '/' || meeting_pot_balance
           from group_statements where period_id = pg_temp.ip(1)), '1000.00/100.00/-10.00/100.00',
  'February: idle 1,000; excess 100; fee pot 10 − 20; meeting pot 100');
-- March: Ben pays 2,000 → 80.18 to excess (12.50 + 67.68), 450 to interest, 1,469.82 to principal.
--   Closing 3,462.50 + 67.68 − 2,000 = 1,530.18; unpaid minimum 3,462.50 − 2,000 = 1,462.50; minimum 800 (the workbook's).
select is((select paid_to_excess || '/' || paid_to_interest || '/' || paid_to_principal || '/' || closing_owed || '/' || unpaid_minimum
                  || '/' || next_minimum
           from statements s join members m on m.id = s.member_id where s.period_id = pg_temp.ip(2) and m.short_name = 'Ben'),
  '80.18/450.00/1469.82/1530.18/1462.50/800.00', 'Ben''s March statement');
select is((select closing_owed from statements s join members m on m.id = s.member_id
           where s.period_id = pg_temp.ip(2) and m.short_name = 'Cid'), 753.26, 'Cid: 12.50 + 600 + 90 + 50.76');
-- Interest collected in March: 75 (Ann's excess) + 80.18 + 450 = 605.18, shared over 4,750:
--   Ann 3,000 → 382.2189 → 382.21; Ben 1,000 → 127.4063 → 127.40; Cid 750 → 95.5547 → 95.55; sum 605.16, 0.02 to Ann → 382.23.
select is((select array_agg(m.short_name || ' ' || s.interest_earned order by m.short_name) from statements s join members m on m.id = s.member_id
           where s.period_id = pg_temp.ip(2)), array['Ann 382.23', 'Ben 127.40', 'Cid 95.55'],
  'interest earned before November follows the ledger''s rule');
-- Group: opening 1,000 + 2,075 = 3,075; idle 3,075 + 750 − 600 = 3,225 (the loan fee came from the fee pot);
--   excess billed = the workbook's shares 203.05 + 67.68 + 50.76 = 321.49; fee pot −10 − 10 = −20.
select is((select opening_cash || '/' || idle_cash || '/' || excess_billed || '/' || interest_collected || '/' || fee_pot_balance
           from group_statements where period_id = pg_temp.ip(2)), '3075.00/3225.00/321.49/605.18/-20.00', 'March''s group statement');
select is((select value from workbook_figures where period_id = pg_temp.ip(2) and member_id is null and field = 'idle_cash'), 3215.00,
  'the workbook''s own idle cash is kept for comparison');

-- Loans still owed are rebuilt from May (month 4): November-style, the workbook's last minimum covers the next month.
select is((select array_agg(status order by sent_at) from loans l join periods p on p.id = l.period_id where p.cycle_id = tests.id('icycle')),
  array['repaid', 'open', 'open'], 'Ben''s 1,000 is repaid; his 2,000 and Cid''s 600 are still owed');
select is((select array_agg(p.month_index || ':' || i.amount_due order by p.month_index) from loan_instalments i
           join periods p on p.id = i.period_id join loans l on l.id = i.loan_id where l.principal = 2000 and l.group_id = tests.id('ig')),
  array['2:2300.00', '4:1530.18'], 'Ben''s remaining 1,530.18 falls due in May');
select is((select array_agg(p.month_index || ':' || i.amount_due order by p.month_index) from loan_instalments i
           join periods p on p.id = i.period_id join loans l on l.id = i.loan_id where l.principal = 600 and l.group_id = tests.id('ig')),
  array['3:690.00', '4:690.00'], 'Cid''s April instalment stays (the workbook asked for it); May asks the 690 still owed');

-- Summary: counts and totals only.
select is((tests.kept('summary') ->> 'entries')::int, 27, '27 entries');
select is((tests.kept('summary') ->> 'open_loans')::int, 2, 'two loans still owed');
select is((tests.kept('summary') ->> 'owed')::numeric, 2486.49, 'owed 203.05 + 1,530.18 + 753.26');
select is((tests.kept('summary') ->> 'savings')::numeric, 4750.00, 'savings 4,750');

-- Replaying March with the ledger's own rules: every difference is explained.
select tests.keep('replay', jsonb_build_object('diff', private.close_diff(pg_temp.ip(2), private.close_figures(pg_temp.ip(2), false))));
select is((select count(*)::int from jsonb_array_elements(tests.kept('replay') -> 'diff') d where d ->> 'reason_code' = 'unexplained'), 0,
  'nothing unexplained');
select is(tests.reason('replay', null, 'idle_cash'), 'fee_pot_vs_cash', 'idle cash: the K10 loan fee');
select is(tests.reason('replay', 'Ben', 'next_minimum'), 'workbook_term_differs', 'Ben''s minimum: the workbook spread his debt');
select is(jsonb_array_length(private.close_diff(pg_temp.ip(1), private.close_figures(pg_temp.ip(1), false))), 0,
  'February replays exactly');

-- Re-running replaces the import, it does not double it.
select lives_ok($$select private.import_history(tests.id('ig'), tests.kept('bundle'))$$, 'the import runs again');
select is((select count(*)::int from entries e join periods p on p.id = e.period_id where p.cycle_id = tests.id('icycle')), 27,
  'still 27 entries');
select is((select count(*)::int from workbook_figures w join periods p on p.id = w.period_id where p.cycle_id = tests.id('icycle')), 29,
  'still 29 workbook figures (12 + 2 in February, 12 + 3 in March)');
select is((select count(*)::int from loans l join periods p on p.id = l.period_id where p.cycle_id = tests.id('icycle')), 3, 'still 3 loans');
select is((select count(*)::int from cycles where group_id = tests.id('ig')), 1, 'one cycle');

-- Once April (the first app month here) opens, the import refuses.
select tests.login_as(tests.id('owner2'));
select lives_ok($$select open_period(tests.id('icycle'), 3)$$, 'the treasurer opens the first app month');
reset role;
select throws_ok($$select private.import_history(tests.id('ig'), tests.kept('bundle'))$$, 'P0001', 'already_opened',
  'no re-import after the app takes over');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to see it fail**

```bash
bun run db:test
```
Expected: `14_ledger_import.sql .. FAILED` (function private.import_history does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261010001500_ledger_import.sql`:
```sql
-- The 2026 history import (spec §7). bun run ledger:import reads the workbooks into a JSON bundle and calls this as
-- the database owner; every amount is worked out here, with the same close code the app uses.

create or replace function private.import_history(p_group uuid, p_bundle jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_through int := (p_bundle ->> 'through')::int;
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
begin
  if not exists (select 1 from groups where id = p_group) then
    raise exception 'member_not_found' using errcode = 'P0001', detail = 'No such group';
  end if;
  if v_through is null or v_through not between 1 and 10
     or (select array_agg((m ->> 'month_index')::int order by (m ->> 'month_index')::int)
         from jsonb_array_elements(coalesce(p_bundle -> 'months', '[]'::jsonb)) m)
        is distinct from (select array_agg(i order by i) from generate_series(1, v_through) i) then
    raise exception 'invalid_amount' using errcode = 'P0001', detail = 'The bundle must hold months 1 to "through", at most 10';
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
  update periods p set deadline = d.value::date
    from jsonb_each_text(coalesce(p_bundle -> 'deadlines', '{}'::jsonb)) d
   where p.cycle_id = v_cycle and p.month_index = d.key::int;
  update periods set status = 'closed', closed_at = now() where cycle_id = v_cycle and month_index <= v_through;

  for v_month in select m from jsonb_array_elements(p_bundle -> 'months') m order by (m ->> 'month_index')::int loop
    select * into v_period from periods where cycle_id = v_cycle and month_index = (v_month ->> 'month_index')::int;
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
      -- What was received against this month's statement arrived in next month's window.
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

    -- Close the month with the app's own code; the workbook's excess shares and minimums are the official record.
    v_fig := private.close_figures(v_period.id, true);
    perform private.write_close(v_period.id, v_fig, 'import');
  end loop;

  -- Every loan still owed gets equal instalments of what remains, from the first month the app asks for (the workbook's
  -- last minimum covers the month after the import) to the loan's original last month, at least one; the last
  -- instalment absorbs the ngwee remainder. Earlier instalments stay as they were, so replays have them.
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

  return jsonb_build_object(
    'cycle_id', v_cycle,
    'months', v_through,
    'members', (select count(*) from statements s where s.period_id = v_period.id),
    'entries', (select count(*) from entries e join periods p on p.id = e.period_id where p.cycle_id = v_cycle),
    'loans', (select count(*) from loans l join periods p on p.id = l.period_id where p.cycle_id = v_cycle),
    'open_loans', (select count(*) from loans l join periods p on p.id = l.period_id where p.cycle_id = v_cycle and l.status = 'open'),
    'savings', (v_fig -> 'group' ->> 'total_savings')::numeric,
    'owed', (v_fig -> 'group' ->> 'total_owed')::numeric,
    'idle_cash', (v_fig -> 'group' ->> 'idle_cash')::numeric);
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
```

- [ ] **Step 4: Apply and run**

```bash
bun run db:reset    # or, hosted dev: bun run db:push
bun run db:test
```
Expected: every file `ok`.

- [ ] **Step 5: Commit**

```bash
git status --short data/    # Expected: no output
git add supabase
git commit -m "feat: import 2026 history in SQL through the shared month-close code"
```

---
### Task 10: Error sentences and generated types

**Files:**
- Modify: `src/lib/errors.ts`, `src/lib/errors.test.ts`, `src/lib/database.types.ts` (regenerated)

**Interfaces:**
- Consumes: every business code raised by Tasks 1–9.
- Produces: a `friendlyError` sentence for `period_not_open`, `previous_period_open`, `declarations_pending`, `loans_closed`, `insufficient_cash`, `over_cap_needs_reason`, `reason_required`, `entry_not_found`, `already_closed`, `unexplained_differences`, `already_opened`, `invalid_amount`, `invalid_date`, `wallet_not_found`, `declaration_not_found`, `append_only`; `Database['public']['Functions']` types for `open_period`, `set_deadline`, `submit_declaration`, `return_declaration`, `approve_declaration`, `send_loan`, `apply_penalty`, `suggest_penalties`, `set_default`, `post_correction`, `post_waiver`, `close_month`, `ledger_check`, `payout_preview`, and `Tables` types for the ten ledger tables.

- [ ] **Step 1: Write the failing test**

In `src/lib/errors.test.ts`, replace the `SQL_CODES` constant with:
```ts
const SQL_CODES = [
  'invite_not_found', 'invite_expired', 'invite_revoked', 'invite_used', 'email_mismatch', 'already_linked',
  'member_taken', 'member_not_active', 'member_not_found', 'last_admin', 'not_admin', 'not_signed_in',
  'already_bootstrapped', 'owner_member_not_found',
  // ledger (sub-project 2a)
  'period_not_open', 'previous_period_open', 'declarations_pending', 'loans_closed', 'insufficient_cash',
  'over_cap_needs_reason', 'reason_required', 'entry_not_found', 'already_closed', 'unexplained_differences',
  'already_opened', 'invalid_amount', 'invalid_date', 'wallet_not_found', 'declaration_not_found', 'append_only',
];
```
and add after the `maps SQL business codes` test:
```ts
test('ledger refusals say what to do next', () => {
  expect(friendlyError({ message: 'insufficient_cash', code: 'P0001' })).toBe('There isn’t enough lending cash for this loan right now.');
  expect(friendlyError({ message: 'over_cap_needs_reason', code: 'P0001' })).toBe(
    'This loan is over the member’s limit. Add a reason to send it anyway.',
  );
  expect(friendlyError({ message: 'unexplained_differences', code: 'P0001' })).toBe(
    'Some differences from the workbook aren’t explained. Add a reason to close the month anyway.',
  );
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
bun run test src/lib/errors.test.ts
```
Expected: FAIL — `has a friendly sentence for period_not_open` (and the other new codes) get the generic sentence.

- [ ] **Step 3: Add the sentences**

In `src/lib/errors.ts`, after the line `  rules_locked: 'Rules can only change before the cycle starts.',` add:
```ts
  // ledger (sub-project 2a)
  period_not_open: 'That month isn’t open. Pick the current month, or open it first.',
  previous_period_open: 'Close the previous month first.',
  declarations_pending: 'Some declarations are still waiting. Approve or return them first.',
  loans_closed: 'No new loans in the last month of the cycle.',
  insufficient_cash: 'There isn’t enough lending cash for this loan right now.',
  over_cap_needs_reason: 'This loan is over the member’s limit. Add a reason to send it anyway.',
  reason_required: 'Add a reason first.',
  entry_not_found: 'That record couldn’t be found. Refresh and try again.',
  already_closed: 'This month is already closed.',
  unexplained_differences: 'Some differences from the workbook aren’t explained. Add a reason to close the month anyway.',
  already_opened: 'That month has already been opened.',
  invalid_amount: 'Check the amount: kwacha and ngwee only, and not below zero.',
  invalid_date: 'Pick a date in that month or later.',
  wallet_not_found: 'Choose one of the group’s wallets.',
  declaration_not_found: 'That declaration was already handled or replaced. Refresh and try again.',
  append_only: 'Ledger records can’t be changed. Post a correction instead.',
```

- [ ] **Step 4: Regenerate the database types**

With the Task 1–9 migrations applied to the development database:
```bash
bun run db:types                                                              # option b (hosted dev project)
bun x supabase gen types typescript --local --schema public > src/lib/database.types.ts   # option a (local stack)
grep -c -E "close_month|ledger_check|payout_preview|send_loan|loan_instalments" src/lib/database.types.ts
```
Expected: the grep prints a number ≥ 5. Never run `db:types` with `SUPABASE_PROJECT_REF` set to production for this branch: production does not have these migrations yet.

- [ ] **Step 5: Run the checks**

```bash
bun run test src/lib/errors.test.ts
bun run typecheck
```
Expected: errors tests PASS; typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git status --short data/    # Expected: no output
git add src/lib/errors.ts src/lib/errors.test.ts src/lib/database.types.ts
git commit -m "feat: friendly sentences for ledger refusals and regenerated database types"
```

---

### Task 11: Workbook parser (exceljs)

**Files:**
- Create: `scripts/ledger-workbook.mjs`, `scripts/ledger-workbook.test.mjs`
- Modify: `package.json`, `bun.lock` (dev dependency), `eslint.config.js` (exceljs banned in `src/`)

**Why exceljs:** it is MIT-licensed, has no native code, and gives each formula cell's text as well as its cached result — the importer needs the text to split a loan cell typed as `=4100+900+2600` into three loans; SheetJS's npm package is frozen at 0.18.5 with an open advisory.

**Interfaces:**
- Consumes: the workbook layouts in `data/private/workbook-model.md` §1.2 (described structurally below; no figures).
- Produces (`scripts/ledger-workbook.mjs`):
  - `MONTHS` (`['Feb', … , 'Jan']`, cycle order), `CYCLE_2026`, `DEADLINES_2026` (17 Feb, 8 May, 8 Jun, 10 Jul, 9 Aug; otherwise the 7th).
  - `monthIndex(name) → 1..12` (`'Oct'`, `'october'` → 9); throws on anything else.
  - `pickWorkbook(fileNames, through?) → {file, through}`: the `.xlsx` whose name contains the month (`Premium VB September 2026.xlsx` → 8); the latest when `through` is omitted.
  - `num(value)`, `text(value)`, `loanParts(value)`: cell readers (formula cells use their cached result; a loan cell whose formula is only numbers and `+` becomes one loan per term).
  - `readSheet(ws) → {rows, group}` and `parseWorkbook(workbook, through) → bundle` (the shape in Task 9), `readBundle(path, through) → Promise<bundle>`.

Workbook structure the parser relies on (no figures): each month has a statement sheet `<Mon> 1` and, once the next month's workbook exists, a reconciliation sheet `<Mon> 2` (a copy plus *Amount received*); June may be spelled `June 1`. Headers sit in one of rows 1–4 (the row holding `Savings`); members follow one per row until a blank name; a totals row comes next, then a group block whose labels (`Opening balance`, `Total funds`, `Excess Amount`, `Interest on excess`) sit in columns A–C with the value in the next numeric cell to the right. Column letters move between months, so columns are found by header text: `Name`, `Savings`, `Cumm. Savings` (absent in February), `Transaction fee` (the member's), `Membership fee`, `Loan` (not `Loan C/F`), `Interest on loan`, `Excess` / `Excess interest`, `Transaction fee spent` / `fee spent`, `Penalties` (April–July only), `Total amount payable` (from April; before that `Loan Repayment` is the total), `Minimum amount payable`, `Amount received`. The `Interest ` sheet (trailing space) has a `Name` column and one column per month of cumulative savings; the latest month's column holds that month's savings only.

- [ ] **Step 1: Add the dependency and the import ban**

```bash
bun add -d exceljs@^4.4.0
```
Expected: `package.json` gains `"exceljs": "^4.4.0"` under `devDependencies`; `bun.lock` changes.

In `eslint.config.js`, add this entry as the last element of the `tseslint.config(…)` list:
```js
  // Workbook parsing is a local script (scripts/ledger-*.mjs); it must never reach the browser bundle.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'exceljs', message: 'exceljs is for the local ledger scripts only.' }] }],
    },
  },
```

- [ ] **Step 2: Write the failing tests**

`scripts/ledger-workbook.test.mjs`:
```js
// @vitest-environment node
// The workbook here is synthetic: made-up members and amounts in the treasurer's layouts. Real workbooks never
// enter the repo (*.xlsx and data/ are git-ignored).
import ExcelJS from 'exceljs'
import { expect, test } from 'vitest'
import { loanParts, monthIndex, parseWorkbook, pickWorkbook, readSheet } from './ledger-workbook.mjs'

// February: statement and reconciliation (layout A). March: statement only (layout B).
const FEB = {
  A: 'S/N', B: 'Name', D: 'Savings', E: 'Transaction fee', F: 'Membership fee', G: 'Total sent', H: 'Loan',
  I: 'Interest on loan', J: 'Excess interest', K: 'Transaction fee spent', L: 'Loan Repayment',
  M: 'Interest Earned Cumulative', N: 'Minimum amount payable',
}
const FEB2 = { ...FEB, O: 'Amount received', P: 'Variance' }
const MAR = {
  A: 'S/N', B: 'Name', D: 'Savings', E: 'Cumm. Savings', F: 'Transaction fee', G: 'Total sent', H: 'Loan C/F', I: 'Loan',
  J: 'Interest on loan', K: 'Excess', L: 'fee spent', M: 'Loan Repayment', O: 'Minimum amount payable',
}
const febRows = [
  { A: 1, B: 'Ann', D: 3000, E: 10, F: 50, I: 0, J: 75, L: 75, N: 75 },
  { A: 2, B: 'ben', D: 500, F: 50, H: { formula: '1000+2000', result: 3000 }, I: { formula: '15%*H4', result: 450 }, J: 12.5, K: 20,
    L: 3462.5, N: 3462.5 },
  { A: 3, B: ' Cid Gamma ', D: 500, J: 12.5, L: 12.5, N: 12.5 },
]
const received = [75, 2000, 0]
const marRows = [
  { A: 1, B: 'Ann', D: 0, E: 3000, K: { formula: 'E3/E6*D11', result: 203.0526315789 }, M: 203.0526315789, O: 203.05 },
  { A: 2, B: 'ben', D: 500, E: 1000, H: 1462.5, K: 67.6842105263, M: 1530.1842105263, O: 800 },
  { A: 3, B: ' Cid Gamma ', D: 250, E: 750, H: 12.5, I: 600, J: 90, K: 50.7631578947, L: 10, M: 753.2631578947, O: 753.26 },
]

function addSheet(wb, name, headers, rows, group) {
  const ws = wb.addWorksheet(name)
  ws.getCell('A1').value = `Premium VB ${name}`
  for (const [col, label] of Object.entries(headers)) ws.getCell(`${col}2`).value = label
  rows.forEach((row, i) => {
    for (const [col, v] of Object.entries(row)) ws.getCell(`${col}${i + 3}`).value = v
  })
  const totals = rows.length + 3
  ws.getCell(`D${totals}`).value = { formula: `SUM(D3:D${totals - 1})`, result: 0 }
  group.forEach(([label, value], i) => {
    ws.getCell(`C${totals + 2 + i}`).value = label
    ws.getCell(`D${totals + 2 + i}`).value = { formula: `D${totals}`, result: value }
  })
}

async function build(tweak = () => {}) {
  const wb = new ExcelJS.Workbook()
  const febGroup = [['Excess Amount', 1000], ['Interest on excess', 100]]
  addSheet(wb, 'Feb 1', FEB, febRows, febGroup)
  addSheet(wb, 'Feb 2', FEB2, febRows.map((r, i) => ({ ...r, O: received[i] })), febGroup)
  addSheet(wb, 'Mar 1', MAR, marRows,
    [['Opening balance', 3075], ['Total funds', 3825], ['Excess Amount', 3215], ['Interest on excess', 321.5]])
  const interest = wb.addWorksheet('Interest ')
  interest.getCell('B2').value = 'Name'
  interest.getCell('D2').value = 'Feb'
  interest.getCell('E2').value = 'Mar'
  ;[['Ann', 3000, 3000], ['ben', 500, 1000], [' Cid Gamma ', 500, 750]].forEach(([name, feb, mar], i) => {
    interest.getCell(`B${i + 3}`).value = name
    interest.getCell(`D${i + 3}`).value = feb
    interest.getCell(`E${i + 3}`).value = mar
  })
  tweak(wb)
  // Round-trip through a real .xlsx buffer, so formula cells come back the way exceljs reads a treasurer's file.
  const back = new ExcelJS.Workbook()
  await back.xlsx.load(await wb.xlsx.writeBuffer())
  return back
}

test('reads statements, receipts and the group block into the import bundle', async () => {
  const bundle = parseWorkbook(await build(), 2)
  expect(bundle.through).toBe(2)
  expect(bundle.cycle).toEqual({ label: 'Cycle 2026', starts_on: '2026-02-15', ends_on: '2027-02-15', payout_on: '2027-02-06' })
  expect(bundle.deadlines['1']).toBe('2026-02-17')
  const [feb, mar] = bundle.months
  expect(feb.month_index).toBe(1)
  expect(feb.fee_spent).toBe(20)
  expect(feb.group).toEqual({ opening_cash: null, idle_cash: 1000, excess_billed: 100 })
  expect(feb.rows.map((r) => r.name)).toEqual(['Ann', 'ben', 'Cid Gamma'])
  expect(feb.rows[1]).toEqual({
    name: 'ben', saving: 500, cum_savings: 500, txn_fee: 0, membership: 50, loans: [1000, 2000], interest: 450, excess: 12.5,
    penalty: 0, fee_spent: 20, total: 3462.5, minimum: 3462.5, received: 2000,
  })
  expect(feb.rows[2].received).toBe(0)
  expect(mar.month_index).toBe(2)
  expect(mar.fee_spent).toBe(10)
  expect(mar.group).toEqual({ opening_cash: 3075, idle_cash: 3215, excess_billed: 321.5 })
  expect(mar.rows[0].excess).toBeCloseTo(203.0526315789, 9)
  expect(mar.rows[2]).toMatchObject({ cum_savings: 750, loans: [600], interest: 90, total: 753.2631578947, minimum: 753.26, received: null })
})

test('the reconciliation sheet is required for every month but the last', async () => {
  const wb = await build((w) => w.removeWorksheet(w.getWorksheet('Feb 2').id))
  expect(() => parseWorkbook(wb, 2)).toThrow(/No "Feb 2" sheet/)
})

test('a column the month needs must be there', async () => {
  const wb = await build((w) => {
    w.getWorksheet('Mar 1').getCell('O2').value = 'Notes'
  })
  expect(() => parseWorkbook(wb, 2)).toThrow(/Mar 1: no "minimum" column/)
})

test('the Interest sheet cross-checks cumulative savings, so a shifted column is caught', async () => {
  const wb = await build((w) => {
    w.getWorksheet('Interest ').getCell('D3').value = 2999
  })
  expect(() => parseWorkbook(wb, 2)).toThrow(/Interest sheet disagrees with the Feb statement/)
})

test('later layouts: the total payable column wins over the repayment subtotal, and penalties are read', async () => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Apr 2')
  const headers = {
    B: 'Name', D: 'Savings', E: 'Cumm. Savings', F: 'Transaction fee', I: 'Loan', J: 'Interest on loan', K: 'Excess', L: 'fee spent',
    M: 'Loan Repayment', N: 'Penalties', O: 'Total amount payable', P: 'Minimum amount payable', Q: 'Amount received (2)',
  }
  for (const [col, label] of Object.entries(headers)) ws.getCell(`${col}2`).value = label
  Object.entries({ B: 'Dee', D: 0, E: 250, K: 5, M: 105, N: 1350, O: 1455, P: 105, Q: 0 })
    .forEach(([col, v]) => { ws.getCell(`${col}3`).value = v })
  const { rows } = readSheet(ws)
  expect(rows[0]).toMatchObject({ name: 'Dee', penalty: 1350, total: 1455, minimum: 105, received: 0 })
})

test('loan cells typed as sums are several loans', () => {
  expect(loanParts({ formula: '4100+900+2600', result: 7600 })).toEqual([4100, 900, 2600])
  expect(loanParts({ formula: 'H4*2', result: 600 })).toEqual([600])
  expect(loanParts(2500)).toEqual([2500])
  expect(loanParts(null)).toEqual([])
})

test('months and workbook names', () => {
  expect(monthIndex('Feb')).toBe(1)
  expect(monthIndex('october')).toBe(9)
  expect(monthIndex('Jan')).toBe(12)
  expect(() => monthIndex('Total')).toThrow(/Unknown month/)
  const files = ['Premium VB September 2026.xlsx', 'Premium VB may 2026.xlsx', 'Premium VB June 2026(2).xlsx', 'notes.txt']
  expect(pickWorkbook(files)).toEqual({ file: 'Premium VB September 2026.xlsx', through: 8 })
  expect(pickWorkbook(files, 'May')).toEqual({ file: 'Premium VB may 2026.xlsx', through: 4 })
  expect(() => pickWorkbook(files, 'Oct')).toThrow(/No workbook for Oct/)
})
```

- [ ] **Step 3: Run it to see it fail**

```bash
bun run test scripts/ledger-workbook.test.mjs
```
Expected: FAIL — `Failed to load url ./ledger-workbook.mjs`.

- [ ] **Step 4: Write the parser**

`scripts/ledger-workbook.mjs`:
```js
// Reads a treasurer's workbook (exceljs) into the bundle private.import_history takes. Cells only: every amount the
// ledger stores is worked out in SQL. Column letters move between months, so columns are found by header text
// (the layouts are described in data/private/workbook-model.md, which is git-ignored).
import ExcelJS from 'exceljs'

export const MONTHS = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']
const FULL = ['february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'january']

export const CYCLE_2026 = { label: 'Cycle 2026', starts_on: '2026-02-15', ends_on: '2027-02-15', payout_on: '2027-02-06' }
// Deadlines announced in the group chat (cycle month → date); every other month closes on the 7th.
export const DEADLINES_2026 = { 1: '2026-02-17', 4: '2026-05-08', 5: '2026-06-08', 6: '2026-07-10', 7: '2026-08-09' }

const COLUMNS = {
  name: /^name/i,
  saving: /^savings$/i,
  cum_savings: /^cumm?\.? ?savings$/i,
  txn_fee: /^transaction fee$/i,
  membership: /^membership/i,
  loan: /^loan$/i,
  interest: /^interest on loan$/i,
  excess: /^excess( interest)?$/i,
  fee_spent: /fee spent$/i,
  penalty: /^penalt/i,
  total: /^total amount payable$/i,
  repayment: /^loan repayment$/i,
  minimum: /^minimum/i,
  received: /^amount received/i,
}
const REQUIRED = ['name', 'saving', 'loan', 'interest', 'excess', 'minimum']
const GROUP = { opening_cash: /^opening/i, idle_cash: /^excess amount$/i, excess_billed: /^interest on excess$/i }

/** 'Oct', 'october', 'OCT' → 9: the cycle month, Feb 2026 being 1 and Jan 2027 being 12. */
export function monthIndex(name) {
  const s = String(name).trim().toLowerCase()
  const i = MONTHS.findIndex((m) => s.startsWith(m.toLowerCase()))
  if (i < 0) throw new Error(`Unknown month "${name}"`)
  return i + 1
}

/** The workbook for a month (by the month named in its file name); the latest one when no month is given. */
export function pickWorkbook(fileNames, through) {
  const books = fileNames
    .filter((f) => /\.xlsx$/i.test(f))
    .map((f) => ({ file: f, month: FULL.findIndex((m) => f.toLowerCase().includes(m)) + 1 }))
    .filter((b) => b.month > 0)
  const want = through === undefined ? Math.max(0, ...books.map((b) => b.month)) : monthIndex(through)
  const hits = books.filter((b) => b.month === want).sort((a, b) => a.file.localeCompare(b.file))
  const hit = hits[hits.length - 1]
  if (!hit) throw new Error(`No workbook for ${through ?? 'any month'} in the folder`)
  return { file: hit.file, through: want }
}

const raw = (v) => (v !== null && typeof v === 'object' && 'result' in v ? v.result : v)

export function num(v) {
  const r = raw(v)
  if (r === null || r === undefined || r === '') return 0
  if (typeof r === 'number') return r
  if (typeof r === 'string' && r.trim() !== '' && Number.isFinite(Number(r))) return Number(r)
  if (typeof r === 'object' && 'error' in r) throw new Error(`cell error ${r.error}`)
  throw new Error('a cell that should hold a number does not')
}

export function text(v) {
  const r = raw(v)
  if (r !== null && typeof r === 'object' && Array.isArray(r.richText)) return r.richText.map((t) => t.text).join('')
  return r === null || r === undefined ? '' : String(r)
}

/** A loan cell typed as `=4100+900+2600` is three loans; any other cell is one loan of its value. */
export function loanParts(v) {
  if (v !== null && typeof v === 'object' && typeof v.formula === 'string' && /^[\d.\s+]+$/.test(v.formula)) {
    return v.formula.split('+').map(Number).filter((n) => n > 0)
  }
  const n = num(v)
  return n > 0 ? [n] : []
}

function header(ws) {
  for (let r = 1; r <= 4; r++) {
    const cols = new Map()
    ws.getRow(r).eachCell((cell, c) => {
      const t = text(cell.value).trim().replace(/\s+/g, ' ')
      if (t) cols.set(c, t)
    })
    if ([...cols.values()].some((t) => COLUMNS.saving.test(t))) return { row: r, cols }
  }
  throw new Error(`${ws.name}: no header row with a "Savings" column`)
}

/** One month's sheet: a row per member, and the group block under the totals row. */
export function readSheet(ws) {
  const h = header(ws)
  const col = {}
  for (const [key, re] of Object.entries(COLUMNS)) {
    for (const [c, t] of h.cols) {
      if (re.test(t)) {
        col[key] = c
        break
      }
    }
  }
  for (const key of REQUIRED) if (!col[key]) throw new Error(`${ws.name}: no "${key}" column`)
  if (!col.total && !col.repayment) throw new Error(`${ws.name}: no total payable column`)
  const cell = (r, key) => (col[key] ? ws.getRow(r).getCell(col[key]).value : null)

  const rows = []
  for (let r = h.row + 1; r <= ws.rowCount; r++) {
    const name = text(cell(r, 'name')).trim()
    if (!name || /^total/i.test(name)) break
    rows.push({
      name,
      saving: num(cell(r, 'saving')),
      cum_savings: col.cum_savings ? num(cell(r, 'cum_savings')) : null,
      txn_fee: num(cell(r, 'txn_fee')),
      membership: num(cell(r, 'membership')),
      loans: loanParts(cell(r, 'loan')),
      interest: num(cell(r, 'interest')),
      excess: num(cell(r, 'excess')),
      penalty: num(cell(r, 'penalty')),
      fee_spent: num(cell(r, 'fee_spent')),
      total: num(cell(r, col.total ? 'total' : 'repayment')),
      minimum: num(cell(r, 'minimum')),
      received: col.received ? num(cell(r, 'received')) : null,
    })
  }

  const group = { opening_cash: null, idle_cash: null, excess_billed: null }
  const first = h.row + rows.length + 1
  for (let r = first; r <= Math.min(ws.rowCount, first + 12); r++) {
    const row = ws.getRow(r)
    for (let c = 1; c <= 3; c++) {
      const label = text(row.getCell(c).value).trim()
      const key = Object.keys(GROUP).find((k) => GROUP[k].test(label))
      if (!key) continue
      for (let v = c + 1; v <= c + 3; v++) {
        const value = raw(row.getCell(v).value)
        if (typeof value === 'number') {
          group[key] = value
          break
        }
      }
    }
  }
  return { rows, group }
}

function checkInterestSheet(wb, months, through) {
  const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === 'interest')
  if (!ws) return
  for (let r = 1; r <= 4; r++) {
    let nameCol = null
    const monthCols = []
    ws.getRow(r).eachCell((cell, c) => {
      const t = text(cell.value).trim()
      if (/^name/i.test(t)) nameCol = c
      else if (/^[a-z]+\.?$/i.test(t)) {
        try {
          monthCols.push([c, monthIndex(t)])
        } catch {
          // a header that is not a month
        }
      }
    })
    if (!nameCol || monthCols.length === 0) continue
    for (let row = r + 1; row <= ws.rowCount; row++) {
      const name = text(ws.getRow(row).getCell(nameCol).value).trim().toLowerCase()
      if (!name || /^total/.test(name)) break
      for (const [c, t] of monthCols) {
        // The latest month's column holds that month's savings, not the running total: compare earlier months only.
        if (t >= through) continue
        const expected = months[t - 1]?.rows.find((x) => x.name.toLowerCase() === name)?.cum_savings
        if (expected === undefined) continue
        if (Math.abs(num(ws.getRow(row).getCell(c).value) - expected) > 0.01) {
          throw new Error(`Interest sheet disagrees with the ${MONTHS[t - 1]} statement on cumulative savings (row ${row}); check the column layout`)
        }
      }
    }
    return
  }
}

/** Months 1..through from one workbook: each month from its reconciliation sheet when there is one, else its statement. */
export function parseWorkbook(wb, through) {
  const sheets = new Map()
  for (const ws of wb.worksheets) {
    const m = /^([a-z]{3})[a-z]*\s*([12])$/i.exec(ws.name.trim())
    if (!m) continue
    try {
      sheets.set(`${monthIndex(m[1])} ${m[2]}`, ws)
    } catch {
      // not a month sheet
    }
  }
  const months = []
  const running = new Map()
  for (let t = 1; t <= through; t++) {
    const label = MONTHS[t - 1]
    const statement = sheets.get(`${t} 1`)
    const reconciliation = sheets.get(`${t} 2`)
    if (!statement) throw new Error(`No "${label} 1" sheet in the workbook`)
    if (t < through && !reconciliation) throw new Error(`No "${label} 2" sheet: ${label}'s receipts would be lost`)
    const { rows, group } = readSheet(reconciliation ?? statement)
    months.push({
      month_index: t,
      fee_spent: rows.reduce((sum, r) => sum + r.fee_spent, 0),
      group,
      rows: rows.map((r) => {
        const key = r.name.toLowerCase()
        const cum = r.cum_savings ?? (running.get(key) ?? 0) + r.saving
        running.set(key, cum)
        // Receipts against the last month arrive in the app's first month and are entered there.
        return { ...r, cum_savings: cum, received: t < through ? r.received : null }
      }),
    })
  }
  checkInterestSheet(wb, months, through)
  return { cycle: CYCLE_2026, through, deadlines: DEADLINES_2026, months }
}

export async function readBundle(path, through) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path)
  return parseWorkbook(wb, through)
}
```

- [ ] **Step 5: Run the tests and the guards**

```bash
bun run test scripts/ledger-workbook.test.mjs
bun run lint
printf "import ExcelJS from 'exceljs';\nexport const x = ExcelJS;\n" | bun x eslint --stdin --stdin-filename src/lib/probe.ts
```
Expected: 7 tests PASS; `bun run lint` clean; the probe prints `'exceljs' import is restricted from being used. exceljs is for the local ledger scripts only` and exits 1 (nothing is written to disk).

- [ ] **Step 6: Commit**

```bash
git status --short data/    # Expected: no output
git add scripts/ledger-workbook.mjs scripts/ledger-workbook.test.mjs package.json bun.lock eslint.config.js
git commit -m "feat: read the treasurer's workbooks into an import bundle"
```

---
### Task 12: `ledger:import` and `ledger:check` commands

**Files:**
- Create: `scripts/ledger-import.mjs`, `scripts/ledger-check.mjs`, `scripts/ledger-import.test.mjs`
- Modify: `scripts/seed-guard.mjs`, `scripts/seed-guard.test.mjs`, `package.json` (scripts)

**Interfaces:**
- Consumes: Task 9 (`private.import_history`), Task 7 (`private.check_cycle`), Task 11 (parser), `scripts/scrub.mjs`, `targetsProject`/`isLocalUrl`.
- Produces:
  - `importRefusal(url, prodRef, target, write) → string | null` in `scripts/seed-guard.mjs`: `--write` needs `--target`; a `--target` must be what the URL points at (`local` for localhost); the production project only when `--target` names it.
  - `bun run ledger:import -- [--target <ref>|local] [--through Mon] [--write] [--dir data/content]`: dry run by default (the whole import inside a transaction, rolled back), summary of counts and totals only. Exports `parseArgs(argv)` and `summaryLines(summary, wrote)`.
  - `bun run ledger:check -- [--target <ref>|local]`: per-month counts by reason code from `private.check_cycle`; member-level detail to `data/private/ledger-check.json`; exit 1 when anything is unexplained. Exports `summarise(report)` and `reportLines(rows)`.
  - Neither runs in CI; neither is imported by `src/`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/seed-guard.test.mjs` (and add `importRefusal` to its import list from `./seed-guard.mjs`):
```js
test('the ledger import names its target before writing, and production only by name', () => {
  const prod = 'postgresql://postgres.prodref:x@aws-0-eu.pooler.supabase.com:5432/postgres'
  const dev = 'postgresql://postgres.devref:x@aws-0-eu.pooler.supabase.com:5432/postgres'
  const local = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  expect(importRefusal(dev, 'prodref', undefined, false)).toBeNull()
  expect(importRefusal(dev, 'prodref', undefined, true)).toMatch(/--write needs --target/)
  expect(importRefusal(dev, 'prodref', 'devref', true)).toBeNull()
  expect(importRefusal(dev, 'prodref', 'otherref', false)).toMatch(/does not point at --target otherref/)
  expect(importRefusal(prod, 'prodref', undefined, false)).toMatch(/production/)
  expect(importRefusal(prod, 'prodref', 'devref', true)).toMatch(/does not point at/)
  expect(importRefusal(prod, 'prodref', 'prodref', true)).toBeNull()
  expect(importRefusal(local, 'prodref', 'local', true)).toBeNull()
  expect(importRefusal(dev, 'prodref', 'local', true)).toMatch(/does not point at --target local/)
})
```

`scripts/ledger-import.test.mjs`:
```js
// @vitest-environment node
import { expect, test } from 'vitest'
import { reportLines, summarise } from './ledger-check.mjs'
import { parseArgs, summaryLines } from './ledger-import.mjs'

test('arguments: dry run by default, flags with values, nothing unknown', () => {
  expect(parseArgs([])).toEqual({ target: undefined, through: undefined, write: false, dir: 'data/content' })
  expect(parseArgs(['--', '--target', 'abc', '--write', '--through', 'Oct'])).toEqual({
    target: 'abc', through: 'Oct', write: true, dir: 'data/content',
  })
  expect(() => parseArgs(['--target'])).toThrow(/--target needs a value/)
  expect(() => parseArgs(['--target', '--write'])).toThrow(/--target needs a value/)
  expect(() => parseArgs(['--force'])).toThrow(/Unknown option --force/)
})

test('the import summary prints counts and totals, nothing per member', () => {
  const lines = summaryLines(
    { months: 9, members: 18, entries: 1234, loans: 56, open_loans: 12, savings: 123456.5, owed: 7890, idle_cash: 1000.25 },
    false,
  )
  expect(lines).toEqual([
    'Dry run, rolled back: Cycle 2026, Feb to Oct',
    '  members 18, entries 1234, loans 56 (12 still owed)',
    '  savings K 123,456.50, owed K 7,890.00, idle cash K 1,000.25',
  ])
  expect(summaryLines({ months: 8, members: 1, entries: 1, loans: 0, open_loans: 0, savings: 0, owed: 0, idle_cash: 0 }, true)[0])
    .toBe('Imported: Cycle 2026, Feb to Sep')
})

test('the check report counts reason codes per month', () => {
  const report = {
    periods: [
      { label: 'Feb 2026', checked: true, diff: [] },
      { label: 'Apr 2026', checked: true, diff: [
        { reason_code: 'fee_pot_vs_cash' }, { reason_code: 'workbook_rounded' }, { reason_code: 'fee_pot_vs_cash' },
        { reason_code: 'unexplained' }] },
      { label: 'Nov 2026', checked: false, diff: [] },
    ],
  }
  const rows = summarise(report)
  expect(rows.map((r) => r.unexplained)).toEqual([0, 1, 0])
  expect(reportLines(rows)).toEqual([
    'Feb 2026: 0 differences',
    'Apr 2026: 4 differences (fee_pot_vs_cash 2, unexplained 1, workbook_rounded 1)',
    'Nov 2026: no workbook figures',
  ])
})
```

- [ ] **Step 2: Run them to see them fail**

```bash
bun run test scripts/seed-guard.test.mjs scripts/ledger-import.test.mjs
```
Expected: FAIL — `importRefusal is not a function` / `Failed to load url ./ledger-check.mjs`.

- [ ] **Step 3: Add the guard**

Append to `scripts/seed-guard.mjs`:
```js
// ledger:import and ledger:check read real member data, and ledger:import --write changes the ledger. --write needs an
// explicit --target that the URL really points at (`local` for localhost); production only when --target names it.
// Returns the refusal message, or null when the command may go ahead.
export const importRefusal = (url, prodRef, target, write) => {
  if (write && !target) return '--write needs --target <project ref> (or --target local), naming the database it changes.'
  if (target && !(target === 'local' ? isLocalUrl(url) : targetsProject(url, target))) {
    return `SUPABASE_DB_URL does not point at --target ${target}.`
  }
  if (targetsProject(url, prodRef) && target !== prodRef) {
    return 'Refusing to touch the production project (PROD_PROJECT_REF) unless --target names it.'
  }
  return null
}
```

- [ ] **Step 4: Write the import command**

`scripts/ledger-import.mjs`:
```js
// bun run ledger:import -- [--target <ref>|local] [--through Oct] [--write] [--dir data/content]
// Imports the 2026 treasurer workbooks (git-ignored, data/content/) into Cycle 2026 of Premium Village Banking.
// Local only, never in CI. Without --write it runs the whole import inside a transaction, prints counts and totals,
// and rolls back. The money maths is all in SQL (private.import_history); this file only reads cells.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { MONTHS, pickWorkbook, readBundle } from './ledger-workbook.mjs'
import { clean } from './scrub.mjs'
import { importRefusal, isLocalUrl } from './seed-guard.mjs'

export function parseArgs(argv) {
  const out = { target: undefined, through: undefined, write: false, dir: 'data/content' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') continue
    if (a === '--write') out.write = true
    else if (a === '--target' || a === '--through' || a === '--dir') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`)
      out[a.slice(2)] = v
    } else throw new Error(`Unknown option ${a}`)
  }
  return out
}

const kwacha = (n) => `K ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Counts and totals only: nothing per member ever reaches the terminal. */
export function summaryLines(s, wrote) {
  return [
    `${wrote ? 'Imported' : 'Dry run, rolled back'}: Cycle 2026, ${MONTHS[0]} to ${MONTHS[s.months - 1]}`,
    `  members ${s.members}, entries ${s.entries}, loans ${s.loans} (${s.open_loans} still owed)`,
    `  savings ${kwacha(s.savings)}, owed ${kwacha(s.owed)}, idle cash ${kwacha(s.idle_cash)}`,
  ]
}

const ROLLBACK = Symbol('dry run')

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const url = process.env.SUPABASE_DB_URL
  if (!url) throw new Error('SUPABASE_DB_URL is not set (see .env.example).')
  const refusal = importRefusal(url, process.env.PROD_PROJECT_REF, args.target, args.write)
  if (refusal) throw new Error(refusal)

  const { file, through } = pickWorkbook(readdirSync(args.dir), args.through)
  const bundle = await readBundle(join(args.dir, file), through)

  // postgres.js connects in plaintext unless told otherwise: require TLS off localhost (as db-test.mjs does).
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, ssl: isLocalUrl(url) ? false : 'require' })
  try {
    const [group] = await sql`select id from groups where name = 'Premium Village Banking'`
    if (!group) throw new Error('No "Premium Village Banking" group in this database. Bootstrap it first (docs/ops/setup.md).')
    let summary
    try {
      await sql.begin(async (tx) => {
        const [row] = await tx`select private.import_history(${group.id}, ${JSON.stringify(bundle)}::jsonb) as summary`
        summary = row.summary
        if (!args.write) throw ROLLBACK
      })
    } catch (e) {
      if (e !== ROLLBACK) throw e
    }
    for (const line of summaryLines(summary, args.write)) console.log(line)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    // The DETAIL of a refusal lists unmatched workbook names; it stays on this terminal.
    const detail = e?.detail ? ` (${e.detail})` : ''
    console.error(`ledger:import failed: ${clean(e?.message ?? e)}${clean(detail)}`)
    process.exit(1)
  })
}
```

- [ ] **Step 5: Write the check command**

`scripts/ledger-check.mjs`:
```js
// bun run ledger:check -- [--target <ref>|local]
// Replays every imported month of Cycle 2026 through the close calculation and compares it with the workbook's figures
// (private.check_cycle). Prints counts per reason code only; member-level detail goes to data/private/ledger-check.json,
// which is git-ignored and never leaves this machine. Exits 1 when any difference is unexplained.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { parseArgs } from './ledger-import.mjs'
import { clean } from './scrub.mjs'
import { importRefusal, isLocalUrl } from './seed-guard.mjs'

const DETAIL = 'data/private/ledger-check.json'

export function summarise(report) {
  return report.periods.map((p) => {
    const counts = {}
    for (const d of p.diff) counts[d.reason_code] = (counts[d.reason_code] ?? 0) + 1
    return { label: p.label, checked: p.checked, differences: p.diff.length, unexplained: counts.unexplained ?? 0, counts }
  })
}

export function reportLines(rows) {
  return rows.map((r) => {
    if (!r.checked) return `${r.label}: no workbook figures`
    const parts = Object.entries(r.counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, n]) => `${code} ${n}`)
    return `${r.label}: ${r.differences} differences${parts.length ? ` (${parts.join(', ')})` : ''}`
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const url = process.env.SUPABASE_DB_URL
  if (!url) throw new Error('SUPABASE_DB_URL is not set (see .env.example).')
  const refusal = importRefusal(url, process.env.PROD_PROJECT_REF, args.target, false)
  if (refusal) throw new Error(refusal)

  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, ssl: isLocalUrl(url) ? false : 'require' })
  try {
    const [row] = await sql`
      select private.check_cycle(c.id) as report
      from cycles c join groups g on g.id = c.group_id
      where g.name = 'Premium Village Banking' and c.label = 'Cycle 2026'`
    if (!row) throw new Error('No Cycle 2026 on Premium Village Banking here yet. Run bun run ledger:import first.')
    const rows = summarise(row.report)
    for (const line of reportLines(rows)) console.log(line)
    mkdirSync('data/private', { recursive: true })
    writeFileSync(DETAIL, JSON.stringify(row.report, null, 2))
    console.log(`Member-level detail: ${DETAIL} (git-ignored; keep it on this machine)`)
    const unexplained = rows.reduce((n, r) => n + r.unexplained, 0)
    if (unexplained > 0) {
      console.error(`${unexplained} unexplained difference(s).`)
      process.exitCode = 1
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`ledger:check failed: ${clean(e?.message ?? e)}`)
    process.exit(1)
  })
}
```

- [ ] **Step 6: Add the package scripts**

In `package.json` `scripts`, after `"db:types"`, add:
```json
    "ledger:import": "bun scripts/ledger-import.mjs",
    "ledger:check": "bun scripts/ledger-check.mjs",
```

- [ ] **Step 7: Run the tests, then a smoke run against the development database**

```bash
bun run test scripts/seed-guard.test.mjs scripts/ledger-import.test.mjs
bun run lint
mkdir -p /tmp/pvb-empty && bun run ledger:import -- --dir /tmp/pvb-empty
```
Expected: tests PASS; lint clean; the smoke run prints `ledger:import failed: No workbook for any month in the folder` and exits 1 (the real run is Task 15).

- [ ] **Step 8: Commit**

```bash
git status --short data/    # Expected: no output
git add scripts/ledger-import.mjs scripts/ledger-check.mjs scripts/ledger-import.test.mjs scripts/seed-guard.mjs scripts/seed-guard.test.mjs package.json
git commit -m "feat: ledger:import (dry run by default) and ledger:check commands"
```

---

### Task 13: Admin ledger check page

**Files:**
- Create: `src/features/desk/useLedgerCheck.ts`, `src/features/desk/LedgerCheckPage.tsx`, `src/features/desk/LedgerCheckPage.test.tsx`
- Modify: `src/app/router.tsx`, `src/features/desk/DeskPage.tsx`, `src/features/desk/DeskPage.test.tsx`

**Interfaces:**
- Consumes: `ledger_check(p_group)` (Task 7) via `supabase.rpc`, `useGroup`, `NotFound`, `friendlyError`, `money`, `@/ui` primitives.
- Produces: route `/desk/ledger-check` (title "Ledger check"); `useLedgerCheck(groupId, enabled)` (query key `['ledger-check', groupId]`) returning `LedgerCheck = { cycle_label: string | null; periods: LedgerPeriod[] }`; a link from the desk page. Non-admins get the existing "This page is for admins" screen and no request is made. Read only: the page computes nothing that is stored.

- [ ] **Step 1: Write the failing tests**

`src/features/desk/LedgerCheckPage.test.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import type { Membership } from '@/features/group/useMembership';

const rpc = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
const { LedgerCheckPage } = await import('./LedgerCheckPage');

const membership = (isAdmin: boolean): Membership => ({
  group: { id: 'g1', name: 'Premium Village Banking', currency: 'ZMW', owner_user_id: 'x', figures_visibility: 'open' },
  member: null,
  isAdmin,
});

// Synthetic figures.
const GROUP = { opening_cash: 0, idle_cash: 299, excess_billed: 29.9, interest_collected: 0, fee_pot_balance: 5, meeting_pot_balance: 900 };
const REPORT = {
  cycle_id: 'c1',
  cycle_label: 'Cycle 2026',
  periods: [
    {
      id: 'p1', label: 'Feb 2026', month_index: 1, status: 'closed', group: GROUP, checked: true,
      diff: [
        { member_id: null, short_name: null, field: 'idle_cash', app: 299, workbook: 289, difference: 10, reason_code: 'fee_pot_vs_cash' },
        { member_id: 'm1', short_name: 'Eve', field: 'cum_savings', app: 300, workbook: 350, difference: -50, reason_code: 'unexplained' },
        { member_id: 'm2', short_name: 'Ann', field: 'excess_charged', app: 4.09, workbook: 4.1, difference: -0.01, reason_code: 'workbook_rounded' },
      ],
    },
    { id: 'p2', label: 'Mar 2026', month_index: 2, status: 'closed', group: GROUP, checked: true, diff: [] },
    { id: 'p3', label: 'Apr 2026', month_index: 3, status: 'open', group: null, checked: false, diff: [] },
  ],
};

const renderPage = (isAdmin = true) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <GroupProvider value={membership(isAdmin)}>
          <LedgerCheckPage />
        </GroupProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => rpc.mockReset());

test('members get the admins-only screen and no request is made', () => {
  renderPage(false);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('loading: a labelled skeleton', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderPage();
  expect(screen.getByRole('status')).toHaveTextContent('Loading the ledger check');
  await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('ledger_check', { p_group: 'g1' }));
});

test('error: the friendly sentence and a 48px retry', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'not_admin', code: '42501' } });
  renderPage();
  expect(await screen.findByText('Only admins can do this.')).toBeInTheDocument();
  const retry = screen.getByRole('button', { name: 'Try again' });
  expect(retry.className).toContain('h-12');
  rpc.mockResolvedValueOnce({ data: REPORT, error: null });
  await userEvent.click(retry);
  expect(await screen.findByText('Feb 2026')).toBeInTheDocument();
});

test('empty: no months yet', async () => {
  rpc.mockResolvedValue({ data: { cycle_id: null, cycle_label: null, periods: [] }, error: null });
  renderPage();
  expect(await screen.findByText('No months to check yet')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Check again' }).className).toContain('h-12');
});

test('each month shows its status, group figures and differences grouped by reason', async () => {
  rpc.mockResolvedValue({ data: REPORT, error: null });
  renderPage();
  expect(await screen.findByText('Cycle 2026')).toBeInTheDocument();
  const feb = screen.getByRole('region', { name: 'Feb 2026' });
  expect(within(feb).getByText('Closed')).toBeInTheDocument();
  expect(within(feb).getByText('K 299')).toBeInTheDocument();
  expect(within(feb).getByText('K 29.90')).toBeInTheDocument();
  // unexplained first, then the explained reasons
  const headings = within(feb).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  expect(headings).toEqual(['Unexplained1', 'Loan fees paid from the fee pot, not lending cash1', 'Workbook rounding1']);
  expect(within(feb).getByText('Eve · Savings to date')).toBeInTheDocument();
  expect(within(feb).getByText('App K 300 · Workbook K 350 · Difference −K 50')).toBeInTheDocument();
  expect(within(feb).getByText('Group · Idle cash')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Mar 2026' })).getByText('Matches the workbook.')).toBeInTheDocument();
  const apr = screen.getByRole('region', { name: 'Apr 2026' });
  expect(within(apr).getByText('Open')).toBeInTheDocument();
  expect(within(apr).getByText('Figures appear once this month is closed.')).toBeInTheDocument();
  expect(within(apr).getByText('No workbook figures for this month.')).toBeInTheDocument();
});
```

In `src/features/desk/DeskPage.test.tsx`, replace the `admins get the desk placeholder` test with:
```tsx
test('admins get the desk placeholder and a way to the ledger check', () => {
  render(<MemoryRouter><GroupProvider value={membership(true)}><DeskPage /></GroupProvider></MemoryRouter>);
  expect(screen.getByText('The treasurer desk arrives with the ledger')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'Open the ledger check' });
  expect(link).toHaveAttribute('href', '/desk/ledger-check');
  expect(link.className).toContain('h-12');
});
```

- [ ] **Step 2: Run them to see them fail**

```bash
bun run test src/features/desk
```
Expected: FAIL — `Failed to resolve import "./LedgerCheckPage"`, and no link named "Open the ledger check".

- [ ] **Step 3: Write the hook**

`src/features/desk/useLedgerCheck.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type LedgerDiff = {
  member_id: string | null;
  short_name: string | null;
  field: string;
  app: number;
  workbook: number;
  difference: number;
  reason_code: string;
};
export type LedgerGroupFigures = {
  opening_cash: number;
  idle_cash: number;
  excess_billed: number;
  interest_collected: number;
  fee_pot_balance: number;
  meeting_pot_balance: number;
};
export type LedgerPeriod = {
  id: string;
  label: string;
  month_index: number;
  status: string;
  group: LedgerGroupFigures | null;
  checked: boolean;
  diff: LedgerDiff[];
};
export type LedgerCheck = { cycle_label: string | null; periods: LedgerPeriod[] };

/** Every opened month of the group's active cycle with its group statement and its differences from the workbook. */
export function useLedgerCheck(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ledger-check', groupId],
    enabled,
    queryFn: async (): Promise<LedgerCheck> => {
      const { data, error } = await supabase.rpc('ledger_check', { p_group: groupId });
      if (error) throw error;
      return data as unknown as LedgerCheck;
    },
  });
}
```

- [ ] **Step 4: Write the page**

`src/features/desk/LedgerCheckPage.tsx`:
```tsx
import { ClipboardCheck } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton, type Tone } from '@/ui';
import { useLedgerCheck, type LedgerGroupFigures, type LedgerPeriod } from './useLedgerCheck';

const STATUS: Record<string, { tone: Tone; label: string }> = {
  open: { tone: 'info', label: 'Open' },
  closing: { tone: 'warning', label: 'Closing' },
  closed: { tone: 'neutral', label: 'Closed' },
};

// The spec's fixed reason codes, in the order the treasurer should read them.
const REASONS: { code: string; label: string; tone: Tone }[] = [
  { code: 'unexplained', label: 'Unexplained', tone: 'danger' },
  { code: 'workbook_missed_loan', label: 'Workbook left a loan out of the minimum', tone: 'warning' },
  { code: 'workbook_term_differs', label: 'Workbook used a different repayment term', tone: 'warning' },
  { code: 'penalty_not_charged', label: 'Workbook asked for a charge the app does not raise', tone: 'warning' },
  { code: 'waiver', label: 'Waived by the treasurer', tone: 'info' },
  { code: 'fee_pot_vs_cash', label: 'Loan fees paid from the fee pot, not lending cash', tone: 'info' },
  { code: 'workbook_rounded', label: 'Workbook rounding', tone: 'neutral' },
];

const FIELDS: Record<string, string> = {
  cum_savings: 'Savings to date',
  excess_charged: 'Excess charge',
  closing_owed: 'Owed',
  next_minimum: 'Minimum due',
  opening_cash: 'Opening cash',
  idle_cash: 'Idle cash',
  excess_billed: 'Excess billed',
};

const GROUP_FIGURES: { key: keyof LedgerGroupFigures; label: string }[] = [
  { key: 'opening_cash', label: 'Opening cash' },
  { key: 'idle_cash', label: 'Idle cash' },
  { key: 'excess_billed', label: 'Excess billed' },
  { key: 'interest_collected', label: 'Interest collected' },
  { key: 'fee_pot_balance', label: 'Fee pot' },
  { key: 'meeting_pot_balance', label: 'Meeting pot' },
];

// money() puts the minus after the K (K −50); a difference reads better as −K 50.
const signed = (n: number) => (n < 0 ? `−${money(-n)}` : money(n));

function Differences({ period }: { period: LedgerPeriod }) {
  if (!period.checked) return <p className="mt-4 text-sm text-muted">No workbook figures for this month.</p>;
  if (period.diff.length === 0) {
    return (
      <div className="mt-4">
        <Alert tone="success">Matches the workbook.</Alert>
      </div>
    );
  }
  return (
    <div className="mt-4 grid gap-4">
      {REASONS.map(({ code, label, tone }) => {
        const rows = period.diff.filter((d) => d.reason_code === code);
        if (rows.length === 0) return null;
        return (
          <section key={code}>
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-fg">
              {label}
              <Badge tone={tone}>{rows.length}</Badge>
            </h3>
            <ul role="list" className="grid gap-2">
              {rows.map((d) => (
                <li key={`${d.member_id ?? 'group'}-${d.field}`} className="rounded-xl bg-surface-2 p-3 text-sm text-fg">
                  <p className="font-semibold">{`${d.short_name ?? 'Group'} · ${FIELDS[d.field] ?? d.field}`}</p>
                  <p className="tabular text-muted">{`App ${money(d.app)} · Workbook ${money(d.workbook)} · Difference ${signed(d.difference)}`}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function PeriodCard({ period }: { period: LedgerPeriod }) {
  const status = STATUS[period.status] ?? STATUS.open!;
  const group = period.group;
  const headingId = `ledger-${period.id}`;
  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader title={<span id={headingId}>{period.label}</span>} action={<Badge tone={status.tone}>{status.label}</Badge>} />
        {group ? (
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {GROUP_FIGURES.map(({ key, label }) => (
              <div key={key}>
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="tabular text-base font-semibold text-fg">{money(group[key])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-base text-muted">Figures appear once this month is closed.</p>
        )}
        <Differences period={period} />
      </Card>
    </section>
  );
}

export function LedgerCheckPage() {
  const { group, isAdmin } = useGroup();
  const query = useLedgerCheck(group.id, isAdmin);
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  const { data } = query;
  const refetch = () => void query.refetch();

  return (
    <>
      <PageHeader title="Ledger check" subtitle={data?.cycle_label ?? undefined} />
      {data === undefined ? (
        // Data wins over a failed background refetch: the error state is only for when there is nothing to show.
        query.isError ? (
          <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={refetch}>Try again</Button>}>
            {friendlyError(query.error)}
          </Alert>
        ) : (
          <div role="status" className="grid gap-4">
            <span className="sr-only">Loading the ledger check…</span>
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        )
      ) : data.periods.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-7" />}
          title="No months to check yet"
          action={<Button size="sm" variant="secondary" onClick={refetch}>Check again</Button>}
        >
          Months appear here once the 2026 workbooks are imported or a month is opened.
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {data.periods.map((p) => (
            <PeriodCard key={p.id} period={p} />
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 5: Route and desk link**

In `src/app/router.tsx`, add the import
```tsx
import { LedgerCheckPage } from '@/features/desk/LedgerCheckPage';
```
and, after `page('desk', 'Desk', <DeskPage />),`, the route
```tsx
                  page('desk/ledger-check', 'Ledger check', <LedgerCheckPage />),
```

Replace `src/features/desk/DeskPage.tsx` with:
```tsx
import { ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { NotFound } from '@/features/shells/NotFound';
import { EmptyState, PageHeader } from '@/ui';

export function DeskPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader title="Treasurer desk" />
      <EmptyState
        icon={<ClipboardCheck className="size-7" />}
        title="The treasurer desk arrives with the ledger"
        action={
          <Link
            to="/desk/ledger-check"
            className="inline-flex h-12 items-center rounded-xl px-5 font-semibold text-accent underline transition duration-150 hover:bg-surface-2 active:scale-[.97]"
          >
            Open the ledger check
          </Link>
        }
      >
        Approvals, loans and month close appear here once the February 2027 cycle opens. Until then, the ledger check
        compares the imported 2026 months with the workbooks.
      </EmptyState>
    </>
  );
}
```

- [ ] **Step 6: Run the checks**

```bash
bun run test src/features/desk
bun run typecheck && bun run lint && bun run check:tokens
```
Expected: 7 tests PASS (5 page, 2 desk); typecheck 0; lint clean; `check-tokens: clean`.

- [ ] **Step 7: See it in the browser**

`bun run dev`, sign in as an admin of the development database's Premium VB group (option a: `admin@pvb.test` / `password123`), open `/desk`, tap "Open the ledger check". Expected: "No months to check yet" until Task 15 imports months; the "Check again" button is 48px tall in the phone view (devtools, 390px width) and in dark mode. Sign in as `member@pvb.test`: "This page is for admins".

- [ ] **Step 8: Commit**

```bash
git status --short data/    # Expected: no output
git add src/features/desk src/app/router.tsx
git commit -m "feat: admin ledger check page comparing months with the workbooks"
```

---
### Task 14: Security sweep and docs

**Files:**
- Create: `supabase/tests/database/15_ledger_security.sql`
- Modify: `supabase/tests/database/00_ledger_helpers.sql` (add `tests.admin_calls()`), `README.md`, `SECURITY.md`

**Interfaces:**
- Consumes: every function from Tasks 2–9.
- Produces: one privilege matrix for the ledger API (anon, outsider, member, another group's admin, admin, owner), catalogue checks that no ledger function is executable by `anon` or `PUBLIC`, and the contributor docs for the ledger.

- [ ] **Step 1: Add the call list helper**

In `supabase/tests/database/00_ledger_helpers.sql`, above `-- Later tasks add helpers above this line.`, add:
```sql
-- One call per admin-only ledger function, with arguments that exist, so the only thing that can fail is the caller.
create or replace function tests.admin_calls() returns table (name text, call text) language sql immutable as $$
  values
    ('open_period', $c$select open_period(tests.id('lcycle'), 2)$c$),
    ('set_deadline', $c$select set_deadline(tests.lp(1), date '2026-02-20', 'x')$c$),
    ('return_declaration', $c$select return_declaration(tests.id('decl'), 'x')$c$),
    ('approve_declaration', $c$select approve_declaration(tests.id('decl'))$c$),
    ('send_loan', $c$select send_loan(tests.lm('Dee'), 10, tests.id('w_airtel'))$c$),
    ('apply_penalty', $c$select apply_penalty(tests.lm('Dee'), tests.lp(1), 10, 'other', 'x')$c$),
    ('suggest_penalties', $c$select * from suggest_penalties(tests.lp(1))$c$),
    ('set_default', $c$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, 'x')$c$),
    ('post_correction', $c$select post_correction(tests.id('entry'), 1, 'x')$c$),
    ('post_waiver', $c$select post_waiver(tests.id('interest'), 1, 'x')$c$),
    ('close_month', $c$select close_month(tests.lp(1))$c$),
    ('ledger_check', $c$select ledger_check(tests.id('lg'))$c$)
$$;
```

- [ ] **Step 2: Write the tests**

`supabase/tests/database/15_ledger_security.sql`:
```sql
begin;
select * from no_plan();
select tests.ledger_fixture();
select tests.ledger_inputs(1);
select tests.remember('entry', (select id from entries where member_id = tests.lm('Ann') and kind = 'saving'));
select tests.remember('interest', (select id from entries where member_id = tests.lm('Cid') and kind = 'loan_interest'));
insert into declarations (group_id, period_id, member_id, saving, wallet_id, submitted_by)
  values (tests.id('lg'), tests.lp(1), tests.lm('Dee'), 250, tests.id('w_airtel'), tests.id('admin'));
select tests.remember('decl', (select id from declarations where member_id = tests.lm('Dee')));

-- catalogue ----------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', f, 'EXECUTE'), 'anon cannot execute ' || f)
from unnest(array['public.open_period(uuid,integer,date)', 'public.set_deadline(uuid,date,text)',
  'public.submit_declaration(uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text)',
  'public.return_declaration(uuid,text)', 'public.approve_declaration(uuid)', 'public.send_loan(uuid,numeric,uuid,text,numeric)',
  'public.apply_penalty(uuid,uuid,numeric,text,text)', 'public.suggest_penalties(uuid)', 'public.set_default(uuid,uuid,boolean,text)',
  'public.post_correction(uuid,numeric,text)', 'public.post_waiver(uuid,numeric,text)', 'public.close_month(uuid,boolean,text)',
  'public.ledger_check(uuid)', 'public.payout_preview(uuid)', 'public.ledger_append_only()']) as f;
select ok(has_function_privilege('authenticated', f, 'EXECUTE'), 'signed-in users can call ' || f || ' (it checks them itself)')
from unnest(array['public.open_period(uuid,integer,date)', 'public.set_deadline(uuid,date,text)',
  'public.submit_declaration(uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text)',
  'public.return_declaration(uuid,text)', 'public.approve_declaration(uuid)', 'public.send_loan(uuid,numeric,uuid,text,numeric)',
  'public.apply_penalty(uuid,uuid,numeric,text,text)', 'public.suggest_penalties(uuid)', 'public.set_default(uuid,uuid,boolean,text)',
  'public.post_correction(uuid,numeric,text)', 'public.post_waiver(uuid,numeric,text)', 'public.close_month(uuid,boolean,text)',
  'public.ledger_check(uuid)', 'public.payout_preview(uuid)']) as f;
select is((select count(*)::int from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
           where p.pronamespace = 'public'::regnamespace and a.grantee = 0
             and p.proname in ('open_period', 'set_deadline', 'submit_declaration', 'return_declaration', 'approve_declaration',
                               'send_loan', 'apply_penalty', 'suggest_penalties', 'set_default', 'post_correction', 'post_waiver',
                               'close_month', 'ledger_check', 'payout_preview', 'ledger_append_only')),
  0, 'PUBLIC executes none of the ledger functions');
select ok((select bool_and(prosecdef) from pg_proc
           where pronamespace = 'public'::regnamespace
             and proname in ('open_period', 'set_deadline', 'submit_declaration', 'return_declaration', 'approve_declaration',
                             'send_loan', 'apply_penalty', 'suggest_penalties', 'set_default', 'post_correction', 'post_waiver',
                             'close_month', 'ledger_check', 'payout_preview')),
  'every ledger API function is security definer (05_hardening checks their search_path)');
select is((select count(*)::int from pg_proc p, unnest(array['anon', 'authenticated']) as r
           where p.pronamespace = 'private'::regnamespace and has_function_privilege(r, p.oid, 'EXECUTE')),
  0, 'app roles execute nothing in private (close_figures, import_history, …)');

-- the matrix ---------------------------------------------------------------------------------------
select tests.login_anon();
select throws_ok(c.call, '42501', null, 'anon: ' || c.name) from tests.admin_calls() c;
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$, '42501', null,
  'anon: submit_declaration');
select throws_ok($$select * from payout_preview(tests.id('lcycle'))$$, '42501', null, 'anon: payout_preview');
reset role;

select tests.login_as(tests.id('outsider'));
select throws_ok(c.call, '42501', 'not_admin', 'outsider: ' || c.name) from tests.admin_calls() c;
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'member_not_found', 'outsider: submit_declaration');
select throws_ok($$select * from payout_preview(tests.id('lcycle'))$$, '42501', 'not_admin', 'outsider: payout_preview');
reset role;

select tests.login_as(tests.id('member'));
select throws_ok(c.call, '42501', 'not_admin', 'member: ' || c.name) from tests.admin_calls() c;
select lives_ok($$select submit_declaration(tests.lp(1), tests.lm('Ben'), 500, p_wallet => tests.id('w_airtel'))$$,
  'member: declares for themselves');
select throws_ok($$select submit_declaration(tests.lp(1), tests.lm('Cid'), 500, p_wallet => tests.id('w_airtel'))$$,
  'P0001', 'member_not_found', 'member: not for someone else');
select lives_ok($$select * from payout_preview(tests.id('lcycle'))$$, 'member: payout preview');
reset role;

select tests.login_as(tests.id('owner2'));
select throws_ok(c.call, '42501', 'not_admin', 'another group''s admin: ' || c.name) from tests.admin_calls() c;
reset role;

-- admin and owner get through (spot checks; each function's own file covers its behaviour)
select tests.login_as(tests.id('admin'));
select lives_ok($$select * from suggest_penalties(tests.lp(1))$$, 'admin: suggest_penalties');
select lives_ok($$select ledger_check(tests.id('lg'))$$, 'admin: ledger_check');
reset role;
-- (Dee's and Ben's declarations are still waiting, so the owner decides them before previewing the close.)
select tests.login_as(tests.id('owner'));
select lives_ok($$select approve_declaration(tests.id('decl'))$$, 'owner: approve');
select lives_ok($$select return_declaration((select id from declarations where member_id = tests.lm('Ben')), 'test')$$, 'owner: return');
select lives_ok($$select close_month(tests.lp(1))$$, 'owner: close preview');
select lives_ok($$select * from payout_preview(tests.id('lcycle'))$$, 'owner: payout preview');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 3: Run the suite**

```bash
bun run db:test
```
Expected: every file `ok`, including `02_rls.sql` (anon executes nothing but `invite_preview`), `04_bootstrap.sql` (nothing in `private` is executable by app roles), `05_hardening.sql` (every public definer function has `search_path=public, pg_temp`) and `15_ledger_security.sql`.

- [ ] **Step 4: Document the ledger for contributors**

In `README.md`, after the paragraph that starts `Guards: \`db:reset\` refuses…`, add:
```markdown
### Development database

Production is the hosted project, so database work needs a second database: the local stack (Docker, `bun run db:start`)
or a second free Supabase project used as "dev" (point `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF` and the `VITE_*` values
in `.env.local` at it, apply migrations with `bun run db:push`, and keep `PROD_PROJECT_REF` set to production).
Step by step: Task 0 of `docs/superpowers/plans/2026-10-10-ledger-engine.md`.

### Ledger: 2026 import and checks

    bun run ledger:import                              # dry run: reads data/content/, imports in a transaction, rolls back
    bun run ledger:import -- --target <ref> --write    # writes; <ref> must be the project SUPABASE_DB_URL points at (--target local for the local stack)
    bun run ledger:check -- --target <ref>             # per-month differences from the workbooks, counted by reason code

Both are local only, never in CI. The workbooks (`data/content/`) and everything derived from them (`data/private/`,
including `ledger-check.json`) are git-ignored and never committed. The import refuses production unless `--target`
names it, and refuses to run again once November is open.
```

In `SECURITY.md`, after the `### Authorization lives in the database` list, add:
```markdown
### Ledger
- Ledger tables (`entries`, `statements`, `loans`, `declarations`, …) are read-only to clients. Every write is a
  `security definer` function that checks `is_admin` (or, for `submit_declaration`, that the caller owns the member row).
- `entries`, `statements`, `group_statements` and `workbook_figures` are append-only (trigger). Fix a mistake with
  `post_correction` / `post_waiver`, which land in the open month. Never edit or delete ledger rows from the SQL editor.
- Money maths happens in SQL only. The client shows figures; it never computes one that is stored.
- Treasurer workbooks and anything derived from them stay in `data/content/` and `data/private/` (git-ignored).
  Tests use made-up people and amounts only.
```

- [ ] **Step 5: Run every check**

```bash
bun run typecheck && bun run lint && bun run check:tokens && bun run test
bun run db:test
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git status --short data/    # Expected: no output
git add supabase/tests/database README.md SECURITY.md
git commit -m "test: ledger privilege matrix; docs: development database and ledger commands"
```

---

### Task 15: Workbook fidelity run and production import (local, no committed data)

Nothing in this task commits member data. It may produce fixes (each with a synthetic test and its own commit) and ends with Cycle 2026 on production.

**Files:**
- Modify only if a fix is needed: `scripts/ledger-workbook.mjs` (+ test), or a **new** migration `supabase/migrations/20261010001600_ledger_diff_rules.sql` (+ cases in `12_ledger_diff.sql`). Never edit an earlier migration once production has it.

**Interfaces:**
- Consumes: Tasks 0–14; the real workbooks in `data/content/` (git-ignored).
- Produces: zero `unexplained` differences for every imported month (spec §12.2); Cycle 2026 on production with Feb–Sep (then Oct) imported, open loans rebuilt, November planned (spec §12.3); a rehearsal of close, correction, waiver and default on the development database (spec §12.4).

- [ ] **Step 1: Check nothing private can be committed**

```bash
git check-ignore -v "data/content/Premium VB September 2026.xlsx" data/private/ledger-check.json
git status --short data/
```
Expected: both paths reported as ignored by `.gitignore`; `git status` prints nothing.

- [ ] **Step 2: Dry run against the development database**

The development database needs the Premium VB group (option a: the seed; option b: Task 0 step 5) and migrations up to `…1500` applied.
```bash
bun run ledger:import -- --through Sep
```
Expected: `Dry run, rolled back: Cycle 2026, Feb to Sep`, `members 18`, and plausible totals. A `member_not_found` refusal prints the workbook spellings that match no member: **stop and ask the owner** (do not rename real members to fit a workbook); the remedy is decided with them.

- [ ] **Step 3: Write to the development database and check**

```bash
bun run ledger:import -- --through Sep --target <dev ref, or local> --write
bun run ledger:check -- --target <dev ref, or local>
```
Expected: one line per month, e.g. `Apr 2026: 23 differences (fee_pot_vs_cash 19, workbook_rounded 4)` (numbers illustrative), and `data/private/ledger-check.json` written.

- [ ] **Step 4: Clear every `unexplained` difference**

For each `unexplained` row in `data/private/ledger-check.json` (read it locally; never paste it anywhere):
1. **The parser read the wrong cell** (a renamed header, an extra column, a sheet spelled differently): fix `scripts/ledger-workbook.mjs` and add a Vitest case that builds the same *layout* with made-up numbers. Commit: `fix: read <what> from the <Mon> layout`.
2. **A workbook practice an existing code covers but the rule misses** (`data/private/workbook-model.md` §2 lists the known ones): add the rule to `private.close_diff` in the new migration `20261010001600_ledger_diff_rules.sql` (a full `create or replace function private.close_diff …` copied from Task 7 with the extra `when` line) and a synthetic case in `12_ledger_diff.sql` that fails before the change. Commit: `fix: explain <practice> as <reason_code>`.
3. **Neither**: do not invent a reason code (the spec's list is fixed). Write it up privately in `data/private/` and ask the owner; a month may only be accepted with the owner's decision.

Re-run Step 3 (the import is re-runnable until November opens) until every month reports `unexplained` 0. Then `bun run test && bun run db:test`.

- [ ] **Step 5: Look at it**

`bun run dev`, sign in as an admin on the development database, open `/desk/ledger-check`: Feb–Sep listed as closed with group figures, differences grouped by reason, no "Unexplained" group.

- [ ] **Step 6: Rehearse a month on the development database (never production)**

In the development database's SQL editor (or `psql "$SUPABASE_DB_URL"`), acting as an admin by setting the JWT claims for one transaction:
```sql
begin;
select set_config('request.jwt.claims', json_build_object('sub', '<an admin''s auth user id>', 'role', 'authenticated')::text, true);
select open_period((select id from cycles where label = 'Cycle 2026'), 9);          -- October, as in the next workbook
select close_month((select id from periods p join cycles c on c.id = p.cycle_id where c.label = 'Cycle 2026' and p.month_index = 9));
-- try a correction, a waiver and a default the same way (post_correction, post_waiver, set_default), then:
select action, created_at from audit_log order by created_at desc limit 10;   -- each one audited
rollback;                                                                       -- leave the import as it was
```
Expected: the preview returns figures and a difference list; each call is audited; `rollback` undoes it all.

- [ ] **Step 7: Ship the migrations**

Open a pull request from `feat/ledger-engine` to `main`; CI (web, db, edge) must be green. Merge, then approve the gated "Deploy database and functions" workflow (`docs/ops/setup.md` section 6). Expected: the workflow's dry run lists `20261010000700` … `20261010001500` (and `…1600` if Step 4 added it), then applies them.

- [ ] **Step 8: Import into production**

In a terminal, not in `.env.local` (shell variables win over `.env.local`):
```bash
export SUPABASE_DB_URL='<production session pooler URL>'
bun run ledger:import -- --through Sep --target <PROD_PROJECT_REF>            # dry run
bun run ledger:import -- --through Sep --target <PROD_PROJECT_REF> --write
bun run ledger:check -- --target <PROD_PROJECT_REF>
unset SUPABASE_DB_URL
```
Expected: the same summary as on the development database; `ledger:check` reports `unexplained` 0 for every month. In the production SQL editor: `select month_index, label, status from periods p join cycles c on c.id = p.cycle_id where c.label = 'Cycle 2026' order by 1;` shows Feb–Sep `closed`, the rest `planned`.

- [ ] **Step 9: October**

When the October workbook arrives (before the November window opens on the 5th), put it in `data/content/` and repeat Steps 2–4 and 8 with `--through Oct`. The import replaces its own rows; it refuses once November is open, so do this before anyone opens November.

- [ ] **Step 10: Tidy the development database**

If the development database is a hosted project, it now holds real member figures: `bun run db:reset -- --allow-hosted` once production is verified. Delete `data/private/ledger-check.json` when it is no longer needed.

---

## Self-review: spec → tasks

| Spec section | Where |
|---|---|
| §1 Goal (money tables, month close, corrections, defaults, import, one check page) | Tasks 1–13 |
| §2 Sources stay git-ignored; nothing real committed | Global Constraints; `git status --short data/` before every commit; Task 15 Step 1 |
| §3 Amounts to the ngwee, no rounding | `numeric(12,2)` everywhere (Task 1); trunc + remainder splits (Task 6); ngwee tests (Tasks 4, 6) |
| §3 Saving minimum K250 | `suggest_penalties` `under_saving` (Task 5) |
| §3 Window/deadline per month, extensions | `periods.deadline`, `open_period(…, deadline)`, `set_deadline` (Task 2) |
| §3 Penalties suggested, applied or waived with a reason, join the interest pool | `suggest_penalties`, `apply_penalty` (Task 5); `post_waiver` (Task 5); penalties in `interest_collected` (Task 6) |
| §3 Membership to the meeting pot | `membership` entries → `meeting_pot_*` (Task 6 Feb test) |
| §3 Transaction fees → fee pot; loan transfer fees from it | `txn_fee` / `payout_fee`, `send_loan(p_fee)` (Tasks 4, 6) |
| §3 Loan interest 15% once; waiver as a correction | `send_loan` (Task 4); `post_waiver` + Fay's zero-interest loan (Tasks 5, 6) |
| §3 Loan term by size, shortened by January, equal instalments, last absorbs remainder | `private.schedule_loan` (Task 4: 3,001, 5,001 in Nov, 10,000 in Dec) |
| §3 Loan cap by cycle month, warn, reason to approve | `send_loan` (Task 4: over cap without/with reason, exactly at cap) |
| §3 Arrears warn | `send_loan` arrears warning (Task 4) |
| §3 Loans any day, cash on hand only, month sent | `private.lending_cash`, period row lock (Task 4) |
| §3 Excess 10% of idle cash, all members, by cumulative savings incl. this month | `close_figures` step 3 (Task 6) |
| §3 Minimum payable = next instalments + excess + earlier unpaid minimum | `close_figures` step 6 (Task 6: Ben, Eve, Dee, Fay) |
| §3 Payment order excess → penalties → interest → principal, oldest loan first | `close_figures` step 4 (Task 6: Ben, Cid; loan statuses) |
| §3 Interest earned shared by cumulative savings, booked monthly | `close_figures` step 5, `interest_share` entries (Task 6) |
| §3 Default: no further share, debt from savings, reversible | `set_default` (Task 5); Dee in Task 6; payout netting (Task 8) |
| §3 Payout: savings + interest − owed; pots equally | `payout_preview` (Task 8) |
| §3 Wallets on every receipt and loan | `wallet_id` checks in Tasks 3, 4 |
| §3 History imported as official; rules from November | Task 9 (imported mode) and Task 15 |
| §4 Tables, entry kinds, corrections, immutability | Task 1 (tables, triggers, import switch); Task 2 (`ledger_lines`) |
| §5 Preview/commit, preconditions, steps 1–6, determinism | Task 6 (`previous_period_open`, `declarations_pending`, preview = commit, determinism, replay) |
| §5 Step 7 diff and reason codes, reason to commit unexplained | Task 7 (every code has a case; `unexplained_differences`) |
| §5 Corrections into the open month | Tasks 5 and 6 (closed-month correction) |
| §6 `open_period`, `set_deadline` | Task 2 |
| §6 `submit_declaration` / `return_declaration` / `approve_declaration` | Task 3 |
| §6 `send_loan` (`loans_closed`, `insufficient_cash`, `over_cap_needs_reason`) | Task 4 |
| §6 `apply_penalty`, `suggest_penalties`, `post_correction`, `post_waiver`, `set_default` | Task 5 |
| §6 `close_month` | Tasks 6–7 |
| §6 `payout_preview` | Task 8 |
| §6 Business codes → `friendlyError` | Task 10 (table test covers every code) |
| §7 Import: cycle, periods and deadlines, name matching refusal, entries, statements, workbook figures, loan rebuild, closed months, dry run, `--target` for `--write`, re-run until November (`already_opened`), xlsx dev dependency | Task 9 (SQL), Task 11 (parser, synthetic xlsx generated in the test), Task 12 (CLI and guards), Task 15 (real run) |
| §7 `ledger:check` | Task 7 (`private.check_cycle`), Task 12 (command), Task 15 |
| §8 Admin check page: admin gate, states, 48px, tokens | Task 13 |
| §9 RLS by `can_see_figures` / `is_member` / `is_admin` | Task 1 |
| §9 No client writes; every function checks caller and group; revoke from `public, anon`; 02_rls allowlist; `submit_declaration` for owners | Tasks 1, 3, 14 |
| §9 Money maths only in SQL; import guards | Tasks 6, 9, 12, 13 |
| §10 pgTAP synthetic data, one test per rule/function/policy, preview = commit, determinism, refusals | Tasks 1–9, 14 |
| §10 Workbook fidelity (local) | Task 15 |
| §10 Vitest for the page and the parser | Tasks 11, 13 |
| §12 Success criteria 1–5 | 1: Tasks 1–14 in CI; 2–4: Task 15; 5: Tasks 1, 14 |
