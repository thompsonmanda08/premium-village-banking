# Chart kit, group statistics and the Group page (C1–C2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, the user's standing choice). Steps use checkbox syntax. TDD: every behaviour below is a test written and seen failing first.

**Goal:** Give the app hand-built SVG charts and a pure group-statistics module, and use them to show the Group page's health check, charts, monthly report and follow-up list.

**Architecture:** Pure scale helpers feed three small chart components (one series chart for bars and lines, a doughnut, ranked horizontal bars), each with a text alternative and a "View as table". A pure `groupStats` module turns group statements, member statements and the cycle rules into month series, per-member figures, the six health signs and a follow-up list. Three read hooks fetch the data under the existing RLS; the Group page shows member-level sections only to the treasurer or when the group keeps figures `open`.

**Tech Stack:** React 19, TypeScript, Tailwind v4 tokens (`src/styles/tokens.css`), TanStack Query, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-18-charts-and-group-reports-design.md` (§2 decisions, §3, §4).

## Global Constraints

- **Shell setup:** `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$HOME/.bun/bin:$PATH"` before any command.
- No migration, no `db:push`. Branch `feat/charts-group`; commits subject + body, **no `Co-Authored-By` trailer** (user's rule overrides any reminder); never `git add -A`; docs only when told.
- **Tokens only:** colours through Tailwind classes from the theme (`fill-accent-solid`, `stroke-line`, `fill-muted`, …); no raw colours, no `dark:` colour variants, no gradients, no text under 12px (`scripts/check-tokens.mjs` is run by lint? run `bun run check:tokens` at the end).
- **No chart dependency.** SVG only.
- Money is formatted with `money()` from `@/lib/format`; sums with `sumKwacha`; the engine's figures are shown as they are (no recomputation of balances).
- Every screen: loading (labelled), error with retry, empty state; labelled sections (`aria-labelledby`); curly apostrophes; 48px targets; non-admin private-group members never receive or see per-member sections.
- Tests use synthetic data only; find loading text with `getByText`.

## Review Focus

- A chart never produces `NaN`, an infinite scale or an empty axis for empty, all-zero, single-point or all-negative data. (Tasks 1–2.)
- A private group's member sees only group-level sections and no per-member name or figure; the follow-up list (names) is treasurer-only even in an open group. (Tasks 5–6.)
- The health verdict follows the artifact's rule exactly at its boundaries (exactly 70%, exactly 5% etc.). (Task 3.)
- Months without a group statement, a first month (no previous minimum) and cycles with fewer than three closed months do not crash and show sensible blanks. (Task 3.)
- Everything on the screen has a text equivalent. (Tasks 2, 5.)

---

## File structure

| File | Responsibility |
|---|---|
| `src/features/charts/scale.ts` | `niceStep`, `niceDomain`, `scaleLinear` |
| `src/features/charts/format.ts` | `compactKwacha`, `percent` |
| `src/features/charts/tone.ts` | tone → class names; `Tone` type |
| `src/features/charts/ChartTable.tsx` | the "View as table" `<details>` |
| `src/features/charts/SeriesChart.tsx` | bars and lines, optional second axis, reference line, area |
| `src/features/charts/DonutChart.tsx` | doughnut with a centre label |
| `src/features/charts/RankedBars.tsx` | ranked horizontal bars around zero |
| `src/features/ledger/healthTargets.ts` | the six targets as named constants |
| `src/features/ledger/groupStats.ts` | month series, member stats, at-risk, indicators, verdict, follow-up |
| `src/features/ledger/queries.ts` | + `useGroupStatements`, `useCycleStatements`, `useCycleRules`; refresh keys (modified) |
| `src/features/ledger/testFixtures.tsx` | + `groupStatement`; `renderLedger` visibility option (modified) |
| `src/features/group/GroupReport.tsx` | the Group page's figures, health, charts, report, follow-up |
| `src/features/group/GroupPage.tsx` | renders `GroupReport` (modified) |

---

### Task 1: Scale and format helpers

**Files:** Create `src/features/charts/scale.ts`, `format.ts`, `tone.ts`; Test `scale.test.ts`, `format.test.ts`.

**Interfaces — Produces:**
- `niceStep(raw: number): number` — the smallest of 1, 2, 2.5, 5, 10 × 10^k that is ≥ `raw`; `1` for `raw` ≤ 0 or not finite.
- `niceDomain(min: number, max: number, count = 4): { lo: number; hi: number; step: number; ticks: number[] }` — domain always includes 0; `lo = floor(min/step)·step`, `hi = ceil(max/step)·step` with `step = niceStep((max' − min')/count)` where `min' = Math.min(0, min)`, `max' = Math.max(0, max)`; if `min' === max'` the domain is `{0, 1}` with step 0.25; `ticks` from `lo` to `hi` inclusive in steps (rounded to 10 decimals to avoid float dust).
- `scaleLinear(domain: [number, number], range: [number, number]): (v: number) => number` — degenerate domain maps everything to the range's midpoint.
- `compactKwacha(n: number): string` — `K 0`, `K 250`, `K 1.2k`, `K 3k`, `-K 1.2k`; `percent(ratio: number, decimals = 0): string` — `75%`.
- `tone.ts`: `type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted'`; `TONE: Record<Tone, { fill: string; stroke: string; swatch: string }>` with literal class strings (`fill-accent-solid`, `stroke-accent-solid`, `bg-accent-solid`; the others `fill-success` … ; `muted` → `fill-muted`); `AREA = 'fill-accent-soft'`.

- [ ] **Step 1: Write failing tests** for: `niceStep(212.5) === 250`, `niceStep(2) === 2`, `niceStep(0) === 1`, `niceStep(NaN) === 1`, `niceStep(0.03) === 0.05`; `niceDomain(0, 850)` → `{lo:0, hi:1000, step:250, ticks:[0,250,500,750,1000]}`; `niceDomain(-300, 500)` → `lo -400, hi 600, step 200`; `niceDomain(0, 0)` → hi 1, finite ticks; `niceDomain(-50, -10)` → hi 0, lo ≤ -50; `scaleLinear([0,1000],[200,0])(250) === 150`; degenerate domain midpoint; `compactKwacha` cases above; `percent(0.756) === '76%'`, `percent(0.756,1) === '75.6%'`.
- [ ] **Step 2:** run `bun run test src/features/charts` → FAIL. **Step 3:** implement. **Step 4:** run → PASS; `bun run lint && bun run typecheck`.
- [ ] **Step 5: Commit** `feat: scale and format helpers for charts`.

---

### Task 2: The chart components

**Files:** Create `ChartTable.tsx`, `SeriesChart.tsx`, `DonutChart.tsx`, `RankedBars.tsx`; Test `SeriesChart.test.tsx`, `DonutChart.test.tsx`, `RankedBars.test.tsx`.

**Interfaces — Produces:**

```ts
type Table = { head: string[]; rows: string[][] };
// ChartTable({ table, caption }) → <details><summary>View as table</summary><table>…</table></details>

type SeriesDef = {
  key: string; label: string; tone: Tone; values: Array<number | null>;
  kind: 'bar' | 'line'; dashed?: boolean; axis?: 'left' | 'right';
  tones?: Tone[];          // per-bar tone override
  area?: boolean;          // line: fill under it
};
SeriesChart({
  label: string;           // aria-label of the svg
  categories: string[];
  series: SeriesDef[];
  format: (n: number) => string;        // left axis and table
  rightFormat?: (n: number) => string;  // right axis
  stacked?: boolean;                    // stack the bar series
  reference?: { label: string; value: number; tone?: Tone };
  height?: number;                      // default 260
})
DonutChart({ label, slices: {label: string; value: number; tone: Tone}[], centre: {big: string; small: string}, format: (n:number)=>string })
RankedBars({ label, rows: {label: string; value: number; highlight?: boolean}[], format: (n:number)=>string })
```

Behaviour (each a test):
- **SeriesChart:** `svg` has `role="img"` and the `label`; fixed `viewBox` 640 × height; one bar `rect` per non-null bar value; bar heights are proportional (values 100 and 200 → second height = 2 × first, to 0.01); stacked bars stack (second series' `y` = first's `y`); `null` bar draws nothing; a line series draws one `path` per run of non-null points (`[1,null,3,4]` → two paths) and a `circle` per point; `area` adds a closed filled path; a right-axis series uses its own domain (its max reaches the top of the plot); negative values draw below a zero line; a `reference` draws one dashed line with its label; all-zero, empty and single-category data render without `NaN` in any attribute (assert no attribute contains `NaN`/`Infinity`); the table under it has one row per category and `—` for null; `<title>` on each bar/point carries "category — series: value".
- **DonutChart:** one circle per positive slice whose dash lengths sum to the circumference; slices proportional to value; zero total renders a single muted ring and "No data yet"; centre text shown; table lists slice, value and share.
- **RankedBars:** one bar per row in the given order; positive and negative bars start at the zero line and go opposite ways; the highlighted row uses the `warning` tone, positives `success`, negatives `danger`; domain includes 0 for all-positive and all-negative data; empty rows → "No data yet"; table lists rows.
- Common: no raw colour classes anywhere (class strings come from `TONE`).

- [ ] **Steps:** failing tests → implement → pass → `bun run lint && bun run typecheck && bun run check:tokens` → **Commit** `feat: SVG charts: series, doughnut and ranked bars`.

---

### Task 3: Group statistics

**Files:** Create `src/features/ledger/healthTargets.ts`, `groupStats.ts`; Test `groupStats.test.ts`.

**Interfaces — Produces** (all pure):

```ts
export const TARGETS = {
  poolWorking:   { good: 0.7,  watch: 0.5,  text: '70% or more owed back, not idle' },
  minimumsMet:   { good: 0.85, watch: 0.65, text: '85% or more' },
  atRisk:        { good: 0.05, watch: 0.15, text: 'Under 5% of the pool' },
  savers:        { good: 0.9,  watch: 0.75, text: '90% or more' },
  behind:        { good: 2,    watch: 5,    text: 'At most 2 members behind' },
  concentration: { good: 0.3,  watch: 0.45, text: 'Under 30% of the pool' },
} as const;

type GroupStatementRow = Tables<'group_statements'>;
type Person = { id: string; short_name: string };

closedPeriods(periods): PeriodRow[]                        // closed, by month_index
monthStats(periods, groupRows, statements: StatementRow[] | null, minSaving): MonthStat[]
  // MonthStat = { period, label, saved, cum, loans, owed, idle, use, excessBilled, interestCollected,
  //               savers: number|null, minDue: number|null, minMet: number|null, metPct: number|null }
memberStats(periods, statements, people): MemberStat[]
  // MemberStat = { id, name, savings, share, loans, interestCharged, penalties, earned, net, roi, due, rank }, sorted by rank
medianSavings(periods, statements): Array<number | null>   // per closed month, median of members' `saving`
atRiskIds(periods, statements): string[]
healthIndicators({ months, members, atRisk }): { indicators: Indicator[]; verdict: { status: Status; title: string; say: string } }
followUp({ periods, statements, people, minSaving }): FollowUp[]   // { id, name, why, amount, kind: 'owes' | 'saved' }
```

Rules (exact):
- "now" is the latest **closed** month with a group statement. A month without a group statement is skipped.
- `use = owed / (owed + idle)`, `0` when both are 0.
- `minDue` = members whose **previous closed month's** `next_minimum` > 0 and who have a statement this month; `minMet` = of those, `unpaid_minimum === 0`; `metPct = minMet / minDue` or `null` when `minDue` is 0. First month: `minDue` 0.
- `memberStats`: `savings` = latest `cum_savings`; `loans` = Σ `loan_principal_sent`; `interestCharged` = Σ (`loan_interest_charged` + `excess_charged`); `penalties` = Σ `penalties_charged`; `earned` = latest `interest_earned_to_date`; `net = earned − interestCharged − penalties`; `roi = net / savings` (0 when no savings); `due` = latest `closing_owed`; `share = savings / Σ savings`; `rank` by savings descending then name ascending; only people with at least one statement.
- `atRiskIds`: needs ≥ 3 closed months; a member with `next_minimum > 1` after each of the two months before the last, and `paid_total === 0` in each of the last two.
- Indicators (in this order; one is omitted when its data is missing): **Pool working** = latest `use` (higher better, strict ≥ good/≥ watch); **Minimum payments met** = latest month with non-null `metPct`; **Balances at risk** = Σ `closing_owed` of at-risk members at the last month ÷ `cum` (lower better, `<`); **Saving the minimum** = latest `savers` ÷ member count (higher); **Members ahead** = (count − behind) ÷ count where behind = members with `net < 0` (status by `behind` ≤ good → good, ≤ watch → watch); **Largest saver's share** = top `share` (lower, `<`). `say` is one plain sentence per sign naming the numbers (use `money`, `percent`).
- Verdict: any `bad` → "Needs attention"; else ≥ 2 `watch` → "Worth watching"; else "Healthy" (each with a `say` sentence).
- `followUp`: at-risk members first (`kind: 'owes'`, why "No payment on the last two statements", `amount` = latest `closing_owed`), then members whose latest `saving` < `minSaving` and who are not at risk (`kind: 'saved'`, why "Saved less than K{minSaving} last month").

**Worked fixture for the tests** (four closed months p1–p4 via `year(4)`, minSaving 250, members Eve m1, Ann m2, Bob m3, Cy m4; `statement()` rows; group statements built by a small helper). Values per month — saving / cum_savings / paid_total / next_minimum / unpaid_minimum / closing_owed / interest charges / earned_to_date:

| | Eve | Ann | Bob | Cy |
|---|---|---|---|---|
| p1 | 250/250/0/0/0/0 | 500/500/0/0/0/0 | 100/100/0/400/0/1000, loan 1000, loan interest 150 | 250/250/0/0/0/0 |
| p2 | 250/500, earned 5 | 500/1000, earned 10 | 250/350, paid 400, next_min 400, closing 600, excess 20, earned 2 | 250/500, closing 200, next_min 100, earned 5 |
| p3 | 250/750, earned 10 | 500/1500, earned 20 | 250/600, paid 0, unpaid_min 400, closing 700, next_min 500, excess 20, earned 2 | 250/750, paid 0, closing 300, next_min 150, earned 10 |
| p4 | 250/1000, earned 10 | 500/2000, earned 20 | 100/700, paid 500, unpaid_min 0, closing 200, next_min 200, earned 6 | 250/1000, paid 0, unpaid_min 150, closing 400, next_min 200, earned 10 |

Group statements p4: `savings` 1100, `total_savings` 4700, `total_owed` 600, `idle_cash` 2400, `loans_sent` 0, `excess_billed` 0, `interest_collected` 40 (earlier months any consistent values).

**Expected, to assert:** p4 `savers` 3, `minDue` 2 (Bob, Cy), `minMet` 1, `metPct` 0.5; `use` = 0.2; Bob `net` = 6 − (150 + 20 + 20) = −184, Ann `net` 20 and `roi` 0.01, Eve/Cy `net` 10; ranks Ann 1, Cy 2, Eve 3, Bob 4; shares sum to 1; `atRiskIds` = [Cy]; indicators: Pool working 0.2 **bad**, Minimum payments met 0.5 **bad**, Balances at risk 400/4700 ≈ 0.085 **watch**, Saving the minimum 0.75 **watch** (exactly the watch boundary), Members ahead 0.75 **good** (1 behind), Largest saver 2000/4700 ≈ 0.4255 **watch**; verdict **Needs attention**; `followUp` = [Cy owes K 400, Bob saved K 100]; `medianSavings` p1 = 250, p4 = 250. Boundary tests: a pool-working value of exactly 0.7 is **good**, 0.5 **watch**; at-risk share exactly 0.05 is **watch** (strict `<`); behind exactly 2 is **good**; verdict "Worth watching" with two watch and no bad; "Healthy" with none. Edge: `statements = null` gives group-level fields and `null` member fields; only 2 closed months → `atRiskIds` empty; a month with no group row is skipped; zero savings → `roi` 0 and no `NaN`.

- [ ] **Steps:** failing tests → implement → pass → lint/typecheck → **Commit** `feat: group statistics and health check`.

---

### Task 4: Read hooks and fixtures

**Files:** Modify `src/features/ledger/queries.ts`, `testFixtures.tsx`; Test `groupQueries.test.tsx`.

**Interfaces — Produces:**
- `useGroupStatements(periodIds: string[])` → `group_statements` rows for those periods (`.in('period_id', ids)`, `enabled` when `ids.length > 0`, key `['group-statements', ...ids]`).
- `useCycleStatements(periodIds: string[], enabled: boolean)` → `statements` rows via `fetchAllRows` from `@/features/exports/paging` (stable order `created_at`, `id`), key `['cycle-statements', ...ids]`.
- `useCycleRules(cycleId?: string)` → `{ min_saving, loan_rate, excess_rate, loan_multiples, membership_fee } | null` (`maybeSingle`), key `['cycle-rules', cycleId]`.
- `useRefreshLedger` also invalidates `['group-statements']`, `['cycle-statements']`.
- Fixtures: `groupStatement(o?)` (a full `group_statements` row, defaults like the close preview's group); `renderLedger` accepts `visibility?: 'open' | 'private'` (default `open`) for the context's group.

- [ ] **Steps:** failing hook tests (asks `.in('period_id', ids)`, nothing asked without ids, `enabled=false` asks nothing, rules asked by cycle, refresh invalidates the two keys) → implement → pass → **Commit** `feat: read hooks for group statements, cycle statements and rules`.

---

### Task 5: The Group report

**Files:** Create `src/features/group/GroupReport.tsx`; Test `GroupReport.test.tsx`.

**Behaviour** (hooks mocked with `vi.mock('@/features/ledger/queries', …)` keeping `orig`, as the Desk tests do):
- `canMembers = isAdmin || group.figures_visibility === 'open'`. Reads: `useLedgerCycle`, `useGroupStatements(closed period ids)`, `useCycleRules`, `useGroupMembers` (mocked via `@/features/group/GroupPage`), and `useCycleStatements(ids, canMembers)`.
- Sections (each `aria-labelledby`): **Figures** (total savings, interest collected, loans issued, idle cash, owed — from the latest closed group statement, with the change since the previous month for savings); **Group health check** (verdict pill + six cards: label, value, target, status badge, `say`) when `canMembers`, otherwise the note "Per-member health signs are shown to the treasurer in groups that keep figures private."; **charts** — *Savings growth* (`SeriesChart`: bar "Saved that month" + line "Pool total"), *How much of the pool is working* (stacked bars owed vs idle), and when `canMembers`: *Discipline* (`SeriesChart` lines "Paid at least the minimum" and "Saved K{min} or more", percent axis 0–100) and *Who is ahead* (`RankedBars` of `net`, highlighting the viewer's `member.id` when present); **Monthly group report** table with a totals row (saved, loans, interest collected, excess billed totals); **Follow-up list** table only when `isAdmin` ("Nobody needs follow-up right now." when empty).
- States: loading (`role=status`, "Loading the group report"); error with a retry button; no closed month → `EmptyState` "No months closed yet" with the sentence "The group report appears after the first month is closed."; a failed *member* statements query leaves the group-level sections showing and replaces the member-level ones with "Member figures could not be loaded just now."
- Private-group member: no per-member name or figure appears anywhere, member statements are not requested (`useCycleStatements` is called with `enabled` false).
- Chart labels (aria) summarise the latest values in words.

**Tests:** admin sees everything incl. follow-up; open-group member sees health and charts but no follow-up; private-group member sees group-level only and the note, and the statements hook is called with `enabled=false`; figures show the latest statement; verdict text for the worked fixture is "Needs attention"; the totals row adds up; empty state; loading; error + retry; member-statements failure message; the viewer's bar is the highlighted one.

- [ ] **Steps:** failing tests → implement → pass → lint/typecheck/check:tokens → **Commit** `feat: the group report: health check, charts and follow-up`.

---

### Task 6: Put it on the Group page and finish

**Files:** Modify `src/features/group/GroupPage.tsx`, `GroupPage.test.tsx`.

- [ ] Render `<GroupReport />` after the visibility notice and before the member list; in `GroupPage.test.tsx` add `vi.mock('./GroupReport', () => ({ GroupReport: () => null }))` so the existing tests stay as they are, plus one test that the report is rendered on the page.
- [ ] Full gates: `bun run lint && bun run typecheck && bun run check:tokens && bun run test && bun run build` (no ExcelJS regression: `grep -c exceljs dist/index.html` is 0).
- [ ] Final whole-branch review by a fresh opus reviewer with the Review Focus; one fix pass with RED→GREEN tests; ledger the rulings; merge `--ff-only` to `main`; do **not** push until told.
- [ ] Manual check (user): open Group as treasurer and as a member of a private group on dev; compare the figures with the Close page and the Excel export.
