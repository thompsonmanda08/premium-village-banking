# Known limits of the ledger engine

Things that are deliberately left as they are, why, and what would change that. Each one was reviewed; none moves money
wrongly. Update this file when a limit is removed or a new one is accepted.

## Accepted

| Limit | Why it is acceptable | What would change it |
|---|---|---|
| About ten admin functions look the row up before checking the caller, so a signed-in user can tell whether a random UUID exists (a missing id answers `*_not_found`, another group's id answers `not_admin`). Nothing about the row is revealed. | Ids are random UUIDs, existence is the only leak, and answering `not_admin` for a stale id would tell a real admin the wrong thing. | A requirement that ids are secret, or a client that enumerates ids. Use `open_period`'s pattern (`not found or not is_admin` gives `not_admin`). |
| `loans.status` is not reliable (a minimum payer leaves one month's excess on the loan; waived interest that was already paid is not carried to principal; a repaid loan is not reopened). | Nothing reads it. Debts come from statements and ledger lines, and payout uses `member_balance`. | Anything that wants to show "repaid" in the UI must compute it from statements first. |
| Interest already shared is not taken back when a payment or interest is corrected afterwards. | Closing balances stay right; it is a group rule, not a code defect. | A written rule from the group (Article 11 vote). |
| A month whose interest has no eligible saver leaves the interest in idle cash. | Cannot happen with real data (someone always saves). | None needed. |
| A figure of 10 000 000 000 or more stops a close with a raw overflow error. | The table checks already refuse such amounts at the door. | None needed. |
| The import accepts a month with `rows: []` at SQL level. | The workbook parser refuses a statement sheet with no member rows, and the import is run by the owner only. | Add a SQL check when a second import path exists. |
| Pot shares go to members who left but have entries this cycle, and to active members with no entries. | Same member set as `close_figures`; the constitution is silent. | A group decision on leavers. |
| `service_role` and the table owner can still alter ledger tables outside the app; the app roles cannot. | Needed for migrations and the import. | None. |
| The reconciliation in `ledger:check` counts pots up to the latest closed month; `payout_preview` also counts an open month's entries. | They match by construction once the month is closed. | None. |

| After a member raises a question on an imported month, `ledger:import` cannot re-run: the import deletes periods, and `figure_queries` rows are append-only and cascade from periods. | Imports are a one-off; the group's own questions must not vanish. | Load a reissued workbook as `ledger:figures` comparison figures or as corrections instead. |
| A free-text reason on a deadline extension is visible to every member even in a private group (it has no member attached). | The treasurer controls the text. | Reasons there must not name members; or attach a member to extensions. |
| `minimum_breakdown` replays the whole group's close on each call and raises `statement_drifted` if a closed month's stored minimum no longer matches the replay. | Fine for 18 members; the drift error is deliberate. | Do not call it per row in a list; cache the replay if groups grow. |
| A vote recorded after a month closes never changes that month's "rules ratified" count (it counts votes decided on or before the close date, in Lusaka time, and recorded before the close moment). | A closed month is a record; it should not move. | A decision to restate closed months. |
| A report's override list for a month closed before its calendar month ends can still receive a default change or deadline change made later in that calendar month. | Rare, and the later change is real. | Stamp overrides with the close time. |
| The three-open-queries cap and the answer-once rule rely on row locks and have no concurrent test. | Logic is covered serially; 18 members rarely collide. | A concurrent pgTAP or load test. |
| A vote recorded on a planned cycle makes deleting that cycle fail with `append_only` (votes cascade from the cycle and are append-only). | No screen deletes a cycle today. | Adding a delete-cycle screen: it must refuse or explain this first. |
| The rule catalog text hard-codes November 2026, 6 February 2027 and kwacha amounts, and votes from a previous cycle are not shown as "ratified last cycle" yet. | Correct for the 2026 cycle. | The February 2027 cycle starts: review `ruleCatalog.ts` and show earlier votes. |
| `deadline_extended` rows in a month's report give only the reason, not the month or the new date. | The reason is what the group asked for; the date is in the Desk. | Members ask for the new date in the report. |

## Fixed on purpose by process, not by code

- A deploy to production needs green CI on the same commit (`ci-gate` in `.github/workflows/db-deploy.yml`) and then the
  reviewer's approval on the `production` environment. Running the workflow by hand skips the CI gate; use that only for an
  emergency.
- Sessions, transcripts and generated review output must never be committed: `docs/context.md` and `semantic-review/` are
  ignored. If real member data lands in git again, make the repository private first, then clean it.
