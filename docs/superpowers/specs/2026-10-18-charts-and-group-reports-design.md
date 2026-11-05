# Charts and group reports (C1–C5)

Date: 2026-10-18
Status: Approved by the user's standing instruction ("proceed … go with your recommendations"); every default below is my call and is marked **[call]**.
Builds on: `2026-10-10-ledger-engine-design.md` (statements, `group_statements`, `payout_preview`), `2026-10-11-member-screens-design.md` (Passbook, Record, Plan), `2026-10-12-excel-exports-design.md` (the same data, as files).

## 1. Why

The earlier "Premium VB member passbook" artifact showed the group and each member a picture of the books: charts of savings growth, how much of the pool is lent out, who pays on time, who is ahead, and a projection of what a member would get at payout. The app has the figures (tables and Excel) but no charts and no group reports. This brings those reports into the app, driven by the ledger instead of a hand-loaded data set.

Success: a member opens **Group**, **Passbook**, **My record** or **Plan** and sees what the artifact showed, computed from the ledger; the treasurer sees the group-wide and per-member views on the **Desk**; nothing a member may not see is shown to them.

Non-goals: new engine calculations or migrations; reading the WhatsApp chat (the artifact's "From the group chat" and "Declared on time from chat dates" come from a chat export: the app uses its own declaration dates instead); Chart.js or any chart dependency; a "Welcome / find your passbook" picker (accounts are linked by sign-in now); editing anything.

## 2. Decisions (all **[call]**)

1. **Hand-built SVG charts, no chart library.** The app has no chart dependency and four chart shapes are enough (bars, lines, doughnut, ranked horizontal bars). SVG with design tokens themes with light/dark for free, adds no bundle weight, is testable (assert the marks), and each chart carries a text alternative and a "View as table" `<details>`. A library (Chart.js was 200 kB+) would add weight and a second theming system.
2. **Who sees what.** Group totals (`group_statements`) are readable by every member, so group-level charts are shown to everyone. Anything per member (discipline, who is ahead, ranking, the all-members table) needs `statements` of other people: shown to the treasurer, and to members only when the group's `figures_visibility` is `open`. The follow-up list (names of members who have not paid) is **treasurer-only** whatever the setting. The screens reuse the data hooks' RLS: they show a member-level section only when `isAdmin || group.figures_visibility === 'open'`, and say plainly why a section is not shown otherwise.
3. **Honest labels.** Where the ledger cannot give what the artifact showed, the label says what is shown. Examples: "net position" is interest earned minus loan interest, excess interest and penalties charged (transfer and membership fees are separate entries and are not in the statements); "declared on time" uses the app's declaration time against the month's deadline.
4. **Targets as named constants.** The six health-check targets (70% of the pool working, 85% minimums met, under 5% of balances at risk, 90% saving the minimum, at most 2 members behind, largest saver under 30%) live in one file, `healthTargets.ts`, with the artifact's thresholds, so the treasurer can later change them in one place. Amber/green cut-offs are the artifact's.
5. **Projection is an estimate, shown as one.** Every projection screen states its assumptions and the formula, excludes what it cannot know (transfer fees, membership fees, unrecoverable debts), and never presents the number as a promise.
6. **Four independent pieces, built in this order**, each reviewed and merged on its own: C1 chart kit and group statistics; C2 Group page; C3 Desk pool and members; C4 Passbook and My record; C5 Plan projection.

## 3. C1: chart kit and group statistics

### 3.1 Charts (`src/features/charts/`)

Pure scale helpers (`scale.ts`: `niceMax`, `ticks`, `linear`, `band`) and four components, each taking plain data:

- `BarChart`: categories on x; series as grouped or stacked bars; optional line series on the same or a second (right) axis; optional dashed reference line; optional per-bar tone.
- `LineChart`: categories on x; several series (solid or dashed); optional filled area under the first; `null` points break the line.
- `DonutChart`: two or more slices with a centre label (for example "12.4% of all savings").
- `RankedBars`: horizontal bars, sorted by the caller, positive and negative values around a zero line, one bar highlighted.

Shared behaviour: responsive `viewBox` with a fixed height per chart, tick labels in kwacha or percent through a formatter prop, series colours only from tokens (`accent`, `success`, `warning`, `danger`, `info`, `muted`) via classes, never a raw colour; `role="img"` with an `aria-label` the caller supplies; a legend; hover/focus tooltips are **not** built (the "View as table" `<details>` below each chart is the accessible and the precise view); an empty data set renders a short "No data yet" line, not an empty axis; all-zero or single-point data never produces `NaN` or an infinite scale; negative values draw below the axis.

### 3.2 Group statistics (`src/features/ledger/groupStats.ts`, pure, tested)

Inputs: the cycle's periods, its `group_statements`, and (optionally) its `statements`, the rules (`min_saving`, `loan_rate`, `excess_rate`), the active member ids and the `member_status` flags. Outputs:

- `months[]`: for each month with a group statement: `saved` (`savings`), `cum` (`total_savings`), `loans` (`loans_sent`), `owed` (`total_owed`), `idle` (`idle_cash`), `use` = `owed / (owed + idle)` (0 when both are 0), `excessBilled`, `interestCollected`.
- With member statements: per month `savers` (members whose `saving` ≥ `min_saving`), `minimumsMet` and `minimumsDue` (members whose previous month's `next_minimum` was above 0, and of those the ones with `unpaid_minimum` = 0), `metPct`.
- `perMember[]`: `savings` (latest `cum_savings`), `share` of the pool, `loans` (sum of `loan_principal_sent`), `interestCharged` (loan + excess), `earned` (latest `interest_earned_to_date`), `net` = earned − interest charged − penalties, `roi` = net / savings (0 when no savings), `due` (latest `closing_owed`), `rank` by savings, `median` monthly saving.
- `atRisk`: members who owed something and paid nothing on each of the last two closed statements.
- `indicators[]`: the six health signs, each `{key, label, value, format, target, status: good|watch|bad, say}`, and an overall `verdict` (`Healthy`, `Worth watching`, `Needs attention`) by the artifact's rule: any red is "Needs attention", two or more amber is "Worth watching", else "Healthy".
- `followUp[]`: at-risk members (reason "No payment on the last two statements", amount owed) and members who saved below the minimum last month (reason, amount saved).

The latest month with a **closed** statement is "now"; the open month's preview is not used here (it is not final).

### 3.3 Data hooks (`src/features/ledger/queries.ts`)

`useGroupStatements(cycleId)` (RLS: any member), `useCycleStatements(cycleId)` (RLS: what the viewer may see), `useCycleRules(cycleId)` (RLS: any member). All keyed by cycle, none persisted beyond the existing cache policy for ledger figures.

## 4. C2: the Group page

The existing member list stays. Above it, a **Health** area and **charts** appear:

- **Group figures** row (total savings, interest collected, loans issued, idle cash, owed) from the latest group statement, with change since the previous month.
- **Group health check** (needs member statements: admin or `open`): the six signs as cards with status and one plain sentence each, and the verdict pill. Otherwise a note: "Per-member health signs are shown to the treasurer in groups that keep figures private."
- **Charts** (group-level, everyone): *Savings growth* (bars saved + line pool total), *How much of the pool is working* (stacked owed vs idle), and, with member statements, *Discipline* (lines: paid at least the minimum, saved the minimum) and *Who is ahead* (RankedBars of net position, highlighting the viewer).
- **Monthly group report** table (every month, totals row) and, for the treasurer only, the **Follow-up list**.
- States: loading, error with retry, "No months closed yet" empty state; no chart when there is nothing to draw.

## 5. C3: Desk pool and members

New route `/desk/pool` (admin-only), reached from a Desk card:

- **Payout pool today**: the real figure (members' savings + interest collected) and the estimate on current records (from `payout_preview` totals: savings + interest − owed + pots), each line shown, with a note on what is and is not counted. This is the whole-group payout view that was planned as S3d.
- **All members** table (sortable; columns: savings, pool share, loans taken, interest charged, interest earned, net gain, net return, owed), totals row, each name links to `/desk/members/:id`.
- **Share of the pool** doughnut and **Net return, all members** ranked bars for a member picked from a select (default: the largest saver).
- Excel: a "Download whole-period workbook" link to Reports (the table's data is already in that file).

## 6. C4: Passbook and My record

**Passbook** gains, below the current statement list: a figures row (total savings, loans taken, interest charged, interest earned, net gain and net return, due on the latest statement), three charts (*Savings and interest growth*: cumulative savings against interest earned and charged; *Monthly contributions*: bars with balance growth %; *Loans and interest charged*: loan taken, loan interest, excess interest) and the **Monthly ledger** table (month, saved, balance, loan taken, loan interest, excess, penalty, due, paid, interest earned cumulative).

**My record** gains a verdict banner ("You are ahead by K … / behind by K …" with what to watch), six figures (months at or above the minimum saving; minimum payments met; declared on time; savings rank of N, only when member figures are visible; charges; net position), two charts (*Your saving against the group*: your bars, the group median line when visible, the minimum-saving reference line; *Are you ahead?*: interest earned, charges and net position, cumulative) and **Every declaration** (one row per month: declared when, timing against the deadline, saving, paid on the last statement, minimum, result, loan, interest charged, penalties).

The median and rank need other members' figures: shown only when `open` or admin; otherwise the chart shows the member against the minimum only and the rank figure is left out, with no message needed beyond the existing visibility note.

## 7. C5: Plan, "Project my savings"

A new section on Plan, member only (needs the member's own statement and the group's statements):

- **Inputs** (sliders with typed values, steppers for keyboards): monthly saving (default: last month's), months to keep saving (default: all remaining), a loan to take next month (default 0, capped at the loan limit `loan_multiples` × savings); group assumptions with defaults from the last three statements: group saves per month, new loans per month, share of what is owed repaid per month; **Reset to what the statements show**.
- **Model** (`projection.ts`, pure, tested against hand-worked numbers): months remaining = the cycle's months after the last closed one up to the last month that accepts declarations. Each month: `R = r × D` repaid; `funds = E + R + G`; new loans `n = min(N, funds)` (none in the final month); `E = funds − n`; loan interest billed `LI = loan_rate × n`; excess billed `EX = excess_rate × E`; `D = D − R + n + LI + EX`; group savings `S += G`. The member's share each month is `balance / S`; interest income = share × (LI + EX); excess paid = share × EX (it nets out); own loan interest = `loan_rate × loan`. Payout = final balance + interest earned to date + interest still to come, assuming what the member owes is repaid on schedule.
- **Outputs**: estimated payout on the payout date; interest still to come; costs along the way (excess, own loan interest); net gain from here; a verdict sentence; a *Projected growth* line chart (plan vs "if you stop now"); a *Month by month* table; *What helps and what hurts* (three or four deterministic sentences from the numbers); *Compare saving amounts* (the same model at K250, last month's, K1,000, K2,000, K5,000); *Your saved plans* (up to four, kept in this browser only, with `try/catch` around storage).
- **Stated limits**, printed on the screen: excludes transfer fees and membership fees; assumes interest billed is collected; assumes the member repays what they owe; ignores unrecoverable debts; an estimate, not a promise.

## 8. Shared behaviour and security

No new write path, grant or migration. Reads use the existing RLS; the screens additionally hide what the group's visibility setting hides (§2.2) so a private-group member never gets an empty-looking or misleading chart: the section is replaced by a one-line note. Loading skeletons with labels, error with retry, 48px targets, tokens only, labelled sections, curly apostrophes, `money()` formatting. Charts carry text alternatives and a data table. Synthetic data only in tests (the repo is public).

## 9. Testing

- Chart kit: scale helpers (nice maxima, ticks, negative values, all-zero, single point); each component renders the expected marks for fixed data (bar heights proportional, line breaks on `null`, doughnut arc fractions sum to the whole, ranked bars around zero), its `role="img"` label and its table.
- `groupStats`: a worked fixture across four months and four members (savers, minimums met, at-risk, pool working, net, ROI, rank, median, health statuses and verdict boundaries, follow-up), including empty and single-month cycles.
- `projection`: hand-worked numbers for a two-month horizon; no new loans in the final month; a loan above the cap is clamped; zero savings never divides by zero; "stop now" equals the plan with zero months.
- Screens with mocked hooks, following earlier work: Group (admin / open member / private member; loading; error; empty), Desk pool (admin gate, table sort, totals, pickers), Passbook and My record additions, Plan projection (inputs change outputs, reset, save/compare plans with storage failing).
- Manual check on dev after each piece, comparing figures with the Close page, the Excel export and the Passbook.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Charts mislead (wrong scale, `NaN`) | Pure scale helpers with edge-case tests; empty/zero states; every chart has its table. |
| A private group's member sees other members' figures through a chart | Member-level sections rendered only for admin or `open`; hooks use RLS as a second layer; tests for the private case. |
| The projection is read as a promise | Printed assumptions and limits, "estimate" wording, formula shown. |
| Health targets feel arbitrary | One constants file, the artifact's thresholds, explanation sentence per sign. |
| Hand-built SVG is more code than a library | Four small components with one shared scale module; no dependency to upgrade. |
