# Desk loans and penalties (S3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the treasurer act on borrowing requests (send a loan after seeing cash, cap and arrears) and apply the engine's suggested penalties, from the Desk.

**Architecture:** One new read-only SQL function (`loan_check`, migration 2200) mirrors `send_loan`'s checks so the screen never computes money; `send_loan` is untouched and a pgTAP test pins the two together. The UI adds hooks to `src/features/ledger/queries.ts`, pure helpers in `deskMoney.ts`, a `SelectField` primitive, two sheets (`SendLoanSheet`, `ApplyPenaltySheet`) and two Desk sections (`LoansSection`, `PenaltiesSection`) wired into `DeskPage`. Every money action is a two-tap confirm and a disabled-while-pending button.

**Tech Stack:** Postgres/pgTAP (`bun run db:test`), React 19, TanStack Query, supabase-js, Tailwind tokens from `src/ui`, Vitest + Testing Library, eslint, `tsc`.

**Spec:** `docs/superpowers/specs/2026-10-11-desk-loans-penalties-design.md` (builds on the ledger-engine spec §3, §6 and the S1 spec).

## Global Constraints

- Migration number **`20261010002200`**. Before writing it run `git fetch origin && git ls-tree --name-only origin/main supabase/migrations/ | tail -3`: if 2200 is taken, use the next free number and rename the test's reference only.
- **Never run `bun run db:push`**; the user applies migrations. Verify SQL inside a rolled-back transaction with the runner in Task 1 (it never commits).
- `send_loan` and every existing function stay untouched. `loan_check` is `stable`, `security definer`, `set search_path = public, pg_temp`, admin-only, `revoke ... from public, anon, authenticated; grant execute ... to authenticated`.
- Money maths only in SQL. The client sends what was typed and shows what comes back. Amounts are typed with `parseKwacha` (no commas, ≤ 2 decimals); sums use `sumKwacha`.
- Money actions (send loan, apply penalty) use `useConfirmTap` (second tap sends) and a button disabled while the request runs: the database has no idempotency.
- Every section has loading (labelled), error-with-retry and empty states; 48px targets (`Button`/`TextField`/`SelectField` already are); tokens only; labelled sections; curly apostrophes `’`. Server errors go through `friendlyError` (all codes used here already have messages).
- Tests: synthetic data only. Find loading text with `getByText` (the toast region has `role="status"`). Mock `@/features/ledger/useDebouncedValue` to the identity in component tests.
- Commits: subject + body, **no `Co-Authored-By` trailer**. Never `git push`, never `git add -A`, never stage anything under `docs/` or `semantic-review/`.

## Review Focus

- A double tap on Send loan or Apply sends one request (two-tap confirm + disabled while pending). (Tasks 4, 6.)
- Send stays disabled until the preview has answered for exactly the amount typed; a stale preview never enables it. (Task 4.)
- `1,000`, `250.555`, `-5`, `1e3` in the amount: no check request, no send, a message. (Task 4.)
- Over the cap: reason required; under the cap the reason is optional but is sent when typed. (Task 4.)
- `loan_check` agrees with `send_loan` on over-cap, insufficient cash, interest, term and the arrears text. (Task 1 pgTAP.)
- A suggestion already applied this month, or dismissed, is not shown; "Add a penalty" works for a member with no suggestion. (Tasks 2, 6.)
- A member who has left is not offered in either member select, and `loan_check` refuses them. (Tasks 1, 4, 6.)
- A non-admin never sees these sections or reaches `loan_check`. (Tasks 1, 7.)

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261010002200_loan_check.sql` | `public.loan_check` |
| `supabase/tests/database/18_loan_check.sql` | pgTAP for it, including agreement with `send_loan` |
| `src/lib/database.types.ts` | + `loan_check` signature (modified) |
| `src/ui/SelectField.tsx`, `src/ui/index.ts` | Labelled native select (new, export added) |
| `src/features/ledger/useDebouncedValue.ts` | 300 ms debounce hook |
| `src/features/ledger/deskMoney.ts` | `loanRequests`, `GROUNDS`, `groundLabel`, `appliedGrounds`, `openSuggestions`, `splitReason`, types |
| `src/features/ledger/queries.ts` | + `useLoanCheck`, `useMonthLoans`, `useSuggestedPenalties`, `useMonthPenalties`; refresh keys extended (modified) |
| `src/features/desk/SendLoanSheet.tsx` | The send-loan sheet with the "Before you send" preview |
| `src/features/desk/LoansSection.tsx` | Requests, send button, loans sent this month |
| `src/features/desk/ApplyPenaltySheet.tsx` | Apply a suggested penalty / add one |
| `src/features/desk/PenaltiesSection.tsx` | Suggestions, applied list |
| `src/features/desk/DeskPage.tsx` (+ test) | Wire the sections in (modified) |

---

### Task 1: `loan_check` migration, types and pgTAP

**Files:**
- Create: `supabase/migrations/20261010002200_loan_check.sql`, `supabase/tests/database/18_loan_check.sql`
- Modify: `src/lib/database.types.ts`

**Interfaces:**
- Produces `public.loan_check(p_member uuid, p_principal numeric default null) returns jsonb` with keys: `period_id`, `label`, `month_index`, `loans_open`, `lending_cash`, `multiple`, `cum_savings`, `loans_owed`, `cap`, `headroom`, `arrears` (text or null) and, only when `p_principal` is given: `principal`, `interest`, `term_months` (null when loans are closed), `over_cap`, `insufficient_cash`. Refusals: `member_not_found`, `not_admin` (42501), `member_not_active`, `invalid_amount`, `period_not_open`.
- Types file gains `loan_check` (Args `{ p_member: string; p_principal?: number }`, Returns `Json`).

- [ ] **Step 1: Write the failing pgTAP test**

`supabase/tests/database/18_loan_check.sql`:

```sql
begin;
select * from no_plan();
select tests.ledger_fixture();

-- privileges ---------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.loan_check(uuid, numeric)', 'EXECUTE'), 'anon has no execute on loan_check');
select ok(has_function_privilege('authenticated', 'public.loan_check(uuid, numeric)', 'EXECUTE'),
  'signed-in users may call it (the function checks for an admin)');

-- before any month is open ---------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select throws_ok($$select loan_check(tests.lm('Dee'))$$, 'P0001', 'period_not_open', 'no preview before a month is open');
select lives_ok($$select open_period(tests.id('lcycle'), 1)$$, 'February opens');
reset role;
select tests.ledger_feb_savings();   -- 7,300 saved: that is all the lending cash in the first month

-- who may ask --------------------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select loan_check(tests.lm('Dee'))$$, '42501', 'not_admin', 'members cannot ask');
reset role;
select tests.login_as(tests.id('outsider'));
select throws_ok($$select loan_check(tests.lm('Dee'))$$, '42501', 'not_admin', 'outsiders cannot ask');
reset role;
select tests.login_as(tests.id('owner2'));
select throws_ok($$select loan_check(tests.lm('Dee'))$$, '42501', 'not_admin', 'nor another group''s admin');
reset role;
select tests.login_anon();
select throws_ok($$select loan_check(tests.lm('Dee'))$$, '42501', 'permission denied for function loan_check', 'anon cannot call it');
reset role;

-- refusals -----------------------------------------------------------------------------------
select tests.login_as(tests.id('admin'));
select throws_ok($$select loan_check(gen_random_uuid())$$, 'P0001', 'member_not_found', 'unknown member');
select throws_ok($$select loan_check(tests.lm('Dee'), 0)$$, 'P0001', 'invalid_amount', 'no zero loans');
select throws_ok($$select loan_check(tests.lm('Dee'), -5)$$, 'P0001', 'invalid_amount', 'no negative loans');
select throws_ok($$select loan_check(tests.lm('Dee'), 100.005)$$, 'P0001', 'invalid_amount', 'to the ngwee only');
select throws_ok($$select loan_check(tests.lm('Dee'), 'NaN'::numeric)$$, 'P0001', 'invalid_amount', 'NaN is not an amount');
select throws_ok($$select loan_check(tests.lm('Dee'), 'Infinity'::numeric)$$, 'P0001', 'invalid_amount', 'nor is Infinity');
select throws_ok($$select loan_check(tests.lm('Dee'), 10000000000)$$, 'P0001', 'invalid_amount', 'an amount past the column is refused with a code');
reset role;
update members set status = 'left' where id = tests.lm('Zed');
select tests.login_as(tests.id('admin'));
select throws_ok($$select loan_check(tests.lm('Zed'))$$, 'P0001', 'member_not_active', 'a member who left cannot borrow');
reset role;

-- the figures (month 1: multiple 3; Dee saved 250, so her cap is 750) ----------------------------
select tests.login_as(tests.id('admin'));
select is(loan_check(tests.lm('Dee')) ->> 'label', 'Feb 2026', 'it names the open month');
select is((loan_check(tests.lm('Dee')) ->> 'lending_cash')::numeric, 7300::numeric, 'lending cash is everything saved so far');
select is((loan_check(tests.lm('Dee')) ->> 'multiple')::numeric, 3::numeric, 'the month''s multiple');
select is((loan_check(tests.lm('Dee')) ->> 'cum_savings')::numeric, 250::numeric, 'her savings');
select is((loan_check(tests.lm('Dee')) ->> 'loans_owed')::numeric, 0::numeric, 'she owes nothing on loans');
select is((loan_check(tests.lm('Dee')) ->> 'cap')::numeric, 750::numeric, 'cap = 3 x 250');
select is((loan_check(tests.lm('Dee')) ->> 'headroom')::numeric, 750::numeric, 'headroom = cap - owed');
select ok((loan_check(tests.lm('Dee')) ->> 'loans_open')::boolean, 'loans are open in February');
select ok(loan_check(tests.lm('Dee')) -> 'arrears' = 'null'::jsonb, 'no arrears in the first month');
select ok(not (loan_check(tests.lm('Dee')) ? 'principal'), 'without an amount there is nothing about an amount');

-- with an amount: interest 15%, 1-month band up to 3,000 ---------------------------------------------
select is((loan_check(tests.lm('Dee'), 500) ->> 'interest')::numeric, 75::numeric, 'interest is 15% of the principal');
select is((loan_check(tests.lm('Dee'), 500) ->> 'term_months')::int, 1, 'K500 is the one-month band');
select is((loan_check(tests.lm('Dee'), 3001) ->> 'term_months')::int, 2, 'K3,001 is the two-month band');
select ok(not (loan_check(tests.lm('Dee'), 500) ->> 'over_cap')::boolean, 'K500 is inside her cap of 750');
select ok((loan_check(tests.lm('Dee'), 800) ->> 'over_cap')::boolean, 'K800 is over her cap of 750');
select ok(not (loan_check(tests.lm('Cid'), 6000) ->> 'over_cap')::boolean, 'Cid''s cap is 3 x 2,000 = 6,000, so 6,000 is inside it');
select ok((loan_check(tests.lm('Cid'), 7301) ->> 'insufficient_cash')::boolean, 'K7,301 is more than the K7,300 on hand');
select ok(not (loan_check(tests.lm('Cid'), 7300) ->> 'insufficient_cash')::boolean, 'K7,300 is exactly what is on hand');
reset role;

-- agreement with send_loan: the same facts, the same words ---------------------------------------
select tests.login_as(tests.id('admin'));
select tests.keep('eve', loan_check(tests.lm('Eve'), 500));      -- Eve saved 300, cap 900: inside it
select tests.keep('dee', loan_check(tests.lm('Dee'), 800));      -- Dee: over her cap of 750
select throws_ok($$select send_loan(tests.lm('Dee'), 800, tests.id('w_airtel'))$$, 'P0001', 'over_cap_needs_reason',
  'over_cap = true, and send_loan asks for a reason');
select lives_ok($$select send_loan(tests.lm('Dee'), 800, tests.id('w_airtel'), 'Approved by the group')$$, 'with a reason it goes');
select lives_ok($$select send_loan(tests.lm('Eve'), 500, tests.id('w_airtel'))$$, 'under the cap it goes without one');
reset role;
select ok((tests.kept('dee') ->> 'over_cap')::boolean and not (tests.kept('eve') ->> 'over_cap')::boolean,
  'loan_check said the same beforehand');
select is((select interest || '/' || term_months from loans where member_id = tests.lm('Eve')),
  (tests.kept('eve') ->> 'interest')::numeric || '/' || (tests.kept('eve') ->> 'term_months'), 'the loan''s interest and term equal the preview''s');
select is((select interest || '/' || term_months from loans where member_id = tests.lm('Dee')),
  (tests.kept('dee') ->> 'interest')::numeric || '/' || (tests.kept('dee') ->> 'term_months'), 'the same for an over-cap loan');

-- after 800 + 500 went out: cash is 6,000, and Dee is over her limit ---------------------------------
select tests.login_as(tests.id('admin'));
select is((loan_check(tests.lm('Gus')) ->> 'lending_cash')::numeric, 6000::numeric, 'cash on hand falls by what was sent');
select is((loan_check(tests.lm('Dee')) ->> 'loans_owed')::numeric, 920::numeric, 'Dee owes 800 + 120 interest');
select is((loan_check(tests.lm('Dee')) ->> 'headroom')::numeric, -170::numeric, 'and is 170 over her limit');
select ok((loan_check(tests.lm('Cid'), 6001) ->> 'insufficient_cash')::boolean, 'K6,001 is now more than is on hand');
select throws_ok($$select send_loan(tests.lm('Cid'), 6001, tests.id('w_airtel'), 'because')$$, 'P0001', 'insufficient_cash',
  'and send_loan agrees');
select ok(not (loan_check(tests.lm('Cid'), 6000) ->> 'insufficient_cash')::boolean, 'K6,000 is still affordable');
reset role;

-- arrears: the same sentence send_loan stores ----------------------------------------------------
select tests.ledger_jump(11);
insert into statements (group_id, period_id, member_id, next_minimum, unpaid_minimum, closing_owed, source)
values (tests.id('lg'), tests.lp(10), tests.lm('Lee'), 20, 20, 20, 'close');
select tests.ledger_pay('Lee', 11, 600, 0);
select tests.login_as(tests.id('admin'));
select tests.keep('lee', loan_check(tests.lm('Lee'), 500));
select lives_ok($$select send_loan(tests.lm('Lee'), 500, tests.id('w_airtel'))$$, 'Lee, in arrears, may still borrow');
reset role;
select is(tests.kept('lee') ->> 'arrears', (select arrears_warning from loans where member_id = tests.lm('Lee')),
  'the preview''s arrears sentence is the one the loan stores');
select ok(tests.kept('lee') ->> 'arrears' like 'K20.00 of last month''s minimum unpaid%', 'and it says what is unpaid');

-- no new loans in the last month ---------------------------------------------------------------------
select tests.ledger_jump(12);
select tests.login_as(tests.id('admin'));
select ok(not (loan_check(tests.lm('Dee'), 100) ->> 'loans_open')::boolean, 'January is closed to new loans');
select ok(loan_check(tests.lm('Dee'), 100) -> 'term_months' = 'null'::jsonb, 'so there is no term');
select throws_ok($$select send_loan(tests.lm('Dee'), 100, tests.id('w_airtel'))$$, 'P0001', 'loans_closed', 'and send_loan agrees');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Set up the rollback-only runner and prove the test fails**

Write the scratch runner (outside the repo; it never commits and drops the helper schema when done). Use the session scratchpad directory:

```bash
S=/tmp/claude-1000/-home-bk08-dev-web-village-banking/43e07bdc-ccaf-4683-870c-76c605cf3048/scratchpad
mkdir -p $S
cat > $S/run.mjs <<'EOF'
import postgres from '/home/bk08/dev/web/village-banking/node_modules/postgres/src/index.js'
import { readFileSync } from 'node:fs'
const root = '/home/bk08/dev/web/village-banking/supabase/tests/database/'
const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, prepare: false, onnotice: () => {}, ssl: 'require' })
const lines = (res) => (Array.isArray(res[0]) ? res.flat() : res).flatMap((r) => String(Object.values(r)[0]).split('\n'))
try {
  await sql.unsafe('create extension if not exists pgtap with schema extensions').simple()
  await sql.unsafe('drop schema if exists tests cascade').simple()
  for (const h of ['00_helpers.sql', '00_ledger_helpers.sql']) await sql.unsafe(readFileSync(root + h, 'utf8')).simple()
  await sql.unsafe('discard temp').simple()
  const res = await sql.unsafe(readFileSync(process.argv[2], 'utf8')).simple()
  console.log(lines(res).filter((l) => /^(ok|not ok|#|1\.\.)/.test(l)).join('\n'))
} catch (e) { console.log('ERR', e.message) }
finally {
  await sql.unsafe('rollback').simple().catch(() => {})
  await sql.unsafe('drop schema if exists tests cascade').simple().catch(() => {})
  await sql.end()
}
EOF
cat > $S/combine.py <<'EOF'
import sys
mig, test, out = sys.argv[1], sys.argv[2], sys.argv[3]
m = open(mig).read() if mig != '-' else ''
t = open(test).read().replace('begin;\n', 'begin;\n' + m + '\n', 1)
open(out, 'w').write(t)
EOF
```

Then, with the migration not written yet, run (this connects to the **development** database named in `.env.local`; it only reads and rolls back):

```bash
set -a; . ./.env.local; set +a
python3 $S/combine.py - supabase/tests/database/18_loan_check.sql $S/c18.sql && bun $S/run.mjs $S/c18.sql | head -5
```

Expected: `ERR function loan_check(uuid) does not exist` (or the first `not ok`). That is the RED.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261010002200_loan_check.sql`:

```sql
-- A read-only look at a loan before it is sent: lending cash on hand, the member's cap and arrears, and, for an amount, its
-- interest, term and whether send_loan would refuse it. send_loan is unchanged and stays the only writer; this repeats its
-- formulas so the screen never has to compute money, and pgTAP (18_loan_check) pins the two together.

create or replace function public.loan_check(p_member uuid, p_principal numeric default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_m members;
  v_p periods;
  v_r cycle_rules;
  v_multiple numeric;
  v_open boolean;
  v_cash numeric;
  v_cum numeric;
  v_owed numeric;
  v_cap numeric;
  v_unpaid numeric;
  v_paid_this_month numeric;
  v_arrears text;
  v_term int;
  v_out jsonb;
begin
  select * into v_m from members where id = p_member;
  if not found then raise exception 'member_not_found' using errcode = 'P0001'; end if;
  if not is_admin(v_m.group_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if v_m.status <> 'active' then raise exception 'member_not_active' using errcode = 'P0001'; end if;
  if p_principal is not null
     and (not (p_principal > 0 and p_principal <= 9999999999.99) or p_principal <> round(p_principal, 2)) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  select * into v_p from periods where group_id = v_m.group_id and status = 'open';
  if not found then raise exception 'period_not_open' using errcode = 'P0001'; end if;
  select * into v_r from cycle_rules where cycle_id = v_p.cycle_id;

  select (x ->> 'multiple')::numeric into v_multiple
    from jsonb_array_elements(v_r.loan_multiples) x
   where v_p.month_index between (x ->> 'from_month')::int and (x ->> 'to_month')::int
   limit 1;
  v_open := v_p.month_index < 12 and coalesce(v_multiple, 0) > 0;
  v_cash := private.lending_cash(v_p.id);
  v_cum := coalesce((select sum(l.amount) from private.ledger_lines l
                     where l.member_id = p_member and l.cycle_id = v_p.cycle_id and l.kind = 'saving'
                       and l.month_index <= v_p.month_index), 0);
  v_owed := private.loans_owed(p_member, v_p.id);
  v_cap := coalesce(v_multiple, 0) * v_cum;

  -- Arrears: the same sentence send_loan stores (previous month's minimum less payments received so far this month).
  select coalesce(sum(l.amount), 0) into v_paid_this_month
    from private.ledger_lines l
   where l.period_id = v_p.id and l.member_id = p_member and l.kind = 'payment';
  select s.next_minimum into v_unpaid
    from periods prev join statements s on s.period_id = prev.id and s.member_id = p_member
   where prev.cycle_id = v_p.cycle_id and prev.month_index = v_p.month_index - 1;
  if coalesce(v_unpaid, 0) - v_paid_this_month > 0 then
    v_arrears := format('K%s of last month''s minimum unpaid (K%s due, K%s paid so far); already owes K%s in all',
                        round(coalesce(v_unpaid, 0) - v_paid_this_month, 2), round(coalesce(v_unpaid, 0), 2),
                        round(v_paid_this_month, 2), round(greatest(private.member_balance(p_member, v_p.id), 0), 2));
  end if;

  v_out := jsonb_build_object(
    'period_id', v_p.id, 'label', v_p.label, 'month_index', v_p.month_index, 'loans_open', v_open,
    'lending_cash', v_cash, 'multiple', coalesce(v_multiple, 0), 'cum_savings', v_cum, 'loans_owed', v_owed,
    'cap', v_cap, 'headroom', v_cap - v_owed, 'arrears', v_arrears);

  if p_principal is not null then
    -- The term is the tenor band for the size, shortened so the last instalment falls by month 12 (as schedule_loan does).
    select (b ->> 'months')::int into v_term
      from jsonb_array_elements(v_r.tenor_bands) with ordinality as x(b, i)
     where b ->> 'max' is null or p_principal <= (b ->> 'max')::numeric
     order by i
     limit 1;
    v_term := least(coalesce(v_term, 1), 12 - v_p.month_index);
    v_out := v_out || jsonb_build_object(
      'principal', p_principal, 'interest', round(p_principal * v_r.loan_rate, 2),
      'term_months', case when v_term < 1 then null else v_term end,
      'over_cap', v_owed + p_principal > v_cap, 'insufficient_cash', p_principal > v_cash);
  end if;
  return v_out;
end $$;

revoke execute on function public.loan_check(uuid, numeric) from public, anon, authenticated;
grant execute on function public.loan_check(uuid, numeric) to authenticated;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
set -a; . ./.env.local; set +a
S=/tmp/claude-1000/-home-bk08-dev-web-village-banking/43e07bdc-ccaf-4683-870c-76c605cf3048/scratchpad
python3 $S/combine.py supabase/migrations/20261010002200_loan_check.sql supabase/tests/database/18_loan_check.sql $S/c18.sql && bun $S/run.mjs $S/c18.sql | grep -v '^ok'
```

Expected: only the `1..N` plan line (no `not ok`, no `ERR`). Fix the migration (never the test's agreement expectations) if anything fails. If an expected number differs because of how the fixture behaves (for example Dee's headroom), work out the true value from the engine, confirm it with `send_loan`'s own result, and rule on it in the ledger.

- [ ] **Step 5: Prove the neighbours still pass with the function present**

```bash
for t in 02_rls 05_hardening 15_ledger_security 09_ledger_loans 16_ledger_hardening; do
  python3 $S/combine.py supabase/migrations/20261010002200_loan_check.sql supabase/tests/database/$t.sql $S/c_$t.sql
  echo "== $t"; bun $S/run.mjs $S/c_$t.sql | grep -v '^ok'
done
```

Expected: each prints only its `1..N` line.

- [ ] **Step 6: Add the signature to the generated types**

In `src/lib/database.types.ts`, in the `Functions` block next to `"create_group"`, add (same hand-edit style as `create_group`):

```ts
"loan_check":
{ Args: { "p_member": string,"p_principal"?: number }; Returns: Json
                           },
```

Run `bun run typecheck`. Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261010002200_loan_check.sql supabase/tests/database/18_loan_check.sql src/lib/database.types.ts
git commit -m "feat: loan_check, a read-only preview of a loan

Lending cash on hand, the member's cap, headroom and arrears, and for an
amount its interest, term and whether send_loan would refuse it. send_loan
is unchanged; pgTAP pins the two together. Admin-only, no writes."
```

---

### Task 2: Pure helpers, SelectField, debounce

**Files:**
- Create: `src/features/ledger/deskMoney.ts`, `src/features/ledger/useDebouncedValue.ts`, `src/ui/SelectField.tsx`
- Modify: `src/ui/index.ts`
- Test: `src/features/ledger/deskMoney.test.ts`, `src/features/ledger/useDebouncedValue.test.ts`, `src/ui/SelectField.test.tsx`

**Interfaces:**
- Produces:
  - `deskMoney.ts`: `type LoanRequest = { declaration: DeclarationRow; memberId: string; amount: number; sent: number }`, `loanRequests(declarations: DeclarationRow[], loans: Array<{ member_id: string; principal: number }>): LoanRequest[]`, `GROUNDS`, `groundLabel(ground: string): string`, `type PenaltySuggestion = { member_id: string; short_name: string; ground: string; amount: number; detail: string }`, `appliedKey(memberId, ground): string`, `appliedGrounds(entries: EntryRow[]): Set<string>`, `openSuggestions(suggestions, applied: Set<string>, dismissed: Set<string>): PenaltySuggestion[]`, `splitReason(reason: string | null): { ground: string; text: string }`
  - `useDebouncedValue<T>(value: T, ms: number): T`
  - `SelectField({ label, error?, ...selectProps })` exported from `@/ui`

- [ ] **Step 1: Write the failing tests**

`src/features/ledger/deskMoney.test.ts`:

```ts
import { expect, test } from 'vitest';
import { appliedGrounds, groundLabel, loanRequests, openSuggestions, splitReason } from './deskMoney';
import { declaration, entry } from './testFixtures';

test('loanRequests lists live declarations that ask for a loan, newest first, with what was already sent to that member', () => {
  const rows = [
    declaration({ id: 'd3', member_id: 'm3', borrowing_request: 500 }),
    declaration({ id: 'd2', member_id: 'm2', borrowing_request: 0 }),
    declaration({ id: 'd1b', member_id: 'm1', borrowing_request: 2000, supersedes_id: 'd1' }),
    declaration({ id: 'd1', member_id: 'm1', borrowing_request: 100, status: 'returned' }),
    declaration({ id: 'd4', member_id: 'm4', borrowing_request: 300, status: 'returned' }),
  ];
  const r = loanRequests(rows, [{ member_id: 'm1', principal: 1000 }, { member_id: 'm1', principal: 0.5 }]);
  expect(r.map((x) => [x.memberId, x.amount, x.sent])).toEqual([['m3', 500, 0], ['m1', 2000, 1000.5]]);
});

test('groundLabel names the four grounds and shows an unknown one as itself', () => {
  expect(groundLabel('late_declaration')).toBe('Late declaration');
  expect(groundLabel('missed_minimum')).toBe('Missed minimum');
  expect(groundLabel('under_saving')).toBe('Saved under the minimum');
  expect(groundLabel('other')).toBe('Other');
  expect(groundLabel('new_ground')).toBe('new_ground');
});

test('splitReason separates the ground the engine stores from the written reason', () => {
  expect(splitReason('missed_minimum: Paid K0 of the K300 minimum')).toEqual({ ground: 'missed_minimum', text: 'Paid K0 of the K300 minimum' });
  expect(splitReason('other: a: b')).toEqual({ ground: 'other', text: 'a: b' });
  expect(splitReason('no ground here')).toEqual({ ground: '', text: 'no ground here' });
  expect(splitReason(null)).toEqual({ ground: '', text: '' });
});

test('suggestions already applied this month, or dismissed, are not offered again', () => {
  const applied = appliedGrounds([
    entry({ id: 'p1', kind: 'penalty', member_id: 'm1', source: 'app', reason: 'late_declaration: Declared 2 days late' }),
    entry({ id: 'p2', kind: 'penalty', member_id: 'm2', source: 'correction', corrects_entry_id: 'p1', reason: 'late_declaration: x' }),
    entry({ id: 'p3', kind: 'saving', member_id: 'm3', source: 'app', reason: null }),
  ]);
  expect([...applied]).toEqual(['m1:late_declaration']);
  const s = (member_id: string, ground: string) => ({ member_id, short_name: member_id, ground, amount: 50, detail: '' });
  const open = openSuggestions(
    [s('m1', 'late_declaration'), s('m1', 'missed_minimum'), s('m2', 'late_declaration'), s('m3', 'under_saving')],
    applied,
    new Set(['m3:under_saving']),
  );
  expect(open.map((x) => `${x.member_id}:${x.ground}`)).toEqual(['m1:missed_minimum', 'm2:late_declaration']);
});
```

`src/features/ledger/useDebouncedValue.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('the value follows only after it has been still for the delay', () => {
  const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'a' } });
  expect(result.current).toBe('a');
  rerender({ v: 'b' });
  act(() => void vi.advanceTimersByTime(299));
  expect(result.current).toBe('a');
  rerender({ v: 'c' });
  act(() => void vi.advanceTimersByTime(299));
  expect(result.current).toBe('a');
  act(() => void vi.advanceTimersByTime(1));
  expect(result.current).toBe('c');
});
```

`src/ui/SelectField.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { SelectField } from './SelectField';

test('a labelled select that reports the choice', async () => {
  const onChange = vi.fn();
  render(
    <SelectField label="Wallet" value="" onChange={onChange}>
      <option value="">Choose</option>
      <option value="w1">Airtel</option>
    </SelectField>,
  );
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(onChange).toHaveBeenCalled();
});

test('an error is announced and linked to the select', () => {
  render(
    <SelectField label="Wallet" error="Choose a wallet." defaultValue="">
      <option value="">Choose</option>
    </SelectField>,
  );
  const select = screen.getByLabelText('Wallet');
  expect(select).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a wallet.');
  expect(select.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `bun run test src/features/ledger/deskMoney.test.ts src/features/ledger/useDebouncedValue.test.ts src/ui/SelectField.test.tsx`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement**

`src/features/ledger/deskMoney.ts`:

```ts
import type { EntryRow } from './memberViews';
import { liveDeclarations, type DeclarationRow } from './model';
import { sumKwacha } from './money';

export type LoanRequest = { declaration: DeclarationRow; memberId: string; amount: number; sent: number };

/** Borrowing requests from this month's live declarations (a returned one is not a request), with what has already gone to that member. */
export function loanRequests(declarations: DeclarationRow[], loans: Array<{ member_id: string; principal: number }>): LoanRequest[] {
  return liveDeclarations(declarations)
    .filter((d) => d.borrowing_request > 0 && d.status !== 'returned')
    .map((d) => ({
      declaration: d,
      memberId: d.member_id,
      amount: d.borrowing_request,
      sent: sumKwacha(...loans.filter((l) => l.member_id === d.member_id).map((l) => l.principal)),
    }));
}

export const GROUNDS: Record<string, string> = {
  late_declaration: 'Late declaration',
  missed_minimum: 'Missed minimum',
  under_saving: 'Saved under the minimum',
  other: 'Other',
};
export const groundLabel = (ground: string): string => GROUNDS[ground] ?? ground;

export type PenaltySuggestion = { member_id: string; short_name: string; ground: string; amount: number; detail: string };

export const appliedKey = (memberId: string, ground: string): string => `${memberId}:${ground}`;

/** apply_penalty stores the reason as "<ground>: <text>". */
export function splitReason(reason: string | null): { ground: string; text: string } {
  if (!reason) return { ground: '', text: '' };
  const i = reason.indexOf(': ');
  return i === -1 ? { ground: '', text: reason } : { ground: reason.slice(0, i), text: reason.slice(i + 2) };
}

/** The member+ground pairs already penalised this month by the app (corrections are not applications). */
export function appliedGrounds(entries: EntryRow[]): Set<string> {
  const applied = new Set<string>();
  for (const e of entries) {
    if (e.kind === 'penalty' && e.source === 'app' && e.member_id) applied.add(appliedKey(e.member_id, splitReason(e.reason).ground));
  }
  return applied;
}

/** The engine keeps suggesting a penalty after it has been applied, so hide those, and the ones put off for now. */
export const openSuggestions = (suggestions: PenaltySuggestion[], applied: Set<string>, dismissed: Set<string>): PenaltySuggestion[] =>
  suggestions.filter((s) => {
    const key = appliedKey(s.member_id, s.ground);
    return !applied.has(key) && !dismissed.has(key);
  });
```

`src/features/ledger/useDebouncedValue.ts`:

```ts
import { useEffect, useState } from 'react';

/** The value, but only once it has stopped changing for `ms`. */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
```

`src/ui/SelectField.tsx`:

```tsx
import { useId, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

/** A labelled native select, styled like TextField. */
export function SelectField({ label, error, id, className, children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={fieldId} className="text-sm font-medium text-fg">{label}</label>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-fg transition focus-visible:border-accent',
          error ? 'border-danger' : 'border-line',
        )}
        {...rest}
      >
        {children}
      </select>
      {error ? <p id={errorId} role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
```

In `src/ui/index.ts` add: `export { SelectField } from './SelectField';` next to `TextField`.

- [ ] **Step 4: Run tests, lint and typecheck**

Run: `bun run test src/features/ledger src/ui && bun run lint && bun run typecheck`
Expected: PASS, clean

- [ ] **Step 5: Commit**

```bash
git add src/features/ledger src/ui
git commit -m "feat: helpers for the Desk's loans and penalties

Borrowing requests from live declarations, penalty grounds and the
already-applied filter the engine does not do itself, a debounce hook and a
labelled SelectField."
```

---

### Task 3: Read hooks

**Files:**
- Modify: `src/features/ledger/queries.ts`
- Test: `src/features/ledger/deskQueries.test.tsx`

**Interfaces:**
- Produces:
  - `type LoanCheck = { period_id: string; label: string; month_index: number; loans_open: boolean; lending_cash: number; multiple: number; cum_savings: number; loans_owed: number; cap: number; headroom: number; arrears: string | null; principal?: number; interest?: number; term_months?: number | null; over_cap?: boolean; insufficient_cash?: boolean }`
  - `useLoanCheck(memberId: string | undefined, principal: number | null)` → `LoanCheck` (`staleTime: 0`, keeps the previous answer while a new amount loads)
  - `useMonthLoans(groupId: string, periodId: string | undefined)` → `LoanRow[]`
  - `useSuggestedPenalties(groupId: string, periodId: string | undefined)` → `PenaltySuggestion[]`
  - `useMonthPenalties(groupId: string, periodId: string | undefined)` → `EntryRow[]` (penalty entries of the month, newest first)
  - `useRefreshLedger` additionally invalidates the four new keys.

- [ ] **Step 1: Write the failing test**

`src/features/ledger/deskQueries.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

const calls = vi.hoisted(() => ({
  eq: [] as Array<[string, unknown]>,
  rpc: [] as unknown[][],
  result: vi.fn(),
  rpcResult: vi.fn(),
}));
vi.mock('@/lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit', 'in']) chain[m] = () => chain;
  chain.eq = (col: string, val: unknown) => {
    calls.eq.push([col, val]);
    return chain;
  };
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(calls.result()).then(res, rej);
  return {
    supabase: {
      from: () => chain,
      rpc: (...args: unknown[]) => {
        calls.rpc.push(args);
        return Promise.resolve(calls.rpcResult());
      },
    },
  };
});
const { useLoanCheck, useMonthLoans, useMonthPenalties, useSuggestedPenalties } = await import('./queries');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  calls.eq.length = 0;
  calls.rpc.length = 0;
  calls.result.mockReset();
  calls.rpcResult.mockReset();
});

test('loan_check is asked with the member alone, or with the amount too', async () => {
  calls.rpcResult.mockReturnValue({ data: { lending_cash: 100 }, error: null });
  const a = renderHook(() => useLoanCheck('m1', null), { wrapper });
  await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
  const b = renderHook(() => useLoanCheck('m1', 500), { wrapper });
  await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
  expect(calls.rpc).toEqual([['loan_check', { p_member: 'm1' }], ['loan_check', { p_member: 'm1', p_principal: 500 }]]);
});

test('nothing is asked without a member', () => {
  const { result } = renderHook(() => useLoanCheck(undefined, 500), { wrapper });
  expect(result.current.fetchStatus).toBe('idle');
});

test('a refusal from loan_check surfaces as the query error', async () => {
  calls.rpcResult.mockReturnValue({ data: null, error: { message: 'period_not_open', code: 'P0001' } });
  const { result } = renderHook(() => useLoanCheck('m1', null), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
});

test('the month’s loans and penalty entries are asked for by the open month', async () => {
  calls.result.mockReturnValue({ data: [], error: null });
  const loans = renderHook(() => useMonthLoans('g1', 'p9'), { wrapper });
  await waitFor(() => expect(loans.result.current.isSuccess).toBe(true));
  const pens = renderHook(() => useMonthPenalties('g1', 'p9'), { wrapper });
  await waitFor(() => expect(pens.result.current.isSuccess).toBe(true));
  expect(calls.eq).toEqual([['period_id', 'p9'], ['period_id', 'p9'], ['kind', 'penalty']]);
});

test('suggested penalties come from the engine for the open month, and are idle without one', async () => {
  const idle = renderHook(() => useSuggestedPenalties('g1', undefined), { wrapper });
  expect(idle.result.current.fetchStatus).toBe('idle');
  calls.rpcResult.mockReturnValue({ data: [{ member_id: 'm1', short_name: 'Eve', ground: 'late_declaration', amount: 100, detail: 'x' }], error: null });
  const { result } = renderHook(() => useSuggestedPenalties('g1', 'p9'), { wrapper });
  await waitFor(() => expect(result.current.data).toHaveLength(1));
  expect(calls.rpc[0]).toEqual(['suggest_penalties', { p_period: 'p9' }]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test src/features/ledger/deskQueries.test.tsx`
Expected: FAIL (the hooks are not exported)

- [ ] **Step 3: Implement**

In `src/features/ledger/queries.ts`:

1. Change the first import to `import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';` and add `import type { PenaltySuggestion } from './deskMoney';` and extend the memberViews import with `LoanRow` (it already exports `LoanRow`).
2. Replace `useRefreshLedger` with:

```ts
export function useRefreshLedger(groupId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['declarations', groupId] }),
      qc.invalidateQueries({ queryKey: ['ledger-cycle', groupId] }),
      qc.invalidateQueries({ queryKey: ['month-loans', groupId] }),
      qc.invalidateQueries({ queryKey: ['month-penalties', groupId] }),
      qc.invalidateQueries({ queryKey: ['suggested-penalties', groupId] }),
      qc.invalidateQueries({ queryKey: ['loan-check'] }),
    ]);
}
```

3. Append:

```ts
export type LoanCheck = {
  period_id: string;
  label: string;
  month_index: number;
  loans_open: boolean;
  lending_cash: number;
  multiple: number;
  cum_savings: number;
  loans_owed: number;
  cap: number;
  headroom: number;
  arrears: string | null;
  principal?: number;
  interest?: number;
  term_months?: number | null;
  over_cap?: boolean;
  insufficient_cash?: boolean;
};

/** Cash, cap and arrears for a member, and, with an amount, whether send_loan would take it. Never cached: cash moves. */
export function useLoanCheck(memberId: string | undefined, principal: number | null) {
  return useQuery({
    queryKey: ['loan-check', memberId, principal],
    enabled: Boolean(memberId),
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<LoanCheck> => {
      const { data, error } = await supabase.rpc('loan_check', principal === null ? { p_member: memberId! } : { p_member: memberId!, p_principal: principal });
      if (error) throw error;
      return data as unknown as LoanCheck;
    },
  });
}

/** Loans sent in the month (admin RLS shows them all). */
export function useMonthLoans(groupId: string, periodId: string | undefined) {
  return useQuery({
    queryKey: ['month-loans', groupId, periodId],
    enabled: Boolean(periodId),
    queryFn: async (): Promise<LoanRow[]> => {
      const { data, error } = await supabase.from('loans').select('*').eq('period_id', periodId!).order('sent_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** What the engine would charge for the month so far. It keeps suggesting after a penalty is applied; see openSuggestions. */
export function useSuggestedPenalties(groupId: string, periodId: string | undefined) {
  return useQuery({
    queryKey: ['suggested-penalties', groupId, periodId],
    enabled: Boolean(periodId),
    queryFn: async (): Promise<PenaltySuggestion[]> => {
      const { data, error } = await supabase.rpc('suggest_penalties', { p_period: periodId! });
      if (error) throw error;
      return data;
    },
  });
}

/** Penalty entries of the month: the applications and any corrections of them. */
export function useMonthPenalties(groupId: string, periodId: string | undefined) {
  return useQuery({
    queryKey: ['month-penalties', groupId, periodId],
    enabled: Boolean(periodId),
    queryFn: async (): Promise<EntryRow[]> => {
      const { data, error } = await supabase.from('entries').select('*').eq('period_id', periodId!).eq('kind', 'penalty').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
```

- [ ] **Step 4: Run tests, lint and typecheck**

Run: `bun run test src/features/ledger && bun run lint && bun run typecheck`
Expected: PASS, clean. If `suggest_penalties`' generated return type differs from `PenaltySuggestion[]`, fix the annotation, not with `any`.

- [ ] **Step 5: Commit**

```bash
git add src/features/ledger/queries.ts src/features/ledger/deskQueries.test.tsx
git commit -m "feat: read hooks for the Desk's loans and penalties

loan_check, the month's loans, the engine's suggested penalties and the
penalty entries; every ledger action now refreshes them too."
```

---

### Task 4: SendLoanSheet

**Files:**
- Create: `src/features/desk/SendLoanSheet.tsx`
- Test: `src/features/desk/SendLoanSheet.test.tsx`

**Interfaces:**
- Consumes: `useLoanCheck`, `LoanCheck`; `useLedgerAction`; `useDebouncedValue`; `parseKwacha`; `ActiveMember`, `Wallet`; `Sheet`, `TextField`, `SelectField`, `Button`, `Alert`, `useConfirmTap`.
- Produces: `SendLoanSheet({ members: ActiveMember[]; wallets: Wallet[]; initialMemberId?: string; initialAmount?: number; onClose: () => void })`.

- [ ] **Step 1: Write the failing test**

`src/features/desk/SendLoanSheet.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import type { LoanCheck } from '@/features/ledger/queries';
import { renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const hooks = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/features/ledger/useDebouncedValue', () => ({ useDebouncedValue: <T,>(v: T) => v }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLoanCheck: (memberId: string | undefined, principal: number | null) => hooks.check(memberId, principal),
}));
const { SendLoanSheet } = await import('./SendLoanSheet');

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
const WALLETS = [{ id: 'w1', name: 'Airtel' }, { id: 'w2', name: 'MTN' }];
const onClose = vi.fn();

const base: LoanCheck = {
  period_id: 'p9', label: 'Oct 2026', month_index: 9, loans_open: true, lending_cash: 6000, multiple: 2, cum_savings: 2000,
  loans_owed: 500, cap: 4000, headroom: 3500, arrears: null,
};
/** What the database answers: the member facts, plus the amount facts once an amount is given. */
const answer = (principal: number | null, extra: Partial<LoanCheck> = {}): LoanCheck =>
  principal === null
    ? { ...base, ...extra }
    : { ...base, principal, interest: Math.round(principal * 15) / 100, term_months: 1, over_cap: false, insufficient_cash: false, ...extra };
const respond = (extra: Partial<LoanCheck> = {}) =>
  hooks.check.mockImplementation((memberId: string | undefined, principal: number | null) => ({
    data: memberId ? answer(principal, extra) : undefined, isError: false, error: null, isFetching: false,
  }));

const renderSheet = (props: Partial<React.ComponentProps<typeof SendLoanSheet>> = {}) =>
  renderLedger(<SendLoanSheet members={MEMBERS} wallets={WALLETS} onClose={onClose} {...props} />, { isAdmin: true });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
  onClose.mockReset();
  respond();
});

test('opened from a request it starts with the member and amount filled in, and shows cash, limit and interest', () => {
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  expect(screen.getByLabelText('Member')).toHaveValue('m1');
  expect(screen.getByLabelText('Amount')).toHaveValue('1000');
  expect(screen.getByText('Lending cash on hand').nextElementSibling).toHaveTextContent('K 6,000');
  expect(screen.getByText('Limit (2× savings of K 2,000)').nextElementSibling).toHaveTextContent('K 4,000');
  expect(screen.getByText('Owes on loans').nextElementSibling).toHaveTextContent('K 500');
  expect(screen.getByText('Room under the limit').nextElementSibling).toHaveTextContent('K 3,500');
  expect(screen.getByText('Interest').nextElementSibling).toHaveTextContent('K 150');
  expect(screen.getByText('Term').nextElementSibling).toHaveTextContent('1 month');
});

test('nothing is asked until a member is chosen', () => {
  renderSheet();
  expect(hooks.check).toHaveBeenCalledWith(undefined, null);
  expect(screen.queryByText('Lending cash on hand')).toBeNull();
});

test('malformed amounts are not asked about and cannot be sent', async () => {
  renderSheet({ initialMemberId: 'm1' });
  for (const bad of ['1,000', '250.555', '-5', '1e3']) {
    await userEvent.clear(screen.getByLabelText('Amount'));
    await userEvent.type(screen.getByLabelText('Amount'), bad);
    expect(screen.getByText('Use kwacha and ngwee, like 250 or 250.50.'), bad).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send loan' })).toBeDisabled();
  }
  expect(hooks.check.mock.calls.every(([, p]) => p === null)).toBe(true);
  expect(rpc).not.toHaveBeenCalled();
});

test('short of cash it says how much is available and cannot be sent', async () => {
  respond({ insufficient_cash: true, lending_cash: 800 });
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(screen.getByText('Only K 800 is on hand, which is less than this loan.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeDisabled();
});

test('no new loans this month blocks sending', async () => {
  respond({ loans_open: false });
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(screen.getByText('No new loans can be sent this month.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeDisabled();
});

test('over the limit a reason is required before it can be sent', async () => {
  respond({ over_cap: true });
  renderSheet({ initialMemberId: 'm1', initialAmount: 5000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(screen.getByText(/over the member’s limit/)).toBeInTheDocument();
  expect(screen.getByLabelText('Reason (required over the limit)')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Reason (required over the limit)'), 'Group agreed on the call');
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeEnabled();
});

test('arrears are shown as a warning and do not block', async () => {
  respond({ arrears: 'K20.00 of last month’s minimum unpaid (K20.00 due, K0.00 paid so far); already owes K20.00 in all' });
  renderSheet({ initialMemberId: 'm1', initialAmount: 500 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(screen.getByText(/K20.00 of last month’s minimum unpaid/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeEnabled();
});

test('sending takes a second tap, sends the typed values once, and closes', async () => {
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w2');
  await userEvent.type(screen.getByLabelText('Transfer fee (optional)'), '10');
  await userEvent.click(screen.getByRole('button', { name: 'Send loan' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to send K 1,000 to Eve' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('send_loan', { p_member: 'm1', p_principal: 1000, p_wallet: 'w2', p_reason: undefined, p_fee: 10 });
  expect(await screen.findByText('Loan sent.')).toBeInTheDocument();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('a typed reason is sent even when the loan is inside the limit', async () => {
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  await userEvent.type(screen.getByLabelText('Reason (required over the limit)'), 'For school fees');
  await userEvent.click(screen.getByRole('button', { name: 'Send loan' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to send K 1,000 to Eve' }));
  expect(rpc).toHaveBeenCalledWith('send_loan', expect.objectContaining({ p_reason: 'For school fees', p_fee: 0 }));
});

test('tapping again while the request runs does not send a second loan', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  await userEvent.click(screen.getByRole('button', { name: 'Send loan' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to send K 1,000 to Eve' }));
  await userEvent.click(screen.getByRole('button', { name: /Send loan|Tap again/ }));
  expect(rpc).toHaveBeenCalledTimes(1);
});

test('a refusal shows the friendly sentence and keeps the sheet open', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'insufficient_cash', code: 'P0001' } });
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  await userEvent.click(screen.getByRole('button', { name: 'Send loan' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to send K 1,000 to Eve' }));
  expect(await screen.findByText('There isn’t enough lending cash for this loan right now.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

test('the preview failing is shown and blocks sending', async () => {
  hooks.check.mockReturnValue({ data: undefined, isError: true, error: { message: 'period_not_open', code: 'P0001' }, isFetching: false });
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(screen.getByText('That month isn’t open. Pick the current month, or open it first.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeDisabled();
});

test('a preview that is still loading for the typed amount keeps Send disabled', async () => {
  hooks.check.mockImplementation((memberId: string | undefined) => ({
    data: memberId ? answer(null) : undefined, isError: false, error: null, isFetching: true,
  }));
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeDisabled();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test src/features/desk/SendLoanSheet.test.tsx`
Expected: FAIL (`./SendLoanSheet` not found)

- [ ] **Step 3: Implement**

`src/features/desk/SendLoanSheet.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { useLedgerAction } from '@/features/ledger/actions';
import type { ActiveMember, Wallet } from '@/features/ledger/model';
import { parseKwacha } from '@/features/ledger/money';
import { useLoanCheck } from '@/features/ledger/queries';
import { useDebouncedValue } from '@/features/ledger/useDebouncedValue';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Alert, Button, SelectField, Sheet, TextField, useConfirmTap } from '@/ui';

type Props = { members: ActiveMember[]; wallets: Wallet[]; initialMemberId?: string; initialAmount?: number; onClose: () => void };

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-muted">{label}</dt>
    <dd className="tabular text-right text-fg">{children}</dd>
  </>
);

export function SendLoanSheet({ members, wallets, initialMemberId = '', initialAmount, onClose }: Props) {
  const [memberId, setMemberId] = useState(initialMemberId);
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '');
  const [walletId, setWalletId] = useState('');
  const [fee, setFee] = useState('');
  const [reason, setReason] = useState('');

  const parsed = parseKwacha(amount);
  const principal = parsed !== null && parsed > 0 ? parsed : null;
  const feeValue = parseKwacha(fee);
  const asked = useDebouncedValue(principal, 300);
  const check = useLoanCheck(memberId || undefined, asked);
  const data = check.data;
  const name = members.find((m) => m.id === memberId)?.short_name ?? '';

  // Send only on an answer to exactly what is typed: a preview for an earlier amount must never enable it.
  const answered = Boolean(data) && !check.isFetching && asked === principal && (data!.principal ?? null) === principal;
  const overCap = answered && data!.over_cap === true;
  const blocked = answered && (data!.insufficient_cash === true || !data!.loans_open);
  const canSend =
    Boolean(memberId && walletId) && principal !== null && feeValue !== null && answered && !blocked &&
    (!overCap || reason.trim().length > 0) && reason.trim().length <= 500;

  const send = useLedgerAction<void>(async () => {
    const { error } = await supabase.rpc('send_loan', {
      p_member: memberId,
      p_principal: principal!,
      p_wallet: walletId,
      p_reason: reason.trim() || undefined,
      p_fee: feeValue ?? 0,
    });
    if (error) throw error;
  }, 'Loan sent.');
  const confirm = useConfirmTap(() => send.mutate(undefined, { onSuccess: onClose }));
  // Any edit disarms the second tap, so what is sent is always what was last seen.
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    confirm.reset();
    set(v);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Send a loan"
      description="Paid from lending cash. Interest is charged now; the schedule is worked out for you."
      footer={
        <Button fullWidth disabled={!canSend} isLoading={send.isPending} onClick={confirm.tap}>
          {confirm.armed ? `Tap again to send ${money(principal ?? 0)} to ${name}` : 'Send loan'}
        </Button>
      }
    >
      <form className="grid gap-4" noValidate onSubmit={(e) => e.preventDefault()}>
        <SelectField label="Member" value={memberId} onChange={(e) => edit(setMemberId)(e.target.value)}>
          <option value="">Choose a member</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.short_name}</option>)}
        </SelectField>
        <TextField
          label="Amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          error={parsed === null ? 'Use kwacha and ngwee, like 250 or 250.50.' : undefined}
          value={amount}
          onChange={(e) => edit(setAmount)(e.target.value)}
        />

        {memberId && check.isError && !data ? <Alert tone="danger">{friendlyError(check.error)}</Alert> : null}
        {memberId && data ? (
          <section aria-label="Before you send" className="grid gap-3 rounded-xl bg-surface-2 p-4 text-sm">
            <h3 className="font-semibold text-fg">Before you send</h3>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
              <Row label="Lending cash on hand">{money(data.lending_cash)}</Row>
              <Row label={`Limit (${data.multiple}× savings of ${money(data.cum_savings)})`}>{money(data.cap)}</Row>
              <Row label="Owes on loans">{money(data.loans_owed)}</Row>
              <Row label={data.headroom < 0 ? 'Over the limit by' : 'Room under the limit'}>{money(Math.abs(data.headroom))}</Row>
              {answered && data.interest !== undefined ? <Row label="Interest">{money(data.interest)}</Row> : null}
              {answered && data.term_months ? <Row label="Term">{data.term_months} month{data.term_months === 1 ? '' : 's'}</Row> : null}
            </dl>
            {data.arrears ? <Alert tone="warning">{data.arrears}</Alert> : null}
            {!data.loans_open ? <Alert tone="danger">No new loans can be sent this month.</Alert> : null}
            {answered && data.insufficient_cash ? (
              <Alert tone="danger">Only {money(data.lending_cash)} is on hand, which is less than this loan.</Alert>
            ) : null}
            {overCap ? <Alert tone="warning">This loan is over the member’s limit. Add a reason to send it anyway.</Alert> : null}
          </section>
        ) : null}

        <SelectField label="Wallet" value={walletId} onChange={(e) => edit(setWalletId)(e.target.value)}>
          <option value="">Choose the wallet it is sent from</option>
          {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </SelectField>
        <TextField
          label="Transfer fee (optional)"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          hint="Paid from the fee pot, not from lending cash."
          error={feeValue === null ? 'Use kwacha and ngwee, like 10 or 10.50.' : undefined}
          value={fee}
          onChange={(e) => edit(setFee)(e.target.value)}
        />
        <TextField
          label="Reason (required over the limit)"
          maxLength={500}
          autoComplete="off"
          value={reason}
          onChange={(e) => edit(setReason)(e.target.value)}
        />
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run tests, lint and typecheck**

Run: `bun run test src/features/desk/SendLoanSheet.test.tsx && bun run lint && bun run typecheck`
Expected: PASS, clean. Notes: the amount label `Amount` must not collide with other labels in the sheet; if `getByLabelText('Amount')` matches "Transfer fee (optional)" no, labels are distinct. If the test for the double tap finds the label text differs after the first tap (the button text returns to "Send loan" because `confirm.tap` resets `armed` once confirmed), the regex `/Send loan|Tap again/` covers both.

- [ ] **Step 5: Commit**

```bash
git add src/features/desk/SendLoanSheet.tsx src/features/desk/SendLoanSheet.test.tsx
git commit -m "feat: send a loan from the Desk with a preview first

Shows lending cash, the member's limit and arrears before sending, blocks
what send_loan would refuse, requires a reason over the limit, and sends only
on a second tap and only on an answer to exactly the amount typed."
```

---

### Task 5: LoansSection

**Files:**
- Create: `src/features/desk/LoansSection.tsx`
- Test: `src/features/desk/LoansSection.test.tsx`

**Interfaces:**
- Consumes: `useMonthLoans`, `loanRequests`, `SendLoanSheet`, `ActiveMember`, `Wallet`, `DeclarationRow`.
- Produces: `LoansSection({ periodId: string; declarations: DeclarationRow[]; members: ActiveMember[]; wallets: Wallet[] })`.

- [ ] **Step 1: Write the failing test**

`src/features/desk/LoansSection.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, loan, renderLedger } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ loans: vi.fn(), check: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/features/ledger/useDebouncedValue', () => ({ useDebouncedValue: <T,>(v: T) => v }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useMonthLoans: () => hooks.loans(),
  useLoanCheck: () => hooks.check(),
}));
const { LoansSection } = await import('./LoansSection');

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
const WALLETS = [{ id: 'w1', name: 'Airtel' }];
const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });

const renderSection = (declarations = [declaration({ borrowing_request: 1000 })]) =>
  renderLedger(<LoansSection periodId="p9" declarations={declarations} members={MEMBERS} wallets={WALLETS} />, { isAdmin: true });

beforeEach(() => {
  hooks.loans.mockReturnValue(ok([]));
  hooks.check.mockReturnValue({ data: undefined, isError: false, error: null, isFetching: false });
});

test('a borrowing request shows its member and amount, with a Send loan button', () => {
  renderSection();
  const row = screen.getByRole('button', { name: 'Send loan to Eve' }).closest('li')!;
  expect(within(row).getByText('Eve')).toBeInTheDocument();
  expect(within(row).getByText('K 1,000')).toBeInTheDocument();
});

test('Send loan opens the sheet with the request filled in', async () => {
  renderSection();
  await userEvent.click(screen.getByRole('button', { name: 'Send loan to Eve' }));
  expect(screen.getByRole('dialog', { name: 'Send a loan' })).toBeInTheDocument();
  expect(screen.getByLabelText('Member')).toHaveValue('m1');
  expect(screen.getByLabelText('Amount')).toHaveValue('1000');
});

test('a request that has been served shows what was sent, not a button', () => {
  hooks.loans.mockReturnValue(ok([loan({ id: 'l1', member_id: 'm1', principal: 1000, interest: 150, term_months: 1, wallet_id: 'w1' })]));
  renderSection();
  expect(screen.queryByRole('button', { name: 'Send loan to Eve' })).toBeNull();
  expect(screen.getByText('Sent K 1,000')).toBeInTheDocument();
});

test('Send a loan opens an empty sheet for a loan nobody requested', async () => {
  renderSection([]);
  expect(screen.getByText('No borrowing requests this month.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Send a loan' }));
  expect(screen.getByLabelText('Member')).toHaveValue('');
  expect(screen.getByLabelText('Amount')).toHaveValue('');
});

test('loans sent this month are listed with their terms and any stored warning', () => {
  hooks.loans.mockReturnValue(
    ok([loan({ id: 'l1', member_id: 'm2', principal: 800, interest: 120, term_months: 1, wallet_id: 'w1', cap_warning: 'Over the cap: owes K0, new loan K800, cap K750', arrears_warning: null })]),
  );
  renderSection([]);
  const list = screen.getByRole('heading', { name: 'Loans sent this month (1)' }).closest('div')!;
  expect(within(list).getByText('Ann')).toBeInTheDocument();
  expect(within(list).getByText('K 800')).toBeInTheDocument();
  expect(within(list).getByText(/Interest K 120 · 1 month · Airtel/)).toBeInTheDocument();
  expect(within(list).getByText(/Over the cap: owes K0/)).toBeInTheDocument();
});

test('nothing sent yet says so', () => {
  renderSection([]);
  expect(screen.getByText('No loans sent yet this month.')).toBeInTheDocument();
});

test('loading and failure of the loans query', async () => {
  hooks.loans.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderSection();
  expect(screen.getByText('Loading loans')).toBeInTheDocument();
  unmount();
  const refetch = vi.fn();
  hooks.loans.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch });
  renderSection();
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test src/features/desk/LoansSection.test.tsx`
Expected: FAIL (`./LoansSection` not found)

- [ ] **Step 3: Implement**

`src/features/desk/LoansSection.tsx`:

```tsx
import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { loanRequests } from '@/features/ledger/deskMoney';
import type { ActiveMember, DeclarationRow, Wallet } from '@/features/ledger/model';
import { useMonthLoans } from '@/features/ledger/queries';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { Alert, Badge, Button, Card, Skeleton } from '@/ui';
import { SendLoanSheet } from './SendLoanSheet';

type Props = { periodId: string; declarations: DeclarationRow[]; members: ActiveMember[]; wallets: Wallet[] };

export function LoansSection({ periodId, declarations, members, wallets }: Props) {
  const { group } = useGroup();
  const loans = useMonthLoans(group.id, periodId);
  const [sheet, setSheet] = useState<{ memberId?: string; amount?: number } | null>(null);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.short_name ?? 'Former member';
  const walletOf = (id: string | null) => wallets.find((w) => w.id === id)?.name;

  if (loans.data === undefined) {
    return loans.isError ? (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void loans.refetch()}>Try again</Button>}>
        {friendlyError(loans.error)}
      </Alert>
    ) : (
      <div role="status"><span className="sr-only">Loading loans</span><Skeleton className="h-40" /></div>
    );
  }
  const requests = loanRequests(declarations, loans.data);

  return (
    <section aria-labelledby="loans-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="loans-title" className="text-xl font-semibold text-fg">Loans</h2>
        <Button size="sm" onClick={() => setSheet({})}>Send a loan</Button>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-fg">Borrowing requests</h3>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No borrowing requests this month.</p>
        ) : (
          <ul role="list" className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.declaration.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-fg">{nameOf(r.memberId)}</p>
                  <p className="tabular text-sm text-muted">{money(r.amount)}</p>
                </div>
                {r.sent > 0 ? (
                  <Badge tone="success">Sent {money(r.sent)}</Badge>
                ) : (
                  <Button size="sm" aria-label={`Send loan to ${nameOf(r.memberId)}`} onClick={() => setSheet({ memberId: r.memberId, amount: r.amount })}>
                    Send loan
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div>
          <h3 className="text-lg font-semibold text-fg">Loans sent this month ({loans.data.length})</h3>
          {loans.data.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No loans sent yet this month.</p>
          ) : (
            <ul role="list" className="divide-y divide-line">
              {loans.data.map((l) => (
                <li key={l.id} className="grid gap-1 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-fg">{nameOf(l.member_id)}</span>
                    <span className="tabular font-semibold text-fg">{money(l.principal)}</span>
                  </div>
                  <p className="text-sm text-muted">
                    Interest {money(l.interest)} · {l.term_months} month{l.term_months === 1 ? '' : 's'}
                    {walletOf(l.wallet_id) ? ` · ${walletOf(l.wallet_id)}` : ''}
                  </p>
                  {l.cap_warning ? <p className="text-sm text-muted">{l.cap_warning}</p> : null}
                  {l.arrears_warning ? <p className="text-sm text-muted">{l.arrears_warning}</p> : null}
                  {l.approved_reason ? <p className="text-sm text-muted">Reason: {l.approved_reason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {sheet ? (
        <SendLoanSheet members={members} wallets={wallets} initialMemberId={sheet.memberId} initialAmount={sheet.amount} onClose={() => setSheet(null)} />
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Run tests, lint and typecheck**

Run: `bun run test src/features/desk/LoansSection.test.tsx && bun run lint && bun run typecheck`
Expected: PASS, clean. If the heading's `closest('div')` does not reach the list, point the test at `closest('li')`'s parent card instead.

- [ ] **Step 5: Commit**

```bash
git add src/features/desk/LoansSection.tsx src/features/desk/LoansSection.test.tsx
git commit -m "feat: Desk loans section

Borrowing requests from live declarations with a Send loan button (or what
was already sent), a Send a loan button for any other loan, and the month's
loans with their terms and stored warnings."
```

---

### Task 6: Penalties (sheet and section)

**Files:**
- Create: `src/features/desk/ApplyPenaltySheet.tsx`, `src/features/desk/PenaltiesSection.tsx`
- Test: `src/features/desk/ApplyPenaltySheet.test.tsx`, `src/features/desk/PenaltiesSection.test.tsx`

**Interfaces:**
- Consumes: `useSuggestedPenalties`, `useMonthPenalties`; `appliedGrounds`, `openSuggestions`, `groundLabel`, `splitReason`, `PenaltySuggestion`; `useLedgerAction`; `parseKwacha`.
- Produces:
  - `ApplyPenaltySheet({ periodId: string; members: ActiveMember[]; suggestion?: PenaltySuggestion; onClose: () => void })` — with a suggestion the member and ground are fixed and amount/reason prefilled; without, a member select, ground `other`, empty amount and reason.
  - `PenaltiesSection({ periodId: string; members: ActiveMember[] })`.

- [ ] **Step 1: Write the failing tests**

`src/features/desk/ApplyPenaltySheet.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { ApplyPenaltySheet } = await import('./ApplyPenaltySheet');

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
const SUGGESTION = { member_id: 'm1', short_name: 'Eve', ground: 'late_declaration', amount: 100, detail: 'Declared 2 days after the deadline' };
const onClose = vi.fn();
const renderSheet = (suggestion?: typeof SUGGESTION) =>
  renderLedger(<ApplyPenaltySheet periodId="p9" members={MEMBERS} suggestion={suggestion} onClose={onClose} />, { isAdmin: true });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
  onClose.mockReset();
});

test('a suggestion fixes the member and ground and prefills the amount and the reason', () => {
  renderSheet(SUGGESTION);
  expect(screen.getByText('Eve')).toBeInTheDocument();
  expect(screen.getByText('Late declaration')).toBeInTheDocument();
  expect(screen.queryByLabelText('Member')).toBeNull();
  expect(screen.getByLabelText('Amount')).toHaveValue('100');
  expect(screen.getByLabelText('Reason')).toHaveValue('Declared 2 days after the deadline');
});

test('applying takes a second tap, sends the edited amount with the suggestion’s ground, once', async () => {
  renderSheet(SUGGESTION);
  await userEvent.clear(screen.getByLabelText('Amount'));
  await userEvent.type(screen.getByLabelText('Amount'), '50');
  await userEvent.click(screen.getByRole('button', { name: 'Apply penalty' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to apply K 50 to Eve' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('apply_penalty', {
    p_member: 'm1', p_period: 'p9', p_amount: 50, p_ground: 'late_declaration', p_reason: 'Declared 2 days after the deadline',
  });
  expect(await screen.findByText('Penalty applied.')).toBeInTheDocument();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('a new penalty needs a member, an amount above zero and a reason', async () => {
  renderSheet();
  await userEvent.click(screen.getByRole('button', { name: 'Apply penalty' }));
  expect(await screen.findByText('Choose a member.')).toBeInTheDocument();
  expect(screen.getByText('Enter an amount above zero.')).toBeInTheDocument();
  expect(screen.getByText('Say why.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.selectOptions(screen.getByLabelText('Member'), 'm2');
  await userEvent.type(screen.getByLabelText('Amount'), '25');
  await userEvent.type(screen.getByLabelText('Reason'), 'Missed the meeting');
  await userEvent.click(screen.getByRole('button', { name: 'Apply penalty' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to apply K 25 to Ann' }));
  expect(rpc).toHaveBeenCalledWith('apply_penalty', { p_member: 'm2', p_period: 'p9', p_amount: 25, p_ground: 'other', p_reason: 'Missed the meeting' });
});

test('malformed or zero amounts are refused before any request', async () => {
  renderSheet(SUGGESTION);
  for (const bad of ['1,000', '250.555', '-5', '0']) {
    await userEvent.clear(screen.getByLabelText('Amount'));
    await userEvent.type(screen.getByLabelText('Amount'), bad);
    await userEvent.click(screen.getByRole('button', { name: /Apply penalty|Tap again/ }));
    expect(await screen.findByText(/Use kwacha and ngwee|Enter an amount above zero/), bad).toBeInTheDocument();
  }
  expect(rpc).not.toHaveBeenCalled();
});

test('tapping again while the request runs does not apply a second penalty', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderSheet(SUGGESTION);
  await userEvent.click(screen.getByRole('button', { name: 'Apply penalty' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to apply K 100 to Eve' }));
  await userEvent.click(screen.getByRole('button', { name: /Apply penalty|Tap again/ }));
  expect(rpc).toHaveBeenCalledTimes(1);
});

test('a refusal shows the friendly sentence and keeps the sheet open', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'period_not_open', code: 'P0001' } });
  renderSheet(SUGGESTION);
  await userEvent.click(screen.getByRole('button', { name: 'Apply penalty' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to apply K 100 to Eve' }));
  expect(await screen.findByText('That month isn’t open. Pick the current month, or open it first.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});
```

`src/features/desk/PenaltiesSection.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { entry, renderLedger } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ suggestions: vi.fn(), applied: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useSuggestedPenalties: () => hooks.suggestions(),
  useMonthPenalties: () => hooks.applied(),
}));
const { PenaltiesSection } = await import('./PenaltiesSection');

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const s = (member_id: string, short_name: string, ground: string, amount: number, detail: string) => ({ member_id, short_name, ground, amount, detail });

const renderSection = () => renderLedger(<PenaltiesSection periodId="p9" members={MEMBERS} />, { isAdmin: true });

beforeEach(() => {
  hooks.suggestions.mockReturnValue(ok([s('m1', 'Eve', 'late_declaration', 100, 'Declared 2 days after the deadline'), s('m2', 'Ann', 'under_saving', 50, 'Saved K100 of the K250 minimum')]));
  hooks.applied.mockReturnValue(ok([]));
});

test('suggestions show member, ground, amount and the engine’s detail', () => {
  renderSection();
  const row = screen.getByRole('button', { name: 'Apply penalty to Eve' }).closest('li')!;
  expect(within(row).getByText('Eve')).toBeInTheDocument();
  expect(within(row).getByText(/Late declaration/)).toBeInTheDocument();
  expect(within(row).getByText('K 100')).toBeInTheDocument();
  expect(within(row).getByText('Declared 2 days after the deadline')).toBeInTheDocument();
});

test('a suggestion already applied this month is not shown again', () => {
  hooks.applied.mockReturnValue(ok([entry({ id: 'p1', kind: 'penalty', member_id: 'm1', source: 'app', amount: 100, reason: 'late_declaration: Declared 2 days after the deadline' })]));
  renderSection();
  expect(screen.queryByRole('button', { name: 'Apply penalty to Eve' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Apply penalty to Ann' })).toBeInTheDocument();
});

test('Not now hides a suggestion for the session and records nothing', async () => {
  renderSection();
  await userEvent.click(screen.getByRole('button', { name: 'Not now for Eve' }));
  expect(screen.queryByRole('button', { name: 'Apply penalty to Eve' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Apply penalty to Ann' })).toBeInTheDocument();
});

test('Apply opens the sheet for that suggestion', async () => {
  renderSection();
  await userEvent.click(screen.getByRole('button', { name: 'Apply penalty to Ann' }));
  expect(screen.getByRole('dialog', { name: 'Apply a penalty' })).toBeInTheDocument();
  expect(screen.getByLabelText('Amount')).toHaveValue('50');
});

test('Add a penalty opens an empty sheet with a member to choose', async () => {
  renderSection();
  await userEvent.click(screen.getByRole('button', { name: 'Add a penalty' }));
  expect(screen.getByLabelText('Member')).toHaveValue('');
});

test('nothing to suggest says so', () => {
  hooks.suggestions.mockReturnValue(ok([]));
  renderSection();
  expect(screen.getByText('Nothing to suggest right now.')).toBeInTheDocument();
});

test('penalties applied this month are listed with their ground and reason, and flagged when corrected', () => {
  hooks.applied.mockReturnValue(
    ok([
      entry({ id: 'p1', kind: 'penalty', member_id: 'm1', source: 'app', amount: 100, reason: 'late_declaration: Declared 2 days after the deadline' }),
      entry({ id: 'p2', kind: 'waiver', member_id: 'm1', source: 'correction', corrects_entry_id: 'p1', amount: 100, reason: 'Slip found' }),
    ]),
  );
  renderSection();
  const list = screen.getByRole('heading', { name: 'Applied this month (1)' }).closest('div')!;
  expect(within(list).getByText('Eve')).toBeInTheDocument();
  expect(within(list).getByText('K 100')).toBeInTheDocument();
  expect(within(list).getByText(/Late declaration: Declared 2 days after the deadline/)).toBeInTheDocument();
  expect(within(list).getByText('Corrected')).toBeInTheDocument();
});

test('loading and failure', async () => {
  hooks.suggestions.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderSection();
  expect(screen.getByText('Loading penalties')).toBeInTheDocument();
  unmount();
  const refetch = vi.fn();
  hooks.suggestions.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch });
  renderSection();
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `bun run test src/features/desk/ApplyPenaltySheet.test.tsx src/features/desk/PenaltiesSection.test.tsx`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement**

`src/features/desk/ApplyPenaltySheet.tsx`:

```tsx
import { useState } from 'react';
import { useLedgerAction } from '@/features/ledger/actions';
import { groundLabel, type PenaltySuggestion } from '@/features/ledger/deskMoney';
import type { ActiveMember } from '@/features/ledger/model';
import { parseKwacha } from '@/features/ledger/money';
import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Button, SelectField, Sheet, TextField, useConfirmTap } from '@/ui';

type Props = { periodId: string; members: ActiveMember[]; suggestion?: PenaltySuggestion; onClose: () => void };
type Errors = { member?: string; amount?: string; reason?: string };

export function ApplyPenaltySheet({ periodId, members, suggestion, onClose }: Props) {
  const [memberId, setMemberId] = useState(suggestion?.member_id ?? '');
  const [amount, setAmount] = useState(suggestion ? String(suggestion.amount) : '');
  const [reason, setReason] = useState(suggestion?.detail ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const ground = suggestion?.ground ?? 'other';
  const name = members.find((m) => m.id === memberId)?.short_name ?? '';

  const apply = useLedgerAction(async (a: { amount: number; reason: string }) => {
    const { error } = await supabase.rpc('apply_penalty', {
      p_member: memberId,
      p_period: periodId,
      p_amount: a.amount,
      p_ground: ground,
      p_reason: a.reason,
    });
    if (error) throw error;
  }, 'Penalty applied.');

  const confirm = useConfirmTap(() => {
    const value = parseKwacha(amount);
    apply.mutate({ amount: value ?? 0, reason: reason.trim() }, { onSuccess: onClose });
  });
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    confirm.reset();
    set(v);
  };

  const tap = () => {
    const value = parseKwacha(amount);
    const next: Errors = {};
    if (!memberId) next.member = 'Choose a member.';
    if (value === null) next.amount = 'Use kwacha and ngwee, like 250 or 250.50.';
    else if (value <= 0) next.amount = 'Enter an amount above zero.';
    if (!reason.trim()) next.reason = 'Say why.';
    else if (reason.trim().length > 500) next.reason = 'Keep the reason to 500 characters or fewer.';
    setErrors(next);
    if (next.member || next.amount || next.reason) {
      confirm.reset();
      return;
    }
    confirm.tap();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Apply a penalty"
      description="It is charged to the member this month and recorded with your reason."
      footer={
        <Button fullWidth isLoading={apply.isPending} onClick={tap}>
          {confirm.armed ? `Tap again to apply ${money(parseKwacha(amount) ?? 0)} to ${name}` : 'Apply penalty'}
        </Button>
      }
    >
      <form className="grid gap-4" noValidate onSubmit={(e) => e.preventDefault()}>
        {suggestion ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Member</dt>
            <dd className="text-right font-semibold text-fg">{suggestion.short_name}</dd>
            <dt className="text-muted">Ground</dt>
            <dd className="text-right text-fg">{groundLabel(suggestion.ground)}</dd>
          </dl>
        ) : (
          <SelectField label="Member" value={memberId} error={errors.member} onChange={(e) => edit(setMemberId)(e.target.value)}>
            <option value="">Choose a member</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.short_name}</option>)}
          </SelectField>
        )}
        <TextField
          label="Amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          error={errors.amount}
          value={amount}
          onChange={(e) => edit(setAmount)(e.target.value)}
        />
        <TextField label="Reason" maxLength={500} autoComplete="off" error={errors.reason} value={reason} onChange={(e) => edit(setReason)(e.target.value)} />
      </form>
    </Sheet>
  );
}
```

`src/features/desk/PenaltiesSection.tsx`:

```tsx
import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { appliedGrounds, groundLabel, openSuggestions, splitReason, type PenaltySuggestion } from '@/features/ledger/deskMoney';
import type { ActiveMember } from '@/features/ledger/model';
import { useMonthPenalties, useSuggestedPenalties } from '@/features/ledger/queries';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { Alert, Badge, Button, Card, Skeleton } from '@/ui';
import { ApplyPenaltySheet } from './ApplyPenaltySheet';

type Props = { periodId: string; members: ActiveMember[] };

export function PenaltiesSection({ periodId, members }: Props) {
  const { group } = useGroup();
  const suggestions = useSuggestedPenalties(group.id, periodId);
  const applied = useMonthPenalties(group.id, periodId);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<{ suggestion?: PenaltySuggestion } | null>(null);
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.short_name ?? 'Former member';

  const failed = [suggestions, applied].find((q) => q.isError && !q.data);
  if (failed) {
    return (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => { void suggestions.refetch(); void applied.refetch(); }}>Try again</Button>}>
        {friendlyError(failed.error)}
      </Alert>
    );
  }
  if (suggestions.data === undefined || applied.data === undefined) {
    return <div role="status"><span className="sr-only">Loading penalties</span><Skeleton className="h-40" /></div>;
  }

  const open = openSuggestions(suggestions.data, appliedGrounds(applied.data), dismissed);
  const applications = applied.data.filter((e) => e.source === 'app');
  const corrected = new Set(applied.data.filter((e) => e.source === 'correction').map((e) => e.corrects_entry_id));
  const dismiss = (s: PenaltySuggestion) => setDismissed((d) => new Set(d).add(`${s.member_id}:${s.ground}`));

  return (
    <section aria-labelledby="penalties-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="penalties-title" className="text-xl font-semibold text-fg">Penalties</h2>
        <Button size="sm" variant="secondary" onClick={() => setSheet({})}>Add a penalty</Button>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-fg">Suggested</h3>
        <p className="mt-0.5 text-sm text-muted">Suggestions update until the month closes. “Not now” only hides one on this screen.</p>
        {open.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing to suggest right now.</p>
        ) : (
          <ul role="list" className="divide-y divide-line">
            {open.map((s) => (
              <li key={`${s.member_id}:${s.ground}`} className="grid gap-2 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-fg">{s.short_name}</span>
                  <span className="tabular font-semibold text-fg">{money(s.amount)}</span>
                </div>
                <p className="text-sm text-muted">{groundLabel(s.ground)}</p>
                <p className="text-sm text-muted">{s.detail}</p>
                <div className="flex gap-2">
                  <Button size="sm" aria-label={`Apply penalty to ${s.short_name}`} onClick={() => setSheet({ suggestion: s })}>Apply</Button>
                  <Button size="sm" variant="secondary" aria-label={`Not now for ${s.short_name}`} onClick={() => dismiss(s)}>Not now</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div>
          <h3 className="text-lg font-semibold text-fg">Applied this month ({applications.length})</h3>
          {applications.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No penalties applied yet this month.</p>
          ) : (
            <ul role="list" className="divide-y divide-line">
              {applications.map((e) => {
                const r = splitReason(e.reason);
                return (
                  <li key={e.id} className="grid gap-1 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-fg">{nameOf(e.member_id)}</span>
                      <span className="tabular font-semibold text-fg">{money(e.amount)}</span>
                    </div>
                    <p className="text-sm text-muted">{r.ground ? `${groundLabel(r.ground)}: ${r.text}` : r.text}</p>
                    {corrected.has(e.id) ? <div><Badge tone="info">Corrected</Badge></div> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {sheet ? <ApplyPenaltySheet periodId={periodId} members={members} suggestion={sheet.suggestion} onClose={() => setSheet(null)} /> : null}
    </section>
  );
}
```

- [ ] **Step 4: Run tests, lint and typecheck**

Run: `bun run test src/features/desk/ApplyPenaltySheet.test.tsx src/features/desk/PenaltiesSection.test.tsx && bun run lint && bun run typecheck`
Expected: PASS, clean. If `getByText('Eve')` finds two matches in the sheet test (name appears in the fixed-member row and in the armed button label only after the first tap), scope the first assertion to the `dl`.

- [ ] **Step 5: Commit**

```bash
git add src/features/desk/ApplyPenaltySheet.tsx src/features/desk/PenaltiesSection.tsx src/features/desk/ApplyPenaltySheet.test.tsx src/features/desk/PenaltiesSection.test.tsx
git commit -m "feat: Desk penalties

The engine's suggestions (minus those already applied or put off) with
Apply and Not now, Add a penalty for any other ground, and the month's applied
penalties. Applying takes a second tap and a written reason."
```

---

### Task 7: Wire into the Desk, final checks

**Files:**
- Modify: `src/features/desk/DeskPage.tsx`, `src/features/desk/DeskPage.test.tsx`

**Interfaces:**
- Consumes: `LoansSection`, `PenaltiesSection`.
- Produces: the finished Desk (month panel, inbox, loans, penalties, not-yet-declared).

- [ ] **Step 1: Update the Desk test first (it must fail)**

In `src/features/desk/DeskPage.test.tsx`:

1. Extend the hoisted hooks: `const hooks = vi.hoisted(() => ({ cycle: vi.fn(), wallets: vi.fn(), declarations: vi.fn(), members: vi.fn(), loans: vi.fn(), suggestions: vi.fn(), penalties: vi.fn() }));`
2. Extend the `@/features/ledger/queries` mock factory with:

```ts
  useMonthLoans: () => hooks.loans(),
  useSuggestedPenalties: () => hooks.suggestions(),
  useMonthPenalties: () => hooks.penalties(),
  useLoanCheck: () => ({ data: undefined, isError: false, error: null, isFetching: false }),
```

3. In `beforeEach` add: `hooks.loans.mockReturnValue(ok([])); hooks.suggestions.mockReturnValue(ok([])); hooks.penalties.mockReturnValue(ok([]));`
4. Add tests:

```tsx
test('with a month open the Desk also offers loans and penalties', () => {
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByRole('heading', { name: 'Loans' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Penalties' })).toBeInTheDocument();
});

test('without an open month there are no loans or penalties to manage', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8) }));
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.queryByRole('heading', { name: 'Loans' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Penalties' })).toBeNull();
});

test('a borrowing request on a declaration shows up in the loans section', () => {
  hooks.declarations.mockReturnValue(ok([declaration({ member_id: 'm1', borrowing_request: 1500 })]));
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByRole('button', { name: 'Send loan to Eve' })).toBeInTheDocument();
});
```

Run `bun run test src/features/desk/DeskPage.test.tsx`. Expected: the three new tests FAIL (no Loans/Penalties headings yet); the old ones still pass.

- [ ] **Step 2: Wire the sections in**

In `src/features/desk/DeskPage.tsx` add imports `import { LoansSection } from './LoansSection';` and `import { PenaltiesSection } from './PenaltiesSection';`, and in the `ready` branch render, between `DeclarationInbox` and `NotYetDeclared`:

```tsx
            <LoansSection periodId={open.id} declarations={declarations.data!} members={activeMembers(members.data!)} wallets={wallets.data!} />
            <PenaltiesSection periodId={open.id} members={activeMembers(members.data!)} />
```

- [ ] **Step 3: Run the Desk tests**

Run: `bun run test src/features/desk`
Expected: PASS

- [ ] **Step 4: Full verification**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: all green; the build warns only about the existing chunk-size notice.

Re-run the pgTAP agreement test one last time (Task 1 Step 4 command) and confirm no `not ok`.

- [ ] **Step 5: Commit**

```bash
git add src/features/desk
git commit -m "feat: loans and penalties on the Desk

The open month's Desk now offers borrowing requests and sending loans, the
engine's suggested penalties, and what was applied, between the declaration
inbox and the not-yet-declared list."
```

- [ ] **Step 6: Hand over**

Tell the user: the migration `20261010002200_loan_check.sql` must be applied with `bun run db:push` (dev first) before the Loans sheet works, since the preview calls it. Manual check on dev with a throwaway group: open a month, post a borrowing request as a member, preview and send a loan as the admin, apply a suggested penalty, and confirm `loans`, `entries` and `audit_log` rows.
