# Corrections, waivers and defaults (S3c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the treasurer one page per member to see their ledger and use the engine's three append-only tools: correct an entry to a new total, waive part of a charge, and mark or reverse a default, each with a recorded reason.

**Architecture:** UI only, no migration. Pure helpers in `corrections.ts` compute an entry's current amount for display; a pgTAP file and a Vitest test use the **same scenario** (100, waiver 30, +20, −10 → 80) so the screen and the engine cannot drift unnoticed. Three sheets (`CorrectEntrySheet`, `WaiveEntrySheet`, `DefaultPanel`) post through the existing RPCs; `MemberLedgerPage` and `MembersPage` are reached from a "Members" card on the Desk.

**Tech Stack:** Postgres/pgTAP, React 19, react-router, TanStack Query, supabase-js, Tailwind tokens from `src/ui`, Vitest + Testing Library, eslint, `tsc`.

**Spec:** `docs/superpowers/specs/2026-10-12-corrections-defaults-design.md` (builds on the ledger-engine spec §3, §5, §6 and the S1–S3b specs).

## Global Constraints

- **Shell setup for every command in this plan:** `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$HOME/.bun/bin:$PATH"` (Node must come before bun's shim or vitest cannot host jsdom).
- No database change, no migration, never `bun run db:push`. SQL is verified inside a rolled-back transaction with the runner from the S3a work (Task 1 re-creates it if the scratch files are gone).
- Corrections are append-only and land in the cycle's **open month**; the screen never claims to edit a closed month. Without an open month the posting buttons are disabled with the explanation.
- Money maths only in SQL. The only figure computed on screen is an entry's current amount (display), pinned to the engine by the shared scenario; the engine re-validates every post. Amounts typed with `parseKwacha`; sums with `sumKwacha`.
- Every post is a two-tap confirm that states the change, a button disabled while the request runs, and a sheet that cannot be closed while it runs. Any edit disarms the second tap.
- Every screen has loading (labelled), error-with-retry and empty states; 48px targets; tokens only; labelled sections; curly apostrophes `’`. Server errors go through `friendlyError` (all codes used here have messages).
- Tests: synthetic data only. Find loading text with `getByText` (the toast region has `role="status"`). Mock `react-router`'s `useParams` / `useNavigate` where needed.
- Commits: subject + body, **no `Co-Authored-By` trailer**. Never `git push`, never `git add -A`, never stage anything under `docs/` or `semantic-review/`.

## Review Focus

- The screen's "Now K…" equals what the engine treats as current: the shared scenario in pgTAP and Vitest. (Tasks 1, 2.)
- Correction entries are nested under their original, never rows of their own, and an original from another cycle is not shown. (Task 5.)
- **Correct** appears only for correctable kinds, **Waive** only for waivable kinds with something still charged; loans, interest shares and corrections get neither. (Tasks 2, 5.)
- With no open month the posting buttons are disabled and say why. (Task 5.)
- A blank new total is refused (not read as 0); setting a total equal to the current amount is refused; waiving more than is still charged is refused. (Task 3.)
- A double tap, or closing the sheet mid-request, posts once. (Tasks 3, 4.)
- A default needs a reason, shows who/when/why, and can be reversed. (Task 4.)
- A non-admin makes no requests on either page; a member id that is not in the group shows a clear message. (Tasks 5, 6.)

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/tests/database/19_correction_parity.sql` | pgTAP: the effective-amount rule, eligibility, defaults |
| `src/features/ledger/corrections.ts` | `isCorrectable`, `isWaivable`, `correctionsOf`, `effectiveAmount`, `correctionLine` |
| `src/features/ledger/queries.ts` | + `useMemberStatuses`; refresh key (modified) |
| `src/features/ledger/testFixtures.tsx` | + `memberStatus` (modified) |
| `src/features/desk/CorrectEntrySheet.tsx` | Correct to a new total |
| `src/features/desk/WaiveEntrySheet.tsx` | Waive part or all of a charge |
| `src/features/desk/DefaultPanel.tsx` | Default status and its sheet |
| `src/features/desk/MemberLedgerPage.tsx` | `/desk/members/:memberId` |
| `src/features/desk/MembersPage.tsx` | `/desk/members` |
| `src/app/router.tsx`, `src/features/desk/DeskPage.tsx` | routes and the Members card (modified) |

---

### Task 1: pgTAP parity for the effective amount

**Files:**
- Create: `supabase/tests/database/19_correction_parity.sql`

**Interfaces:**
- Produces the numbers Task 2's Vitest scenario reuses: a penalty of 100, a waiver of 30, a correction to 90 (lands as a +20 `penalty` correction), a correction to 80 (lands as a 10 `adjustment`) → effective 80.

- [ ] **Step 1: Write the test (it needs no new SQL, so it should pass at once; the point is that it pins the rule)**

`supabase/tests/database/19_correction_parity.sql`:

```sql
begin;
select * from no_plan();
select tests.ledger_fixture();

select tests.login_as(tests.id('admin'));
select lives_ok($$select open_period(tests.id('lcycle'), 1)$$, 'February opens');
reset role;
select tests.ledger_feb_savings();

select tests.login_as(tests.id('admin'));
select lives_ok($$select apply_penalty(tests.lm('Dee'), tests.lp(1), 100, 'other', 'Missed the meeting')$$, 'a penalty of 100');
reset role;
select tests.remember('pen', (select id from entries where member_id = tests.lm('Dee') and kind = 'penalty'));

-- 100, waive 30, correct to 90, correct to 80 ------------------------------------------------------
select tests.login_as(tests.id('admin'));
select lives_ok($$select post_waiver(tests.id('pen'), 30, 'Slip found')$$, 'waive 30 (70 left)');
select lives_ok($$select post_correction(tests.id('pen'), 90, 'Treasurer raised it')$$, 'correct to 90: a +20 correction');
select lives_ok($$select post_correction(tests.id('pen'), 80, 'Settled on 80')$$, 'correct to 80: a -10 adjustment');
reset role;
select is((select array_agg(c.kind || ':' || c.amount order by c.amount desc) from entries c where c.corrects_entry_id = tests.id('pen')),
  array['waiver:30.00', 'penalty:20.00', 'adjustment:10.00'], 'the corrections are a waiver of 30, a penalty of 20 and an adjustment of 10');
select ok((select bool_and(c.source = 'correction' and c.period_id = tests.lp(1)) from entries c where c.corrects_entry_id = tests.id('pen')),
  'each lands in the open month, as a correction');

-- the engine's own view of the effective amount: 100 + 20 - 30 - 10 = 80 -----------------------------
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('pen'), 80, 'No change')$$, 'P0001', 'invalid_amount',
  'the effective amount is exactly 80: setting it to 80 changes nothing');
select throws_ok($$select post_waiver(tests.id('pen'), 80.01, 'Too much')$$, 'P0001', 'invalid_amount', 'only 80 is still charged');
select lives_ok($$select post_waiver(tests.id('pen'), 80, 'Waive the rest')$$, 'waiving exactly 80 is allowed');
select throws_ok($$select post_waiver(tests.id('pen'), 0.01, 'Nothing left')$$, 'P0001', 'invalid_amount', 'and then nothing is left to waive');
reset role;

-- what can and cannot be changed ---------------------------------------------------------------
select tests.remember('corr', (select id from entries where corrects_entry_id = tests.id('pen') order by amount desc limit 1));
select tests.remember('saving', (select id from entries where member_id = tests.lm('Dee') and kind = 'saving'));
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('corr'), 5, 'again')$$, 'P0001', 'entry_not_found', 'a correction is never corrected');
select throws_ok($$select post_waiver(tests.id('saving'), 10, 'no')$$, 'P0001', 'entry_not_found', 'a saving cannot be waived');
select lives_ok($$select post_correction(tests.id('saving'), 300, 'Paid 300, not 250')$$, 'a saving can be corrected');
select lives_ok($$select send_loan(tests.lm('Cid'), 3000, tests.id('w_airtel'))$$, 'a loan is sent');
reset role;
select tests.remember('loan_sent', (select id from entries where member_id = tests.lm('Cid') and kind = 'loan_sent'));
select tests.remember('loan_int', (select id from entries where member_id = tests.lm('Cid') and kind = 'loan_interest'));
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('loan_sent'), 1, 'no')$$, 'P0001', 'entry_not_found', 'a loan is not corrected');
select throws_ok($$select post_waiver(tests.id('loan_sent'), 1, 'no')$$, 'P0001', 'entry_not_found', 'a loan principal is not waived');
select lives_ok($$select post_waiver(tests.id('loan_int'), 100, 'Group agreed')$$, 'loan interest can be waived');
reset role;

-- who may, and what is needed ------------------------------------------------------------------
select tests.login_as(tests.id('member'));
select throws_ok($$select post_correction(tests.id('saving'), 1, 'x')$$, '42501', 'not_admin', 'a member cannot correct');
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, 'x')$$, '42501', 'not_admin', 'a member cannot mark a default');
reset role;
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('saving'), 1, ' ')$$, 'P0001', 'reason_required', 'a correction needs a reason');
select throws_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, ' ')$$, 'P0001', 'reason_required', 'a default needs a reason');
select lives_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), true, 'Missed three months')$$, 'mark a default');
reset role;
select is((select defaulted from member_status where member_id = tests.lm('Dee') and cycle_id = tests.id('lcycle')), true, 'Dee is defaulted');
select tests.login_as(tests.id('admin'));
select lives_ok($$select set_default(tests.lm('Dee'), tests.id('lcycle'), false, 'Paid up')$$, 'reverse it');
reset role;
select is((select defaulted from member_status where member_id = tests.lm('Dee') and cycle_id = tests.id('lcycle')), false, 'Dee is back in good standing');
select is((select count(*)::int from member_status where member_id = tests.lm('Dee')), 1, 'still one row per member and cycle');

-- no open month: nothing can be posted ------------------------------------------------------------
update periods set status = 'closed' where id = tests.lp(1);
select tests.login_as(tests.id('admin'));
select throws_ok($$select post_correction(tests.id('saving'), 10, 'late')$$, 'P0001', 'period_not_open', 'with no open month a correction is refused');
select throws_ok($$select post_waiver(tests.id('loan_int'), 1, 'late')$$, 'P0001', 'period_not_open', 'and so is a waiver');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Make sure the rollback runner exists**

The runner lives in the session scratchpad. If `run.mjs` / `combine.py` are missing, recreate them exactly as in the S3a plan (Task 1, Step 2: `run.mjs` runs `discard temp` before each of `00_helpers.sql` and `00_ledger_helpers.sql`, then the test, always rolls back and drops schema `tests`; `combine.py MIG|- TEST OUT` splices a migration after the test's first `begin;`).

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$HOME/.bun/bin:$PATH"
S=/tmp/claude-1000/-home-bk08-dev-web-village-banking/43e07bdc-ccaf-4683-870c-76c605cf3048/scratchpad
ls $S/run.mjs $S/combine.py
```

Expected: both files listed.

- [ ] **Step 3: Run the test against dev (read-only, rolled back)**

```bash
set -a; . ./.env.local; set +a
python3 $S/combine.py - supabase/tests/database/19_correction_parity.sql $S/c19.sql && bun $S/run.mjs $S/c19.sql | grep -v '^ok'
```

Expected: only the `1..N` plan line (no `not ok`, no `ERR`). If a figure differs (for example the order of the corrections), work out the engine's true value, confirm it through the engine, and rule on it in the ledger; never loosen an assertion to make it pass. This test pins existing behaviour, so a failure means the engine does something this plan misdescribes.

- [ ] **Step 4: Commit**

```bash
git add supabase/tests/database/19_correction_parity.sql
git commit -m "test: pin the effective-amount rule of corrections

A penalty of 100, a waiver of 30, a correction to 90 and one to 80 leave 80,
proven by the engine refusing a no-op correction to 80 and a waiver above 80.
Also pins what can and cannot be corrected or waived, defaults, and the
open-month requirement. No SQL changes."
```

---

### Task 2: Helpers, status hook and fixtures

**Files:**
- Create: `src/features/ledger/corrections.ts`
- Modify: `src/features/ledger/queries.ts`, `src/features/ledger/testFixtures.tsx`
- Test: `src/features/ledger/corrections.test.ts`, `src/features/ledger/statusQueries.test.tsx`

**Interfaces:**
- Produces:
  - `corrections.ts`: `isCorrectable(e: EntryRow): boolean`, `isWaivable(e: EntryRow): boolean`, `correctionsOf(entryId: string, entries: EntryRow[]): EntryRow[]`, `effectiveAmount(e: EntryRow, entries: EntryRow[]): number`, `correctionLine(c: EntryRow): string`
  - `queries.ts`: `type MemberStatusRow = Tables<'member_status'>`, `useMemberStatuses(groupId: string, cycleId: string | undefined)` → `MemberStatusRow[]`; `useRefreshLedger` also invalidates `['member-statuses', groupId]`
  - `testFixtures.tsx`: `memberStatus(o?)`

- [ ] **Step 1: Write the failing tests**

`src/features/ledger/corrections.test.ts`:

```ts
import { expect, test } from 'vitest';
import { correctionLine, correctionsOf, effectiveAmount, isCorrectable, isWaivable } from './corrections';
import { entry } from './testFixtures';

// The same scenario as supabase/tests/database/19_correction_parity.sql: 100, waive 30, correct to 90 (+20), correct to 80 (-10).
const ORIGINAL = entry({ id: 'e1', kind: 'penalty', amount: 100, source: 'app', period_id: 'p8', created_at: '2026-09-05T08:00:00Z' });
const SCENARIO = [
  ORIGINAL,
  entry({ id: 'c1', kind: 'waiver', amount: 30, source: 'correction', corrects_entry_id: 'e1', reason: 'Slip found', period_id: 'p9', created_at: '2026-10-08T08:00:00Z' }),
  entry({ id: 'c2', kind: 'penalty', amount: 20, source: 'correction', corrects_entry_id: 'e1', reason: 'Treasurer raised it', period_id: 'p9', created_at: '2026-10-08T08:01:00Z' }),
  entry({ id: 'c3', kind: 'adjustment', amount: 10, source: 'correction', corrects_entry_id: 'e1', reason: 'Settled on 80', period_id: 'p9', created_at: '2026-10-08T08:02:00Z' }),
];

test('the current amount is the original plus increases less waivers and adjustments: 100 + 20 - 30 - 10 = 80, as the engine says', () => {
  expect(effectiveAmount(ORIGINAL, SCENARIO)).toBe(80);
});

test('an entry nobody corrected is just its amount, and other entries’ corrections do not leak in', () => {
  const other = entry({ id: 'e2', kind: 'saving', amount: 250 });
  expect(effectiveAmount(other, [...SCENARIO, other])).toBe(250);
});

test('ngwee add up exactly', () => {
  const e = entry({ id: 'e3', kind: 'excess_charge', amount: 0.1, source: 'app' });
  const c = entry({ id: 'c9', kind: 'excess_charge', amount: 0.2, source: 'correction', corrects_entry_id: 'e3', reason: 'x' });
  expect(effectiveAmount(e, [e, c])).toBe(0.3);
});

test('correctionsOf lists an entry’s corrections oldest first', () => {
  expect(correctionsOf('e1', SCENARIO).map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  expect(correctionsOf('nope', SCENARIO)).toEqual([]);
});

test('correctionLine says which way a correction moved, with its amount', () => {
  expect(correctionLine(SCENARIO[1]!)).toBe('−K 30 waived');
  expect(correctionLine(SCENARIO[2]!)).toBe('+K 20 added');
  expect(correctionLine(SCENARIO[3]!)).toBe('−K 10 reduced');
});

test('only these kinds can be corrected, and never a correction or an entry with no member', () => {
  for (const kind of ['saving', 'payment', 'membership', 'txn_fee', 'penalty', 'excess_charge']) {
    expect(isCorrectable(entry({ kind, source: 'app' })), kind).toBe(true);
  }
  for (const kind of ['loan_sent', 'loan_interest', 'interest_share', 'payout_fee', 'waiver', 'adjustment']) {
    expect(isCorrectable(entry({ kind, source: 'app' })), kind).toBe(false);
  }
  expect(isCorrectable(entry({ kind: 'saving', source: 'correction', corrects_entry_id: 'e1', reason: 'x' }))).toBe(false);
  expect(isCorrectable(entry({ kind: 'saving', member_id: null }))).toBe(false);
});

test('only charges can be waived, and never a correction', () => {
  for (const kind of ['loan_interest', 'excess_charge', 'penalty']) expect(isWaivable(entry({ kind, source: 'app' })), kind).toBe(true);
  for (const kind of ['saving', 'payment', 'loan_sent', 'interest_share', 'waiver']) expect(isWaivable(entry({ kind, source: 'app' })), kind).toBe(false);
  expect(isWaivable(entry({ kind: 'penalty', source: 'correction', corrects_entry_id: 'e1', reason: 'x' }))).toBe(false);
});
```

`src/features/ledger/statusQueries.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

const calls = vi.hoisted(() => ({ eq: [] as Array<[string, unknown]>, result: vi.fn() }));
vi.mock('@/lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'order']) chain[m] = () => chain;
  chain.eq = (col: string, val: unknown) => {
    calls.eq.push([col, val]);
    return chain;
  };
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(calls.result()).then(res, rej);
  return { supabase: { from: () => chain } };
});
const { useMemberStatuses } = await import('./queries');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  calls.eq.length = 0;
  calls.result.mockReset();
});

test('the cycle’s default flags are asked for by cycle', async () => {
  calls.result.mockReturnValue({ data: [], error: null });
  const { result } = renderHook(() => useMemberStatuses('g1', 'c1'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.eq).toEqual([['cycle_id', 'c1']]);
});

test('nothing is asked without a cycle', () => {
  const { result } = renderHook(() => useMemberStatuses('g1', undefined), { wrapper });
  expect(result.current.fetchStatus).toBe('idle');
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$HOME/.bun/bin:$PATH"
bun run test src/features/ledger/corrections.test.ts src/features/ledger/statusQueries.test.tsx
```

Expected: FAIL (`./corrections` not found; `useMemberStatuses` not exported)

- [ ] **Step 3: Implement**

`src/features/ledger/corrections.ts`:

```ts
import { money } from '@/lib/format';
import type { EntryRow } from './memberViews';
import { sumKwacha } from './money';

// The engine's rules (20261010001100 / 20261010001700): what post_correction and post_waiver accept, and how the current amount is worked out.
const CORRECTABLE = ['saving', 'payment', 'membership', 'txn_fee', 'penalty', 'excess_charge'];
const WAIVABLE = ['loan_interest', 'excess_charge', 'penalty'];
const SUBTRACTS = ['waiver', 'adjustment'];

/** A member-bound original (never a correction) of a kind the engine lets the treasurer correct. payout_fee has no member, so no member page reaches it. */
export const isCorrectable = (e: EntryRow): boolean => e.source !== 'correction' && e.member_id !== null && CORRECTABLE.includes(e.kind);

export const isWaivable = (e: EntryRow): boolean => e.source !== 'correction' && e.member_id !== null && WAIVABLE.includes(e.kind);

/** The corrections that point back at an entry, oldest first. */
export const correctionsOf = (entryId: string, entries: EntryRow[]): EntryRow[] =>
  entries
    .filter((c) => c.corrects_entry_id === entryId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));

/**
 * The entry's amount plus the corrections that raise it, less the waivers and adjustments. Display only: the engine works out the same
 * figure itself and re-checks every post (pinned by supabase/tests/database/19_correction_parity.sql and the same scenario in the tests).
 */
export const effectiveAmount = (e: EntryRow, entries: EntryRow[]): number =>
  sumKwacha(e.amount, ...correctionsOf(e.id, entries).map((c) => (SUBTRACTS.includes(c.kind) ? -c.amount : c.amount)));

/** "−K 30 waived", "+K 20 added", "−K 10 reduced". */
export function correctionLine(c: EntryRow): string {
  if (c.kind === 'waiver') return `−${money(c.amount)} waived`;
  if (c.kind === 'adjustment') return `−${money(c.amount)} reduced`;
  return `+${money(c.amount)} added`;
}
```

In `src/features/ledger/queries.ts`: add `import type { Tables } from '@/lib/database.types';` with the other imports, add `qc.invalidateQueries({ queryKey: ['member-statuses', groupId] }),` to the list in `useRefreshLedger`, and append:

```ts
export type MemberStatusRow = Tables<'member_status'>;

/** Who is marked as defaulted in the cycle (one row per member and cycle; no row means in good standing). */
export function useMemberStatuses(groupId: string, cycleId: string | undefined) {
  return useQuery({
    queryKey: ['member-statuses', groupId, cycleId],
    enabled: Boolean(cycleId),
    queryFn: async (): Promise<MemberStatusRow[]> => {
      const { data, error } = await supabase.from('member_status').select('*').eq('cycle_id', cycleId!);
      if (error) throw error;
      return data;
    },
  });
}
```

In `src/features/ledger/testFixtures.tsx` add `import type { MemberStatusRow } from './queries';` beside the other type imports (merge with the existing `./queries` import if one exists) and append:

```tsx
export const memberStatus = (o: Partial<MemberStatusRow> = {}): MemberStatusRow => ({
  id: 'ms1', created_at: '2026-10-08T08:00:00Z', group_id: 'g1', member_id: 'm1', cycle_id: 'c1', defaulted: true,
  changed_at: '2026-10-08T08:00:00Z', changed_by: null, reason: 'Missed three months', ...o,
});
```

- [ ] **Step 4: Run tests, lint and typecheck**

```bash
bun run test src/features/ledger && bun run lint && bun run typecheck
```

Expected: PASS, clean

- [ ] **Step 5: Commit**

```bash
git add src/features/ledger
git commit -m "feat: helpers for corrections, waivers and defaults

The current amount of an entry (original plus increases less waivers and
adjustments) pinned to the engine by the same scenario as the pgTAP test, what
can be corrected or waived, a correction as a signed line, and a hook for the
cycle's default flags."
```

---

### Task 3: Correct and waive sheets

**Files:**
- Create: `src/features/desk/CorrectEntrySheet.tsx`, `src/features/desk/WaiveEntrySheet.tsx`
- Test: `src/features/desk/CorrectEntrySheet.test.tsx`, `src/features/desk/WaiveEntrySheet.test.tsx`

**Interfaces:**
- Produces:
  - `CorrectEntrySheet({ entry: EntryRow; current: number; onClose: () => void })` → `post_correction({ p_entry, p_new_amount, p_reason })`
  - `WaiveEntrySheet({ entry: EntryRow; current: number; onClose: () => void })` → `post_waiver({ p_entry, p_amount, p_reason })`

- [ ] **Step 1: Write the failing tests**

`src/features/desk/CorrectEntrySheet.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { entry, renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { CorrectEntrySheet } = await import('./CorrectEntrySheet');

const PAYMENT = entry({ id: 'e1', kind: 'payment', amount: 250, source: 'app' });
const onClose = vi.fn();
const renderSheet = (current = 250) => renderLedger(<CorrectEntrySheet entry={PAYMENT} current={current} onClose={onClose} />, { isAdmin: true });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
  onClose.mockReset();
});

test('shows what is being corrected and what it is now', () => {
  renderSheet(200);
  expect(screen.getByText('Payment')).toBeInTheDocument();
  expect(screen.getByText('Recorded').nextElementSibling).toHaveTextContent('K 250');
  expect(screen.getByText('Now').nextElementSibling).toHaveTextContent('K 200');
});

test('a blank total is refused, not read as zero', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('Reason'), 'Wrong amount typed');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  expect(await screen.findByText('Enter the new total.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('the same total as now is refused, since it would change nothing', async () => {
  renderSheet(250);
  await userEvent.type(screen.getByLabelText('New total'), '250');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  expect(await screen.findByText('That is already the amount.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('malformed totals are refused before any request, and zero is a valid total', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  for (const bad of ['1,000', '250.555', '-5', '1e3']) {
    await userEvent.clear(screen.getByLabelText('New total'));
    await userEvent.type(screen.getByLabelText('New total'), bad);
    await userEvent.click(screen.getByRole('button', { name: /Post correction|Tap again/ }));
    expect(await screen.findByText('Use kwacha and ngwee, like 250 or 250.50.'), bad).toBeInTheDocument();
  }
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.clear(screen.getByLabelText('New total'));
  await userEvent.type(screen.getByLabelText('New total'), '0');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  expect(screen.getByRole('button', { name: 'Tap again to change K 250 to K 0' })).toBeInTheDocument();
});

test('a reason is required', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('New total'), '200');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  expect(await screen.findByText('Say why.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('posting takes a second tap that states the change, sends the exact values once, and closes', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('New total'), '200');
  await userEvent.type(screen.getByLabelText('Reason'), 'Paid 200, not 250');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to change K 250 to K 200' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('post_correction', { p_entry: 'e1', p_new_amount: 200, p_reason: 'Paid 200, not 250' });
  expect(await screen.findByText('Correction posted.')).toBeInTheDocument();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('editing a field disarms the second tap', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('New total'), '200');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  await userEvent.type(screen.getByLabelText('New total'), '0');
  expect(screen.getByRole('button', { name: 'Post correction' })).toBeInTheDocument();
});

test('tapping again while the request runs posts once, and the sheet cannot be closed meanwhile', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderSheet();
  await userEvent.type(screen.getByLabelText('New total'), '200');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to change K 250 to K 200' }));
  await userEvent.click(screen.getByRole('button', { name: /Post correction|Tap again/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
});

test('a refusal from the engine shows its friendly sentence and keeps the sheet open', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'period_not_open', code: 'P0001' } });
  renderSheet();
  await userEvent.type(screen.getByLabelText('New total'), '200');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to change K 250 to K 200' }));
  expect(await screen.findByText('That month isn’t open. Pick the current month, or open it first.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});
```

`src/features/desk/WaiveEntrySheet.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { entry, renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { WaiveEntrySheet } = await import('./WaiveEntrySheet');

const PENALTY = entry({ id: 'e1', kind: 'penalty', amount: 120, source: 'app' });
const onClose = vi.fn();
const renderSheet = (current = 120) => renderLedger(<WaiveEntrySheet entry={PENALTY} current={current} onClose={onClose} />, { isAdmin: true });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
  onClose.mockReset();
});

test('shows the charge and how much is still charged', () => {
  renderSheet(80);
  expect(screen.getByText('Penalty')).toBeInTheDocument();
  expect(screen.getByText('Still charged').nextElementSibling).toHaveTextContent('K 80');
});

test('zero, blank and malformed amounts are refused before any request', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post waiver' }));
  expect(await screen.findByText('Enter an amount above zero.')).toBeInTheDocument();
  for (const bad of ['0', '1,000', '-5', '1e3']) {
    await userEvent.clear(screen.getByLabelText('Amount to waive'));
    await userEvent.type(screen.getByLabelText('Amount to waive'), bad);
    await userEvent.click(screen.getByRole('button', { name: /Post waiver|Tap again/ }));
    expect(await screen.findByText(/Use kwacha and ngwee|Enter an amount above zero/), bad).toBeInTheDocument();
  }
  expect(rpc).not.toHaveBeenCalled();
});

test('more than is still charged is refused', async () => {
  renderSheet(80);
  await userEvent.type(screen.getByLabelText('Amount to waive'), '80.01');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post waiver' }));
  expect(await screen.findByText('You can waive at most K 80.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('a reason is required', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('Amount to waive'), '50');
  await userEvent.click(screen.getByRole('button', { name: 'Post waiver' }));
  expect(await screen.findByText('Say why.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('waiving takes a second tap that states the change, sends the exact values once, and closes', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('Amount to waive'), '50');
  await userEvent.type(screen.getByLabelText('Reason'), 'Slip found');
  await userEvent.click(screen.getByRole('button', { name: 'Post waiver' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to waive K 50 of K 120' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('post_waiver', { p_entry: 'e1', p_amount: 50, p_reason: 'Slip found' });
  expect(await screen.findByText('Waiver posted.')).toBeInTheDocument();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('tapping again while the request runs waives once, and the sheet cannot be closed meanwhile', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderSheet();
  await userEvent.type(screen.getByLabelText('Amount to waive'), '50');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post waiver' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to waive K 50 of K 120' }));
  await userEvent.click(screen.getByRole('button', { name: /Post waiver|Tap again/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
});

test('a refusal from the engine shows its friendly sentence and keeps the sheet open', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'invalid_amount', code: 'P0001' } });
  renderSheet();
  await userEvent.type(screen.getByLabelText('Amount to waive'), '50');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post waiver' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to waive K 50 of K 120' }));
  expect(await screen.findByText('Check the amount: kwacha and ngwee, and not below zero.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
bun run test src/features/desk/CorrectEntrySheet.test.tsx src/features/desk/WaiveEntrySheet.test.tsx
```

Expected: FAIL (modules not found)

- [ ] **Step 3: Implement**

`src/features/desk/CorrectEntrySheet.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { useLedgerAction } from '@/features/ledger/actions';
import { kindLabel, type EntryRow } from '@/features/ledger/memberViews';
import { parseKwacha, sumKwacha } from '@/features/ledger/money';
import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Button, Sheet, TextField, useConfirmTap } from '@/ui';

type Props = { entry: EntryRow; current: number; onClose: () => void };
type Errors = { total?: string; reason?: string };

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-muted">{label}</dt>
    <dd className="tabular text-right text-fg">{children}</dd>
  </>
);

/** Set an entry's total to a new amount. The correction lands in the open month; the original stays where it was. */
export function CorrectEntrySheet({ entry, current, onClose }: Props) {
  const [total, setTotal] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const value = parseKwacha(total);

  const post = useLedgerAction(async (a: { amount: number; reason: string }) => {
    const { error } = await supabase.rpc('post_correction', { p_entry: entry.id, p_new_amount: a.amount, p_reason: a.reason });
    if (error) throw error;
  }, 'Correction posted.');
  const confirm = useConfirmTap(() => post.mutate({ amount: value ?? 0, reason: reason.trim() }, { onSuccess: onClose }));
  // Closing mid-request would let the same correction be posted again from the list behind it.
  const close = () => {
    if (!post.isPending) onClose();
  };
  // Any edit disarms the second tap, so what is posted is always what was last seen.
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    confirm.reset();
    set(v);
  };

  const tap = () => {
    const next: Errors = {};
    if (total.trim() === '') next.total = 'Enter the new total.';
    else if (value === null) next.total = 'Use kwacha and ngwee, like 250 or 250.50.';
    else if (sumKwacha(value, -current) === 0) next.total = 'That is already the amount.';
    if (!reason.trim()) next.reason = 'Say why.';
    else if (reason.trim().length > 500) next.reason = 'Keep the reason to 500 characters or fewer.';
    setErrors(next);
    if (next.total || next.reason) {
      confirm.reset();
      return;
    }
    confirm.tap();
  };

  return (
    <Sheet
      open
      onClose={close}
      title="Correct an entry"
      description="The correction is added to the open month with your reason. The original stays in its own month."
      footer={
        <Button fullWidth isLoading={post.isPending} onClick={tap}>
          {confirm.armed ? `Tap again to change ${money(current)} to ${money(value ?? 0)}` : 'Post correction'}
        </Button>
      }
    >
      <form className="grid gap-4" noValidate onSubmit={(e) => e.preventDefault()}>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Entry</dt>
          <dd className="text-right font-semibold text-fg">{kindLabel(entry.kind)}</dd>
          <Row label="Recorded">{money(entry.amount)}</Row>
          <Row label="Now">{money(current)}</Row>
        </dl>
        <TextField
          label="New total"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          error={errors.total}
          value={total}
          onChange={(e) => edit(setTotal)(e.target.value)}
        />
        <TextField label="Reason" maxLength={500} autoComplete="off" error={errors.reason} value={reason} onChange={(e) => edit(setReason)(e.target.value)} />
      </form>
    </Sheet>
  );
}
```

`src/features/desk/WaiveEntrySheet.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { useLedgerAction } from '@/features/ledger/actions';
import { kindLabel, type EntryRow } from '@/features/ledger/memberViews';
import { parseKwacha } from '@/features/ledger/money';
import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Button, Sheet, TextField, useConfirmTap } from '@/ui';

type Props = { entry: EntryRow; current: number; onClose: () => void };
type Errors = { amount?: string; reason?: string };

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-muted">{label}</dt>
    <dd className="tabular text-right text-fg">{children}</dd>
  </>
);

/** Waive part or all of a charge. The waiver lands in the open month; the original stays where it was. */
export function WaiveEntrySheet({ entry, current, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const value = parseKwacha(amount);

  const post = useLedgerAction(async (a: { amount: number; reason: string }) => {
    const { error } = await supabase.rpc('post_waiver', { p_entry: entry.id, p_amount: a.amount, p_reason: a.reason });
    if (error) throw error;
  }, 'Waiver posted.');
  const confirm = useConfirmTap(() => post.mutate({ amount: value ?? 0, reason: reason.trim() }, { onSuccess: onClose }));
  // Closing mid-request would let the same waiver be posted again from the list behind it.
  const close = () => {
    if (!post.isPending) onClose();
  };
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    confirm.reset();
    set(v);
  };

  const tap = () => {
    const next: Errors = {};
    if (value === null) next.amount = 'Use kwacha and ngwee, like 250 or 250.50.';
    else if (value <= 0) next.amount = 'Enter an amount above zero.';
    else if (Math.round(value * 100) > Math.round(current * 100)) next.amount = `You can waive at most ${money(current)}.`;
    if (!reason.trim()) next.reason = 'Say why.';
    else if (reason.trim().length > 500) next.reason = 'Keep the reason to 500 characters or fewer.';
    setErrors(next);
    if (next.amount || next.reason) {
      confirm.reset();
      return;
    }
    confirm.tap();
  };

  return (
    <Sheet
      open
      onClose={close}
      title="Waive a charge"
      description="The waiver is added to the open month with your reason. The original charge stays in its own month."
      footer={
        <Button fullWidth isLoading={post.isPending} onClick={tap}>
          {confirm.armed ? `Tap again to waive ${money(value ?? 0)} of ${money(current)}` : 'Post waiver'}
        </Button>
      }
    >
      <form className="grid gap-4" noValidate onSubmit={(e) => e.preventDefault()}>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Charge</dt>
          <dd className="text-right font-semibold text-fg">{kindLabel(entry.kind)}</dd>
          <Row label="Still charged">{money(current)}</Row>
        </dl>
        <TextField
          label="Amount to waive"
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

- [ ] **Step 4: Run tests, lint and typecheck**

```bash
bun run test src/features/desk/CorrectEntrySheet.test.tsx src/features/desk/WaiveEntrySheet.test.tsx && bun run lint && bun run typecheck
```

Expected: PASS, clean. If `getByText('Payment')` also matches the sheet title, scope it to the `dl`.

- [ ] **Step 5: Commit**

```bash
git add src/features/desk/CorrectEntrySheet.tsx src/features/desk/WaiveEntrySheet.tsx src/features/desk/CorrectEntrySheet.test.tsx src/features/desk/WaiveEntrySheet.test.tsx
git commit -m "feat: correct and waive sheets

Set an entry to a new total or waive part of a charge, each with a required
reason and a second tap that states the change. Blank and no-op totals and
waivers above what is still charged are refused before any request; the sheet
cannot be closed while the request runs."
```

---

### Task 4: Default panel

**Files:**
- Create: `src/features/desk/DefaultPanel.tsx`
- Test: `src/features/desk/DefaultPanel.test.tsx`

**Interfaces:**
- Consumes: `MemberStatusRow` from `@/features/ledger/queries`; `useLedgerAction`; `formatDate`.
- Produces: `DefaultPanel({ memberId: string; memberName: string; cycleId: string; status: MemberStatusRow | undefined })`.

- [ ] **Step 1: Write the failing test**

`src/features/desk/DefaultPanel.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { memberStatus, renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { DefaultPanel } = await import('./DefaultPanel');

const renderPanel = (status?: ReturnType<typeof memberStatus>) =>
  renderLedger(<DefaultPanel memberId="m1" memberName="Eve" cycleId="c1" status={status} />, { isAdmin: true });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
});

test('a member with no record is in good standing and can be marked', () => {
  renderPanel();
  expect(screen.getByText('In good standing')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mark as defaulted' })).toBeInTheDocument();
});

test('a defaulted member shows when and why, and what it means', () => {
  renderPanel(memberStatus({ defaulted: true, reason: 'Missed three months', changed_at: '2026-10-08T08:00:00Z' }));
  expect(screen.getByText('Defaulted')).toBeInTheDocument();
  expect(screen.getByText(/Changed 8 Oct 2026: Missed three months/)).toBeInTheDocument();
  expect(screen.getByText(/earns no further interest share/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reverse the default' })).toBeInTheDocument();
});

test('a reversed default reads as good standing, keeping the history line', () => {
  renderPanel(memberStatus({ defaulted: false, reason: 'Paid up' }));
  expect(screen.getByText('In good standing')).toBeInTheDocument();
  expect(screen.getByText(/Paid up/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mark as defaulted' })).toBeInTheDocument();
});

test('marking a default needs a reason and a second tap, and sends the exact values once', async () => {
  renderPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as defaulted' }));
  await userEvent.click(screen.getByRole('button', { name: 'Record default' }));
  expect(await screen.findByText('Say why.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText('Reason'), 'Missed three months');
  await userEvent.click(screen.getByRole('button', { name: 'Record default' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to mark Eve as defaulted' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('set_default', { p_member: 'm1', p_cycle: 'c1', p_defaulted: true, p_reason: 'Missed three months' });
  expect(await screen.findByText('Default recorded.')).toBeInTheDocument();
});

test('reversing sends defaulted false', async () => {
  renderPanel(memberStatus({ defaulted: true }));
  await userEvent.click(screen.getByRole('button', { name: 'Reverse the default' }));
  await userEvent.type(screen.getByLabelText('Reason'), 'Paid up');
  await userEvent.click(screen.getByRole('button', { name: 'Record reversal' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to reverse Eve’s default' }));
  expect(rpc).toHaveBeenCalledWith('set_default', { p_member: 'm1', p_cycle: 'c1', p_defaulted: false, p_reason: 'Paid up' });
  expect(await screen.findByText('Default reversed.')).toBeInTheDocument();
});

test('editing the reason disarms the second tap', async () => {
  renderPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as defaulted' }));
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Record default' }));
  await userEvent.type(screen.getByLabelText('Reason'), 'y');
  expect(screen.getByRole('button', { name: 'Record default' })).toBeInTheDocument();
});

test('tapping again while the request runs records once, and the sheet cannot be closed meanwhile', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as defaulted' }));
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Record default' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to mark Eve as defaulted' }));
  await userEvent.click(screen.getByRole('button', { name: /Record default|Tap again/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Reason')).toBeInTheDocument();
});

test('a refusal shows its friendly sentence and keeps the sheet open', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'not_admin', code: '42501' } });
  renderPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as defaulted' }));
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Record default' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to mark Eve as defaulted' }));
  expect(await screen.findByText('Only admins can do this.')).toBeInTheDocument();
  expect(screen.getByLabelText('Reason')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
bun run test src/features/desk/DefaultPanel.test.tsx
```

Expected: FAIL (`./DefaultPanel` not found)

- [ ] **Step 3: Implement**

`src/features/desk/DefaultPanel.tsx`:

```tsx
import { useState } from 'react';
import { useLedgerAction } from '@/features/ledger/actions';
import type { MemberStatusRow } from '@/features/ledger/queries';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Badge, Button, Card, Sheet, TextField, useConfirmTap } from '@/ui';

type Props = { memberId: string; memberName: string; cycleId: string; status: MemberStatusRow | undefined };

function DefaultSheet({ memberId, memberName, cycleId, defaulted, onClose }: { memberId: string; memberName: string; cycleId: string; defaulted: boolean; onClose: () => void }) {
  // `defaulted` here is the state being set: true marks the member, false reverses it.
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const record = useLedgerAction(async (text: string) => {
    const { error: e } = await supabase.rpc('set_default', { p_member: memberId, p_cycle: cycleId, p_defaulted: defaulted, p_reason: text });
    if (e) throw e;
  }, defaulted ? 'Default recorded.' : 'Default reversed.');
  const confirm = useConfirmTap(() => record.mutate(reason.trim(), { onSuccess: onClose }));
  // Closing mid-request would let the same change be recorded again.
  const close = () => {
    if (!record.isPending) onClose();
  };

  const tap = () => {
    const text = reason.trim();
    if (!text) {
      setError('Say why.');
      confirm.reset();
      return;
    }
    if (text.length > 500) {
      setError('Keep the reason to 500 characters or fewer.');
      confirm.reset();
      return;
    }
    setError(undefined);
    confirm.tap();
  };

  return (
    <Sheet
      open
      onClose={close}
      title={defaulted ? `Mark ${memberName} as defaulted` : `Reverse ${memberName}’s default`}
      description="The change and your reason are recorded."
      footer={
        <Button fullWidth isLoading={record.isPending} onClick={tap}>
          {confirm.armed ? (defaulted ? `Tap again to mark ${memberName} as defaulted` : `Tap again to reverse ${memberName}’s default`) : defaulted ? 'Record default' : 'Record reversal'}
        </Button>
      }
    >
      <form noValidate onSubmit={(e) => e.preventDefault()}>
        <TextField
          label="Reason"
          maxLength={500}
          autoComplete="off"
          error={error}
          value={reason}
          onChange={(e) => {
            confirm.reset();
            setReason(e.target.value);
          }}
        />
      </form>
    </Sheet>
  );
}

/** Whether the member is defaulted for the cycle, who changed it and why, and the way to change it. No record means in good standing. */
export function DefaultPanel({ memberId, memberName, cycleId, status }: Props) {
  const [open, setOpen] = useState(false);
  const defaulted = status?.defaulted === true;
  return (
    <Card>
      <section aria-labelledby="default-title" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="default-title" className="text-lg font-semibold text-fg">Default status</h2>
          <Badge tone={defaulted ? 'danger' : 'success'}>{defaulted ? 'Defaulted' : 'In good standing'}</Badge>
        </div>
        {status ? <p className="text-sm text-muted">{`Changed ${formatDate(status.changed_at)}: ${status.reason}`}</p> : null}
        <p className="text-sm text-muted">
          A defaulted member earns no further interest share, and what they owe is taken from their payout.
        </p>
        <div>
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{defaulted ? 'Reverse the default' : 'Mark as defaulted'}</Button>
        </div>
      </section>
      {open ? <DefaultSheet memberId={memberId} memberName={memberName} cycleId={cycleId} defaulted={!defaulted} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}
```

- [ ] **Step 4: Run tests, lint and typecheck**

```bash
bun run test src/features/desk/DefaultPanel.test.tsx && bun run lint && bun run typecheck
```

Expected: PASS, clean. If `getByText('Defaulted')` matches more than the badge, the explanatory sentence uses the word "defaulted" in lowercase inside a longer string, so exact matching on `'Defaulted'` is unambiguous.

- [ ] **Step 5: Commit**

```bash
git add src/features/desk/DefaultPanel.tsx src/features/desk/DefaultPanel.test.tsx
git commit -m "feat: default status panel

Whether the member is defaulted for the cycle, who changed it, when and why,
and a way to mark or reverse it. A reason is required and the change takes a
second tap; the sheet cannot be closed while it is being recorded."
```

---

### Task 5: Member ledger page and route

**Files:**
- Create: `src/features/desk/MemberLedgerPage.tsx`
- Modify: `src/app/router.tsx`
- Test: `src/features/desk/MemberLedgerPage.test.tsx`

**Interfaces:**
- Consumes: `useMyEntries`, `useLedgerCycle`, `useMemberStatuses`, `useGroupMembers` (from `@/features/group/GroupPage`); `groupEntriesByPeriod`, `kindLabel`, `entryTone`, `toneLabel`; `currentPeriod`; `corrections.ts`; the three sheets.
- Produces: `MemberLedgerPage()` (route `/desk/members/:memberId`).

- [ ] **Step 1: Write the failing test**

`src/features/desk/MemberLedgerPage.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { entry, memberStatus, renderLedger, year } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const hooks = vi.hoisted(() => ({ members: vi.fn(), cycle: vi.fn(), entries: vi.fn(), statuses: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useParams: () => ({ memberId: 'm1' }) }));
vi.mock('@/features/group/GroupPage', () => ({ useGroupMembers: () => hooks.members() }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useMyEntries: () => hooks.entries(),
  useMemberStatuses: () => hooks.statuses(),
}));
const { MemberLedgerPage } = await import('./MemberLedgerPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const cycleOk = (periods = year(8, 'open')) => ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods });
const MEMBER_ROWS = [{ id: 'm1', full_name: 'Eve Example', short_name: 'Eve', status: 'active' }];

// The pgTAP scenario: a penalty of 100 in September, waived 30, raised 20, reduced 10 in October: 80 now.
const PENALTY = entry({ id: 'e1', kind: 'penalty', amount: 100, source: 'app', period_id: 'p8', reason: 'other: Missed the meeting', created_at: '2026-09-05T08:00:00Z' });
const CORRECTIONS = [
  entry({ id: 'c1', kind: 'waiver', amount: 30, source: 'correction', corrects_entry_id: 'e1', reason: 'Slip found', period_id: 'p9', created_at: '2026-10-08T08:00:00Z' }),
  entry({ id: 'c2', kind: 'penalty', amount: 20, source: 'correction', corrects_entry_id: 'e1', reason: 'Treasurer raised it', period_id: 'p9', created_at: '2026-10-08T08:01:00Z' }),
  entry({ id: 'c3', kind: 'adjustment', amount: 10, source: 'correction', corrects_entry_id: 'e1', reason: 'Settled on 80', period_id: 'p9', created_at: '2026-10-08T08:02:00Z' }),
];
const SAVING = entry({ id: 'e2', kind: 'saving', amount: 250, source: 'import', period_id: 'p8', created_at: '2026-09-05T09:00:00Z' });
const LOAN = entry({ id: 'e3', kind: 'loan_sent', amount: 1000, source: 'app', period_id: 'p8', created_at: '2026-09-02T09:00:00Z' });
const INTEREST_SHARE = entry({ id: 'e4', kind: 'interest_share', amount: 12, source: 'close', period_id: 'p8', created_at: '2026-09-30T09:00:00Z' });

const renderPage = (isAdmin = true) => renderLedger(<MemberLedgerPage />, { isAdmin });

beforeEach(() => {
  rpc.mockReset();
  hooks.members.mockReturnValue(ok(MEMBER_ROWS));
  hooks.cycle.mockReturnValue(cycleOk());
  hooks.entries.mockReturnValue(ok([PENALTY, ...CORRECTIONS, SAVING, LOAN, INTEREST_SHARE]));
  hooks.statuses.mockReturnValue(ok([]));
});

test('members get the admins-only screen and no ledger request is made', () => {
  renderPage(false);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(hooks.entries).not.toHaveBeenCalled();
});

test('a member who is not in the group says so', () => {
  hooks.members.mockReturnValue(ok([{ id: 'zz', full_name: 'Zed', short_name: 'Zed', status: 'active' }]));
  renderPage();
  expect(screen.getByText('That member isn’t in this group.')).toBeInTheDocument();
});

test('entries are grouped by month and corrections are nested under their original, not rows of their own', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: 'Eve Example' })).toBeInTheDocument();
  const sep = screen.getByRole('heading', { name: 'Sep 2026' }).closest('section')!;
  const penalty = within(sep).getByText('Penalty').closest('li')!;
  expect(within(penalty).getByText('K 100')).toBeInTheDocument();
  expect(within(penalty).getByText('Now K 80')).toBeInTheDocument();
  expect(within(penalty).getByText('−K 30 waived: Slip found')).toBeInTheDocument();
  expect(within(penalty).getByText('+K 20 added: Treasurer raised it')).toBeInTheDocument();
  expect(within(penalty).getByText('−K 10 reduced: Settled on 80')).toBeInTheDocument();
  // October only holds the three corrections, which are nested, so October has no month group of its own.
  expect(screen.queryByRole('heading', { name: 'Oct 2026' })).toBeNull();
});

test('Correct and Waive appear only where the engine allows them', () => {
  renderPage();
  expect(screen.getByRole('button', { name: 'Correct Penalty K 100 from Sep 2026' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Waive Penalty K 100 from Sep 2026' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Correct Savings K 250 from Sep 2026' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /Waive Savings/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Loan sent/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Interest earned/ })).toBeNull();
});

test('a charge with nothing left to waive offers no Waive', () => {
  const waiver = entry({ id: 'c9', kind: 'waiver', amount: 100, source: 'correction', corrects_entry_id: 'e1', reason: 'all', period_id: 'p9' });
  hooks.entries.mockReturnValue(ok([PENALTY, waiver]));
  renderPage();
  expect(screen.getByText('Now K 0')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Waive Penalty/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Correct Penalty K 100 from Sep 2026' })).toBeEnabled();
});

test('the note says where corrections land', () => {
  renderPage();
  expect(screen.getByText('Corrections land in Oct 2026; the original stays in its own month.')).toBeInTheDocument();
});

test('with no open month the posting buttons are disabled and the page says why', () => {
  hooks.cycle.mockReturnValue(cycleOk(year(9)));
  renderPage();
  expect(screen.getByText('Open the next month to post corrections or waivers.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Correct Penalty K 100 from Sep 2026' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Waive Penalty K 100 from Sep 2026' })).toBeDisabled();
});

test('Correct opens the sheet with what it is now, and Waive with how much is still charged', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Correct Penalty K 100 from Sep 2026' }));
  expect(screen.getByRole('dialog', { name: 'Correct an entry' })).toBeInTheDocument();
  expect(screen.getByText('Now').nextElementSibling).toHaveTextContent('K 80');
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  await userEvent.click(screen.getByRole('button', { name: 'Waive Penalty K 100 from Sep 2026' }));
  expect(screen.getByRole('dialog', { name: 'Waive a charge' })).toBeInTheDocument();
  expect(screen.getByText('Still charged').nextElementSibling).toHaveTextContent('K 80');
});

test('the default panel shows the member’s status for the cycle', () => {
  hooks.statuses.mockReturnValue(ok([memberStatus({ member_id: 'm1', defaulted: true }), memberStatus({ id: 'ms2', member_id: 'other', defaulted: false })]));
  renderPage();
  expect(screen.getByText('Defaulted')).toBeInTheDocument();
});

test('nothing recorded yet says so', () => {
  hooks.entries.mockReturnValue(ok([]));
  renderPage();
  expect(screen.getByText('Nothing recorded for this member yet.')).toBeInTheDocument();
});

test('loading and failure of the entries', async () => {
  hooks.entries.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderPage();
  expect(screen.getByText('Loading the member’s ledger')).toBeInTheDocument();
  unmount();
  const refetch = vi.fn();
  hooks.entries.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch });
  renderPage();
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
bun run test src/features/desk/MemberLedgerPage.test.tsx
```

Expected: FAIL (`./MemberLedgerPage` not found)

- [ ] **Step 3: Implement the page**

`src/features/desk/MemberLedgerPage.tsx`:

```tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { useGroupMembers } from '@/features/group/GroupPage';
import { correctionLine, correctionsOf, effectiveAmount, isCorrectable, isWaivable } from '@/features/ledger/corrections';
import { entryTone, groupEntriesByPeriod, kindLabel, toneLabel, type EntryRow, type KindTone } from '@/features/ledger/memberViews';
import { currentPeriod } from '@/features/ledger/model';
import { useLedgerCycle, useMemberStatuses, useMyEntries } from '@/features/ledger/queries';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Skeleton, type Tone } from '@/ui';
import { CorrectEntrySheet } from './CorrectEntrySheet';
import { DefaultPanel } from './DefaultPanel';
import { WaiveEntrySheet } from './WaiveEntrySheet';

const BADGE: Record<KindTone, Tone> = { in: 'success', charged: 'warning', earned: 'accent', correction: 'info', other: 'neutral' };
const link = 'font-semibold text-accent underline underline-offset-4';

function MemberLedgerBody() {
  const { memberId = '' } = useParams();
  const { group } = useGroup();
  const members = useGroupMembers(group.id);
  const cycle = useLedgerCycle(group.id);
  const entries = useMyEntries(memberId);
  const cycleId = cycle.data?.cycle?.id;
  const statuses = useMemberStatuses(group.id, cycleId);
  const [sheet, setSheet] = useState<{ kind: 'correct' | 'waive'; entry: EntryRow } | null>(null);

  const queries = [members, cycle, entries, ...(cycleId ? [statuses] : [])];
  const failed = queries.find((q) => q.isError && q.data === undefined);
  if (failed) {
    return (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => queries.forEach((q) => void q.refetch())}>Try again</Button>}>
        {friendlyError(failed.error)}
      </Alert>
    );
  }
  if (queries.some((q) => q.data === undefined)) {
    return (
      <div role="status" className="grid gap-3">
        <span className="sr-only">Loading the member’s ledger</span>
        <Skeleton className="h-28" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  const member = members.data!.find((m) => m.id === memberId);
  if (!member) {
    return (
      <EmptyState title="That member isn’t in this group.">
        <Link to="/desk/members" className={link}>Back to the members</Link>
      </EmptyState>
    );
  }

  const periods = cycle.data!.periods;
  const open = currentPeriod(periods);
  const all = entries.data!;
  const groups = groupEntriesByPeriod(all.filter((e) => e.source !== 'correction'), periods);
  const status = statuses.data?.find((s) => s.member_id === memberId);
  const name = member.short_name ?? member.full_name ?? 'this member';

  return (
    <div className="grid gap-4 md:gap-5 lg:max-w-3xl">
      {cycleId ? <DefaultPanel memberId={memberId} memberName={name} cycleId={cycleId} status={status} /> : null}

      <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
        {open ? `Corrections land in ${open.label}; the original stays in its own month.` : 'Open the next month to post corrections or waivers.'}
      </p>

      <section aria-labelledby="entries-title" className="grid gap-3">
        <h2 id="entries-title" className="text-xl font-semibold text-fg">Entries</h2>
        {groups.length === 0 ? (
          <p className="text-sm text-muted">Nothing recorded for this member yet.</p>
        ) : (
          groups.map((g) => (
            <Card key={g.periodId}>
              <section aria-labelledby={`month-${g.periodId}`}>
                <h3 id={`month-${g.periodId}`} className="text-lg font-semibold text-fg">{g.period.label}</h3>
                <ul role="list" className="divide-y divide-line">
                  {g.entries.map((e) => {
                    const tone = entryTone(e);
                    const fixes = correctionsOf(e.id, all);
                    const current = effectiveAmount(e, all);
                    const label = `${kindLabel(e.kind)} ${money(e.amount)} from ${g.period.label}`;
                    return (
                      <li key={e.id} className="grid gap-2 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-medium text-fg">{kindLabel(e.kind)}</span>
                          <span className="tabular font-semibold text-fg">{money(e.amount)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                          {toneLabel(tone) ? <Badge tone={BADGE[tone]}>{toneLabel(tone)}</Badge> : null}
                          {fixes.length > 0 ? <span className="tabular font-semibold text-fg">{`Now ${money(current)}`}</span> : null}
                        </div>
                        {fixes.length > 0 ? (
                          <ul role="list" className="grid gap-1 text-sm text-muted">
                            {fixes.map((c) => <li key={c.id}>{`${correctionLine(c)}: ${c.reason ?? ''}`}</li>)}
                          </ul>
                        ) : null}
                        {isCorrectable(e) || (isWaivable(e) && current > 0) ? (
                          <div className="flex gap-2">
                            {isCorrectable(e) ? (
                              <Button size="sm" variant="secondary" disabled={!open} aria-label={`Correct ${label}`} onClick={() => setSheet({ kind: 'correct', entry: e })}>Correct</Button>
                            ) : null}
                            {isWaivable(e) && current > 0 ? (
                              <Button size="sm" variant="secondary" disabled={!open} aria-label={`Waive ${label}`} onClick={() => setSheet({ kind: 'waive', entry: e })}>Waive</Button>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </Card>
          ))
        )}
      </section>

      {sheet?.kind === 'correct' ? <CorrectEntrySheet entry={sheet.entry} current={effectiveAmount(sheet.entry, all)} onClose={() => setSheet(null)} /> : null}
      {sheet?.kind === 'waive' ? <WaiveEntrySheet entry={sheet.entry} current={effectiveAmount(sheet.entry, all)} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}

export function MemberLedgerPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return <MemberLedgerHeader />;
}

// The heading needs the member's name, so the body and header share the same queries through TanStack's cache.
function MemberLedgerHeader() {
  const { memberId = '' } = useParams();
  const { group } = useGroup();
  const members = useGroupMembers(group.id);
  const member = members.data?.find((m) => m.id === memberId);
  return (
    <>
      <PageHeader
        title={member?.full_name ?? member?.short_name ?? 'Member ledger'}
        subtitle="Entries, corrections and default status"
        actions={<Link to="/desk/members" className={link}>All members</Link>}
      />
      <MemberLedgerBody />
    </>
  );
}
```

Note: the gate order matters for the first test: `MemberLedgerPage` returns `NotFound` before `MemberLedgerHeader` mounts, so a non-admin triggers no hook of the body.

- [ ] **Step 4: Register the route**

In `src/app/router.tsx` add `import { MemberLedgerPage } from '@/features/desk/MemberLedgerPage';` beside the other desk imports and, after the `desk/close` line, add:

```tsx
                  page('desk/members/:memberId', 'Member ledger', <MemberLedgerPage />),
```

- [ ] **Step 5: Run tests, lint and typecheck**

```bash
bun run test src/features/desk/MemberLedgerPage.test.tsx && bun run lint && bun run typecheck
```

Expected: PASS, clean. Notes: the Oct month has only corrections (which are filtered out), so `groupEntriesByPeriod` yields no October group; `getByText('Penalty')` inside the September section matches only the entry label; the heading `Eve Example` comes from the header component.

- [ ] **Step 6: Commit**

```bash
git add src/features/desk/MemberLedgerPage.tsx src/features/desk/MemberLedgerPage.test.tsx src/app/router.tsx
git commit -m "feat: a member's ledger for the treasurer

Their entries by month with corrections nested under the original and the
current amount shown, Correct and Waive only where the engine allows them
(disabled with an explanation when no month is open), and the default panel."
```

---

### Task 6: Members list and route

**Files:**
- Create: `src/features/desk/MembersPage.tsx`
- Modify: `src/app/router.tsx`
- Test: `src/features/desk/MembersPage.test.tsx`

**Interfaces:**
- Consumes: `useGroupMembers`, `useLedgerCycle`, `useMemberStatuses`, `activeMembers`.
- Produces: `MembersPage()` (route `/desk/members`).

- [ ] **Step 1: Write the failing test**

`src/features/desk/MembersPage.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { memberStatus, renderLedger, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ members: vi.fn(), cycle: vi.fn(), statuses: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/features/group/GroupPage', () => ({ useGroupMembers: () => hooks.members() }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useMemberStatuses: () => hooks.statuses(),
}));
const { MembersPage } = await import('./MembersPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const ROWS = [
  { id: 'm1', short_name: 'Eve', full_name: 'Eve Example', status: 'active' },
  { id: 'm2', short_name: 'Ann', full_name: 'Ann Example', status: 'active' },
  { id: 'm3', short_name: 'Old', full_name: 'Old Example', status: 'left' },
];
const renderPage = (isAdmin = true) => renderLedger(<MembersPage />, { isAdmin });

beforeEach(() => {
  hooks.members.mockReturnValue(ok(ROWS));
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8, 'open') }));
  hooks.statuses.mockReturnValue(ok([]));
});

test('members get the admins-only screen and no ledger request is made', () => {
  renderPage(false);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(hooks.members).not.toHaveBeenCalled();
});

test('lists active members alphabetically, each linking to their ledger; members who left are not listed', () => {
  renderPage();
  const links = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/desk/members/'));
  expect(links.map((l) => l.textContent)).toEqual(['Ann', 'Eve']);
  expect(links.map((l) => l.getAttribute('href'))).toEqual(['/desk/members/m2', '/desk/members/m1']);
  expect(screen.queryByText('Old')).toBeNull();
});

test('a defaulted member carries a badge', () => {
  hooks.statuses.mockReturnValue(ok([memberStatus({ member_id: 'm1', defaulted: true }), memberStatus({ id: 'ms2', member_id: 'm2', defaulted: false })]));
  renderPage();
  const eve = screen.getByRole('link', { name: 'Eve' }).closest('li')!;
  expect(eve).toHaveTextContent('Defaulted');
  expect(screen.getByRole('link', { name: 'Ann' }).closest('li')).not.toHaveTextContent('Defaulted');
});

test('if the default flags cannot be loaded the list still shows, with a note', () => {
  hooks.statuses.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch: vi.fn() });
  renderPage();
  expect(screen.getByRole('link', { name: 'Eve' })).toBeInTheDocument();
  expect(screen.getByText('Default flags could not be loaded just now.')).toBeInTheDocument();
});

test('no active members says so', () => {
  hooks.members.mockReturnValue(ok([ROWS[2]]));
  renderPage();
  expect(screen.getByText('No active members.')).toBeInTheDocument();
});

test('loading and failure', async () => {
  hooks.members.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderPage();
  expect(screen.getByText('Loading the members')).toBeInTheDocument();
  unmount();
  const refetch = vi.fn();
  hooks.members.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch });
  renderPage();
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
bun run test src/features/desk/MembersPage.test.tsx
```

Expected: FAIL (`./MembersPage` not found)

- [ ] **Step 3: Implement**

`src/features/desk/MembersPage.tsx`:

```tsx
import { Link } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { useGroupMembers } from '@/features/group/GroupPage';
import { activeMembers } from '@/features/ledger/model';
import { useLedgerCycle, useMemberStatuses } from '@/features/ledger/queries';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { Alert, Badge, Button, Card, PageHeader, Skeleton } from '@/ui';

function MembersBody() {
  const { group } = useGroup();
  const members = useGroupMembers(group.id);
  const cycle = useLedgerCycle(group.id);
  const statuses = useMemberStatuses(group.id, cycle.data?.cycle?.id);

  if (members.data === undefined) {
    return members.isError ? (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void members.refetch()}>Try again</Button>}>
        {friendlyError(members.error)}
      </Alert>
    ) : (
      <div role="status" className="grid gap-3">
        <span className="sr-only">Loading the members</span>
        <Skeleton className="h-56" />
      </div>
    );
  }

  const rows = activeMembers(members.data).sort((a, b) => a.short_name.localeCompare(b.short_name));
  const defaulted = new Set((statuses.data ?? []).filter((s) => s.defaulted).map((s) => s.member_id));

  return (
    <div className="grid gap-3 lg:max-w-2xl">
      {statuses.isError && !statuses.data ? <p className="text-sm text-muted">Default flags could not be loaded just now.</p> : null}
      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No active members.</p>
        ) : (
          <ul role="list" className="divide-y divide-line">
            {rows.map((m) => (
              <li key={m.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <Link to={`/desk/members/${m.id}`} className="font-semibold text-accent underline underline-offset-4">{m.short_name}</Link>
                {defaulted.has(m.id) ? <Badge tone="danger">Defaulted</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function MembersPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader title="Members" subtitle="Open a member to see their ledger" />
      <MembersBody />
    </>
  );
}
```

In `src/app/router.tsx` add `import { MembersPage } from '@/features/desk/MembersPage';` and, before the `desk/members/:memberId` line, add:

```tsx
                  page('desk/members', 'Members', <MembersPage />),
```

- [ ] **Step 4: Run tests, lint and typecheck**

```bash
bun run test src/features/desk/MembersPage.test.tsx && bun run lint && bun run typecheck
```

Expected: PASS, clean

- [ ] **Step 5: Commit**

```bash
git add src/features/desk/MembersPage.tsx src/features/desk/MembersPage.test.tsx src/app/router.tsx
git commit -m "feat: a members list for the treasurer

Active members alphabetically, each linking to their ledger, with a Defaulted
badge. If the default flags cannot be loaded the list still shows, with a note."
```

---

### Task 7: The Desk entry point and final checks

**Files:**
- Modify: `src/features/desk/DeskPage.tsx`, `src/features/desk/DeskPage.test.tsx`

**Interfaces:**
- Produces: a "Members" card on the Desk linking to `/desk/members`, shown whenever the Desk shows the cycle (open month or not).

- [ ] **Step 1: Add the failing Desk test**

Append to `src/features/desk/DeskPage.test.tsx`:

```tsx

test('the Desk links to the members’ ledgers, with a month open or not', () => {
  const { unmount } = renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByRole('link', { name: 'Open members' })).toHaveAttribute('href', '/desk/members');
  unmount();
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8) }));
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByRole('link', { name: 'Open members' })).toHaveAttribute('href', '/desk/members');
});
```

Run `bun run test src/features/desk/DeskPage.test.tsx`. Expected: FAIL (no such link yet).

- [ ] **Step 2: Add the card**

In `src/features/desk/DeskPage.tsx`, inside `DeskBody`'s returned `<div className="grid gap-4 md:gap-5 lg:max-w-2xl">`, add as the **last child** (after the `open ? … : null` block):

```tsx
      <Card>
        <CardHeader
          title="Members"
          subtitle="See a member’s ledger, correct an entry, waive a charge or mark a default."
          action={
            <Link
              to="/desk/members"
              className="inline-flex h-12 items-center rounded-xl px-5 font-semibold text-accent underline transition duration-150 hover:bg-surface-2 active:scale-[.97]"
            >
              Open members
            </Link>
          }
        />
      </Card>
```

(`Card` and `CardHeader` are already imported from S3b.)

- [ ] **Step 3: Full verification**

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$HOME/.bun/bin:$PATH"
bun run lint && bun run typecheck && bun run test && bun run build
set -a; . ./.env.local; set +a
S=/tmp/claude-1000/-home-bk08-dev-web-village-banking/43e07bdc-ccaf-4683-870c-76c605cf3048/scratchpad
python3 $S/combine.py - supabase/tests/database/19_correction_parity.sql $S/c19.sql && bun $S/run.mjs $S/c19.sql | grep -v '^ok'
```

Expected: all green; the build warns only about the existing chunk-size notice; the pgTAP run prints only its `1..N` plan line.

- [ ] **Step 4: Commit**

```bash
git add src/features/desk/DeskPage.tsx src/features/desk/DeskPage.test.tsx
git commit -m "feat: reach members' ledgers from the Desk

A Members card linking to the list, shown with a month open or not."
```

- [ ] **Step 5: Hand over**

Tell the user: no migration, so it works on dev as soon as it is built. Manual check on dev with a throwaway group: correct a payment, waive part of a penalty, mark and reverse a default; confirm the entries, that the member's Record shows the correction, the audit-log rows, and that the correction landed in the open month while the original stayed in its own. Corrections are append-only, so use a throwaway group, not the real one.
