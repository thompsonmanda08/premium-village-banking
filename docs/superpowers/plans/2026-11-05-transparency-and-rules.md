# Member transparency and rules on the record: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members can read a monthly report with every override and its reason, see why their figures are what they are, query a figure, and see which rules the group has ratified.

**Architecture:** Additive Supabase migrations (two tables, six security-definer functions, all writes through functions, reads through RLS or function results) plus React pages in the existing feature folders. Money maths stays in SQL; the client formats and decomposes nothing it did not receive.

**Tech Stack:** Postgres/pgTAP (`supabase/migrations`, `supabase/tests/database`), React 19 + TanStack Query + Vitest + Testing Library (`src/features/*`), pnpm.

**Spec:** `docs/superpowers/specs/2026-11-05-transparency-and-rules-design.md` (read section 11 first: it holds the settled calls).

## Global Constraints

- Migrations are additive: new tables and functions only; no existing object is altered except adding names to allowlists in tests and to `src/lib/errors.ts`.
- Every new function: `security definer`, `set search_path = public, pg_temp`, checks the caller itself, validates input in SQL, `revoke execute … from public, anon`, `grant execute … to authenticated`. Errors are `raise exception '<code>' using errcode = 'P0001'` (or `'42501'` for `not_admin`).
- Every new table: RLS on, `revoke all … from public, anon, authenticated`, then only the select grants the spec gives. No client insert, update or delete.
- Append-only tables use the existing `public.ledger_append_only()` trigger function.
- Audit rows through `private.audit(group, action, entity, id, data)`. New actions: `rule.ratified`, `query.raised`, `query.answered`.
- Visibility is decided in SQL from `groups.figures_visibility` (`'open'` shows names, `'private'` shows only counts and totals); a member always sees their own rows.
- UI: tokens only (`pnpm run check:tokens`), 48px targets, the states loading / empty / error / success on every new screen, plain English, amounts via `money()` from `@/lib/format`.
- Tests: pgTAP with synthetic data (`tests.ledger_fixture()`), Vitest with the repo's existing helpers. No real member data anywhere.
- Commit after each task; message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Group visibility `private`: `month_report` and `month_overrides` return no other member's name or figure, only counts and totals (tests in Task 4).
2. An imported month (statements with `source = 'import'`): report overrides are empty with `overrides_recorded = false`; `minimum_breakdown` returns `{ "imported": true }` (Tasks 4 and 5).
3. The two-thirds boundary: 12 of 18 passes, 11 of 18 does not; 1 of 1 passes; `votes_for > votes_total` and `votes_total = 0` are refused (Task 1).
4. A query on an open month, on another member's row, with an unknown field, or a fourth open query is refused (Task 6).
5. A member with no statement in a month (joined later) gets an empty breakdown, not an error (Task 5).

## File structure

- Create `supabase/migrations/20261105000100_rule_ratifications.sql`: table, trigger, `record_ratification`.
- Create `supabase/migrations/20261105000200_month_report.sql`: `month_overrides`, `month_report`, `minimum_breakdown`.
- Create `supabase/migrations/20261105000300_figure_queries.sql`: table, `raise_query`, `answer_query`.
- Create `supabase/tests/database/22_rule_ratifications.sql`, `23_month_report.sql`, `24_figure_queries.sql`; modify `02_rls.sql` allowlist.
- Create `src/features/rules/ruleCatalog.ts`, `ratifications.ts` (pure status logic), `RecordVoteSheet.tsx`; modify `RulesPage.tsx`.
- Create `src/features/report/` (`reportQueries.ts`, `ReportPage.tsx`, `OverridesList.tsx`); modify `router.tsx`, `GroupPage.tsx`, `PassbookPage.tsx`.
- Create `src/features/passbook/BreakdownPanel.tsx`, `src/features/queries/QueryFigureSheet.tsx`, `src/features/desk/QuestionsCard.tsx`; modify `DeskPage.tsx`.
- Modify `src/lib/errors.ts` (new codes), regenerate `src/lib/database.types.ts`.

---

### Task 1: Rule ratifications (database)

**Files:**
- Create: `supabase/migrations/20261105000100_rule_ratifications.sql`
- Test: `supabase/tests/database/22_rule_ratifications.sql`

**Interfaces:**
- Produces: table `public.rule_ratifications(id, created_at, group_id, cycle_id, rule_key text, decided_on date, votes_for int, votes_total int, passed boolean, meeting_ref text, note text, recorded_by uuid)`, select for `is_member(group_id)`; `public.record_ratification(p_cycle uuid, p_rule_key text, p_decided_on date, p_votes_for int, p_votes_total int, p_meeting_ref text default null, p_note text default null) returns public.rule_ratifications`. Error codes: `not_admin` (42501), `invalid_rule` (key not `^[a-z][a-z_]{2,39}$`), `invalid_vote` (`votes_total < 1`, `votes_for < 0`, `votes_for > votes_total`, or `decided_on` after today), `invalid_note` (note or meeting_ref over 500 characters).

- [ ] **Step 1: Write the failing pgTAP file.** Tests, each with the stated assertion: app roles lack execute (`has_function_privilege`), a plain member gets `42501`/`not_admin`, an admin of another group gets `not_admin`; `invalid_rule` for `'Bad Key'`, `'ab'`, and a 41-character key; `invalid_vote` for (0 of 0), (5 of 4), (-1 of 4), a future date; `invalid_note` for a 501-character note; `passed` is true for 12 of 18 and 1 of 1, false for 11 of 18; a row cannot be updated or deleted (`append_only`, P0001); a second row for the same key is added, not replaced; a member of the group can select, a member of another group cannot; each call writes one `rule.ratified` audit row.
- [ ] **Step 2: Run to verify it fails.** Run: `node scripts/db-test.mjs` against a local stack (`pnpm exec supabase start`, `SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`, `PROD_PROJECT_REF=none`). Expected: `22_rule_ratifications.sql` fails (function does not exist).
- [ ] **Step 3: Write the migration.** Table with `check (votes_total >= 1 and votes_for between 0 and votes_total)`, unique none, FK `(cycle_id, group_id)` to `cycles`, `passed boolean not null`; trigger `rule_ratifications_append_only` using `public.ledger_append_only()`; RLS select policy `is_member(group_id)`; `record_ratification` computes `passed := p_votes_for * 3 >= p_votes_total * 2`, locks nothing else, audits `rule.ratified` with `{rule_key, votes_for, votes_total, passed, decided_on}`.
- [ ] **Step 4: Run to verify it passes.** Expected: all files `ok`, including `22_`. Also update the allowlist in `supabase/tests/database/02_rls.sql` (and any file it feeds) so the new function is listed as executable by `authenticated`; the suite must stay green.
- [ ] **Step 5: Regenerate types and commit.** Run `pnpm run db:types` (local stack, writes `src/lib/database.types.ts`); `git add` the migration, tests and types; commit `feat: record the group's vote on each rule`.

### Task 2: The rule catalog and status logic

**Files:**
- Create: `src/features/rules/ruleCatalog.ts`, `src/features/rules/ratifications.ts`
- Test: `src/features/rules/ruleCatalog.test.ts`, `src/features/rules/ratifications.test.ts`

**Interfaces:**
- Produces: `type RuleBasis = 'as_written' | 'differs' | 'not_in_constitution'`; `type CatalogRule = { key: string; title: string; text: string; clause: string | null; basis: RuleBasis }`; `export const RULE_CATALOG: CatalogRule[]`; `type Ratification = { rule_key: string; cycle_id: string; passed: boolean; votes_for: number; votes_total: number; decided_on: string; created_at: string }`; `type RuleStatus = { state: 'ratified' | 'failed' | 'not_voted'; row: Ratification | null }`; `export function ruleStatus(rows: Ratification[], key: string, cycleId: string): RuleStatus` (latest row for that cycle by `created_at`; a later failed row replaces an earlier pass); `export function unratifiedCount(rows: Ratification[], cycleId: string): number`.

- [ ] **Step 1: Write failing tests.** `ruleCatalog.test.ts`: every key matches `^[a-z][a-z_]{2,39}$`, no key repeats, every entry has non-empty `title` and `text`, at least one entry has each of the three bases, the entries for penalty basis, minimum payable, payment order and excess charge are not `as_written`. `ratifications.test.ts`: no rows gives `not_voted`; a pass gives `ratified`; a pass followed by a later fail gives `failed`; a fail followed by a later pass gives `ratified`; rows of another cycle are ignored; `unratifiedCount` equals catalog size minus ratified keys.
- [ ] **Step 2: Run to verify they fail.** Run: `pnpm exec vitest run src/features/rules`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement both files.** Catalog entries (keys): `saving_minimum`, `loan_interest`, `loan_terms`, `loan_cap`, `no_loans_last_month`, `excess_charge`, `minimum_payable`, `payment_order`, `penalty_basis`, `membership_fee`, `deadlines_and_extensions`, `default_handling`, `payout_and_pots`. Wording and `basis` follow the clauses in `data/private/rules-from-sources.md` (read locally, copy no member data and no file contents wholesale; plain English a member can read).
- [ ] **Step 4: Run to verify they pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: the catalog of rules the app applies, and how a vote decides one`.

### Task 3: Rules page: statuses and recording a vote

**Files:**
- Create: `src/features/rules/RecordVoteSheet.tsx`, `src/features/rules/useRatifications.ts`
- Modify: `src/features/rules/RulesPage.tsx`, `src/lib/errors.ts`
- Test: `src/features/rules/RulesPage.test.tsx` (extend), `src/features/rules/RecordVoteSheet.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`RULE_CATALOG`, `ruleStatus`, `unratifiedCount`, `Ratification`); `useLedgerAction` from `@/features/ledger/actions`; `useGroup()`.
- Produces: `useRatifications(cycleId: string | undefined)` returning the TanStack query of `Ratification[]` (select from `rule_ratifications`, key `['ratifications', cycleId]`); `useRecordRatification()` (mutation over RPC `record_ratification`, argument `{ cycleId, ruleKey, decidedOn, votesFor, votesTotal, meetingRef?, note? }`); component `RecordVoteSheet({ rule, cycleId, open, onClose })`.

- [ ] **Step 1: Write failing tests.** `RulesPage.test.tsx`: a new section "How the app applies the rules" lists one row per catalog rule with the basis label ("As written", "Applied by the app, differs from the text", "Applied by the app, not in the constitution") and the status text ("Not yet voted", "Ratified 14 Nov 2026, 12 of 18", "Voted, did not pass"); a line at the top reads "N rules not yet ratified"; a member sees no "Record a vote" button, an admin sees one per rule. `RecordVoteSheet.test.tsx`: submitting calls the RPC with the entered values; votes for greater than votes total shows a field error and sends nothing; a refusal shows the friendly message.
- [ ] **Step 2: Run to verify they fail.** Run: `pnpm exec vitest run src/features/rules`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add friendly messages in `src/lib/errors.ts` for `invalid_rule` ("That rule isn't recognised.") and `invalid_vote` ("Check the vote: votes for can't be more than votes counted, and the date can't be in the future."). Follow the existing sheet components (`WaiveEntrySheet.tsx`) for form patterns and the five states.
- [ ] **Step 4: Run to verify they pass** and `pnpm exec tsc --noEmit -p tsconfig.json`, `pnpm run check:tokens`, `pnpm exec eslint src/features/rules`. Expected: all clean.
- [ ] **Step 5: Commit** `feat: show which rules the group has voted on, and record a vote`.

### Task 4: Overrides log and monthly report (database)

**Files:**
- Create: `supabase/migrations/20261105000200_month_report.sql` (this task writes `month_overrides` and `month_report`; Task 5 appends `minimum_breakdown` to the same file)
- Test: `supabase/tests/database/23_month_report.sql`

**Interfaces:**
- Consumes: Task 1 table `rule_ratifications`; `private.ledger_lines`, `entries`, `loans.approved_reason`, `statements`, `group_statements`, audit actions `member.default_changed` (data: `cycle_id`, `from`, `defaulted`, `reason`) and `period.deadline_changed` (entity `periods`, `entity_id` = the period).
- Produces: `public.month_overrides(p_period uuid) returns jsonb` (array of `{ at, kind, member_id, member, amount, reason }`, `member_id` and `member` null when the group is `private` and the viewer is neither admin nor that member; kinds `correction`, `waiver`, `penalty_applied`, `penalty_waived`, `loan_over_cap`, `default_set`, `default_cleared`, `deadline_extended`; ordered by `at`); `public.month_report(p_period uuid) returns jsonb` shaped `{ period: {id, label, month_index, closed_at}, group: <group_statements row of the period as an object>, loans: {sent_count, sent_principal, open_count, open_principal}, arrears: {count, total, members: [{member_id, name, unpaid}] | null}, overrides: <month_overrides>, overrides_recorded: boolean, rules: {ratified_by_close: int} }`. Errors: `period_not_found` is raised as `period_not_open`'s existing behaviour for unknown ids; a period that is not `closed` raises `period_not_closed`; a caller outside the group raises `not_admin`.

- [ ] **Step 1: Write the failing pgTAP file.** With `tests.ledger_fixture()` and a closed month: an outsider and a different group's admin get `not_admin`; an open or planned month gets `period_not_closed`; `month_overrides` lists a correction, a waiver on a penalty (`penalty_waived`), an applied penalty (`penalty_applied`), a loan approved with a reason (`loan_over_cap`, `amount` = principal), a default set and cleared (from the audit rows, attributed to the month containing their date) and a deadline extension (`amount` null); with the group `open` names are shown, with it `private` another member's rows have null member fields and the member's own rows keep theirs, and an admin sees all; arrears `count` and `total` equal the statements with `unpaid_minimum > 0` and `members` is null when `private` (admin and own-row exception does not apply to the list: it is null for non-admins); `loans` figures equal the loans table; `rules.ratified_by_close` counts distinct rule keys whose latest row for the cycle passed with `decided_on` on or before `closed_at`; a month whose statements have `source = 'import'` returns `overrides: []` and `overrides_recorded: false`, and a live month returns `overrides_recorded: true`.
- [ ] **Step 2: Run to verify it fails.** Run: `node scripts/db-test.mjs` (local stack). Expected: `23_month_report.sql` fails.
- [ ] **Step 3: Write the two functions** per the interfaces. A correction's month is the entry's `period_id`; an audit row's month is the period whose `starts_on` to next month's start contains `created_at` for the group's cycle. Visibility check: `groups.figures_visibility = 'open'` or `is_admin(group)` or the row's member is the caller.
- [ ] **Step 4: Run to verify it passes.** Expected: all files `ok`. Update the `02_rls.sql` allowlist for both functions.
- [ ] **Step 5: Commit** `feat: the monthly report and the log of overrides`.

### Task 5: "Why this figure" (database)

**Files:**
- Modify: `supabase/migrations/20261105000200_month_report.sql` (append)
- Test: `supabase/tests/database/23_month_report.sql` (extend)

**Interfaces:**
- Produces: `public.minimum_breakdown(p_member uuid, p_period uuid) returns jsonb`: for a month closed by the app, `{ "instalments": n, "excess": n, "earlier_shortfall": n, "capped_to_owed": boolean, "minimum": n }` where the first three are the terms `close_month` adds into `next_minimum` and `minimum` equals the statement's `next_minimum`; for an imported month `{ "imported": true, "minimum": n }`; for a member with no statement that month `{ "none": true }`. Access follows `can_see_figures(group, member)`; otherwise `not_admin`.

- [ ] **Step 1: Write the failing tests** (extend `23_`): the three terms sum to the statement's `next_minimum` unless `capped_to_owed` is true, in which case `minimum` equals `closing_owed`; an imported month returns the imported form; a member with no statement returns `none`; a member viewing their own row works in a `private` group; viewing another member's row in a `private` group raises `not_admin`.
- [ ] **Step 2: Run to verify it fails.** Expected: new assertions fail.
- [ ] **Step 3: Implement** by reading the same inputs `close_month` uses (`loan_instalments` of the next period, the month's `excess_charged`, `unpaid_minimum`); do not recompute in the client.
- [ ] **Step 4: Run to verify it passes**, then update the `02_rls.sql` allowlist.
- [ ] **Step 5: Commit** `feat: break a minimum down into its parts`.

### Task 6: Figure queries (database)

**Files:**
- Create: `supabase/migrations/20261105000300_figure_queries.sql`
- Test: `supabase/tests/database/24_figure_queries.sql`

**Interfaces:**
- Produces: table `public.figure_queries(id, created_at, group_id, period_id, member_id, field text, note text, status text, reply text, answered_by uuid, answered_at timestamptz)` with `check (field in ('cum_savings','closing_owed','next_minimum','excess_charged','interest_earned_to_date','paid_total'))`, `check (status in ('open','answered'))`, `check (length(trim(note)) between 1 and 500)`; select policy: `is_admin(group_id)` or the row's member is the caller. `public.raise_query(p_period uuid, p_field text, p_note text) returns public.figure_queries` (caller's own active member row; closed month only; at most 3 open queries per member). `public.answer_query(p_query uuid, p_reply text) returns public.figure_queries` (admin only, once, reply 1 to 500 characters). Error codes: `not_admin`, `period_not_closed`, `invalid_field`, `invalid_note`, `too_many_queries`, `query_not_found`, `already_answered`.

- [ ] **Step 1: Write the failing pgTAP file:** a member raises a query on a closed month (audited `query.raised`); open month gives `period_not_closed`; an unknown field gives `invalid_field`; blank or 501-character note gives `invalid_note`; the fourth open query gives `too_many_queries`; a member who left, or someone outside the group, gets `not_admin`; a member sees only their own queries and cannot see another's; an admin sees all; `answer_query` by a member gives `not_admin`, by an admin works once (audited `query.answered`), a second answer gives `already_answered`, an unknown id gives `query_not_found`; clients cannot insert, update or delete directly.
- [ ] **Step 2: Run to verify it fails.** Expected: `24_` fails.
- [ ] **Step 3: Write the migration** (table with FKs `(period_id, group_id)` and `(member_id, group_id)`, RLS, grants, two functions with row locking on the query row in `answer_query`).
- [ ] **Step 4: Run to verify it passes**; update the `02_rls.sql` allowlist; regenerate `src/lib/database.types.ts` with `pnpm run db:types`.
- [ ] **Step 5: Commit** `feat: let a member question a figure and the treasurer answer it`.

### Task 7: The monthly report page

**Files:**
- Create: `src/features/report/reportQueries.ts`, `src/features/report/ReportPage.tsx`, `src/features/report/OverridesList.tsx`
- Modify: `src/app/router.tsx` (add `page('report/:month?', 'Monthly report', <ReportPage />)` before `page('*', …)`), `src/features/group/GroupPage.tsx` (a link to the latest report), `src/features/passbook/PassbookPage.tsx` (a link)
- Test: `src/features/report/ReportPage.test.tsx`, `src/features/report/OverridesList.test.tsx`

**Interfaces:**
- Consumes: Task 4's `month_report` result shape; `useLedgerCycle(groupId)` for the periods.
- Produces: `type MonthReport` (the shape in Task 4) and `useMonthReport(periodId: string | undefined)` (RPC `month_report`, key `['month-report', periodId]`, never persisted: add `'month-report'` to `NEVER_PERSISTED` in `src/lib/queryClient.ts`); route param `month` as `YYYY-MM` mapped to the period whose label is that month (default: the latest closed month).

- [ ] **Step 1: Write failing tests.** `ReportPage.test.tsx`: shows the group figures, loans, arrears count and total and the rules line ("N of M rules ratified by the close"); with `arrears.members` null no names appear and the text says names are hidden by the group's setting; with names they appear; `overrides_recorded: false` shows "Overrides were not recorded before November 2026"; an unknown or open month shows an empty state; loading and error states render; `OverridesList.test.tsx`: each kind renders its plain-English label, reason and, when present, member and amount; an empty recorded list reads "No overrides this month".
- [ ] **Step 2: Run to verify they fail.** Run: `pnpm exec vitest run src/features/report`. Expected: FAIL.
- [ ] **Step 3: Implement the pages** with the existing `PageHeader`, `Card`, `Figure` patterns from `GroupReport.tsx` and `PassbookPage.tsx`; month navigation as links to previous and next closed months.
- [ ] **Step 4: Run to verify they pass** plus `pnpm exec tsc --noEmit -p tsconfig.json`, `pnpm run check:tokens`, `pnpm exec eslint src`. Expected: clean.
- [ ] **Step 5: Commit** `feat: a monthly report every member can read`.

### Task 8: "Why this figure" and querying a figure (screens)

**Files:**
- Create: `src/features/passbook/BreakdownPanel.tsx`, `src/features/queries/QueryFigureSheet.tsx`, `src/features/queries/queryHooks.ts`, `src/features/desk/QuestionsCard.tsx`
- Modify: `src/features/passbook/PassbookPage.tsx` (breakdown under "Next minimum", a "Question this" button on each figure), `src/features/desk/DeskPage.tsx` (render `QuestionsCard`), `src/lib/errors.ts` (friendly messages for `period_not_closed`, `invalid_field`, `too_many_queries`, `query_not_found`, `already_answered`)
- Test: `BreakdownPanel.test.tsx`, `QueryFigureSheet.test.tsx`, `QuestionsCard.test.tsx`

**Interfaces:**
- Consumes: Task 5's `minimum_breakdown` result; Task 6's `raise_query` and `answer_query`; `useLedgerAction`.
- Produces: `useMinimumBreakdown(memberId, periodId)`, `useMyQueries(memberId)`, `useOpenQueries(groupId)`, `useRaiseQuery()`, `useAnswerQuery()`; components `BreakdownPanel({ memberId, periodId })`, `QueryFigureSheet({ periodId, field, open, onClose })`, `QuestionsCard()` (renders nothing when there are no open queries and the viewer is an admin; renders nothing for non-admins).

- [ ] **Step 1: Write failing tests.** `BreakdownPanel`: renders the three parts and their total for an app-closed month, the sentence "From the treasurer's workbook; not itemised" for `{ imported: true }`, nothing for `{ none: true }`, and the cap note when `capped_to_owed`. `QueryFigureSheet`: sending calls `raise_query` with the field and note, a blank note shows a field error, `too_many_queries` shows its friendly message; a member's earlier queries and any reply show under the figure. `QuestionsCard`: lists open queries with member name, figure and note; answering calls `answer_query`; empty and non-admin render nothing.
- [ ] **Step 2: Run to verify they fail.** Run: `pnpm exec vitest run src/features/passbook src/features/queries src/features/desk/QuestionsCard.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Follow the form and sheet patterns already in the repo (`WaiveEntrySheet.tsx`); refresh `['my-queries']` and `['open-queries']` through `useRefreshLedger`'s invalidation list in `src/features/ledger/queries.ts`.
- [ ] **Step 4: Run to verify they pass** plus the whole suite: `pnpm exec vitest run`, `pnpm exec tsc --noEmit -p tsconfig.json`, `pnpm run check:tokens`, `pnpm exec eslint .`. Expected: all green (the four `lint-exceljs` tests must pass; if they fail for a Windows path reason, say so and do not hide it).
- [ ] **Step 5: Commit** `feat: explain a minimum and let members question a figure`.

### Task 9: Local rehearsal and rollout notes

**Files:**
- Modify: `docs/ops/setup.md` (a short section: the three migrations, nothing to configure, who can read what)
- Test: none new

**Interfaces:** Consumes everything above.

- [ ] **Step 1: Rehearse on the local stack.** `pnpm exec supabase start`, import through October with `node --env-file-if-exists=.env.local scripts/ledger-import.mjs --target local --through Oct --write` (local URL only), open November as the fixture admin, record a vote, raise and answer a query, close a copy, read `/report/2026-10` as a member of an `open` and a `private` group. Expected: every screen renders its states and no member sees another's figures in the `private` group.
- [ ] **Step 2: Write the rollout section** in `docs/ops/setup.md`: migrations `20261105000100`, `…0200`, `…0300` deploy through `Deploy database`; no new secrets or variables; the Rules page shows "Not yet voted" for every rule until the treasurer records votes.
- [ ] **Step 3: Verify the whole branch.** `pnpm exec vitest run`, `node scripts/db-test.mjs` (local), `pnpm run build`. Expected: all pass.
- [ ] **Step 4: Commit** `docs: how the transparency and rules features roll out`.
