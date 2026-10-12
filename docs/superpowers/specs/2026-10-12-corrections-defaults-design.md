# Sub-project S3c: Corrections, waivers and defaults

Date: 2026-10-12
Status: Draft for review
Builds on: `2026-10-10-ledger-engine-design.md` (§3 rules, §5 corrections fix forward, §6 `post_correction` / `post_waiver` / `set_default`), `2026-10-11-member-screens-design.md` (entry labels and grouping), `2026-10-11-desk-loans-penalties-design.md` (`useLedgerAction`, two-tap confirm). Part of S3: S3a loans and penalties (done), S3b month close (done), S3c corrections and defaults (this), S3d group payout view, then S4 polish.

## 1. Goal

A treasurer will get things wrong and members will pay late, short or twice. Closed months are never rewritten (§5: "balances fix forward"), so the engine has three append-only tools: **correct** an entry to a new total, **waive** part or all of a charge, and **mark a member as defaulted**. None has a screen. S3c gives the treasurer one place per member to see their ledger and use those tools, with the reason recorded every time.

Decided with the user (2026-10-12): an entry's *current amount* is computed on screen for display only, pinned to the engine by a shared test scenario (no migration). The engine re-validates every post.

Non-goals: correcting a `payout_fee` (it has no member, so no member page reaches it), editing loans (a loan is changed by the loan screens, never corrected), correcting a correction, editing a closed month, bulk edits, and undo (a mistaken correction is itself corrected).

## 2. What the engine does (the screen must match it)

- `post_correction(p_entry, p_new_amount, p_reason)`: sets the entry's **effective total** to `p_new_amount` (≥ 0, 2 dp). Allowed on `saving`, `payment`, `membership`, `txn_fee`, `penalty`, `excess_charge` (and `payout_fee`), never on a correction. The result lands in the cycle's **open month** as a new entry pointing back at the original: the original kind if the total goes up, `adjustment` if it goes down. A change of nothing is refused (`invalid_amount`); raising a penalty on a member who has left is refused (`member_not_active`).
- `post_waiver(p_entry, p_amount, p_reason)`: waives `p_amount` (> 0, at most what is still charged) of a `loan_interest`, `excess_charge` or `penalty`. Lands in the open month as a `waiver`.
- **Effective amount** of an original entry = its amount + the amounts of its corrections that are not `waiver` / `adjustment` − the amounts of its corrections that are.
- `set_default(p_member, p_cycle, p_defaulted, p_reason)`: one row per member per cycle (`member_status`), reason required, `changed_at` / `changed_by` recorded. A defaulted member earns no further interest share and their debt is deducted at payout.
- No open month in the cycle means every post is refused with `period_not_open`.

Every refusal already has a friendly message in `errors.ts` (`entry_not_found`, `reason_required`, `invalid_amount`, `invalid_note`, `period_not_open`, `member_not_active`).

## 3. No database changes

**No migration.** One new pgTAP file pins the effective-amount rule (§8). Reads go through admin RLS: `entries` and `member_status` select via `can_see_figures`, which an admin always satisfies.

## 4. Data layer

| Hook | What |
|---|---|
| `useMyEntries(memberId)` (existing, S2) | the member's entries; an admin passes another member's id and RLS allows it; kept as is |
| `useMemberStatuses(groupId, cycleId)` | `member_status` rows of the cycle: `member_id`, `defaulted`, `reason`, `changed_at` |

`useRefreshLedger` also invalidates `['member-statuses', groupId]`.

Pure helpers (`src/features/ledger/corrections.ts`, unit-tested):
- `isCorrectable(e)`: `source !== 'correction'`, a member-bound entry, kind in the correctable list above (not `payout_fee`).
- `isWaivable(e)`: `source !== 'correction'`, kind in `loan_interest`, `excess_charge`, `penalty`.
- `correctionsOf(entryId, entries)`: the corrections pointing at an entry, oldest first.
- `effectiveAmount(entry, entries)`: the rule in §2.
- `correctionLine(c)`: a correction as text with a sign: "+K 20 correction" / "−K 30 waived" / "−K 10 reduced", with its reason.

## 5. Screens

**Entry point.** A "Members" card on the Desk (always shown to admins) linking to `/desk/members`.

**`/desk/members`** (admin-only): the group's active members with a "Defaulted" badge where it applies; each row links to `/desk/members/:id`. Loading, error with retry and empty states.

**`/desk/members/:id`** (admin-only): the member's name as the heading; then
- **Default status** panel: "In good standing" or "Defaulted" with who, when and why, a one-line explanation of the effect, and an action: **Mark as defaulted** / **Reverse the default**. The action opens a sheet with a required reason and a two-tap confirm ("Tap again to mark Eve as defaulted").
- **Entries** by month, newest first (the S2 grouping, labels and tags). For each entry that is not a correction: its original amount; if it has corrections, the line "Now K 90" and each correction's line and reason underneath; and the buttons **Correct** (if correctable) and **Waive** (if waivable and still above zero). Entries that are neither get no buttons. Correction entries are shown nested under their original, not as rows of their own.
- A note when the cycle has no open month: "Open the next month to post corrections or waivers." and the buttons are disabled. Otherwise the note "Corrections land in {open month}; the original stays in its own month."

**Correct sheet**: shows the kind, the original and "Now K…"; field **New total** (kwacha, 2 dp, 0 allowed, blank not allowed); **Reason** (required, ≤ 500). Same as the current amount → "That is already the amount." (display check; the engine refuses it too). Two-tap: "Tap again to change K 250 to K 200".

**Waive sheet**: shows the kind and "Now K…"; field **Amount to waive** (> 0, at most what is still charged); **Reason**. Two-tap: "Tap again to waive K 50 of K 120".

All three posts use `useLedgerAction`, a button disabled while the request runs, and a sheet that cannot be closed while it runs (the S3a rule). Refusals through `friendlyError`.

## 6. Shared behaviour

Loading skeletons with labels, error with retry, 48px targets, tokens only, labelled sections, curly apostrophes, `money()` formatting, amounts typed through `parseKwacha`. Non-admins get the admin-only screen and make no requests.

## 7. Security

No new write path or grant; all three functions are admin-only and re-validate. Reasons are stored by the engine and audited. The member's entries are fetched only on an admin page.

## 8. Testing

- **pgTAP `19_correction_parity.sql`** (synthetic data): a penalty of 100; a waiver of 30; a correction to 90 (lands as a +20 penalty entry); a correction to 80 (lands as a 10 `adjustment`). The effective amount is now 80, proven by the engine itself: `post_correction(entry, 80)` is refused with `invalid_amount` (nothing changed), `post_waiver(entry, 81)` is refused, `post_waiver(entry, 80)` succeeds. Also: a correction of a correction is refused; `loan_sent` and `interest_share` are not correctable; a waiver on a saving is refused; a closed cycle with no open month refuses with `period_not_open`.
- **Vitest** with mocked hooks, following S1–S3b: `effectiveAmount` on the **same scenario** (100, waiver 30, +20, −10 → 80), `isCorrectable` / `isWaivable` for every kind, `correctionLine`; the members list; the member page (states, default panel, entries nested with corrections, buttons only where eligible, disabled without an open month); each sheet (validation, two-tap sends once with exact arguments, friendly refusals, cannot close while sending); the Desk card; the non-admin gate.
- Synthetic data only. Manual check on dev with a throwaway group: correct a payment, waive part of a penalty, mark and reverse a default, then confirm the entries, the member's Record and the audit log.

## 9. Success criteria

1. On dev an admin can correct an entry, waive part of a charge and mark and reverse a default, each with a reason, and the member's Record shows the correction.
2. The screen's "Now K…" equals what the engine accepts as current, proven by the shared scenario in pgTAP and Vitest.
3. Lint, typecheck, Vitest and pgTAP green.

## 10. Risks

| Risk | Mitigation |
|---|---|
| The screen's current amount drifts from the engine's | The shared 100 / −30 / +20 / −10 → 80 scenario in pgTAP and Vitest; the engine re-validates every post and refuses a no-op. |
| A wrong correction | Corrections are append-only and can themselves be corrected; every post needs a reason and a two-tap confirm that states the change. |
| A double tap posts twice | Two-tap confirm, disabled while running, sheet cannot close while running. |
| No open month | Buttons disabled with an explanation; the engine refuses anyway. |
| Payout-fee corrections unreachable | Stated as a non-goal; they need a group-level view (possible later). |
