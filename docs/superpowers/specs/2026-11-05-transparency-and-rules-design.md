# Member transparency and rules on the record

Date: 2026-11-05
Status: Draft for review
Builds on: `2026-10-10-ledger-engine-design.md` (ledger, statements, `can_see_figures`, audit log), `2026-10-12-corrections-defaults-design.md` (corrections, waivers, defaults), the Group report (`src/features/group`) and the Rules page (`src/features/rules`).

## 1. Intent

Members should be able to see and trust the group's money without waiting for the treasurer to explain it. The constitution asks for records "reviewed by all monthly" and the chat shows members questioning figures ("the math isn't mathing"), penalties waived for some and not others, a loan request cut from K50,000 to K30,000. Today a member sees only their own passbook and the Group page. Overrides, waivers and the rules the app applies are visible only to admins, or not recorded at all.

Two projects, one design because they share the Rules and monthly-report screens:

- **4. Transparency.** A monthly report every member can read, a "why is my figure this?" breakdown, a way to query a figure and get an answer on the record, and a log of every override with its reason.
- **5. Rules on the record.** The app applies rules the constitution does not state (K50 a day penalty, a minimum that carries all earlier shortfall, payment order, monthly excess charge). The group should ratify them with the constitution's two-thirds vote, and the app should show, for each rule, whether and when that happened.

## 2. Goals, non-goals, anti-goals

Goals
- Any member can see why their minimum, owed amount and interest are what they are.
- Any member can read, after each close, the group's position and every override made that month with its reason.
- A member can raise a question about a figure and see the reply; the treasurer has a queue.
- The Rules page says, per rule, "as written in the constitution", "applied by the app, not in the constitution" and "ratified on <date> by <n> of <m>".

Non-goals (separate projects or later)
- A second approver for closes and corrections, wallet-balance reconciliation, proof-of-payment uploads (projects 1 and 2).
- A trustee or chair role. Roles stay `member` and `admin`.
- Push notifications or email when a report is published or a query is answered.
- Editing constitution text, or recording amendments to the constitution itself.
- Showing anything to people who are not members of the group.

Anti-goals (a failure even if it works)
- Showing another member's figures when the group's visibility is `private`.
- Any way for an admin to edit or delete a published override entry, a ratification or an answered query.
- A member seeing the treasurer's workbook figures (they stay admin-only).

## 3. Decisions

Decided with the user (2026-11-05)
- Build both projects now, in this order: rules record (5) first because the report refers to it, then transparency (4).

My calls (marked so they can be changed)
- **Names follow the group's existing visibility setting.** Arrears and overrides show member names when `groups.figures_visibility = 'open'` and only totals and counts when `'private'`. The default group is `open`.
- **Overrides log is a derived view, not the raw audit log.** The audit log stays admin-only. Members read a function result that lists, per month: corrections, waivers, applied or waived penalties, loans approved over the cap (with the reason the treasurer gave), default changes and deadline extensions.
- **History before November has no override entries.** The 2026 import recorded none. The report says "not recorded before November 2026" for those months.
- **A query is private to the member and the admins.** Replies are not shown to the whole group.
- **The workbook comparison appears to members only as counts by reason code,** never as figures.

## 4. Rules on the record (project 5)

**Rule catalog.** A fixed list in code (`src/features/rules/ruleCatalog.ts`), one entry per rule the app applies, each with: a key, plain-language text, the constitution clause it comes from (or none), and a `basis`: `as_written`, `differs` (the app does something other than the text says) or `not_in_constitution`. Initial entries: saving minimum, loan interest, loan term bands, loan cap by month, no loans in the last month, excess charge, minimum payable, payment order, penalty basis (per day), membership fee, deadlines and extensions, default handling, payout and leftover pots. Which entries are `differs` or `not_in_constitution` follows `data/private/rules-from-sources.md`; the builder reads it for the wording but nothing from that file is copied into the repo.

**Table `rule_ratifications`** (append-only, trigger rejects UPDATE and DELETE, as `entries`):
`id`, `created_at`, `group_id`, `cycle_id`, `rule_key text`, `decided_on date`, `votes_for int`, `votes_total int`, `passed boolean` (set by the function: `votes_for * 3 >= votes_total * 2`), `meeting_ref text`, `note text`, `recorded_by uuid`. The current status of a rule is its latest row; earlier rows stay as history.

**Function `record_ratification(p_cycle, p_rule_key, p_decided_on, p_votes_for, p_votes_total, p_meeting_ref, p_note)`**: security definer, `search_path = public, pg_temp`, admin only, audited (`rule.ratified`), refuses `votes_for > votes_total`, `votes_total < 1`, a date in the future, an unknown or malformed key, a note over 500 characters. Execute revoked from `public` and `anon`.

**Reads.** Members select `rule_ratifications` for their group (`is_member`).

**Screen.** The Rules page gains a "How the app applies the rules" section listing the catalog: text, clause, the `basis` as a plain label, and the ratification status ("Ratified 14 Nov 2026, 15 of 18", "Not yet voted", "Voted, did not pass"). Admins get a "Record a vote" sheet per rule. A summary line at the top counts rules not yet ratified.

## 5. Transparency (project 4)

**Monthly report.** `month_report(p_period)` (security definer, any member of the group, a closed period only) returns one jsonb:
- the group statement (the existing `group_statements` figures);
- loans out: count and principal sent that month, count and principal still owed in total;
- arrears: members with a `next_minimum` unpaid, as a count and a total; the named list only when visibility is `open`;
- overrides for the month (section below);
- rules: how many of the catalog's rules were unratified at the close date (ratifications with `decided_on` on or before the close);
- workbook comparison: counts by reason code (admins and members alike), no figures.
It is shown on a new member page `/report/<month>` linked from the Group page and from the Passbook, newest month first.

**Overrides log.** `month_overrides(p_period)` returns, for one month, rows of `when`, `kind` (`correction`, `waiver`, `penalty_applied`, `penalty_waived`, `loan_over_cap`, `default_set`, `default_cleared`, `deadline_extended`), `member` (name or null by visibility), `amount`, `reason`. It reads `entries` with `source = 'correction'` and `kind = 'waiver'`, penalty entries, `loans.approved_reason`, and the audit rows `member.default_changed` and `period.deadline_changed` (`member_status` holds only the latest state, so it cannot give a per-month history). Members cannot read the audit table; only this function reads it for them. See section 11 for how each row is attributed to a month.

**Why this figure.** A statement line expands into its parts.
- `closing_owed` and the paid split already exist on the statement.
- `minimum_breakdown(p_member, p_period)` returns `{ instalments, excess, earlier_shortfall, capped_to_owed }` for months the app closed itself (the same three terms `close_month` adds). For imported months it returns `{ imported: true }` and the screen says "from the treasurer's workbook; not itemised".
- Access follows `can_see_figures`.

**Query a figure.** Table `figure_queries`: `id`, `group_id`, `period_id`, `member_id`, `field text` (one of `cum_savings`, `closing_owed`, `next_minimum`, `excess_charged`, `interest_earned_to_date`, `paid_total`), `note text` (1 to 500 characters), `status` (`open` or `answered`), `reply text`, `answered_by`, `answered_at`, `created_at`. Clients have no insert, update or delete; two functions write.
- `raise_query(p_period, p_field, p_note)`: a member about their own row, a closed month only, at most 3 open queries per member (`too_many_queries`), audited.
- `answer_query(p_query, p_reply)`: admin only, once (`already_answered`), audited. An answer is never edited; a follow-up is a new query.
Members select their own queries (`can_see_figures` and own row); admins select all. A "Questions" card on the Desk lists open ones.

## 6. Security and audit

- Every new table: RLS on, `revoke all … from public, anon, authenticated`, then only the select grants above. Writes only through the functions above.
- Every function: `security definer`, `set search_path = public, pg_temp`, checks the caller itself, validates inputs in SQL, `revoke execute … from public, anon`, grants to `authenticated`. The existing allowlist test (`02_rls`) must keep passing; it is updated for the new functions.
- Audit actions: `rule.ratified`, `query.raised`, `query.answered`. The report and the overrides log only read.
- Visibility rule applied in SQL (`groups.figures_visibility`), never in the client.
- No new secrets, no new environment variables.

## 7. Constraints

Money maths stays in SQL; the client formats and never recomputes a stored figure. 48px touch targets, design tokens only (`check:tokens`), the five screen states (loading, empty, error, success, partial) for every new screen. All text in plain English a member with no finance background can read.

## 8. Testing

- pgTAP, synthetic data only, in the ledger fixture's style: each function's refusals (non-admin, other group, planned or open month, bad input, limits), `private` versus `open` visibility on the report and overrides, immutability triggers, an answered query cannot be answered or edited, the two-thirds arithmetic at the boundaries (12 of 18 passes, 11 of 18 does not), imported months return the "not recorded" and "imported" forms.
- Vitest for the new pages and the catalog (every entry has a key, text and basis; no duplicate keys).
- Local rehearsal: apply the migration to the local stack, open November, close a copy, and read the report as a member and as an admin.

## 9. Left to the builder

Table and function names beyond those given; column types not stated; the page layout; copy wording within the plain-English constraint; whether the report is one RPC or several; the order of work inside each project.

## 10. Rollout

One migration file per project, additive only (new tables and functions; nothing existing is altered). Deployed by the existing gated `Deploy database` workflow after CI is green. The Rules page can ship before the report. Voting records start empty: the treasurer enters the group's votes as they happen.

## 11. Calls settled after the builder check

A fresh reader of this document asked the questions below. Each is answered here; these are my calls, not the user's, and any of them can be changed.

1. **Default history** comes from the `member.default_changed` audit rows. `member_status` is only the current state.
2. **Penalties.** `penalty_applied` is a penalty `entries` row (written by `apply_penalty`). `penalty_waived` is a `waiver` entry that points at a penalty entry. A suggested penalty the treasurer simply did not apply is not recorded anywhere today, so it does not appear; recording it would change existing code and is outside this rollout.
3. **Which month an override belongs to:** the month it was recorded in (the entry's `period_id`; for audit rows, the month whose dates contain the row's date). A correction that targets an older month's entry shows in the month it was made, with the original month named in the reason text. `amount` is null for `deadline_extended` and `default_*`; for `loan_over_cap` it is the loan's principal.
4. **"Not recorded" and "imported"** are decided by the period's data, not by a date: a period with any statement or entry whose `source = 'import'` is an imported month. That applies to the override section and to `minimum_breakdown`.
5. **Who can read and ask.** Any person who is a member of the group (`is_member`) can read a report, whatever that member's status or default flag. Only an active member can raise a query, on their own row. **Arrears** means `statements.unpaid_minimum > 0` at the close, which is last month's minimum minus what was paid.
6. **The rule keys** are validated in SQL by shape only (lowercase letters and underscores, 3 to 40 characters), not by a list, so the database and `ruleCatalog.ts` cannot drift. `month_report` returns how many distinct rules had a passing ratification by the close date; the client subtracts that from the size of the catalog. A vitest checks that every catalog key matches the shape and none repeats.
7. **A ratification belongs to one cycle.** The current status of a rule is its latest row for that cycle by `created_at`, and a later row replaces an earlier one whether it passed or not (a vote that failed after one that passed means the rule is not ratified). A new cycle starts with no votes; the Rules page shows "Ratified in the previous cycle" as information, and the treasurer records the new vote.
8. **Private visibility.** A member always sees their own breakdown and their own queries (`can_see_figures` allows own rows). Other members' rows follow the group's visibility setting, in the report and everywhere else.
9. **Pages.** Reports live at `/report/<year>-<month>` (for example `/report/2026-11`) and map to the period by its label. The Desk's "Questions" card shows only when there is at least one open query.
