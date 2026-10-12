# Sub-project S3b: Month close

Date: 2026-10-11
Status: Draft for review
Builds on: `2026-10-10-ledger-engine-design.md` (§5 month close, §6 `close_month`), `2026-10-11-live-month-loop-design.md` (Desk, `useLedgerAction`), `2026-10-11-desk-loans-penalties-design.md` (loans, penalties, the queries reused for the checklist). Part of S3: S3a loans and penalties (done), S3b month close (this), S3c corrections and defaults, S3d group payout view, then S4 polish.

## 1. Goal

October runs live in the app (S1) with loans and penalties (S3a). To finish the month and open November, the treasurer must **close** it: the engine computes every member's statement and the group's cash and pots, writes them, and locks the month. Closing is the riskiest action in the app: it cannot be undone (later corrections land in the next month). S3b gives the treasurer a deliberate way to see exactly what a close would write, check that nothing is missing, and then commit it.

Decided with the user (2026-10-11): the workbook comparison is **not** built for live months. The engine's differences come from `workbook_figures`, which only the 2026 import writes (and the import refuses once the app has taken over the cycle), so for a live month the comparison list is always empty. The page says so and still works; loading a live month's workbook figures is a possible later piece.

Non-goals: corrections, waivers and defaults (S3c), the whole-group payout table (S3d), loading workbook figures for a live month, reopening a closed month (the engine has no such function), reminders, Excel export.

## 2. No database changes

`close_month(p_period uuid, p_commit boolean default false, p_reason text default null) returns jsonb` already exists and is tested. Preview and commit share one code path. **No migration.** Refusals it can raise (all already have friendly messages in `errors.ts`): `not_admin`, `period_not_open`, `previous_period_open`, `declarations_pending`, `already_closed`, `unexplained_differences`, `invalid_note`.

Preview result (`committed: false`):
- `period_id`, `label`, `month_index`, `committed`;
- `group`: `opening_cash`, `received`, `savings`, `loans_sent`, `idle_cash`, `excess_rate`, `excess_billed`, `interest_collected`, `fee_pot_in`, `fee_pot_out`, `fee_pot_balance`, `meeting_pot_in`, `meeting_pot_balance`, `total_savings`, `total_owed`;
- `members[]`: `member_id`, `short_name`, `opening_owed`, `saving`, `cum_savings`, `loan_principal_sent`, `loan_interest_charged`, `excess_charged`, `penalties_charged`, `paid_total`, `paid_to_excess`, `paid_to_penalties`, `paid_to_interest`, `paid_to_principal`, `closing_owed`, `next_minimum`, `unpaid_minimum`, `interest_earned`, `interest_earned_to_date`, `excess_share`, `interest_share`;
- `loans[]` (`loan_id`, `remaining`), `diff[]` (`member_id`, `short_name`, `field`, `app`, `workbook`, `difference`, `reason_code`), `unexplained` (count).

The commit returns the same with `committed: true`.

## 3. Data layer (`src/features/ledger/queries.ts`, extended)

| Hook | What | Notes |
|---|---|---|
| `useClosePreview(periodId)` | RPC `close_month` with `p_commit: false` | `enabled` only with a period; `staleTime: 0`; `retry: false` (a precondition refusal will not fix itself); **never persisted** (`close-preview` joins `NEVER_PERSISTED` in `queryClient.ts`: it holds every member's figures) |
| `useCloseMonth()` | mutation over `useLedgerAction` | `close_month` with `p_commit: true` and `p_reason` |

Types `ClosePreview`, `CloseMember`, `CloseGroup`, `CloseDiff` live beside the hook. `useRefreshLedger` also invalidates `['close-preview']`, `['statements']`, `['entries']`, `['loans']`, `['payout-preview']` and `['minimum-payable']`, since a close rewrites what members see.

Pure helper (`src/features/ledger/closeChecklist.ts`, unit-tested): `closeChecklist({ declarations, members, openSuggestions, requests, period, today })` returns `{ waiting, notDeclared, penaltiesPending, requestsUnsent, deadline: { text, tone } , blocked }`. `blocked` is true only for waiting declarations. It reuses `liveDeclarations`, `undeclared`, `loanRequests`, `openSuggestions` and `deadlineNote`.

## 4. The Desk entry point

A "Close the month" card on the Desk (open month only), after the other sections: one sentence ("Closing writes everyone's statement and locks the month. Check the list first.") and a **Review the close** link to `/desk/close`. No other Desk change.

## 5. The close page: `/desk/close`

Registered as `page('desk/close', 'Close the month', <ClosePage />)`; admin-only (`NotFound` "This page is for admins" for members, no requests made).

States: no open month ("No month is open to close. Open the next month from the Desk."), loading (labelled), error with retry.

**Before you close** (a labelled section; the same data the Desk loads: declarations, members, suggestions, applied penalties, loans):
- *Declarations waiting*: N, **blocks** the close; "Approve or return them on the Desk" with a link.
- *Not yet declared*: M members, listed by name; warning: they close with nothing paid in.
- *Suggested penalties not applied*: K; warning, with a link to the Desk's penalties.
- *Borrowing requests not sent*: R; info.
- *Deadline*: "Due 14 Oct 2026, 3 days left" / "Past the deadline"; info.

**Preview**: loaded on open; a **Refresh preview** button; a note "Figures change if anything is recorded before you close; the close always uses the figures at the moment you commit."
- *Group statement*: the figures from §2 in a labelled grid. A negative `fee_pot_balance` shows a warning ("The fee pot is short: loan transfer fees exceed what members declared.").
- *Members*: one `<details>` card per member, in the engine's order (by short name). Summary: name and "Owed K…" (or "In credit K…" using the S2 `owedFigure`). Body: lines for opening owed, saved this month, loan sent, loan interest, excess, penalties, paid in total and its split, closing owed, next minimum, interest earned this month and to date. Zero lines are hidden except closing owed; negative lines are shown.
- *Workbook comparison*: when `diff` is empty: "No workbook figures are loaded for this month, so there is nothing to compare." When it is not, the differences grouped by reason code exactly as on the ledger check page (the list component is extracted from `LedgerCheckPage` into `DifferenceList.tsx` and shared), with the `unexplained` count.

**Commit**: at the bottom, a card "Close {label}".
- Text: "This writes {N} statements and locks {label}. Anything you correct later goes into the next month."
- If `unexplained > 0`: a **Reason** field (required, ≤ 500) "Why the differences are acceptable".
- The button **Close {label}** is disabled while: the preview is loading, errored or refetching; declarations are waiting; a reason is required and missing. It takes a **two-tap confirm** ("Tap again to close {label}") and is disabled while the request runs. Any edit or refresh disarms the second tap.
- On success: toast "{label} is closed.", navigate to `/desk`, where the month panel now offers to open the next one.
- Refusals through `friendlyError`. `already_closed` after a dropped connection reads "This month is already closed." and the page refreshes so the Desk shows the truth.

## 6. Shared behaviour

Loading skeletons with labels, error with retry, 48px targets, tokens only, labelled sections, curly apostrophes. Money with `money()`; the sign handled with `owedFigure`; nothing is computed in the client. The ledger check page keeps working, now through the shared `DifferenceList`.

## 7. Security

No new write path or grant. `close_month` is admin-only and re-validates everything. The preview is never persisted. A two-tap confirm and a disabled button guard the commit; the database lock (`for update` on the month) serialises concurrent closes.

## 8. Testing

Vitest with mocked hooks, following S1–S3a:
- `closeChecklist`: each item, `blocked` only for waiting declarations, returned declarations are not "waiting", members with any live declaration are declared.
- `ClosePage`: non-admin gate with no requests; no open month; loading; preview error with retry (`declarations_pending` shows its friendly sentence); the checklist (blocked vs warnings); the group figures and a member card (zero lines hidden, negative lines shown, credit shown as "In credit"); the fee-pot warning; the empty-comparison sentence; a non-empty comparison with an unexplained count; commit blocked while declarations wait; commit needs the reason when unexplained; the two-tap commit sends `{ p_period, p_commit: true, p_reason }` once and navigates; a second tap while pending sends nothing; `already_closed` and `unexplained_differences` refusals.
- Hook test: the preview is asked with `p_commit: false` and never persisted.
- `LedgerCheckPage` tests stay green after the `DifferenceList` extraction; `DeskPage` test: the Close card shows with a month open and not without.
- Synthetic data only. Manual check on dev with a throwaway group: preview, then commit, then confirm `statements`, `group_statements` and the audit log, and that the month is `closed`.

## 9. Success criteria

1. On dev an admin can review the checklist and preview for an open month and close it, after which the Desk offers the next month and members' Passbooks show the new statement.
2. A waiting declaration blocks the commit in the UI and the server agrees.
3. Lint, typecheck and Vitest green; no pgTAP changes.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Closing too early (members unpaid, penalties unapplied) | The checklist names each gap before the button; only waiting declarations hard-block, as the engine does. |
| A double tap or a retry closes twice | Two-tap confirm, disabled while running, server lock; a retry after success reads `already_closed` and refreshes. |
| The preview differs from what commits (something recorded in between) | Stated on the page; preview and commit share one engine path; the committed figures are what members then see. |
| Workbook comparison missing for live months | Said plainly on the page; recorded as a future piece. |
| 18 member cards on a phone | Collapsed `<details>`, newest information in the summary. |
