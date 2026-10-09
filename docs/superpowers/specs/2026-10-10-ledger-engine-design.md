# Premium Village Bank — Sub-project 2a: Ledger engine and 2026 import

Date: 2026-10-10
Status: Draft for review
Builds on: `2026-10-08-foundation-design.md` (groups, members, cycles, `cycle_rules`, RLS, `can_see_figures`, audit log).

## 1. Context and goal

The group will rehearse the platform live for the rest of the current cycle. From the November 2026 declaration window (5–7 Nov) all 18 members declare in the app while the treasurer's Excel workbook keeps running in parallel. Each month the app's statements are compared with the workbook's; when they agree (or every difference is explained), the app is trusted for the February 2027 cycle.

The rehearsal needs three pieces, each with its own spec → plan → build:

| # | Piece | Target |
|---|---|---|
| 2a | **Ledger engine and 2026 import** (this spec) | ~18 Oct 2026 |
| 2b | Treasurer desk: approve/return declarations, loan queue and disbursement, close month, reminders, Excel export | ~28 Oct 2026 |
| 2c | Member screens: passbook, record, declare, plan with real figures | ~4 Nov 2026 |

If 2b or 2c slips, November runs treasurer-only (the treasurer enters WhatsApp declarations) and members join in December.

**Goal of 2a:** money tables, one month-close function, corrections, default handling and an import of Feb–Oct 2026 from the workbooks, proven correct by database tests and by a comparison against the real workbooks — with one small admin "check" page and no other UI.

## 2. Sources

- Treasurer workbooks Feb–Sep 2026 (October to follow), constitution 2025, group chat export — all in `data/content/` (git-ignored; the repo is public).
- Analyses derived from them, also git-ignored: `data/private/workbook-model.md` (how every sheet column is calculated, verified month by month) and `data/private/rules-from-sources.md` (constitution clauses, chat decisions, conflicts).

No member figures, names beyond those already in the Foundation seed, or phone numbers appear in this spec, in tests, or anywhere committed.

## 3. Rules (decided 2026-10-09)

The app applies the rules cleanly and explains each month's differences from the workbook; the treasurer can override any computed figure with a recorded reason.

| Topic | Rule |
|---|---|
| Amounts | Kept to the ngwee (2 dp, `numeric(12,2)`). Members pay what they pay; differences carry forward. No rounding, no write-offs. |
| Saving | Minimum K250 a month, no maximum. |
| Window | Declarations due by the month's deadline: the 7th by default, stored per month so extensions (e.g. 10 July) are recorded. |
| Penalties | The app *suggests*; the treasurer applies or waives with a reason. Grounds: late declaration (suggested K50 × days after the deadline), missed minimum, saving under K250, or any other reason in writing. Penalties collected join the interest pool. |
| Membership | K50 per member, due in Feb, May, Aug, Nov. Paid into a separate **meeting pot** (not lending cash, not interest). |
| Transaction fees | Members declare their mobile-money fee with each payment. Declared fees build a **fee pot**; transfer fees for sending loans are paid from the fee pot, not from lending cash. |
| Loan interest | 15% of principal, charged once when the loan is sent. Never compounds. A waiver (zero or reduced interest) is a correction with a reason. |
| Loan term | Each loan has its own schedule from its size: ≤ K3,000 → 1 month; ≤ K5,000 → 2; < K10,000 → 3; otherwise 4 (K10,000 is 4 months). A late-cycle loan's term is shortened so the last instalment falls by January; anything unpaid at payout is taken from the borrower's payout. Equal instalments of (principal + interest) ÷ months, the last absorbing the ngwee remainder. |
| Loan cap | Total still owed on loans + the new loan ≤ multiple × cumulative savings including this month's saving. Multiple by cycle month: 3× (months 1–4, Feb–May), 2× (5–9, Jun–Oct), 1× (10–11, Nov–Dec), 0 (month 12, Jan: no new loans). Over the cap the app **warns**; the treasurer may approve with a reason. |
| Arrears | A member who owes from earlier months may still borrow; the app warns. |
| Loans out | Any day, first come first served, only from lending cash on hand. A loan belongs to the month it is sent. |
| Excess interest | 10% a month of idle lending cash, billed to every member (including members in arrears) by share of cumulative savings including this month's deposit. |
| Minimum payable | Next month's instalments on every open loan + this month's excess charge + any earlier unpaid minimum, in full. |
| Payment order | Each payment clears excess → penalties → loan interest → loan principal, oldest loan first; any surplus reduces principal early (oldest first). |
| Interest earned | Interest actually collected in a month (loan interest, excess and penalties applied from payments) is shared by each member's cumulative savings that month. Booked monthly as "earned to date"; paid at payout. |
| Default | The treasurer marks a member defaulted (reason, audited). A defaulted member earns no further interest share (their share goes to the others); at payout their outstanding debt is deducted from their savings. Can be reversed by the treasurer with a reason. |
| Payout | Each member receives savings + interest earned − anything still owed. Whatever remains in the meeting pot and the fee pot is shared equally among all members. |
| Wallets | Every receipt and every loan sent records the wallet used (Airtel, MTN, or a temporary one). |
| History | Feb–Oct 2026 imported from the workbooks as the official record. The app's own rules apply from November 2026. |

Governance note (not enforced by the app): the per-day penalty, full-shortfall minimum and payment order differ from the constitution's text or practice; Article 11 requires a written two-thirds vote to amend it. The group should hold that vote before members see the app apply these rules.

## 4. Data model

All tables: `id uuid` PK, `group_id`, `created_at`; RLS enabled; `revoke all … from public, anon, authenticated`, then explicit grants (Foundation pattern). Clients have **no insert/update/delete** on any table here; every write goes through the functions in §6.

```sql
wallets (
  group_id, name text,                      -- 'Airtel', 'MTN', 'Temporary (Aug)'
  holder_member_id uuid null,               -- whose phone holds it
  active boolean default true
)

periods (                                    -- one per month of a cycle
  cycle_id, month_index int,                -- 1 = Feb 2026 … 12 = Jan 2027
  label text,                               -- 'Nov 2026'
  starts_on date, deadline date,            -- deadline defaults to the 7th
  status text check (status in ('open','closing','closed')),
  closed_at timestamptz, closed_by uuid,
  unique (cycle_id, month_index)
)

declarations (                               -- what a member says they are sending
  period_id, member_id,
  saving, loan_repayment, excess, membership, penalty, txn_fee numeric(12,2),
  borrowing_request numeric(12,2),
  wallet_id, note text,
  status text check (status in ('submitted','approved','returned')),
  submitted_at, submitted_by, decided_at, decided_by, return_reason text,
  supersedes_id uuid null                   -- a resubmission replaces, never edits
)

entries (                                    -- the ledger; append-only
  period_id, member_id uuid null,           -- null = group-level (pot movement)
  kind text,                                -- see list below
  amount numeric(12,2),                     -- always positive; kind gives direction
  loan_id uuid null, wallet_id uuid null,
  source text check (source in ('import','app','close','correction')),
  declaration_id uuid null,
  corrects_entry_id uuid null, reason text null,
  created_by uuid
)

loans (
  member_id, period_id,                     -- month sent
  principal, interest numeric(12,2),        -- interest = 15% unless corrected
  term_months int, sent_at timestamptz, wallet_id,
  cap_warning text null, arrears_warning text null, approved_reason text null,
  status text check (status in ('open','repaid','written_against_payout'))
)
loan_instalments (loan_id, period_id, amount_due numeric(12,2))

member_status (member_id, cycle_id, defaulted boolean, changed_at, changed_by, reason)

statements (                                 -- written by month close, one per member per period
  period_id, member_id,
  opening_owed, saving, cum_savings,
  loan_principal_sent, loan_interest_charged, excess_charged, penalties_charged,
  paid_total, paid_to_excess, paid_to_penalties, paid_to_interest, paid_to_principal,
  closing_owed, next_minimum, unpaid_minimum,
  interest_earned, interest_earned_to_date,
  source text check (source in ('import','close'))
)

group_statements (
  period_id,
  opening_cash, received, savings, loans_sent, idle_cash,
  excess_rate, excess_billed, interest_collected,
  fee_pot_in, fee_pot_out, fee_pot_balance,
  meeting_pot_in, meeting_pot_balance,
  total_savings, total_owed,
  source text
)

workbook_figures (                           -- imported values, kept for comparison only
  period_id, member_id uuid null, field text, value numeric(12,2),
  unique (period_id, member_id, field)
)
```

Entry kinds: `saving`, `payment` (money received against what is owed), `membership`, `txn_fee`, `loan_sent`, `loan_interest`, `excess_charge`, `penalty`, `interest_share`, `payout_fee` (fee pot → payout), `waiver` (reduces a charge), `adjustment` (any other corrected amount). A correction is a new entry with `source='correction'`, `corrects_entry_id`, and a non-empty `reason`.

`entries`, `statements`, `group_statements` and `workbook_figures` are immutable: a trigger rejects UPDATE and DELETE (the import's own re-run, §7, deletes only its own `source='import'` rows inside its transaction, before November opens).

## 5. Month close

`close_month(p_period uuid, p_commit boolean default false) returns jsonb` — `security definer`, `search_path = public, pg_temp`, admins only (`is_admin` on the cycle's group), audited. `p_commit = false` is a **preview**: it computes everything and returns it without writing. `p_commit = true` writes and sets the period `closed`. Preconditions: the previous period is closed; no `submitted` declarations remain for the period (approve or return them first).

Steps, in order:

1. **Inputs.** Approved declarations → entries (`saving`, `payment`, `membership`, `txn_fee`, each with wallet, `source='app'`) are written at approval time by the desk (2b); close reads them with the month's `loan_sent`, `loan_interest`, `penalty`, corrections and waivers.
2. **Cash.**
   `opening_cash = previous idle_cash + payments received this period` (payments for the previous statement arrive in this month's window, as in the workbook);
   `idle_cash = opening_cash + savings this period − loans sent this period`.
   Fee pot: `+ txn_fee entries − payout_fee entries`. Meeting pot: `+ membership entries`. Neither touches lending cash.
3. **Charges.**
   Loan interest is charged when a loan is sent (entry at send time).
   `excess_billed = round(0.10 × idle_cash, 2)`, split across **all** members by `cum_savings / Σ cum_savings` (cumulative including this month); the ngwee remainder from splitting goes to the largest share so the parts sum exactly.
   Instalments due this period come from `loan_instalments`.
4. **Apply payments** per member, in order excess → penalties → interest → principal (oldest loan first), then early principal. Record the split on the statement.
5. **Interest earned.** `interest_collected` = payment amounts applied to excess, penalties and loan interest this period. Share it by `cum_savings` among members not defaulted; ngwee remainder to the largest share. Write `interest_share` entries.
6. **Statements.** For each member: opening owed, charges, payment split, `closing_owed = opening_owed + charges − paid_total`, `unpaid_minimum = max(0, previous next_minimum − paid_total)`, `next_minimum = next period's instalments + this period's excess_charged + unpaid_minimum` (capped at `closing_owed`). Then the group statement.
7. **Check.** If `workbook_figures` exist for the period, return a diff list `{member, field, app, workbook, difference, reason_code}`; reason codes come from a fixed list (`workbook_rounded`, `workbook_missed_loan`, `workbook_term_differs`, `waiver`, `penalty_not_charged`, `fee_pot_vs_cash`, `unexplained`). Committing a close with `unexplained` differences requires a reason.

Corrections after a period closes go into the **current open period** as entries pointing back at the original; balances fix forward and closed history is never rewritten.

Determinism: the same inputs always produce the same statements; preview and commit share one code path.

## 6. Functions (the only write paths)

All `security definer`, `search_path = public, pg_temp`, admin-only unless stated, audited (`audit_log` actions in parentheses), errors as P0001 business codes mapped by `friendlyError`.

| Function | Purpose |
|---|---|
| `open_period(cycle, month_index, deadline)` (`period.opened`) | Create/open the next month. |
| `set_deadline(period, date, reason)` (`period.deadline_changed`) | Record an extension. |
| `submit_declaration(...)` (member, own row only) / `return_declaration` / `approve_declaration` — **defined here, screens in 2b/2c** | Approval writes the received entries. |
| `send_loan(member, principal, wallet, reason?)` (`loan.sent`) | Computes term (shortened by January), instalments, 15% interest entry; records cap/arrears warnings; requires a reason when over the cap. Refuses in month 12 (`loans_closed`) and when lending cash is short (`insufficient_cash`). |
| `apply_penalty(member, period, amount, ground, reason)` (`penalty.applied`) | Suggested amounts come from `suggest_penalties(period)` (read-only). |
| `post_correction(entry, new_amount, reason)` / `post_waiver(...)` (`entry.corrected`) | Append-only correction. |
| `set_default(member, cycle, defaulted, reason)` (`member.default_changed`) | Mark/unmark a defaulter. |
| `close_month(period, commit)` (`period.closed`) | §5. |
| `payout_preview(cycle)` (read-only) | Savings + interest − owed per member, pots shared equally — for the February payout and for members' projections. |

New business codes: `period_not_open`, `previous_period_open`, `declarations_pending`, `loans_closed`, `insufficient_cash`, `over_cap_needs_reason`, `reason_required`, `entry_not_found`, `already_closed`, `unexplained_differences`.

## 7. 2026 import

`bun run ledger:import -- --target <ref> [--through Oct] [--write]` — a local script (never in CI) that reads the workbooks in `data/content/`.

- Creates **Cycle 2026** (`starts_on` 2026-02-15, `ends_on` 2027-02-15, `payout_on` 2027-02-06, status `active`) on the existing Premium VB group with its `cycle_rules`, and periods for Feb 2026 – Jan 2027 (deadlines from the chat: 17 Feb, 8 May, 8 Jun, 10 Jul, 9 Aug; otherwise the 7th).
- Matches workbook rows to members by short name; refuses to run if any name doesn't match.
- For each imported month writes, with `source='import'`: entries (savings, receipts, membership, fees, loans sent with interest as the workbook charged it, penalties), the workbook's statements and group statements as the official record, and `workbook_figures` for every compared field.
- Rebuilds every loan still owed at the last imported month as a `loans` row with its remaining `loan_instalments` under §3's rules, so November starts from correct schedules.
- Marks imported periods `closed`. November opens from October's closing balances.
- Default is a **dry run** printing a summary (counts and totals only). `--write` requires the target project ref to be named explicitly. It runs in one transaction and is re-runnable (it deletes only its own `source='import'` rows for the cycle) until the November period opens; after that it refuses (`already_opened`).
- Reads the workbooks with a maintained xlsx reader added as a **dev dependency**; it never runs in the browser bundle.

`bun run ledger:check` — local-only: replays the imported months through `close_month` previews and prints the per-month difference summary against `workbook_figures` (counts and reason codes; member-level detail goes to a file under `data/private/`).

## 8. Admin check page

Route `/desk/ledger-check` (admins only; non-admins get the existing "This page is for admins" screen). For each period: status, the group statement (cash, idle, excess billed, interest collected, pots), and the difference list from §5 step 7 grouped by reason code, member by member, with app vs workbook values. Loading/error/empty states, 48px targets, tokens only — the Foundation UI rules apply. This is the only UI in 2a.

## 9. Security

- RLS: `statements`, `entries`, `loans`, `loan_instalments`, `member_status`, `declarations` select via `can_see_figures(group_id, member_id)`; `group_statements`, `periods`, `wallets` select via `is_member(group_id)`; `workbook_figures` select via `is_admin(group_id)`.
- No client write grants on any table in §4. Every function in §6 checks the caller and the group itself, re-validates inputs in SQL, and revokes execute from `public, anon` (the 02_rls allowlist test must keep passing; `submit_declaration` is granted to `authenticated` and checks the caller owns the member row).
- Money maths only in SQL. The client never computes a figure that is stored.
- The import connects with the database URL and refuses the production project unless `--target` names it; `db:reset`/`db:test` guards stay as they are.

## 10. Testing

- **pgTAP, synthetic data only.** A made-up 18-member group whose Feb–Oct months reproduce every pattern found in the workbooks: minimum-only payers, full payers, partial payers, nil payers, split loans, a loan to a member already owing, a zero-interest (waived) loan, penalties, membership months, a late-cycle loan shortened to January, a default, fee-pot payout fees, ngwee remainders. Expected values are worked out independently in the test file (hand-checked), not by calling the function under test.
- One test per rule in §3, per function in §6 (including refusals and their codes), per policy in §9 for anon, outsider, member, admin and owner; immutability triggers; preview = commit; determinism (same inputs twice → identical statements); `previous_period_open`, `declarations_pending`, over-cap with and without reason, month 12 refusal.
- **Workbook fidelity (local only):** `ledger:check` against the real workbooks must show, for every imported month, zero `unexplained` differences. Its output never leaves `data/private/`.
- Vitest for the check page (states, admin gate) and for the import script's parsing (on a synthetic workbook fixture generated in the test).

## 11. Out of scope (later pieces)

Declaration screens and the approval desk (2b), passbook/record/declare/plan screens (2c), reminders, Excel export, proof-of-payment uploads, notifications, payment-provider integrations, the Feb 2027 cycle setup (uses the same tables).

## 12. Success criteria

1. All pgTAP and Vitest suites green in CI (local stack).
2. `ledger:check` on the real Feb–Sep workbooks (then October) reports no `unexplained` differences.
3. The hosted project holds Cycle 2026 with Feb–Oct imported, every open loan rebuilt, and November ready to open.
4. An admin can preview and commit a month close on a copy of November's inputs, post a correction and a waiver, and mark a default — each audited.
5. A member signed in sees only what `can_see_figures` allows; no client role can write any ledger table.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Workbook practice differs from the clean rules (hand-typed minimums, merged schedules) | Imported months stay official; differences are explained with reason codes; the app's rules start in November. |
| October workbook arrives late | Import Feb–Sep first; October is a re-run of the import before November opens. |
| Rules not ratified by the group | Governance note in §3; the app records overrides with reasons either way. |
| Real member data leaking into the public repo | Sources and derived notes live only in git-ignored folders; tests use synthetic data; import/check output stays in `data/private/`. |
| Month-close bugs on live money | Preview before commit; closed months immutable; corrections forward-only; the workbook runs in parallel through January. |
