# Sub-project S1: live-month loop (Declare + Desk inbox)

Date: 2026-10-11
Status: Draft for review
Builds on: `2026-10-10-ledger-engine-design.md` (§6 functions, §9 RLS). Replaces the "February 2027" placeholders for Declare and the Desk.

## 1. Goal

Production must run on the current 2026 data now, not wait for the 2027 cycle. Feb–Sep 2026 is imported and closed. S1 lets the treasurer **open October (month 9)**, members **declare** what they are sending, and the treasurer **approve or return** each declaration. That is the smallest end-to-end slice that makes the app live.

Decided with the user (2026-10-11): October runs live in the app, with the workbook in parallel for comparison; build order is S1 (this), S2 (Passbook / Record / Plan), S3 (Desk money: loans, penalties, corrections, defaults, month close).

Non-goals for S1: sending loans, penalties, corrections, defaults, month close, payout (all S3); Passbook, Record, Plan (S2); reminders, proof-of-payment upload, notifications, Excel export.

## 2. No database changes

Every function S1 needs already exists and is tested: `open_period`, `set_deadline`, `submit_declaration`, `return_declaration`, `approve_declaration`. Reads go straight to RLS-protected tables (`periods`, `wallets`, `declarations`, `statements`, `members`, `cycles`). **No migration**, so S1 cannot collide with other migration work. The client never computes a stored figure; it only displays what the database returns and sends what the user typed.

## 3. Data layer (`src/features/ledger/`)

Small TanStack Query hooks, keyed by group so a group switch cannot show stale data:

| Hook | Reads | Notes |
|---|---|---|
| `useLedgerCycle(groupId)` | `cycles` (status `active`) + its `periods` ordered by `month_index` | `periods` are all 12 months once any import or `open_period` ran (`ensure_periods`). |
| `useWallets(groupId)` | `wallets` where `active` | Airtel and MTN exist from the import. |
| `useDeclarations(periodId)` | `declarations` for the period, newest first | Admin sees all; a member sees their own (`declarations_select` via `can_see_figures`). |
| `useMinimumPayable(memberId, periodId)` | the member's `statements` row from the last closed period | Hint only. Absent for a brand-new member (hint hidden). |

Derived, pure helpers (unit-tested): `currentPeriod(periods)` = the `open` period, else null; `nextToOpen(periods)` = lowest `planned` month_index above the last `closed` one, only when no period is `open` or `closing`; `liveDeclaration(rows)` = the row nothing supersedes (`supersedes_id` chain), which is the one that counts.

After any mutation: invalidate `['declarations', periodId]` and `['ledger-cycle', groupId]`.

## 4. Member screen: `/declare`

States:

1. **No open month.** "Next month isn't open yet." Shows the last closed month's label. No form.
2. **Open month, no live declaration.** Header: month label and deadline ("Due 7 Oct", with "N days left" or "Past the deadline" using `localISODate`; a late submission is still allowed, the treasurer decides on a penalty in S3). A hint line "Minimum payable this month: K…" from `useMinimumPayable` (not prefilled). Form fields: saving, loan repayment, excess, membership, penalty, mobile-money fee, borrowing request (all kwacha, `inputMode="decimal"`, 2 dp, ≥ 0), wallet (native `<select>` styled like `TextField`, only required when any money amount > 0), note (≤ 500). Submit → `submit_declaration`.
3. **Live declaration `submitted`.** A status card with the figures and "Waiting for the treasurer". "Edit" re-opens the form prefilled; resubmitting supersedes the waiting one (DB rule).
4. **`returned`.** Warning card with the treasurer's `return_reason`; the form is shown prefilled for resubmission.
5. **`approved`.** Read-only card "Approved", with the totals. A second declaration may still be added (the DB allows a new one beside an approved one); a secondary "Declare another payment" button reveals the form.

Validation (client, before the call; the DB re-validates): at least one amount > 0; amounts are non-negative with ≤ 2 dp; wallet present when money is sent; note length. Server error codes show through `friendlyError`. Double-tap protection: submit button `isLoading` plus `useMutation` single-flight; the DB serialises per member.

Members with no `member` row (an owner without a linked member) see "Your account isn't linked to a member profile" with a link to Settings → Members instead of the form.

## 5. Admin screen: `/desk`

Replaces the empty state. Admin-only gate unchanged (`NotFound` for others).

**Month panel.**
- No period open and one is next to open: "Open October" button → sheet with a deadline date input (default: the period's stored deadline, may be in the past; the DB only requires ≥ month start) → `open_period(cycleId, monthIndex, deadline)`.
- A period open: month label, deadline (the counts by status are in the inbox section headings), and "Change deadline" → sheet with date and a required reason → `set_deadline`.
- A period `closing` or nothing left to open: informational text only.

**Inbox** (open period only), three groups:
- **Waiting**: one row per live `submitted` declaration: member short name, amounts, wallet, note, time. Buttons **Approve** (`approve_declaration`) and **Return** (sheet with required reason ≤ 500, `return_declaration`). Approve uses the existing `useConfirmTap` pattern to avoid mis-taps.
- **Returned**: shown with reason, awaiting the member.
- **Approved**: collapsed list with totals.

**Not yet declared**: active members with no live declaration, each with "Declare for member". It opens the same form component as §4 in a sheet, with `p_member` set to that member, so the treasurer can enter WhatsApp declarations.

Link to the ledger check stays.

## 6. Shared pieces

- `DeclarationForm` (one component, used by Declare and by "Declare for member"): props `{ periodId, memberId, wallets, initial?, onDone }`.
- `AmountField`: thin wrapper over `TextField` for kwacha input; parses with a strict regex, returns a string until submit, converts to a number at the boundary. No float arithmetic on money anywhere; totals shown are summed in integer ngwee.
- Formatting through the existing `formatMoney` / `formatDate`.
- Copy: `ComingSoon` (Passbook, Plan, Record) changes from "Available when the February 2027 cycle opens" to "Coming soon" wording until S2 replaces it. Desk copy updated. Any missing codes get `friendlyError` messages in `src/lib/errors.ts` (`already_opened`, `invalid_date`, `member_not_active` if absent).

## 7. Error and edge handling

- Wrong-state races (period closed while the form is open, declaration already handled): the DB answers `period_not_open` / `declaration_not_found`; the UI shows the friendly message and refetches.
- Offline: mutations are not queued; the existing offline banner and `friendlyError` offline message apply. The form keeps its values so nothing typed is lost.
- Non-admin calling a Desk action: DB returns `not_admin`; UI never renders those controls for non-admins.
- Owner of a different group is not a case here: one group per person (migration 2000).

## 8. Testing

Vitest + Testing Library with a mocked `supabase` client, following `LedgerCheckPage.test.tsx`:
- Declare: each of the five states; validation (all zero, bad decimals, missing wallet); correct `submit_declaration` arguments; resubmission after `returned`; error mapping; no double submit.
- Desk: non-admin gate; open-month sheet calls `open_period` with the chosen date; change-deadline requires a reason; approve and return call the right RPCs; return requires a reason; "Not yet declared" opens the form for that member.
- Pure helpers: `currentPeriod`, `nextToOpen`, `liveDeclaration`, money parsing.
- Synthetic data only; no real member figures anywhere committed.
- Manual check on dev before production: open a month, declare as a member, approve as admin, confirm the `entries` appear.

## 9. Security

No new write paths, no new grants. RLS already restricts reads. The client sends only the typed values and ids; authority checks stay in the RPCs. No member figures in tests or the repo.

## 10. Success criteria

1. On the dev database an admin can open October, a member can declare, the admin can approve and return, and all five screen states render correctly.
2. Lint, typecheck and Vitest green; no pgTAP changes needed.
3. No remaining "February 2027" copy on Declare or Desk.

## 11. Risks

| Risk | Mitigation |
|---|---|
| October's deadline (7 Oct) has passed | The Desk lets the treasurer pick a new deadline when opening; it is recorded and audited. |
| Treasurer must still enter WhatsApp declarations | "Declare for member" reuses the same form. |
| Workbook and app diverge during the parallel run | Out of S1; `ledger-check` and S3's close preview compare them. |
