# Sub-project E1: Excel exports

Date: 2026-10-12
Status: Draft for review
Builds on: `2026-10-10-ledger-engine-design.md` (statements, `group_statements`, `payout_preview`, `private.ledger_lines`), `2026-10-11-member-screens-design.md` (entry labels, `owedFigure`), `2026-10-11-month-close-design.md` (the `close_month` preview), `2026-10-12-corrections-defaults-design.md` (`effectiveAmount`, `correctionLine`). Independent of S3d (the group payout view) and S4 (polish).

## 1. Goal

Until now each month was a hand-built workbook (`Premium VB <Month> 2026.xlsx`). Since the app took over, the treasurer has had no way to get that file back out. E1 lets a treasurer or admin download three kinds of Excel file, generated from the ledger:

1. **A month workbook**: one month, laid out like the originals (a member table with group totals), plus the group's cash and pots.
2. **A whole-period workbook**: every closed month of the cycle, and the open month as a labelled preview, in one file, with cumulative figures, month-by-month matrices, a one-row-per-member standpoint sheet, loans and the payout projection.
3. **A member report**: one member's own standpoint, month by month, safe to send to that member alone.

What the user asked (2026-10-12): production holds all data until October; the treasurer or admin can export "an excel document similar to" the monthly workbooks, specific to one month, and another with the aggregated information for the entire period, with cumulative figures and reports that give a member a standpoint. Decided in answer to one question: the standpoint is a **separate file per member** plus a Members summary sheet in the whole-period workbook (not a sheet per member).

Assumptions to correct if wrong:
- "Until October" means closed months through September; October runs live in the app and is included everywhere as a labelled **preview** (decided 2026-10-13: the whole-period and member files include the open month too).
- "Similar to" means the same information and wording where the meaning is identical, not the same formulas. Figures are the ledger's own and are written as values.
- The open month is not final. Wherever it appears (month select, whole-period workbook, member report) it is marked "(preview)", comes from the same `close_month` preview the Close page shows, and is the last column or row so closed months are never mixed with it. If the preview is refused because declarations are waiting, the file is still made without the open month and says so (§5.2).

Non-goals: formulas or charts in the files, PDF, a member downloading their own report, e-mail or WhatsApp sharing, scheduled exports, per-member loan-transfer fees (the ledger records the fee paid out only for the group), other cycles than the active one, loading workbook figures for live months.

## 2. What the ledger can supply

No migration. Everything below is readable by an admin through existing RLS (`statements`, `group_statements`, `entries`, `loans`, `member_status` select through `can_see_figures` / `is_member`).

| Original column | Source in the app |
|---|---|
| Savings | `statements.saving` |
| Cumm. Savings | `statements.cum_savings` |
| Transaction fee, Membership fee | entries of kind `txn_fee` / `membership` in the period, folded (§4) |
| Loan C/F | `statements.opening_owed` ("Owed at the start") |
| Loan | `statements.loan_principal_sent` |
| Interest on loan | `statements.loan_interest_charged` |
| Excess interest | `statements.excess_charged` |
| Penalties | `statements.penalties_charged` |
| Loan Repayment / Total amount payable | not recomputed: the sheet shows the engine's `closing_owed` after payment and `paid_total` |
| Minimum amount payable | the previous month's `next_minimum` (none for the first month: 0) |
| Amount received | `statements.paid_total`, split into `paid_to_penalties` / `paid_to_excess` / `paid_to_interest` / `paid_to_principal` |
| Variance | `statements.unpaid_minimum` (the engine's clipped shortfall) |
| Interest Earned Cumulative | `statements.interest_earned`, `interest_earned_to_date` |
| Transaction fee spent | group level only (`group_statements.fee_pot_out`) |
| Summary / bank and pots | `group_statements` |

The engine owns every figure. The client adds only column totals (integer-ngwee sums with `sumKwacha`), the fee fold in §4, and one display ratio (§5.2).

## 3. Data layer (`src/features/exports/`)

Plain async loaders, not `useQuery`: they run when the admin presses a download button, so no member's figures are fetched on page load and nothing is written to the persisted query cache. Each loader reads, builds nothing, and returns one typed bundle.

| Loader | Reads | Returns |
|---|---|---|
| `loadMonthExport(groupId, period, periods)` | closed month: `statements` and `group_statements` of the period; open month: RPC `close_month` with `p_commit: false`. Both: the previous period's `statements` (minimum due), the period's `entries` plus the originals its corrections point at, `members` (`id, short_name` only) | `MonthExport { period, closed, group, members[], entries[] }` |
| `loadPeriodExport(groupId, cycle, periods)` | `statements` and `group_statements` of the closed periods; the open period (if any) through RPC `close_month` with `p_commit: false`; `loans` of the cycle, `member_status`, RPC `payout_preview`, `members` | `PeriodExport { months[], openLeftOut, ... }` |
| `loadMemberExport(groupId, cycle, periods, memberId)` | the member's `statements` (and their row of the open period's `close_month` preview), `entries` (with the originals their corrections point at), `loans`, `member_status` row, their `payout_preview` row, their `members` row (`short_name`, `full_name`) | `MemberExport` |

Rules:
- **One shape for closed and open months.** A statement row and a preview member row carry the same figures, so the loaders normalise both into `MonthFigures { period, preview: boolean, group, members[] }`; every builder works on `MonthFigures[]`, ordered by month, with `preview` true only for the open month (always last). The preview is requested once per export.
- **Paging.** PostgREST returns at most 1,000 rows. Every list read goes through `fetchAllRows(page => query.range(...))` with a stable order (`created_at`, `id`), and reads until a page comes back empty, advancing by the rows it received (so a server row cap below the page size can never make it skip rows). A cycle with 18 members passes 1,000 entries by month nine or ten, so an unpaged read would silently lose rows.
- **Short ids lists** (the originals of corrections) are fetched in chunks of 100 so the URL stays short.
- **Narrow selects.** Every read names its columns (no `select('*')`): `members` as `id, short_name, full_name, status`, and each other table only the fields the files use. E-mail, phone, account ids (`created_by`, `changed_by`), a default's reason and a loan's warnings are never selected; a test fails if any read asks for every column.
- **Open month.** The preview refuses while declarations are waiting (`declarations_pending`). The month workbook shows that refusal through `friendlyError` and downloads nothing. The whole-period and member loaders instead leave the open month out, set `openLeftOut` and carry on; any other error (network, permission) is thrown and downloads nothing.
- A loader throws the Supabase error; the caller shows it. A failed read downloads nothing.

## 4. The fee fold (the one rule the client repeats)

The engine counts a `waiver` or `adjustment` as a negative line of the **corrected entry's kind** (`private.ledger_lines`: `coalesce(r.kind, e.kind)`, amount negated for those two kinds). The month workbook's fee columns apply the same rule: for a member and a period, `txn_fee` (or `membership`) = the sum of entries whose effective kind is that kind and whose `period_id` is the period, with `waiver` / `adjustment` entries counted negative under the kind of the entry they point at.

A correction made in April to a March fee lands in April, so March keeps its closing figure and April shows the change. The same scenario is pinned in pgTAP and Vitest (§9) so the two cannot drift.

## 5. The workbooks

Common to all three:
- Built with ExcelJS, **loaded only when a download is pressed** (`await import('exceljs')`), so it stays out of the main bundle and the service-worker precache (§8).
- Amounts are numbers with a `"K" #,##0.00` format; negative amounts stay numbers (a credit stays negative). Dates are real dates (`dd mmm yyyy`). Counts are integers.
- Header row bold, filled, frozen with the name column; sensible column widths; landscape, fit to one page wide.
- Every text cell is written as a string. ExcelJS never interprets a string as a formula, so a note starting `=` or `@` stays inert text; a test proves it.
- Sheet names are at most 31 characters without `[]:*?/\`.
- Each file's first sheet opens with the group name, the cycle, a status line and "Generated {date}". No e-mail, phone or user id appears anywhere.
- Wording follows the app (`kindLabel`, "Owed at the start", "In credit") where it differs from the originals; where the meaning is the same it keeps the original's words (Savings, Cumm. Savings, Interest on loan, Minimum amount payable).

### 5.1 Month workbook

File name `{group name} {period label}.xlsx` (for example `Premium VB Mar 2026.xlsx`).

**Sheet "Members"**: title and status line ("Closed on 7 Apr 2026", "Imported from the treasurer’s workbook" for a month loaded from the old workbooks, whose database close date is only the import date, or "PREVIEW: {label} is still open, so these figures can change until it is closed"), deadline; then the table, one row per member by short name:
S/N, Name, Savings, Cumm. Savings, Transaction fee, Membership fee, Owed at the start, Loan, Interest on loan, Excess interest, Penalties, Minimum amount payable, Amount received (and its four-way split), Short of the minimum, Owed at the end, Minimum next month, Interest earned, Interest earned to date. A totals row (`sumKwacha` per column).

**Sheet "Group"**: opening cash, received, savings, loans sent, cash left over, excess rate and excess billed, interest collected, fee pot (in, out, balance), meeting pot (in, balance), total savings, total owed. All from `group_statements` (or the preview's `group`). A negative fee pot balance is kept and flagged in an adjacent note cell.

**Sheet "Entries"**: every entry recorded in the month: date, member, what (`kindLabel`), amount (waivers and adjustments negative), reason, and "corrects" (the original's kind and month) for correction entries. Ordered by time.

### 5.2 Whole-period workbook

File name `{group name} {cycle label} through {last month label}.xlsx`, with ` (preview)` added when the last month is the open one.

- **Summary**: one row per month (like the original Summary), the open month last and marked "{label} (preview)": month, closed on ("Open: preview" for the open month, "From the workbook" for an imported month), savings, received, loans sent, interest collected, fee pot in / out / balance, meeting pot in / balance, cash left over, total savings, total owed. From `group_statements` (the preview's `group` for the open month). A totals row for flow columns (savings, received, loans sent, interest collected, fee pot in/out, meeting pot in), labelled "Total (includes the {label} preview)" when the preview is present; balances are not totalled. When the open month was left out, a note line under the title says "{label} is not included: declarations are still waiting."
- **Savings by month**: members down, months across (the open month last, headed "{label} (preview)"): `cum_savings` per month (the original "Interest" sheet), then "Interest earned" (`interest_earned_to_date` of the last column) and "Interest as % of savings" (that interest divided by the last `cum_savings`, `0` when savings are `0`). Totals row.
- **Owed by month**: members down, months across (open month last, marked preview): `closing_owed`. Credits stay negative with a note "negative = in credit". Totals row.
- **Members** (the standpoint summary): one row per member. Block "Through {last month label}" (with "(preview)" when the open month is the last): saved to date, interest earned to date, loans taken (sum of `loan_principal_sent`), loan interest charged, penalties charged, paid in (sum of `paid_total`), owed now, next minimum, months short of the minimum (count of closed months with `unpaid_minimum` above 0; the open month's preview shortfall is not final and is not counted), standing ("In good standing" or "Defaulted"). Block "If the cycle ended today" (`payout_preview`, which uses the open month's figures when one is open): savings, interest, owed, equal share of the pots, payout. Totals row. When the open month is included the two blocks share a cut-off; when it was left out, or none is open, the block headings say which month each one is through, so different cut-off dates are never mixed.
- **Loans**: every loan of the cycle: member, month, principal, interest, term in months, status, sent on. No instalment total (instalments are caps, not a balance).
- **Statements**: the long form, one row per member per month (the open month's rows flagged "Preview" in a column) with every statement column. This is the raw data behind the other sheets, for pivoting.

### 5.3 Member report

File name `{group name} {member short name} {cycle label} through {last month label}.xlsx`. Contains **only that member's figures**: no other member's name, row or figure, and no group totals (the equal pot share is the member's own payout line).

- **Standpoint**: member's full name, "As at {last month label}" (with "(preview: this month is still open)" when it is the open month), then labelled figures: saved so far, interest earned so far, owed now (`owedFigure`: "In credit K…" when negative), minimum due next month, loans taken, penalties charged, standing (the default reason is a treasurer's note and is not exported), and "If the cycle ended today you would receive K…" with its parts (savings, interest, minus owed, plus the share of the pots).
- **Month by month**: one row per month, the open month last and marked "(preview)": saved, cumulative savings, loan sent, loan interest, excess, penalties, paid in, owed at the end, minimum next month, interest earned, interest earned to date. A final row of totals for the flow columns.
- **Loans**: the member's loans (month, principal, interest, term, status).
- **Ledger**: the member's entries, month by month, oldest first, as on the Record screen: date, month, what, amount, reason. An entry with corrections shows "Now K…" (`effectiveAmount`) and each correction on its own indented row (`correctionLine`), as on the member's page.

## 6. Screens

**Desk entry.** A "Reports" card on the Desk (admins always), one sentence ("Download the month, the whole period or one member's report as Excel files.") and a link to `/desk/reports`.

**`/desk/reports`** (admin-only; members get the admin-only screen and no request is made). Three labelled sections and a line under the heading: "These files contain members' figures. Send a member only their own report."
- **One month**: a select of the cycle's closed months, newest first, plus the open month marked "(preview)"; default the latest closed month; button **Download {label} workbook**.
- **Whole period**: "Through {last closed label}, plus {open label} as a preview" (without the preview part when no month is open) and the button **Download the whole-period workbook**. With no closed month and no open month: "Nothing to export yet."; with only an open month the file holds just that preview.
- **One member**: a select of the group's active members (as on the Members page; a member who has left is not listed) and the button **Download {short name}'s report**; with nothing to export it is disabled with the same explanation.

A button shows "Preparing…" and every export button is disabled while any export runs, so a double press makes one file. Success toast "{file name} downloaded."; failure toast through `friendlyError` and the button is usable again. Loading and error states with retry for the periods and members lists; 48px targets; tokens only; curly apostrophes.

**Member page.** `/desk/members/:id` gets a **Download report** button in the heading area, using the same member export.

## 7. Download

`workbook.xlsx.writeBuffer()`, then a `Blob` with the xlsx media type, an object URL, a temporary anchor with `download` set to the sanitised file name (characters `\ / : * ? " < > |` replaced by a space, spaces collapsed, trimmed), a click, and `URL.revokeObjectURL` ten seconds later (some browsers need the URL to outlive the click). Nothing is uploaded or stored.

## 8. Bundle and offline

- `exceljs` moves from `devDependencies` to `dependencies`.
- It is imported only inside the export action. Vite splits it into its own chunk at the dynamic import (a `manualChunks` rule was tried and rejected: it pulled a shared CommonJS helper into the ExcelJS chunk, which made the entry page statically import it and preload it on every visit) and `workbox.globIgnores` (`**/exceljs*.js`) keeps that chunk out of the service-worker precache, so a member's phone never downloads it. Exporting needs a connection anyway (the data is read live).
- The first task of the plan proves it works before anything depends on it: a throw-away Chromium run serves a build that loads ExcelJS through the lazy loader under the app's real Content-Security-Policy (`script-src 'self'`), builds a workbook and triggers a blob download. If ExcelJS or the download is blocked, the work stops and is reported; the policy is not weakened. After the page exists, the real bundle is checked: the ExcelJS code is only in its own chunk, the entry page does not reference it, and `sw.js`'s precache does not list it. A lint exception allows the one dynamic import in `loadExcel.ts`; a static `import … from 'exceljs'` anywhere else is an error (the rule sees static imports only; a stray dynamic import elsewhere would be caught in review). `loadExcel` also turns a failed chunk fetch, with a connection, into "A newer version of the app is ready. Reload this page and try again.": the chunk has a hashed name that disappears on the next deploy, and the raw failure would read as "offline".

## 9. Testing

- **pgTAP `20_export_fee_fold.sql`** (synthetic data): a `txn_fee` of 10 in March and a `membership` of 30; in April a correction of the fee down to 6 (an `adjustment` of 4). Through `private.ledger_lines`: March `txn_fee` 10, April `txn_fee` −4, cycle total 6; the membership unchanged. The same numbers appear in the Vitest scenario.
- **Vitest, pure builders**, building each workbook and **reading it back with ExcelJS**: headers, sheet names, every figure of a fixture, totals equal `sumKwacha` of the rows and equal the group figures, a credit stays negative, the preview banner, the first month's minimum 0, members ordered by short name, the Members sheet's two blocks, the matrix sheets' month columns, the ratio guard for zero savings, the fee fold (the pgTAP scenario), an entry with corrections ("Now K…" and its lines), a note starting `=HYPERLINK(...)` read back as a plain string, no e-mail / phone / user id anywhere.
- **Privacy test**: the member report for member A, built from a fixture that also holds member B with sentinel name and amounts, contains none of B's sentinels in any cell of any sheet.
- **Vitest, loaders** with a mocked client: the month loader asks for the right period and previous period, uses `close_month` with `p_commit: false` only for an open month, the whole-period and member loaders request the preview once and, when it is refused with `declarations_pending`, set `openLeftOut` and still return the closed months (any other error is thrown), selects `members` with `id, short_name, full_name, status` only; `fetchAllRows` returns all 2,500 rows (four requests: three pages and the empty one that ends it) and loses nothing under a 500-row server cap; chunking of the originals' ids; an error is thrown, not swallowed.
- **Vitest, screens**: the Reports page (non-admin gate with no requests, loading, error with retry, the month select with the preview marker, no closed month, each download sends one load / build / download with the right file name, buttons disabled while running, a failed load shows the friendly message and downloads nothing); the member page button; the Desk card.
- **File name** helper: characters replaced, spaces collapsed.
- **Build check** (§8) in the plan, run as a command with its output in the task record.
- Synthetic data only; the repo is public, so no real member data is committed. Manual check on dev with a throwaway group: download all three kinds, open them in Excel or LibreOffice, compare with the Close page, the Passbook and the Record screen. On production, after the web deploy: export February to September and compare the generated cumulative savings with the September hand-built workbook, member by member (differences should be at most the already-recorded `workbook_rounded` cases).

## 10. Security

- No new write path, grant or migration. The reads are the same admin reads the Desk already makes; they run on a button press under the admin's session and RLS.
- The files hold names and figures. The Reports page says so; the member report is the only file meant to be sent on, and it holds one member's data. E-mail, phone and user ids are never selected or written.
- Loader results are never put in the query cache, so they are never written to IndexedDB. The workbook bytes live in memory until the download starts, then the object URL is revoked.
- Strings stay strings (no formula injection from a member's note).

## 11. Success criteria

1. On dev an admin downloads a closed-month workbook, the open month's preview, the whole-period workbook (closed months plus the open month marked preview) and a member report, and each opens cleanly with figures that match the Close page, the Passbook and the Record screen.
2. On production (after the web deploy) the February to September export agrees with the September hand-built workbook's cumulative savings per member, apart from known `workbook_rounded` differences.
3. The member report contains no other member's data.
4. ExcelJS is not in the main bundle and not in the precache.
5. Lint, typecheck, Vitest and pgTAP green.

## 12. Risks

| Risk | Mitigation |
|---|---|
| More than 1,000 rows silently truncated | `fetchAllRows` pages until an empty page and advances by the rows received; tested with 2,500 rows and with a row cap below the page size; entries are also read per period. |
| The client's fee fold drifts from the engine's | The one rule is pinned by the same scenario in pgTAP and Vitest; every other figure is the engine's own. |
| A member's file leaks another member's data | The member builder only receives that member's data; a sentinel test scans every cell. |
| The open month cannot be previewed (waiting declarations) | The month workbook shows the refusal's friendly message; the whole-period and member files are still made without the open month and say so in the file and in the toast. |
| A preview figure is mistaken for a final one | The open month is always last, headed "(preview)", totals say they include it, and `Statements` flags its rows. |
| ExcelJS is large | Lazy chunk, excluded from the precache, verified by the first plan task. |
| A browser blocks the download or lacks `Blob` support | Standard `Blob` and anchor download; the failure path shows an error and enables the button again; manual check on a phone browser. |
| A note beginning `=` runs as a formula | Strings are written as strings; tested. |
| Production lacks migrations 2000, 2100, 2200 | None of them is needed: E1 reads existing tables and `close_month` / `payout_preview`. |
