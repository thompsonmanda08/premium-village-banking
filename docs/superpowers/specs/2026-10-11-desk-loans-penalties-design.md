# Sub-project S3a: Desk loans and penalties

Date: 2026-10-11
Status: Draft for review
Builds on: `2026-10-10-ledger-engine-design.md` (§3 rules, §6 functions), `2026-10-11-live-month-loop-design.md` (Desk, `useLedgerAction`, fixtures). Part of S3 (treasurer money screens): S3a loans and penalties, S3b month close, S3c corrections and defaults, S3d group payout view, then S4 polish. Each has its own spec, plan, build and review; none is dropped.

## 1. Goal

Production runs on the 2026 data now, with October live in the app (S1). Members' declarations already carry a **borrowing request**; the treasurer must be able to act on it, and to apply the month's penalties, before the month can be closed (S3b). S3a gives the Desk:
- a queue of borrowing requests and a way to send a loan, with the cash, cap and arrears **shown before sending**;
- the engine's suggested penalties, applied with a recorded reason.

Non-goals: month close (S3b), corrections, waivers and defaults (S3c), the group payout view (S3d), reminders, Excel export.

## 2. Database: one read-only function, migration `20261010002200_loan_check.sql`

`send_loan` reveals its cap and arrears warnings only after the loan is sent, and a refusal carries no figures; lending cash cannot be read at all. The client must not compute money, so a read-only preview is added. `send_loan` is **not modified**.

`public.loan_check(p_member uuid, p_principal numeric default null) returns jsonb` — `stable`, `security definer`, `set search_path = public, pg_temp`, admin-only (`is_admin` of the member's group), writes nothing, `revoke ... from public, anon, authenticated; grant execute ... to authenticated` (the 02_rls allowlist test must still pass). It works on the group's **open** month and returns:

| Key | Meaning |
|---|---|
| `period_id`, `label`, `month_index` | The open month |
| `loans_open` | false in month 12 or when the month's loan multiple is 0 (`send_loan` would answer `loans_closed`) |
| `lending_cash` | `private.lending_cash(period)` |
| `multiple`, `cum_savings`, `loans_owed`, `cap`, `headroom` | the cap rule: `cap = multiple × cum_savings`, `headroom = cap − loans_owed` (may be negative) |
| `arrears` | the same text `send_loan` stores in `arrears_warning`, or null |
| `principal`, `interest`, `term_months`, `over_cap`, `insufficient_cash` | present only when `p_principal` is given: `interest = round(principal × loan_rate, 2)`, term from the tenor bands shortened to month 12, `over_cap = loans_owed + principal > cap`, `insufficient_cash = principal > lending_cash` |

Refusals (P0001/42501 like the rest): `member_not_found`, `not_admin`, `member_not_active`, `period_not_open`, `invalid_amount` (a given principal that is not a positive 2-dp amount in range).

The formulas repeat `send_loan`'s. They are pinned together by pgTAP (§8): for every case below, `loan_check` and a real `send_loan` must agree.

## 3. Data layer (`src/features/ledger/queries.ts`, extended)

| Hook | Reads | Notes |
|---|---|---|
| `useLoanCheck(memberId, principal)` | RPC `loan_check` | enabled only with a member and (for the amount part) a valid principal; key includes both; `staleTime: 0`; **never persisted** to IndexedDB; keeps the same member's last answer while a new amount loads but never another member's; Send is enabled only on a successful, non-placeholder, non-paused answer to exactly the typed amount |
| `useMonthLoans(periodId)` | `loans` of the period | admin RLS sees all; used to mark requests as served and list loans sent this month |
| `useSuggestedPenalties(periodId)` | RPC `suggest_penalties` | rows `{member_id, short_name, ground, amount, detail}` |
| `useMonthPenalties(periodId)` | `entries` of the period where `kind = 'penalty'` or `source = 'correction'` | the penalties already applied, and the corrections of them (a waiver is stored as kind `waiver`, a reduction as `adjustment`, so `kind = 'penalty'` alone could never see them) |

Write hooks use `useLedgerAction`; `useRefreshLedger` is extended to also invalidate `['month-loans', …]`, `['month-penalties', …]`, `['suggested-penalties', …]`, `['loan-check']`.

Pure helpers (`src/features/ledger/deskMoney.ts`, unit-tested):
- `loanRequests(declarations, loans)`: from the live declarations (S1 `liveDeclarations`) with `borrowing_request > 0` and status not `returned`, each with whether a loan was already sent to that member this month.
- `appliedGrounds(penaltyEntries)`: the set of `memberId + ground` already applied (an applied entry's `reason` starts with `"<ground>: "`); `openSuggestions(suggestions, applied, dismissed)`.
- `GROUPS`: the four penalty grounds with plain labels (`late_declaration` Late declaration, `missed_minimum` Missed minimum, `under_saving` Saved under the minimum, `other` Other).

## 4. Desk: loans

A new "Loans" section on the Desk (open month only), below the declaration inbox:
- **Borrowing requests**: one row per request: member, amount requested, the declaration's date, and either **Send loan** or the chip "Sent K 1,000". "No borrowing requests this month." when empty.
- **Send a loan** button for a loan nobody requested (e.g. a WhatsApp request).
- **Loans sent this month**: member, principal, interest, term, wallet, and any stored cap/arrears warning.

**SendLoanSheet** (opened from a row or the button): member select (active members), amount, wallet select, transfer fee (optional, default 0), reason.
- Once a member is chosen, a "Before you send" panel (from `loan_check`, re-asked 300 ms after the amount changes) shows: Lending cash on hand; This member's cap (`multiple` × savings) with what they owe on loans and the headroom; Arrears (if any); and, once there is an amount, the interest and term.
- `insufficient_cash` blocks Send and says how much is available. `loans_open` false blocks Send ("No new loans this month").
- `over_cap` shows a warning and makes **Reason** required ("Approved over the cap because…"); otherwise the reason is optional.
- Sending is a **two-tap confirm** (`useConfirmTap`, "Tap again to send K 1,000 to Eve"): the database has no idempotency, so a double tap would send two loans. The button is disabled while the request runs.
- On success: toast, the sheet closes, the stored `cap_warning` / `arrears_warning` appear in "Loans sent this month". Refusals show through `friendlyError` (`insufficient_cash`, `over_cap_needs_reason`, `loans_closed`, `wallet_not_found`, `member_not_active`, `period_not_open`, `invalid_amount`).

## 5. Desk: penalties

A new "Penalties" section (open month only):
- **Suggested**: from `suggest_penalties`, minus those already applied and those dismissed ("Not now", kept for the session only; nothing is recorded). Each row: member, ground label, suggested amount, the engine's detail, and **Apply** / **Not now**. "Nothing to suggest right now." when empty.
- **ApplyPenaltySheet**: member and ground fixed from the suggestion, amount editable (prefilled), reason required (prefilled with the detail, editable, ≤ 500). Two-tap confirm, then `apply_penalty`. For **Add a penalty** (any active member): ground `other`, amount and reason both required.
- **Applied this month**: penalty entries with member, amount, ground and reason (from `entries.reason`, `"ground: reason"`), and "corrected" if a later correction exists (S3c does the correcting).
- Suggestions describe the month so far; the section says "Suggestions update until the month closes."

## 6. Shared behaviour

Loading skeleton with a label, error with retry, empty states, non-admin gate unchanged (the sections only render inside the admin Desk). 48px targets, tokens only, labelled sections. New `friendlyError` messages for any of the codes above that are missing (`insufficient_cash`, `over_cap_needs_reason`, `loans_closed`, `reason_required` already exist or are added). Money is formatted with `money()`; amounts typed through the S1 `parseKwacha`; totals summed with `sumKwacha`.

## 7. Security

`loan_check` is admin-only and read-only; no client write grants change; every write is an existing RPC that re-validates. Reasons and amounts are validated client-side for shape only. The two-tap confirm protects against double sends; the database serialises sends per group already.

## 8. Testing

- **pgTAP `18_loan_check.sql`** (synthetic data): privileges (anon and member refused, admin allowed, not in the anon allowlist); `period_not_open`, `member_not_found`, `member_not_active`, `invalid_amount`; month 12 and multiple 0 give `loans_open = false`; the cash, cap, headroom and arrears figures; and **agreement with `send_loan`**: for an affordable under-cap amount, an over-cap amount, an amount above cash, and a member in arrears, `loan_check`'s flags equal what `send_loan` does (succeeds / `over_cap_needs_reason` / `insufficient_cash`), and after a real send the loan row's `interest`, `term_months` and `arrears_warning` equal `loan_check`'s.
- **Vitest** with mocked hooks: the helpers; the requests list and "Sent" chips; the sheet (preview shown, blocked on cash, reason required over cap, two-tap send sends once, friendly refusals); suggestions (hidden when applied or dismissed, apply sends the ground and edited amount, reason required); add-a-penalty; non-admin never sees these sections.
- Synthetic data only; no real names or figures.
- Manual check on dev before production: send a loan and apply a penalty on a throwaway group, confirm `entries` and `loans` rows and the audit log.

## 9. Success criteria

1. On dev an admin can see a member's request, preview the loan, send it, and see it listed; and apply a suggested penalty, which then disappears from the suggestions.
2. `loan_check` and `send_loan` agree on every pinned case.
3. Lint, typecheck, Vitest and pgTAP green.

## 10. Risks

| Risk | Mitigation |
|---|---|
| `loan_check` drifts from `send_loan` | The agreement tests in §8; `send_loan` stays the only writer. |
| A double tap sends two loans | Two-tap confirm plus a disabled button while pending; the audit log shows any duplicates. |
| Suggestions persist after applying | The UI hides suggestions already applied this month, matched on member and ground. |
| The preview is stale when another admin sends first | `staleTime: 0` and it is re-asked on every amount change; `send_loan` re-checks and the refusal is shown. |
