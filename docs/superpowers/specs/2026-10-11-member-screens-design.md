# Sub-project S2: member screens (Passbook, Record, Plan)

Date: 2026-10-11
Status: Draft for review
Builds on: `2026-10-10-ledger-engine-design.md` (§4 data model, §9 RLS) and `2026-10-11-live-month-loop-design.md` (shared `src/features/ledger/` hooks and test fixtures). Replaces the "Coming soon" placeholders on `/passbook`, `/record` and `/plan`.

## 1. Goal

Production runs on the current 2026 data now. Feb–Sep 2026 is imported and closed, and October is run live (S1). S2 lets each member see **their own** figures: what they have saved and owe (Passbook), every ledger entry behind it (Record), and what is still to pay plus what they would receive at payout (Plan).

Decided with the user (2026-10-11): each screen shows the signed-in member's own figures only. No member picker, even though a group with `figures_visibility = 'open'` lets the database return everyone's rows. The treasurer sees everyone's figures in the Desk (S3).

Non-goals: the running figures of the month in progress (no statement exists until the treasurer closes it), charts, PDF or Excel export, viewing other members' figures, and any write.

## 2. No database changes

Reads only, through existing RLS (`statements`, `entries`, `loans`, `loan_instalments` select via `can_see_figures`) and the existing `payout_preview(p_cycle)` RPC. **No migration.** The client never computes a stored figure; it formats and groups what the database returns. Every query filters by the member's own id: in an open group RLS would otherwise return other members' rows.

## 3. Data layer (`src/features/ledger/queries.ts`, extended)

| Hook | Reads | Returns |
|---|---|---|
| `useMyStatements(memberId)` | `statements` where `member_id` = own | `StatementRow[]` (all columns) |
| `useMyEntries(memberId)` | `entries` where `member_id` = own, newest first | `EntryRow[]` |
| `useMyLoans(memberId)` | `loans` where `member_id` = own and `status = 'open'`, with `loan_instalments` for those loans | `LoanWithInstalments[]` |
| `usePayoutPreview(cycleId, memberId)` | RPC `payout_preview` | the member's own row or `null` |

Months (labels, `month_index`, status) come from the existing `useLedgerCycle`; a `period_id` → period map turns ids into "Sep 2026". The `entries` and `statements` queries are enabled only when a member id is present. Keys are `['statements', memberId]`, `['entries', memberId]`, `['loans', memberId]`, `['payout-preview', cycleId, memberId]`.

Pure helpers (`src/features/ledger/memberViews.ts`, unit-tested):
- `kindLabel(kind)` and `kindTone(kind)`: plain label and a tag (`in`, `charged`, `earned`, `correction`) for each of the 12 entry kinds. Unknown kinds fall back to the raw kind rather than hiding the row.
- `groupEntriesByPeriod(entries, periods)`: month groups newest first, entries newest first within a group, with a per-group total of money paid in.
- `latestStatement(statements, periods)`: the statement of the highest `month_index`.
- `remainingInstalments(loan, periods)`: a loan's scheduled instalments in months that are not closed (by `month_index` order), with their month label. **No total**: instalments are caps on what a close bills, not a balance (an imported loan keeps its original instalment for the first app month and spreads the whole remaining balance after it), so adding them up overstates what is owed.
- `owedFigure(balance)`: a negative balance is shown as "In credit" with a positive amount, never "You owe K −50".
- `statementViews` and `groupEntriesByPeriod` leave out rows whose month is not in the active cycle's periods.

## 4. Passbook (`/passbook`)

- **Headline tiles** from the latest statement: Total saved (`cum_savings`), You owe or In credit (`closing_owed`, noted "At close of Sep 2026"), Next minimum (`next_minimum`), Interest earned to date (`interest_earned_to_date`). Subtitle names the statement month ("As at Sep 2026").
- **Month list**, newest first: one card per statement with the month label and a collapsed breakdown (`<details>`): Saved this month, Loan sent, Loan interest, Excess charged, Penalties, Paid in total and how it was split (to excess, penalties, interest, principal), Closing owed. Only untouched zero lines are hidden: corrections land in the open month, so a line can be negative and is shown.
- **Open month note:** when a period is `open`, a line "Your {month} statement appears when the treasurer closes the month."
- **Empty:** "No statements yet" with the same line.

## 5. Record (`/record`)

- Entries grouped by month (newest first), each group headed by the month label and what was paid in.
- Each row: the plain label, the amount, a tone tag (Paid in / Charged / Earned / Correction), and the date it was recorded. A correction row also shows its `reason`. Rows with `source = 'import'` carry "from the workbook".
- Waivers and adjustments display as corrections; `payout_fee` entries have no member and never appear.
- Empty: "Nothing recorded yet".

## 6. Plan (`/plan`)

- **Where you stand:** You owe (latest statement `closing_owed`) and Next minimum, with the statement month.
- **Open loans:** one card per open loan: principal, interest, term in months, date sent, and the scheduled instalments by month with their `amount_due`, labelled "Scheduled amounts, not what is left to pay", with no total. When none are left: "No scheduled instalments left", pointing to What you owe. Loans that are repaid do not appear.
- **If the cycle paid out today:** from `payout_preview`: Savings, Interest earned, Less what you owe today (or Plus your credit), Share of the pots, and the resulting You would receive (or You would still owe when it is negative), with the note "A projection from today's figures, not a promise. It changes as the group saves and repays." Shown only when the preview returns the member's row; otherwise omitted.
- **Empty:** "No loans" and, if there is no preview, no payout block.

## 7. States and shared behaviour

- Every screen: loading skeleton with a visible label, error with retry through `friendlyError`, empty state, and the "Your account isn't linked to a member" message for an owner without a member row (same copy as Declare).
- Money formatting via the existing `money()`; dates via `formatDate`. 48px targets, tokens only, labelled sections, `<details>` for expandable rows.
- A refetch that fails after data exists keeps showing the data (the same rule as Home and Group).
- `ComingSoon.tsx` and its imports are deleted once nothing uses it.

## 8. Testing

Vitest + Testing Library with mocked hooks, following S1:
- Helpers: kind labels for all 12 kinds plus an unknown kind; grouping and ordering; latest statement; remaining instalments (closed months excluded).
- Passbook: loaded, empty, open-month note, error with retry, no member.
- Record: grouped rows, correction reason, workbook tag, empty, error.
- Plan: loans with remaining instalments only, repaid loans hidden, payout block shown and omitted, the projection note, error.
- Each hook filters by member id (a query-chain test like `queries.test.tsx`).
- Synthetic data only; no real member names or figures in the repo.
- Manual check on dev before production: with the imported data, a member's Passbook latest statement, Record entries and Plan loans match the figures in `ledger:check`.

## 9. Security

No new write paths, no new grants. Own-id filters on every query plus RLS. Nothing is cached beyond the app's existing query persister.

## 10. Success criteria

1. A member signed in on dev sees their own Passbook, Record and Plan from the imported data, and no one else's.
2. Lint, typecheck and Vitest green; no pgTAP changes.
3. No "Coming soon" copy left and `ComingSoon.tsx` removed.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Open-visibility RLS returns other members' rows | Every query filters by the member's id; each hook has a test that pins the filter. |
| Instalments carry no paid flag and are caps, not a balance | The schedule is shown without a total and says so; the statement's `closing_owed` is the authoritative balance and is shown beside it. |
| An unknown entry kind added later | Unknown kinds render with their raw name instead of disappearing. |
