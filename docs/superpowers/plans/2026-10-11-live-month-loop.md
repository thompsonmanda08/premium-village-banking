# Live-month loop (S1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the treasurer open October, members declare, and the treasurer approve or return declarations, replacing the "February 2027" placeholders on Declare and Desk.

**Architecture:** UI only, no migration. A `src/features/ledger/` folder holds pure helpers (`model.ts`, `money.ts`, `declarationForm.ts`), RLS-read query hooks (`queries.ts`), one mutation wrapper (`actions.ts`) and the shared `DeclarationForm` / `DeclarationSummary`. `DeclarePage` (member) and the Desk components (`MonthPanel`, `DeclarationInbox`, `NotYetDeclared`) sit on top. All writes go through the existing RPCs; the client never computes a stored figure.

**Tech Stack:** React 19, react-router, TanStack Query, supabase-js (typed `rpc`), Tailwind tokens from `src/ui`, Vitest + Testing Library (`bun run test`), eslint (`bun run lint`), `tsc` (`bun run typecheck`).

**Spec:** `docs/superpowers/specs/2026-10-11-live-month-loop-design.md` (builds on `2026-10-10-ledger-engine-design.md` §6, §9).

## Global Constraints

- No database change and no new migration number. Migration numbers 1900, 2000 and 2100 are taken by other work.
- Money: kwacha with at most 2 decimals, never negative, strings in the form and numbers at the RPC boundary. No float arithmetic on totals: sum in integer ngwee (`sumKwacha`).
- Every screen has loading, error and empty states; buttons and inputs are 48px (`h-12`, already how `Button` / `TextField` render); tokens only (no raw colours); labels on every input; native `<select>` styled like `TextField`.
- Copy uses the curly apostrophe `’` (as the rest of the app and its tests do). Server errors always go through `friendlyError`.
- Commits: subject + body, **no `Co-Authored-By` trailer**. Never `git push`, never `git add -A`, never stage anything under `docs/` or `semantic-review/` except where a step names it.
- Tests use synthetic data only. No real member names or figures anywhere in the repo.
- `declarations_select` lets members read each other's declarations when the group is `open`, so the member screen **must** filter by `member_id`.

## Review Focus

- A member with no linked member row (an owner who never linked) opens Declare: a clear message, no crash, no request. (Task 4 test.)
- Amount strings `1,000`, `250.555`, `-5`, `1e3`, `.5`, `abc`: rejected with a message and nothing sent. (Task 1 and Task 3 tests.)
- The month closes while a form is open (`period_not_open`): the friendly message shows and the typed values stay. (Task 3 test.)
- A returned declaration that was resubmitted shows only the live one; an approved one plus a new one both show. (Task 1 `liveDeclarations` test, Task 4 test.)
- A double tap on Approve or Submit sends one request. (Task 3 and Task 6 tests.)
- Opening a month with a deadline before the month starts is blocked client-side and the date input has `min`. (Task 5 test.)
- A non-admin never sees Desk controls and no Desk request is made. (Task 7 test.)

---

## File structure

| File | Responsibility |
|---|---|
| `src/features/ledger/model.ts` | Types and pure selectors: `currentPeriod`, `lastClosed`, `nextToOpen`, `liveDeclarations`, `activeMembers`, `undeclared`, `deadlineNote` |
| `src/features/ledger/money.ts` | `parseKwacha`, `sumKwacha` |
| `src/features/ledger/declarationForm.ts` | Field list, `FormValues`, `validateDeclaration`, `fromDeclaration` |
| `src/features/ledger/queries.ts` | `useLedgerCycle`, `useWallets`, `useDeclarations`, `useMinimumPayable`, `useRefreshLedger` |
| `src/features/ledger/actions.ts` | `useLedgerAction`: mutation + refresh + toast |
| `src/features/ledger/DeclarationSummary.tsx` | Read-only list of a declaration's amounts |
| `src/features/ledger/DeclarationForm.tsx` | The declaration form (member and "declare for member") |
| `src/features/ledger/testFixtures.tsx` | Test-only builders and `renderLedger` |
| `src/features/declare/DeclarePage.tsx` | `/declare` screen |
| `src/features/desk/MonthPanel.tsx` | Open the next month, change the deadline |
| `src/features/desk/DeclarationInbox.tsx` | Waiting / Returned / Approved |
| `src/features/desk/NotYetDeclared.tsx` | Members without a live declaration, "Declare for member" |
| `src/features/desk/DeskPage.tsx` | Assembles the above (modified) |
| `src/app/router.tsx`, `src/features/shells/ComingSoon.tsx` | Route swap, neutral placeholder copy (modified) |

---

### Task 1: Pure helpers and test fixtures

**Files:**
- Create: `src/features/ledger/testFixtures.tsx`, `src/features/ledger/model.ts`, `src/features/ledger/money.ts`, `src/features/ledger/declarationForm.ts`
- Test: `src/features/ledger/model.test.ts`, `src/features/ledger/money.test.ts`, `src/features/ledger/declarationForm.test.ts`

**Interfaces:**
- Produces (used by every later task):
  - `model.ts`: `type PeriodRow`, `type DeclarationRow`, `type Wallet = { id: string; name: string }`, `type ActiveMember = { id: string; short_name: string }`, `currentPeriod(periods): PeriodRow | null`, `lastClosed(periods): PeriodRow | null`, `nextToOpen(periods): PeriodRow | null`, `liveDeclarations(rows): DeclarationRow[]`, `activeMembers(rows): ActiveMember[]`, `undeclared(members, live): ActiveMember[]`, `deadlineNote(today, deadline): { text: string; tone: 'neutral' | 'warning' | 'danger' }`
  - `money.ts`: `parseKwacha(input: string): number | null`, `sumKwacha(...n: number[]): number`
  - `declarationForm.ts`: `AMOUNTS`, `type AmountKey`, `type FormValues`, `type FormErrors`, `type DeclarationArgs`, `EMPTY_FORM`, `fromDeclaration(d): FormValues`, `validateDeclaration(v): { args: DeclarationArgs } | { errors: FormErrors }`
  - `testFixtures.tsx`: `period(o?)`, `declaration(o?)`, `cycleMonths(statuses)`, `year(closed, next?)`, `GROUP`, `MEMBER`, `renderLedger(ui, { isAdmin?, member? })`

- [ ] **Step 1: Create the test fixtures**

`src/features/ledger/testFixtures.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { GroupProvider } from '@/features/group/GroupContext';
import type { GroupRow, MemberRow } from '@/features/group/useMembership';
import { ToastProvider } from '@/ui';
import type { DeclarationRow, PeriodRow } from './model';

export const GROUP: GroupRow = { id: 'g1', name: 'Test Group', currency: 'ZMW', owner_user_id: 'u0', figures_visibility: 'open' };
export const MEMBER: MemberRow = { id: 'm1', group_id: 'g1', full_name: 'Eve Example', short_name: 'Eve', role: 'member', status: 'active', email: 'eve@example.test' };

export const period = (o: Partial<PeriodRow> = {}): PeriodRow => ({
  id: 'p9', cycle_id: 'c1', month_index: 9, label: 'Oct 2026', starts_on: '2026-10-01', deadline: '2026-10-07', status: 'open', ...o,
});

export const declaration = (o: Partial<DeclarationRow> = {}): DeclarationRow => ({
  id: 'd1', created_at: '2026-10-05T08:00:00Z', group_id: 'g1', period_id: 'p9', member_id: 'm1',
  saving: 250, loan_repayment: 0, excess: 0, membership: 0, penalty: 0, txn_fee: 0, borrowing_request: 0,
  wallet_id: 'w1', note: null, status: 'submitted', submitted_at: '2026-10-05T08:00:00Z', submitted_by: null,
  decided_at: null, decided_by: null, return_reason: null, supersedes_id: null, ...o,
});

const LABELS = ['Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026', 'Dec 2026', 'Jan 2027'];
const STARTS = ['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01'];

/** Months of the 2026 cycle in order (Feb = 1 … Jan = 12), one status each. Oct 2026 is month 9 with id `p9`. */
export const cycleMonths = (statuses: PeriodRow['status'][]): PeriodRow[] =>
  statuses.map((status, i) => {
    const start = STARTS[i] ?? '';
    return period({ id: `p${i + 1}`, month_index: i + 1, label: LABELS[i] ?? '', starts_on: start, deadline: `${start.slice(0, 8)}07`, status });
  });

/** Twelve months: the first `closed` closed, the next one `next`, the rest planned. `year(8)` is Feb–Sep closed, Oct planned. */
export const year = (closed: number, next: PeriodRow['status'] = 'planned'): PeriodRow[] =>
  cycleMonths(Array.from({ length: 12 }, (_, i): PeriodRow['status'] => (i < closed ? 'closed' : i === closed ? next : 'planned')));

export function renderLedger(ui: ReactElement, opts: { isAdmin?: boolean; member?: MemberRow | null } = {}) {
  const member = opts.member === undefined ? MEMBER : opts.member;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <ToastProvider>
        <MemoryRouter>
          <GroupProvider value={{ group: GROUP, member, isAdmin: opts.isAdmin ?? false }}>{ui}</GroupProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}
```

- [ ] **Step 2: Write the failing tests**

`src/features/ledger/model.test.ts`:

```ts
import { expect, test } from 'vitest';
import { activeMembers, currentPeriod, deadlineNote, lastClosed, liveDeclarations, nextToOpen, undeclared } from './model';
import { declaration, year } from './testFixtures';

test('currentPeriod is the open month, or null', () => {
  expect(currentPeriod(year(8, 'open'))?.label).toBe('Oct 2026');
  expect(currentPeriod(year(8))).toBeNull();
});

test('lastClosed is the highest closed month', () => {
  expect(lastClosed(year(8))?.label).toBe('Sep 2026');
  expect(lastClosed(year(0))).toBeNull();
});

test('nextToOpen is the first planned month once the one before is closed and nothing is open or closing', () => {
  expect(nextToOpen(year(8))?.label).toBe('Oct 2026');
  expect(nextToOpen(year(0))?.label).toBe('Feb 2026');
  expect(nextToOpen(year(8, 'open'))).toBeNull();
  expect(nextToOpen(year(8, 'closing'))).toBeNull();
  expect(nextToOpen(year(12))).toBeNull();
});

test('liveDeclarations drops a declaration that a later one replaced, and keeps approved ones beside a new one', () => {
  const d1 = declaration({ id: 'd1', status: 'returned' });
  const d2 = declaration({ id: 'd2', status: 'submitted', supersedes_id: 'd1' });
  const d3 = declaration({ id: 'd3', status: 'approved' });
  expect(liveDeclarations([d2, d1, d3]).map((d) => d.id)).toEqual(['d2', 'd3']);
});

test('activeMembers keeps active rows that have an id and a short name', () => {
  const rows = [
    { id: 'a', short_name: 'Ann', status: 'active' },
    { id: 'b', short_name: 'Bob', status: 'left' },
    { id: null, short_name: 'X', status: 'active' },
    { id: 'c', short_name: null, status: 'active' },
  ];
  expect(activeMembers(rows)).toEqual([{ id: 'a', short_name: 'Ann' }]);
});

test('undeclared lists members with no live declaration', () => {
  const members = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
  expect(undeclared(members, [declaration({ member_id: 'm1' })])).toEqual([{ id: 'm2', short_name: 'Ann' }]);
});

test('deadlineNote counts days and flags a missed deadline', () => {
  expect(deadlineNote('2026-10-05', '2026-10-07')).toEqual({ text: '2 days left', tone: 'warning' });
  expect(deadlineNote('2026-10-06', '2026-10-07')).toEqual({ text: '1 day left', tone: 'warning' });
  expect(deadlineNote('2026-10-07', '2026-10-07')).toEqual({ text: 'Due today', tone: 'warning' });
  expect(deadlineNote('2026-10-08', '2026-10-07')).toEqual({ text: 'Past the deadline', tone: 'danger' });
  expect(deadlineNote('2026-10-01', '2026-10-07')).toEqual({ text: '6 days left', tone: 'neutral' });
});
```

`src/features/ledger/money.test.ts`:

```ts
import { expect, test } from 'vitest';
import { parseKwacha, sumKwacha } from './money';

test('parseKwacha accepts whole kwacha and up to two decimals; blank is zero', () => {
  expect(parseKwacha('250')).toBe(250);
  expect(parseKwacha('250.5')).toBe(250.5);
  expect(parseKwacha('250.55')).toBe(250.55);
  expect(parseKwacha('')).toBe(0);
  expect(parseKwacha('  12 ')).toBe(12);
});

test('parseKwacha refuses anything else', () => {
  for (const bad of ['1,000', '250.555', '-5', '1e3', '.5', '5.', 'abc', '1 000', '+5']) expect(parseKwacha(bad), bad).toBeNull();
});

test('sumKwacha adds in ngwee so 0.1 + 0.2 is 0.3', () => {
  expect(sumKwacha(0.1, 0.2)).toBe(0.3);
  expect(sumKwacha()).toBe(0);
});
```

`src/features/ledger/declarationForm.test.ts`:

```ts
import { expect, test } from 'vitest';
import { EMPTY_FORM, fromDeclaration, validateDeclaration } from './declarationForm';
import { declaration } from './testFixtures';

const form = (o: Partial<typeof EMPTY_FORM>) => ({ ...EMPTY_FORM, ...o });

test('a valid form becomes numeric arguments, blanks become zero, a blank note is dropped', () => {
  const r = validateDeclaration(form({ saving: '250', loan_repayment: '100.5', wallet: 'w1', note: '  ' }));
  expect(r).toEqual({
    args: { saving: 250, loan_repayment: 100.5, excess: 0, membership: 0, penalty: 0, txn_fee: 0, borrowing_request: 0, wallet: 'w1', note: undefined },
  });
});

test('a bad amount names the field and sends nothing', () => {
  const r = validateDeclaration(form({ saving: '1,000', wallet: 'w1' }));
  expect(r).toEqual({ errors: { saving: 'Use kwacha and ngwee, like 250 or 250.50.' } });
});

test('all-zero is refused, but a borrowing request alone is a declaration', () => {
  expect(validateDeclaration(form({}))).toEqual({ errors: { form: 'Enter at least one amount.' } });
  expect('args' in validateDeclaration(form({ borrowing_request: '1000' }))).toBe(true);
});

test('sending money needs a wallet', () => {
  expect(validateDeclaration(form({ saving: '250' }))).toEqual({ errors: { wallet: 'Choose the wallet you paid from.' } });
});

test('a note over 500 characters is refused', () => {
  expect(validateDeclaration(form({ saving: '250', wallet: 'w1', note: 'x'.repeat(501) }))).toEqual({
    errors: { note: 'Keep the note to 500 characters or fewer.' },
  });
});

test('fromDeclaration shows zero amounts as blanks so the form is not cluttered', () => {
  expect(fromDeclaration(declaration({ saving: 250, loan_repayment: 100.5, note: 'hi' }))).toEqual({
    ...EMPTY_FORM, saving: '250', loan_repayment: '100.5', wallet: 'w1', note: 'hi',
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun run test src/features/ledger`
Expected: FAIL (modules `./model`, `./money`, `./declarationForm` not found)

- [ ] **Step 4: Implement the helpers**

`src/features/ledger/money.ts`:

```ts
const KWACHA = /^\d{1,10}(\.\d{1,2})?$/;

/** '' is 0; whole kwacha or up to two decimals is the number; anything else (commas, signs, exponents) is null. */
export function parseKwacha(input: string): number | null {
  const s = input.trim();
  if (s === '') return 0;
  return KWACHA.test(s) ? Number(s) : null;
}

/** Sums in whole ngwee so 0.1 + 0.2 is 0.3. */
export const sumKwacha = (...amounts: number[]): number => amounts.reduce((total, n) => total + Math.round(n * 100), 0) / 100;
```

`src/features/ledger/model.ts`:

```ts
import { daysBetween } from '@/lib/calendar';
import type { Tables } from '@/lib/database.types';

export type PeriodRow = Pick<Tables<'periods'>, 'id' | 'cycle_id' | 'month_index' | 'label' | 'starts_on' | 'deadline' | 'status'>;
export type DeclarationRow = Tables<'declarations'>;
export type Wallet = { id: string; name: string };
export type ActiveMember = { id: string; short_name: string };

/** The month members are declaring for: the open one. */
export const currentPeriod = (periods: PeriodRow[]): PeriodRow | null => periods.find((p) => p.status === 'open') ?? null;

/** The most recent closed month. */
export const lastClosed = (periods: PeriodRow[]): PeriodRow | null =>
  periods.filter((p) => p.status === 'closed').sort((a, b) => b.month_index - a.month_index)[0] ?? null;

/** The month the treasurer can open next: the first planned one, only when nothing is open or closing and every earlier month is closed. */
export function nextToOpen(periods: PeriodRow[]): PeriodRow | null {
  if (periods.some((p) => p.status === 'open' || p.status === 'closing')) return null;
  const next = periods.filter((p) => p.status === 'planned').sort((a, b) => a.month_index - b.month_index)[0];
  if (!next) return null;
  return periods.every((p) => p.month_index >= next.month_index || p.status === 'closed') ? next : null;
}

/** A resubmission replaces the waiting or returned declaration it points at; what nothing replaced is the live one. */
export function liveDeclarations(rows: DeclarationRow[]): DeclarationRow[] {
  const replaced = new Set(rows.map((r) => r.supersedes_id).filter((id): id is string => id !== null));
  return rows.filter((r) => !replaced.has(r.id));
}

type MemberViewRow = { id: string | null; short_name: string | null; status: string | null };
export const activeMembers = (rows: MemberViewRow[]): ActiveMember[] =>
  rows.flatMap((r) => (r.status === 'active' && r.id && r.short_name ? [{ id: r.id, short_name: r.short_name }] : []));

export const undeclared = (members: ActiveMember[], live: DeclarationRow[]): ActiveMember[] => {
  const declared = new Set(live.map((d) => d.member_id));
  return members.filter((m) => !declared.has(m.id));
};

export function deadlineNote(today: string, deadline: string): { text: string; tone: 'neutral' | 'warning' | 'danger' } {
  const n = daysBetween(today, deadline);
  if (n < 0) return { text: 'Past the deadline', tone: 'danger' };
  if (n === 0) return { text: 'Due today', tone: 'warning' };
  return { text: `${n} day${n === 1 ? '' : 's'} left`, tone: n <= 2 ? 'warning' : 'neutral' };
}
```

`src/features/ledger/declarationForm.ts`:

```ts
import { parseKwacha, sumKwacha } from './money';
import type { DeclarationRow } from './model';

export const AMOUNTS = [
  { key: 'saving', label: 'Savings' },
  { key: 'loan_repayment', label: 'Loan repayment' },
  { key: 'excess', label: 'Excess charge' },
  { key: 'membership', label: 'Membership' },
  { key: 'penalty', label: 'Penalty' },
  { key: 'txn_fee', label: 'Mobile-money fee' },
  { key: 'borrowing_request', label: 'Borrowing request' },
] as const;

export type AmountKey = (typeof AMOUNTS)[number]['key'];
export type FormValues = Record<AmountKey, string> & { wallet: string; note: string };
export type FormErrors = Partial<Record<AmountKey | 'wallet' | 'note' | 'form', string>>;
export type DeclarationArgs = Record<AmountKey, number> & { wallet: string | undefined; note: string | undefined };

export const EMPTY_FORM: FormValues = {
  saving: '', loan_repayment: '', excess: '', membership: '', penalty: '', txn_fee: '', borrowing_request: '', wallet: '', note: '',
};

const text = (n: number) => (n === 0 ? '' : String(n));

export const fromDeclaration = (d: DeclarationRow): FormValues => ({
  saving: text(d.saving), loan_repayment: text(d.loan_repayment), excess: text(d.excess), membership: text(d.membership),
  penalty: text(d.penalty), txn_fee: text(d.txn_fee), borrowing_request: text(d.borrowing_request),
  wallet: d.wallet_id ?? '', note: d.note ?? '',
});

/** Money maths stays in the database; this only checks shape so a typo never reaches it. */
export function validateDeclaration(v: FormValues): { args: DeclarationArgs } | { errors: FormErrors } {
  const errors: FormErrors = {};
  const nums: Partial<Record<AmountKey, number>> = {};
  for (const { key } of AMOUNTS) {
    const n = parseKwacha(v[key]);
    if (n === null) errors[key] = 'Use kwacha and ngwee, like 250 or 250.50.';
    else nums[key] = n;
  }
  const note = v.note.trim();
  if (note.length > 500) errors.note = 'Keep the note to 500 characters or fewer.';
  if (Object.keys(errors).length === 0) {
    const n = nums as Record<AmountKey, number>;
    // The borrowing request is a request, not money sent, so it needs no wallet.
    const sent = sumKwacha(n.saving, n.loan_repayment, n.excess, n.membership, n.penalty, n.txn_fee);
    if (sent === 0 && n.borrowing_request === 0) errors.form = 'Enter at least one amount.';
    else if (sent > 0 && !v.wallet) errors.wallet = 'Choose the wallet you paid from.';
  }
  if (Object.keys(errors).length > 0) return { errors };
  return { args: { ...(nums as Record<AmountKey, number>), wallet: v.wallet || undefined, note: note || undefined } };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test src/features/ledger && bun run typecheck`
Expected: PASS, typecheck clean

- [ ] **Step 6: Commit**

```bash
git add src/features/ledger
git commit -m "feat: pure helpers for the live-month loop

Selectors for the open/next/last-closed month and live declarations, kwacha
parsing and a declaration form validator, plus test fixtures. No UI yet."
```

---

### Task 2: Query hooks and the mutation wrapper

**Files:**
- Create: `src/features/ledger/queries.ts`, `src/features/ledger/actions.ts`
- Test: `src/features/ledger/queries.test.tsx`

**Interfaces:**
- Consumes: `PeriodRow`, `DeclarationRow`, `Wallet` from `./model`.
- Produces:
  - `useLedgerCycle(groupId: string)` → query data `{ cycle: { id: string; label: string } | null; periods: PeriodRow[] }`
  - `useWallets(groupId: string)` → `Wallet[]`
  - `useDeclarations(groupId: string, periodId: string | undefined, memberId?: string)` → `DeclarationRow[]` (newest first; disabled without `periodId`)
  - `useMinimumPayable(memberId: string | undefined, periodId: string | undefined)` → `number | null`
  - `useRefreshLedger(groupId: string)` → `() => Promise<unknown>`
  - `useLedgerAction<T>(fn: (arg: T) => Promise<unknown>, success: string)` → TanStack mutation (toasts success/failure, refreshes ledger queries)

- [ ] **Step 1: Write the failing test**

`src/features/ledger/queries.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

const calls = vi.hoisted(() => ({ eq: [] as Array<[string, unknown]>, result: vi.fn() }));
vi.mock('@/lib/supabase', () => {
  // A chainable stand-in: every method records nothing but returns the chain; awaiting it yields calls.result().
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit']) chain[m] = () => chain;
  chain.eq = (col: string, val: unknown) => {
    calls.eq.push([col, val]);
    return chain;
  };
  chain.maybeSingle = () => Promise.resolve(calls.result());
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(calls.result()).then(res, rej);
  return { supabase: { from: () => chain } };
});
const { useDeclarations, useMinimumPayable } = await import('./queries');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  calls.eq.length = 0;
  calls.result.mockReset();
});

test('useDeclarations filters by member when given one, so open-visibility groups never leak other members', async () => {
  calls.result.mockReturnValue({ data: [], error: null });
  const { result } = renderHook(() => useDeclarations('g1', 'p9', 'm1'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.eq).toEqual([['period_id', 'p9'], ['member_id', 'm1']]);
});

test('useDeclarations does not run without a period', () => {
  const { result } = renderHook(() => useDeclarations('g1', undefined), { wrapper });
  expect(result.current.fetchStatus).toBe('idle');
});

test('useMinimumPayable returns the statement figure, or null when the member has none', async () => {
  calls.result.mockReturnValueOnce({ data: { next_minimum: 300 }, error: null });
  const a = renderHook(() => useMinimumPayable('m1', 'p8'), { wrapper });
  await waitFor(() => expect(a.result.current.data).toBe(300));
  calls.result.mockReturnValueOnce({ data: null, error: null });
  const b = renderHook(() => useMinimumPayable('m2', 'p8'), { wrapper });
  await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
  expect(b.result.current.data).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/features/ledger/queries.test.tsx`
Expected: FAIL (`./queries` not found)

- [ ] **Step 3: Implement the hooks**

`src/features/ledger/queries.ts`:

```ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DeclarationRow, PeriodRow, Wallet } from './model';

export type LedgerCycle = { cycle: { id: string; label: string } | null; periods: PeriodRow[] };

/** The group's active cycle and its months (RLS: any member can read periods). */
export function useLedgerCycle(groupId: string) {
  return useQuery({
    queryKey: ['ledger-cycle', groupId],
    queryFn: async (): Promise<LedgerCycle> => {
      const cycles = await supabase
        .from('cycles')
        .select('id, label')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('starts_on', { ascending: false })
        .limit(1);
      if (cycles.error) throw cycles.error;
      const cycle = cycles.data[0];
      if (!cycle) return { cycle: null, periods: [] };
      const periods = await supabase
        .from('periods')
        .select('id, cycle_id, month_index, label, starts_on, deadline, status')
        .eq('cycle_id', cycle.id)
        .order('month_index');
      if (periods.error) throw periods.error;
      return { cycle, periods: periods.data };
    },
  });
}

export function useWallets(groupId: string) {
  return useQuery({
    queryKey: ['wallets', groupId],
    queryFn: async (): Promise<Wallet[]> => {
      const { data, error } = await supabase.from('wallets').select('id, name').eq('group_id', groupId).eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });
}

/** Declarations for one month, newest first. Pass `memberId` for the member screen: open-visibility groups let members read each other's rows. */
export function useDeclarations(groupId: string, periodId: string | undefined, memberId?: string) {
  return useQuery({
    queryKey: ['declarations', groupId, periodId, memberId ?? 'all'],
    enabled: Boolean(periodId),
    queryFn: async (): Promise<DeclarationRow[]> => {
      let q = supabase.from('declarations').select('*').eq('period_id', periodId!);
      if (memberId) q = q.eq('member_id', memberId);
      const { data, error } = await q.order('submitted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** What the member owes at minimum this month, from the last closed month's statement. A hint only. */
export function useMinimumPayable(memberId: string | undefined, periodId: string | undefined) {
  return useQuery({
    queryKey: ['minimum-payable', memberId, periodId],
    enabled: Boolean(memberId && periodId),
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from('statements')
        .select('next_minimum')
        .eq('member_id', memberId!)
        .eq('period_id', periodId!)
        .maybeSingle();
      if (error) throw error;
      return data?.next_minimum ?? null;
    },
  });
}

export function useRefreshLedger(groupId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['declarations', groupId] }),
      qc.invalidateQueries({ queryKey: ['ledger-cycle', groupId] }),
    ]);
}
```

`src/features/ledger/actions.ts`:

```ts
import { useMutation } from '@tanstack/react-query';
import { useGroup } from '@/features/group/GroupContext';
import { friendlyError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { useToast } from '@/ui';
import { useRefreshLedger } from './queries';

/**
 * A ledger write: buzz, refresh the month and its declarations, confirm with a toast.
 * A refusal toasts the friendly sentence and refreshes too, since the screen may be stale (month closed, declaration already handled).
 */
export function useLedgerAction<T>(fn: (arg: T) => Promise<unknown>, success: string) {
  const { group } = useGroup();
  const refresh = useRefreshLedger(group.id);
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      haptic();
      await refresh();
      toast(success, { tone: 'success' });
    },
    onError: (err) => {
      toast(friendlyError(err), { tone: 'danger' });
      void refresh();
    },
  });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `bun run test src/features/ledger && bun run typecheck`
Expected: PASS, clean. If typecheck rejects `.eq('status', 'active')` or the `let q` reassignment, fix the types (do not cast to `any`).

- [ ] **Step 5: Commit**

```bash
git add src/features/ledger/queries.ts src/features/ledger/actions.ts src/features/ledger/queries.test.tsx
git commit -m "feat: ledger query hooks and a mutation wrapper

Cycle and months, wallets, declarations (member-filtered when asked) and the
last statement's minimum payable, plus useLedgerAction for the RPC writes."
```

---

### Task 3: DeclarationSummary and DeclarationForm

**Files:**
- Create: `src/features/ledger/DeclarationSummary.tsx`, `src/features/ledger/DeclarationForm.tsx`
- Test: `src/features/ledger/DeclarationForm.test.tsx`

**Interfaces:**
- Consumes: `AMOUNTS`, `EMPTY_FORM`, `fromDeclaration`, `validateDeclaration`, types from `./declarationForm`; `DeclarationRow`, `Wallet` from `./model`; `sumKwacha` from `./money`; `useLedgerAction` from `./actions`.
- Produces:
  - `DeclarationSummary({ d: DeclarationRow; walletName?: string })`
  - `DeclarationForm({ periodId: string; memberId: string; wallets: Wallet[]; initial?: DeclarationRow | null; onDone: () => void })` — calls `submit_declaration`; must render inside `GroupProvider`, `QueryClientProvider`, `ToastProvider`.

- [ ] **Step 1: Write the failing test**

`src/features/ledger/DeclarationForm.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, renderLedger } from './testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { DeclarationForm } = await import('./DeclarationForm');

const WALLETS = [{ id: 'w1', name: 'Airtel' }, { id: 'w2', name: 'MTN' }];
const onDone = vi.fn();
const renderForm = (initial?: ReturnType<typeof declaration>) =>
  renderLedger(<DeclarationForm periodId="p9" memberId="m1" wallets={WALLETS} initial={initial} onDone={onDone} />);

beforeEach(() => {
  rpc.mockReset();
  onDone.mockReset();
});

test('sends the typed amounts and the chosen wallet', async () => {
  rpc.mockResolvedValue({ data: {}, error: null });
  renderForm();
  await userEvent.type(screen.getByLabelText('Savings'), '250');
  await userEvent.type(screen.getByLabelText('Loan repayment'), '100.5');
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
  expect(rpc).toHaveBeenCalledWith('submit_declaration', {
    p_period: 'p9', p_member: 'm1', p_saving: 250, p_loan_repayment: 100.5, p_excess: 0, p_membership: 0, p_penalty: 0,
    p_txn_fee: 0, p_borrowing_request: 0, p_wallet: 'w1', p_note: undefined,
  });
  expect(await screen.findByText('Declaration sent to the treasurer.')).toBeInTheDocument();
  await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
});

test('refuses malformed amounts and sends nothing', async () => {
  renderForm();
  for (const bad of ['1,000', '250.555', '-5', '1e3']) {
    const field = screen.getByLabelText('Savings');
    await userEvent.clear(field);
    await userEvent.type(field, bad);
    await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
    expect(await screen.findByText('Use kwacha and ngwee, like 250 or 250.50.'), bad).toBeInTheDocument();
  }
  expect(rpc).not.toHaveBeenCalled();
});

test('needs at least one amount, and a wallet when money is sent', async () => {
  renderForm();
  await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
  expect(await screen.findByText('Enter at least one amount.')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Savings'), '250');
  await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
  expect(await screen.findByText('Choose the wallet you paid from.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('a refusal from the database shows the friendly sentence and keeps what was typed', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'period_not_open', code: 'P0001' } });
  renderForm();
  await userEvent.type(screen.getByLabelText('Savings'), '250');
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w2');
  await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
  expect(await screen.findByText('That month isn’t open. Pick the current month, or open it first.')).toBeInTheDocument();
  expect(screen.getByLabelText('Savings')).toHaveValue('250');
  expect(onDone).not.toHaveBeenCalled();
});

test('a double tap sends one request', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderForm();
  await userEvent.type(screen.getByLabelText('Savings'), '250');
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  const submit = screen.getByRole('button', { name: 'Submit declaration' });
  await userEvent.click(submit);
  await userEvent.click(submit);
  expect(rpc).toHaveBeenCalledTimes(1);
});

test('editing a returned declaration starts from its figures', () => {
  renderForm(declaration({ saving: 250, note: 'May payment', status: 'returned' }));
  expect(screen.getByLabelText('Savings')).toHaveValue('250');
  expect(screen.getByLabelText('Wallet')).toHaveValue('w1');
  expect(screen.getByLabelText('Note (optional)')).toHaveValue('May payment');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/features/ledger/DeclarationForm.test.tsx`
Expected: FAIL (`./DeclarationForm` not found)

- [ ] **Step 3: Implement the summary and the form**

`src/features/ledger/DeclarationSummary.tsx`:

```tsx
import { Fragment } from 'react';
import { money } from '@/lib/format';
import { AMOUNTS } from './declarationForm';
import type { DeclarationRow } from './model';
import { sumKwacha } from './money';

export function DeclarationSummary({ d, walletName }: { d: DeclarationRow; walletName?: string }) {
  const lines = AMOUNTS.filter((a) => d[a.key] > 0);
  const sent = sumKwacha(...AMOUNTS.filter((a) => a.key !== 'borrowing_request').map((a) => d[a.key]));
  return (
    <div className="grid gap-2 text-sm">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        {lines.map((a) => (
          <Fragment key={a.key}>
            <dt className="text-muted">{a.label}</dt>
            <dd className="tabular text-right text-fg">{money(d[a.key])}</dd>
          </Fragment>
        ))}
      </dl>
      {sent > 0 ? <p className="font-semibold text-fg">Sending {money(sent)}{walletName ? ` from ${walletName}` : ''}</p> : null}
      {d.note ? <p className="text-muted">“{d.note}”</p> : null}
    </div>
  );
}
```

`src/features/ledger/DeclarationForm.tsx`:

```tsx
import { useId, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert, Button, TextField } from '@/ui';
import { cn } from '@/ui/cn';
import { useLedgerAction } from './actions';
import { AMOUNTS, EMPTY_FORM, fromDeclaration, validateDeclaration, type DeclarationArgs, type FormErrors, type FormValues } from './declarationForm';
import type { DeclarationRow, Wallet } from './model';

type Props = { periodId: string; memberId: string; wallets: Wallet[]; initial?: DeclarationRow | null; onDone: () => void };

export function DeclarationForm({ periodId, memberId, wallets, initial, onDone }: Props) {
  const [values, setValues] = useState<FormValues>(initial ? fromDeclaration(initial) : EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const walletId = useId();

  const submit = useLedgerAction(async (a: DeclarationArgs) => {
    const { error } = await supabase.rpc('submit_declaration', {
      p_period: periodId,
      p_member: memberId,
      p_saving: a.saving,
      p_loan_repayment: a.loan_repayment,
      p_excess: a.excess,
      p_membership: a.membership,
      p_penalty: a.penalty,
      p_txn_fee: a.txn_fee,
      p_borrowing_request: a.borrowing_request,
      p_wallet: a.wallet,
      p_note: a.note,
    });
    if (error) throw error;
  }, 'Declaration sent to the treasurer.');

  const set = (k: keyof FormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateDeclaration(values);
    if ('errors' in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    submit.mutate(result.args, { onSuccess: onDone });
  };

  return (
    <form className="grid gap-4" noValidate onSubmit={onSubmit}>
      {errors.form ? <Alert tone="danger">{errors.form}</Alert> : null}
      {AMOUNTS.map((a) => (
        <TextField
          key={a.key}
          label={a.label}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          error={errors[a.key]}
          value={values[a.key]}
          onChange={set(a.key)}
        />
      ))}
      <div className="grid gap-1.5">
        <label htmlFor={walletId} className="text-sm font-medium text-fg">Wallet</label>
        <select
          id={walletId}
          value={values.wallet}
          onChange={set('wallet')}
          aria-invalid={errors.wallet ? true : undefined}
          aria-describedby={errors.wallet ? `${walletId}-error` : undefined}
          className={cn(
            'h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-fg transition focus-visible:border-accent',
            errors.wallet ? 'border-danger' : 'border-line',
          )}
        >
          <option value="">Choose a wallet</option>
          {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {errors.wallet ? <p id={`${walletId}-error`} role="alert" className="text-sm text-danger">{errors.wallet}</p> : null}
      </div>
      <TextField label="Note (optional)" maxLength={500} autoComplete="off" error={errors.note} value={values.note} onChange={set('note')} />
      <Button type="submit" fullWidth isLoading={submit.isPending}>Submit declaration</Button>
    </form>
  );
}
```

- [ ] **Step 4: Run tests, lint and typecheck**

Run: `bun run test src/features/ledger && bun run lint && bun run typecheck`
Expected: PASS, clean

- [ ] **Step 5: Commit**

```bash
git add src/features/ledger/DeclarationSummary.tsx src/features/ledger/DeclarationForm.tsx src/features/ledger/DeclarationForm.test.tsx
git commit -m "feat: declaration form and summary

One form for members and for the treasurer declaring on a member's behalf.
Validates shape client-side, sends through submit_declaration, keeps typed
values on a refusal and sends once on a double tap."
```

---

### Task 4: The member Declare screen

**Files:**
- Create: `src/features/declare/DeclarePage.tsx`
- Modify: `src/app/router.tsx` (the `declare` route), `src/features/shells/ComingSoon.tsx` (copy)
- Test: `src/features/declare/DeclarePage.test.tsx`

**Interfaces:**
- Consumes: hooks from `@/features/ledger/queries`; `currentPeriod`, `lastClosed`, `liveDeclarations`, `deadlineNote` from `@/features/ledger/model`; `DeclarationForm`, `DeclarationSummary`; `useGroup()`.
- Produces: `DeclarePage()` (route `/declare`).

- [ ] **Step 1: Write the failing test**

`src/features/declare/DeclarePage.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, renderLedger, year } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const hooks = vi.hoisted(() => ({ cycle: vi.fn(), wallets: vi.fn(), declarations: vi.fn(), minimum: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useWallets: () => hooks.wallets(),
  useDeclarations: () => hooks.declarations(),
  useMinimumPayable: () => hooks.minimum(),
}));
const { DeclarePage } = await import('./DeclarePage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const OPEN = ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8, 'open') });
const NOT_OPEN = ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8) });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T10:00:00'));
  rpc.mockReset();
  hooks.cycle.mockReturnValue(OPEN);
  hooks.wallets.mockReturnValue(ok([{ id: 'w1', name: 'Airtel' }]));
  hooks.declarations.mockReturnValue(ok([]));
  hooks.minimum.mockReturnValue(ok(300));
});

test('a member profile is required: no request, a clear message', () => {
  renderLedger(<DeclarePage />, { member: null });
  expect(screen.getByText('Your account isn’t linked to a member')).toBeInTheDocument();
  expect(screen.queryByLabelText('Savings')).toBeNull();
});

test('no open month: says so, shows no form', () => {
  hooks.cycle.mockReturnValue(NOT_OPEN);
  renderLedger(<DeclarePage />);
  expect(screen.getByText('Next month isn’t open yet')).toBeInTheDocument();
  expect(screen.getByText(/Sep 2026/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Savings')).toBeNull();
});

test('loading shows a labelled skeleton; a failed load offers a retry', () => {
  hooks.cycle.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderLedger(<DeclarePage />);
  expect(screen.getByText('Loading your declaration')).toBeInTheDocument();
  unmount();
  hooks.cycle.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch: vi.fn() });
  renderLedger(<DeclarePage />);
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

test('open month, nothing declared: deadline, minimum hint and the form', () => {
  renderLedger(<DeclarePage />);
  expect(screen.getByText('7 Oct 2026')).toBeInTheDocument();
  expect(screen.getByText('2 days left')).toBeInTheDocument();
  expect(screen.getByText('K 300')).toBeInTheDocument();
  expect(screen.getByLabelText('Savings')).toBeInTheDocument();
});

test('a waiting declaration shows its status and offers Edit before the form', async () => {
  hooks.declarations.mockReturnValue(ok([declaration({ status: 'submitted' })]));
  renderLedger(<DeclarePage />);
  expect(screen.getByText('Waiting for the treasurer')).toBeInTheDocument();
  expect(screen.queryByLabelText('Savings')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(screen.getByLabelText('Savings')).toHaveValue('250');
});

test('a returned declaration shows the reason and the prefilled form', () => {
  hooks.declarations.mockReturnValue(ok([declaration({ status: 'returned', return_reason: 'Amount does not match the receipt' })]));
  renderLedger(<DeclarePage />);
  expect(screen.getByText('Returned by the treasurer')).toBeInTheDocument();
  expect(screen.getByText('Amount does not match the receipt')).toBeInTheDocument();
  expect(screen.getByLabelText('Savings')).toHaveValue('250');
});

test('a resubmitted declaration shows only the live one', () => {
  hooks.declarations.mockReturnValue(
    ok([declaration({ id: 'd2', saving: 400, supersedes_id: 'd1' }), declaration({ id: 'd1', saving: 250, status: 'returned' })]),
  );
  renderLedger(<DeclarePage />);
  expect(screen.getByText('K 400')).toBeInTheDocument();
  expect(screen.queryByText('K 250')).toBeNull();
});

test('an approved declaration is read-only; another payment can still be declared', async () => {
  hooks.declarations.mockReturnValue(ok([declaration({ status: 'approved' })]));
  renderLedger(<DeclarePage />);
  expect(screen.getByText('Approved')).toBeInTheDocument();
  expect(screen.queryByLabelText('Savings')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Declare another payment' }));
  expect(screen.getByLabelText('Savings')).toHaveValue('');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/features/declare`
Expected: FAIL (`./DeclarePage` not found)

- [ ] **Step 3: Implement the page**

`src/features/declare/DeclarePage.tsx`:

```tsx
import { PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { DeclarationForm } from '@/features/ledger/DeclarationForm';
import { DeclarationSummary } from '@/features/ledger/DeclarationSummary';
import { useGroup } from '@/features/group/GroupContext';
import { currentPeriod, deadlineNote, lastClosed, liveDeclarations } from '@/features/ledger/model';
import { useDeclarations, useLedgerCycle, useMinimumPayable, useWallets } from '@/features/ledger/queries';
import { friendlyError } from '@/lib/errors';
import { formatDate, localISODate, money } from '@/lib/format';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton } from '@/ui';

export function DeclarePage() {
  const { group, member } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const periods = cycle.data?.periods ?? [];
  const period = currentPeriod(periods);
  const last = lastClosed(periods);
  const wallets = useWallets(group.id);
  const declarations = useDeclarations(group.id, period?.id, member?.id);
  const minimum = useMinimumPayable(member?.id, last?.id);
  const [editing, setEditing] = useState(false);

  if (!member) {
    return (
      <>
        <PageHeader title="Declare" />
        <EmptyState icon={<PlusCircle className="size-7" />} title="Your account isn’t linked to a member">
          Ask your treasurer to link this account to your name, then come back.
        </EmptyState>
      </>
    );
  }

  if (cycle.data === undefined) {
    return (
      <>
        <PageHeader title="Declare" />
        {cycle.isError ? (
          <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void cycle.refetch()}>Try again</Button>}>
            {friendlyError(cycle.error)}
          </Alert>
        ) : (
          <div role="status" className="grid gap-3">
            <span className="sr-only">Loading your declaration</span>
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        )}
      </>
    );
  }

  if (!period) {
    return (
      <>
        <PageHeader title="Declare" />
        <EmptyState icon={<PlusCircle className="size-7" />} title="Next month isn’t open yet">
          Your treasurer opens each month for declarations.{last ? ` The last closed month is ${last.label}.` : ''}
        </EmptyState>
      </>
    );
  }

  const live = liveDeclarations(declarations.data ?? []);
  const approved = live.filter((d) => d.status === 'approved');
  const waiting = live.find((d) => d.status !== 'approved') ?? null;
  const showForm = waiting ? waiting.status === 'returned' || editing : approved.length === 0 || editing;
  const walletName = (id: string | null) => wallets.data?.find((w) => w.id === id)?.name;
  const note = deadlineNote(localISODate(new Date()), period.deadline);

  return (
    <>
      <PageHeader title="Declare" subtitle={period.label} />
      <div className="grid gap-4 md:gap-5 lg:max-w-xl">
        <Card>
          <p className="flex flex-wrap items-center gap-2 text-base text-fg">
            Due <strong>{formatDate(period.deadline)}</strong>
            <Badge tone={note.tone}>{note.text}</Badge>
          </p>
          {minimum.data != null && minimum.data > 0 ? (
            <p className="mt-2 text-sm text-muted">
              Minimum payable this month: <span className="tabular font-semibold text-fg">{money(minimum.data)}</span>
            </p>
          ) : null}
        </Card>

        {declarations.isPending ? (
          <div role="status"><span className="sr-only">Loading your declaration</span><Skeleton className="h-40" /></div>
        ) : (
          <>
            {approved.map((d) => (
              <Card key={d.id}>
                <CardHeader title="Your declaration" action={<Badge tone="success">Approved</Badge>} />
                <DeclarationSummary d={d} walletName={walletName(d.wallet_id)} />
              </Card>
            ))}

            {waiting?.status === 'submitted' ? (
              <Card>
                <CardHeader title="Your declaration" action={<Badge tone="warning">Waiting for the treasurer</Badge>} />
                <DeclarationSummary d={waiting} walletName={walletName(waiting.wallet_id)} />
                {!editing ? (
                  <Button className="mt-4" size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
                ) : null}
              </Card>
            ) : null}

            {waiting?.status === 'returned' ? (
              <Alert tone="warning" title="Returned by the treasurer">{waiting.return_reason}</Alert>
            ) : null}

            {showForm ? (
              <Card>
                <CardHeader title={waiting ? 'Update your declaration' : 'What are you sending?'} />
                <DeclarationForm
                  key={waiting?.id ?? 'new'}
                  periodId={period.id}
                  memberId={member.id}
                  wallets={wallets.data ?? []}
                  initial={waiting}
                  onDone={() => setEditing(false)}
                />
              </Card>
            ) : !waiting ? (
              <Button variant="secondary" onClick={() => setEditing(true)}>Declare another payment</Button>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Swap the route and reword the remaining placeholders**

In `src/app/router.tsx`: add `import { DeclarePage } from '@/features/declare/DeclarePage';` next to the other feature imports (keep the import list sorted the way the file already does), and change

```tsx
page('declare', 'Declare', <ComingSoon title="Declaration" />),
```

to

```tsx
page('declare', 'Declare', <DeclarePage />),
```

In `src/features/shells/ComingSoon.tsx` change the `EmptyState` title and body:

```tsx
<EmptyState icon={<CalendarClock className="size-7" />} title="Coming soon">
  Your {title.toLowerCase()} will show your figures from the treasurer’s statements. We’re building it now.
</EmptyState>
```

Then run `grep -rn "February 2027" src` and update any test that asserted the old copy (for example under `src/features/shells` or `src/app`) to the new title `Coming soon`. The Desk copy is replaced in Task 7.

- [ ] **Step 5: Run tests, lint and typecheck**

Run: `bun run test && bun run lint && bun run typecheck`
Expected: PASS, clean (the Desk placeholder test still passes until Task 7)

- [ ] **Step 6: Commit**

```bash
git add src/features/declare src/app/router.tsx src/features/shells
git commit -m "feat: member Declare screen

Deadline and minimum-payable hint, the form, and the waiting / returned /
approved states of the member's own live declaration. Replaces the February
2027 placeholder; Passbook, Plan and Record get neutral coming-soon copy."
```

---

### Task 5: Desk month panel (open a month, change the deadline)

**Files:**
- Create: `src/features/desk/MonthPanel.tsx`
- Test: `src/features/desk/MonthPanel.test.tsx`

**Interfaces:**
- Consumes: `currentPeriod`, `nextToOpen`, `PeriodRow` from `@/features/ledger/model`; `useLedgerAction`.
- Produces: `MonthPanel({ cycleId: string; periods: PeriodRow[] })`.

- [ ] **Step 1: Write the failing test**

`src/features/desk/MonthPanel.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger, year } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { MonthPanel } = await import('./MonthPanel');

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
});

test('opens the next month with the chosen deadline', async () => {
  renderLedger(<MonthPanel cycleId="c1" periods={year(8)} />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Open Oct 2026' }));
  const date = screen.getByLabelText('Declaration deadline');
  expect(date).toHaveValue('2026-10-07');
  expect(date).toHaveAttribute('min', '2026-10-01');
  fireEvent.change(date, { target: { value: '2026-10-14' } });
  await userEvent.click(screen.getByRole('button', { name: 'Open month' }));
  expect(rpc).toHaveBeenCalledWith('open_period', { p_cycle: 'c1', p_month_index: 9, p_deadline: '2026-10-14' });
  expect(await screen.findByText('Oct 2026 is open for declarations.')).toBeInTheDocument();
});

test('a deadline before the month starts is blocked before any request', async () => {
  renderLedger(<MonthPanel cycleId="c1" periods={year(8)} />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Open Oct 2026' }));
  fireEvent.change(screen.getByLabelText('Declaration deadline'), { target: { value: '2026-09-30' } });
  await userEvent.click(screen.getByRole('button', { name: 'Open month' }));
  expect(await screen.findByText('Pick a date in Oct 2026 or later.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('an open month shows its deadline; changing it needs a date and a reason', async () => {
  renderLedger(<MonthPanel cycleId="c1" periods={year(8, 'open')} />, { isAdmin: true });
  expect(screen.getByText('Oct 2026 is open')).toBeInTheDocument();
  expect(screen.getByText(/7 Oct 2026/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Change deadline' }));
  fireEvent.change(screen.getByLabelText('New deadline'), { target: { value: '2026-10-14' } });
  await userEvent.click(screen.getByRole('button', { name: 'Save deadline' }));
  expect(await screen.findByText('Add a reason first.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText('Reason'), 'Members asked for a week');
  await userEvent.click(screen.getByRole('button', { name: 'Save deadline' }));
  expect(rpc).toHaveBeenCalledWith('set_deadline', { p_period: 'p9', p_deadline: '2026-10-14', p_reason: 'Members asked for a week' });
});

test('with nothing to open, says so', () => {
  renderLedger(<MonthPanel cycleId="c1" periods={year(8, 'closing')} />, { isAdmin: true });
  expect(screen.getByText('No month is waiting to be opened.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Open/ })).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/features/desk/MonthPanel.test.tsx`
Expected: FAIL (`./MonthPanel` not found)

- [ ] **Step 3: Implement the panel**

`src/features/desk/MonthPanel.tsx`:

```tsx
import { CalendarClock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLedgerAction } from '@/features/ledger/actions';
import { currentPeriod, nextToOpen, type PeriodRow } from '@/features/ledger/model';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Alert, Button, Card, CardHeader, Sheet, TextField } from '@/ui';

function OpenMonthSheet({ cycleId, period, onClose }: { cycleId: string; period: PeriodRow; onClose: () => void }) {
  const [deadline, setDeadline] = useState(period.deadline);
  const [error, setError] = useState<string>();
  const open = useLedgerAction(async (date: string) => {
    const { error: e } = await supabase.rpc('open_period', { p_cycle: cycleId, p_month_index: period.month_index, p_deadline: date });
    if (e) throw e;
  }, `${period.label} is open for declarations.`);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!deadline || deadline < period.starts_on) {
      setError(`Pick a date in ${period.label} or later.`);
      return;
    }
    setError(undefined);
    open.mutate(deadline, { onSuccess: onClose });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Open ${period.label}`}
      description="Members can declare once the month is open. The deadline can be in the past if you are catching up."
      footer={<Button type="submit" form="open-month" fullWidth isLoading={open.isPending}>Open month</Button>}
    >
      <form id="open-month" noValidate onSubmit={submit}>
        <TextField label="Declaration deadline" type="date" min={period.starts_on} value={deadline} error={error} onChange={(e) => setDeadline(e.target.value)} />
      </form>
    </Sheet>
  );
}

function DeadlineSheet({ period, onClose }: { period: PeriodRow; onClose: () => void }) {
  const [deadline, setDeadline] = useState(period.deadline);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ date?: string; reason?: string }>({});
  const save = useLedgerAction(async (a: { date: string; reason: string }) => {
    const { error: e } = await supabase.rpc('set_deadline', { p_period: period.id, p_deadline: a.date, p_reason: a.reason });
    if (e) throw e;
  }, 'Deadline updated.');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: { date?: string; reason?: string } = {};
    if (!deadline || deadline < period.starts_on) next.date = `Pick a date in ${period.label} or later.`;
    if (!reason.trim()) next.reason = 'Add a reason first.';
    else if (reason.trim().length > 500) next.reason = 'Keep the reason to 500 characters or fewer.';
    setErrors(next);
    if (next.date || next.reason) return;
    save.mutate({ date: deadline, reason: reason.trim() }, { onSuccess: onClose });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Change deadline"
      description={`${period.label} is due ${formatDate(period.deadline)}. The change is recorded with your reason.`}
      footer={<Button type="submit" form="change-deadline" fullWidth isLoading={save.isPending}>Save deadline</Button>}
    >
      <form id="change-deadline" className="grid gap-4" noValidate onSubmit={submit}>
        <TextField label="New deadline" type="date" min={period.starts_on} value={deadline} error={errors.date} onChange={(e) => setDeadline(e.target.value)} />
        <TextField label="Reason" maxLength={500} autoComplete="off" value={reason} error={errors.reason} onChange={(e) => setReason(e.target.value)} />
      </form>
    </Sheet>
  );
}

export function MonthPanel({ cycleId, periods }: { cycleId: string; periods: PeriodRow[] }) {
  const open = currentPeriod(periods);
  const next = nextToOpen(periods);
  const [sheet, setSheet] = useState<'open' | 'deadline' | null>(null);
  const close = () => setSheet(null);

  if (open) {
    return (
      <Card>
        <CardHeader
          title={`${open.label} is open`}
          subtitle={`Declarations due ${formatDate(open.deadline)}`}
          action={<Button size="sm" variant="secondary" onClick={() => setSheet('deadline')}>Change deadline</Button>}
        />
        {sheet === 'deadline' ? <DeadlineSheet period={open} onClose={close} /> : null}
      </Card>
    );
  }
  if (next) {
    return (
      <Card>
        <CardHeader
          title={`${next.label} is next`}
          subtitle="Open the month so members can declare."
          action={<Button size="sm" onClick={() => setSheet('open')} leftIcon={<CalendarClock className="size-5" />}>Open {next.label}</Button>}
        />
        {sheet === 'open' ? <OpenMonthSheet cycleId={cycleId} period={next} onClose={close} /> : null}
      </Card>
    );
  }
  return <Alert tone="info">No month is waiting to be opened.</Alert>;
}
```

- [ ] **Step 4: Run tests, lint and typecheck**

Run: `bun run test src/features/desk/MonthPanel.test.tsx && bun run lint && bun run typecheck`
Expected: PASS, clean. If `Button`'s `form` attribute is rejected by types, it is not (it extends `ButtonHTMLAttributes`); if the accessible name of the open button differs because of the icon, keep the icon `aria-hidden` (lucide does this by default).

- [ ] **Step 5: Commit**

```bash
git add src/features/desk/MonthPanel.tsx src/features/desk/MonthPanel.test.tsx
git commit -m "feat: desk month panel

Open the next month with a deadline (may be in the past) or change an open
month's deadline with a recorded reason. Blocks a date before the month
starts before any request."
```

---

### Task 6: Desk declaration inbox

**Files:**
- Create: `src/features/desk/DeclarationInbox.tsx`
- Test: `src/features/desk/DeclarationInbox.test.tsx`

**Interfaces:**
- Consumes: `DeclarationRow`, `ActiveMember`, `Wallet`, `liveDeclarations`; `DeclarationSummary`; `useLedgerAction`; `useConfirmTap`.
- Produces: `DeclarationInbox({ declarations: DeclarationRow[]; members: ActiveMember[]; wallets: Wallet[] })` — shows Waiting / Returned / Approved sections for the live declarations; Approve (tap twice) → `approve_declaration`; Return (sheet, reason required) → `return_declaration`.

- [ ] **Step 1: Write the failing test**

`src/features/desk/DeclarationInbox.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { DeclarationInbox } = await import('./DeclarationInbox');

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
const WALLETS = [{ id: 'w1', name: 'Airtel' }];
const render = (declarations: ReturnType<typeof declaration>[]) =>
  renderLedger(<DeclarationInbox declarations={declarations} members={MEMBERS} wallets={WALLETS} />, { isAdmin: true });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
});

test('groups live declarations by status with counts, naming each member', () => {
  render([
    declaration({ id: 'd1', member_id: 'm1', status: 'submitted' }),
    declaration({ id: 'd2', member_id: 'm2', status: 'returned', return_reason: 'Amount unclear' }),
    declaration({ id: 'd3', member_id: 'm1', status: 'approved', saving: 300 }),
  ]);
  expect(screen.getByRole('heading', { name: 'Waiting (1)' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Returned (1)' })).toBeInTheDocument();
  expect(screen.getByText('Approved (1)')).toBeInTheDocument();
  const waiting = screen.getAllByRole('listitem')[0]!;
  expect(within(waiting).getByText('Eve')).toBeInTheDocument();
  expect(within(waiting).getByText('Sending K 250 from Airtel')).toBeInTheDocument();
  expect(screen.getByText('Amount unclear')).toBeInTheDocument();
});

test('says so when nothing has been declared', () => {
  render([]);
  expect(screen.getByText('No declarations yet this month.')).toBeInTheDocument();
});

test('Approve needs a second tap, then sends once even if tapped again', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  render([declaration({ id: 'd1' })]);
  await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to approve' }));
  await userEvent.click(screen.getByRole('button', { name: /Approve/ }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('approve_declaration', { p_declaration: 'd1' });
});

test('Return needs a reason, then sends it', async () => {
  render([declaration({ id: 'd1' })]);
  await userEvent.click(screen.getByRole('button', { name: 'Return' }));
  await userEvent.click(screen.getByRole('button', { name: 'Return declaration' }));
  expect(await screen.findByText('Say what the member should fix.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText('Reason'), 'Amount does not match the receipt');
  await userEvent.click(screen.getByRole('button', { name: 'Return declaration' }));
  expect(rpc).toHaveBeenCalledWith('return_declaration', { p_declaration: 'd1', p_reason: 'Amount does not match the receipt' });
});

test('an approval refused because the declaration was already handled shows the friendly sentence', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'declaration_not_found', code: 'P0001' } });
  render([declaration({ id: 'd1' })]);
  await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to approve' }));
  expect(await screen.findByText('That declaration was already handled or replaced. Refresh and try again.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/features/desk/DeclarationInbox.test.tsx`
Expected: FAIL (`./DeclarationInbox` not found)

- [ ] **Step 3: Implement the inbox**

`src/features/desk/DeclarationInbox.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { DeclarationSummary } from '@/features/ledger/DeclarationSummary';
import { useLedgerAction } from '@/features/ledger/actions';
import { liveDeclarations, type ActiveMember, type DeclarationRow, type Wallet } from '@/features/ledger/model';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Badge, Button, Card, Sheet, TextField, useConfirmTap } from '@/ui';

type RowProps = { d: DeclarationRow; name: string; walletName?: string };

function ReturnSheet({ d, name, onClose }: { d: DeclarationRow; name: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const send = useLedgerAction(async (text: string) => {
    const { error: e } = await supabase.rpc('return_declaration', { p_declaration: d.id, p_reason: text });
    if (e) throw e;
  }, 'Declaration returned.');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = reason.trim();
    if (!text) return setError('Say what the member should fix.');
    if (text.length > 500) return setError('Keep the reason to 500 characters or fewer.');
    setError(undefined);
    send.mutate(text, { onSuccess: onClose });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Return ${name}’s declaration`}
      description="They will see your reason and can send a corrected declaration."
      footer={<Button type="submit" form={`return-${d.id}`} fullWidth isLoading={send.isPending}>Return declaration</Button>}
    >
      <form id={`return-${d.id}`} noValidate onSubmit={submit}>
        <TextField label="Reason" maxLength={500} autoComplete="off" value={reason} error={error} onChange={(e) => setReason(e.target.value)} />
      </form>
    </Sheet>
  );
}

function WaitingRow({ d, name, walletName }: RowProps) {
  const approve = useLedgerAction(async (id: string) => {
    const { error } = await supabase.rpc('approve_declaration', { p_declaration: id });
    if (error) throw error;
  }, 'Declaration approved.');
  const confirm = useConfirmTap(() => approve.mutate(d.id));
  const [returning, setReturning] = useState(false);
  return (
    <li className="grid gap-3 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold text-fg">{name}</p>
        <Badge tone="warning">{formatDate(d.submitted_at)}</Badge>
      </div>
      <DeclarationSummary d={d} walletName={walletName} />
      <div className="flex gap-2">
        <Button size="sm" isLoading={approve.isPending} onClick={confirm.tap}>{confirm.armed ? 'Tap again to approve' : 'Approve'}</Button>
        <Button size="sm" variant="secondary" onClick={() => setReturning(true)}>Return</Button>
      </div>
      {returning ? <ReturnSheet d={d} name={name} onClose={() => setReturning(false)} /> : null}
    </li>
  );
}

const PlainRow = ({ d, name, walletName }: RowProps) => (
  <li className="grid gap-2 py-4">
    <p className="font-semibold text-fg">{name}</p>
    <DeclarationSummary d={d} walletName={walletName} />
    {d.status === 'returned' && d.return_reason ? <p className="text-sm text-muted">Returned: {d.return_reason}</p> : null}
  </li>
);

export function DeclarationInbox({ declarations, members, wallets }: { declarations: DeclarationRow[]; members: ActiveMember[]; wallets: Wallet[] }) {
  const live = liveDeclarations(declarations);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.short_name ?? 'Former member';
  const walletOf = (id: string | null) => wallets.find((w) => w.id === id)?.name;
  const waiting = live.filter((d) => d.status === 'submitted');
  const returned = live.filter((d) => d.status === 'returned');
  const approved = live.filter((d) => d.status === 'approved');

  if (live.length === 0) return <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">No declarations yet this month.</p>;

  return (
    <div className="grid gap-4">
      <Card>
        <h3 className="text-lg font-semibold text-fg">Waiting ({waiting.length})</h3>
        <ul role="list" className="divide-y divide-line">
          {waiting.map((d) => <WaitingRow key={d.id} d={d} name={nameOf(d.member_id)} walletName={walletOf(d.wallet_id)} />)}
        </ul>
      </Card>
      {returned.length > 0 ? (
        <Card>
          <h3 className="text-lg font-semibold text-fg">Returned ({returned.length})</h3>
          <ul role="list" className="divide-y divide-line">
            {returned.map((d) => <PlainRow key={d.id} d={d} name={nameOf(d.member_id)} walletName={walletOf(d.wallet_id)} />)}
          </ul>
        </Card>
      ) : null}
      {approved.length > 0 ? (
        <Card>
          <details>
            <summary className="cursor-pointer text-lg font-semibold text-fg">Approved ({approved.length})</summary>
            <ul role="list" className="divide-y divide-line">
              {approved.map((d) => <PlainRow key={d.id} d={d} name={nameOf(d.member_id)} walletName={walletOf(d.wallet_id)} />)}
            </ul>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
```

Note for the first test: the `Waiting (1)` heading is an `h3`, and the test's `getAllByRole('listitem')[0]` is the waiting row (it is first in document order). The "Approved (1)" summary is plain text inside `<details>`, found with `getByText`.

- [ ] **Step 4: Run tests, lint and typecheck**

Run: `bun run test src/features/desk/DeclarationInbox.test.tsx && bun run lint && bun run typecheck`
Expected: PASS, clean. If `submitted_at` is not an ISO date string `formatDate` can read (it slices the first 10 characters, so an ISO timestamp works), leave as is.

- [ ] **Step 5: Commit**

```bash
git add src/features/desk/DeclarationInbox.tsx src/features/desk/DeclarationInbox.test.tsx
git commit -m "feat: desk declaration inbox

Waiting, returned and approved declarations by member. Approve takes a
second tap and sends once; Return requires a reason."
```

---

### Task 7: Not-yet-declared list, Desk assembly and final checks

**Files:**
- Create: `src/features/desk/NotYetDeclared.tsx`
- Modify: `src/features/desk/DeskPage.tsx`, `src/features/desk/DeskPage.test.tsx`
- Test: `src/features/desk/NotYetDeclared.test.tsx`
- Modify (spec): `docs/superpowers/specs/2026-10-11-live-month-loop-design.md` (the "counts by status" line, see Step 9)

**Interfaces:**
- Consumes: everything above plus `useGroupMembers` from `@/features/group/GroupPage`.
- Produces: `NotYetDeclared({ periodId: string; members: ActiveMember[]; declarations: DeclarationRow[]; wallets: Wallet[] })`; the final `DeskPage()`.

- [ ] **Step 1: Write the failing tests**

`src/features/desk/NotYetDeclared.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { NotYetDeclared } = await import('./NotYetDeclared');

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
const WALLETS = [{ id: 'w1', name: 'Airtel' }];

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
});

test('lists only members with no live declaration', () => {
  renderLedger(<NotYetDeclared periodId="p9" members={MEMBERS} declarations={[declaration({ member_id: 'm1' })]} wallets={WALLETS} />, { isAdmin: true });
  expect(screen.getByText('Ann')).toBeInTheDocument();
  expect(screen.queryByText('Eve')).toBeNull();
});

test('renders nothing when everyone has declared', () => {
  const { container } = renderLedger(
    <NotYetDeclared periodId="p9" members={MEMBERS} declarations={[declaration({ member_id: 'm1' }), declaration({ id: 'd2', member_id: 'm2' })]} wallets={WALLETS} />,
    { isAdmin: true },
  );
  expect(container).toBeEmptyDOMElement();
});

test('declares on a member’s behalf', async () => {
  renderLedger(<NotYetDeclared periodId="p9" members={MEMBERS} declarations={[]} wallets={WALLETS} />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Declare for Ann' }));
  await userEvent.type(screen.getByLabelText('Savings'), '250');
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
  expect(rpc).toHaveBeenCalledWith('submit_declaration', expect.objectContaining({ p_period: 'p9', p_member: 'm2', p_saving: 250, p_wallet: 'w1' }));
});
```

Replace `src/features/desk/DeskPage.test.tsx` with:

```tsx
import { screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, renderLedger, year } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const hooks = vi.hoisted(() => ({ cycle: vi.fn(), wallets: vi.fn(), declarations: vi.fn(), members: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useWallets: () => hooks.wallets(),
  useDeclarations: () => hooks.declarations(),
}));
vi.mock('@/features/group/GroupPage', () => ({ useGroupMembers: () => hooks.members() }));
const { DeskPage } = await import('./DeskPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const MEMBER_ROWS = [
  { id: 'm1', short_name: 'Eve', status: 'active' },
  { id: 'm2', short_name: 'Ann', status: 'active' },
  { id: 'm3', short_name: 'Old', status: 'left' },
];

beforeEach(() => {
  rpc.mockReset();
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8, 'open') }));
  hooks.wallets.mockReturnValue(ok([{ id: 'w1', name: 'Airtel' }]));
  hooks.declarations.mockReturnValue(ok([declaration({ member_id: 'm1' })]));
  hooks.members.mockReturnValue(ok(MEMBER_ROWS));
});

test('members get the admins-only screen and no ledger request is made', () => {
  renderLedger(<DeskPage />, { isAdmin: false });
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(hooks.cycle).not.toHaveBeenCalled();
  expect(screen.queryByText(/is open/)).toBeNull();
});

test('admin with an open month sees the month panel, the inbox and who has not declared', () => {
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByText('Oct 2026 is open')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Waiting (1)' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Not yet declared' })).toBeInTheDocument();
  expect(screen.getByText('Ann')).toBeInTheDocument();
  expect(screen.queryByText('Old')).toBeNull();
});

test('admin with the next month still to open sees the open button and no inbox', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8) }));
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByRole('button', { name: 'Open Oct 2026' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /Waiting/ })).toBeNull();
});

test('no active cycle: an empty state', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: null, periods: [] }));
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByText('No active cycle')).toBeInTheDocument();
});

test('loading and failure states', () => {
  hooks.cycle.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByText('Loading the desk')).toBeInTheDocument();
  unmount();
  hooks.cycle.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'not_admin', code: '42501' }, refetch: vi.fn() });
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByText('Only admins can do this.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

test('keeps the way to the ledger check', () => {
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByRole('link', { name: 'Open the ledger check' })).toHaveAttribute('href', '/desk/ledger-check');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun run test src/features/desk`
Expected: FAIL (`./NotYetDeclared` not found; DeskPage tests fail against the old placeholder)

- [ ] **Step 3: Implement NotYetDeclared**

`src/features/desk/NotYetDeclared.tsx`:

```tsx
import { useState } from 'react';
import { DeclarationForm } from '@/features/ledger/DeclarationForm';
import { liveDeclarations, undeclared, type ActiveMember, type DeclarationRow, type Wallet } from '@/features/ledger/model';
import { Button, Card, Sheet } from '@/ui';

type Props = { periodId: string; members: ActiveMember[]; declarations: DeclarationRow[]; wallets: Wallet[] };

/** Active members with no live declaration. The treasurer can type in a WhatsApp declaration for any of them. */
export function NotYetDeclared({ periodId, members, declarations, wallets }: Props) {
  const [picked, setPicked] = useState<ActiveMember | null>(null);
  const missing = undeclared(members, liveDeclarations(declarations));
  if (missing.length === 0) return null;
  return (
    <Card>
      <h3 className="text-lg font-semibold text-fg">Not yet declared</h3>
      <ul role="list" className="divide-y divide-line">
        {missing.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 py-2">
            <span className="text-fg">{m.short_name}</span>
            <Button size="sm" variant="secondary" aria-label={`Declare for ${m.short_name}`} onClick={() => setPicked(m)}>Declare</Button>
          </li>
        ))}
      </ul>
      {picked ? (
        <Sheet open onClose={() => setPicked(null)} title={`Declare for ${picked.short_name}`} description="Use this for a declaration the member sent you outside the app.">
          <DeclarationForm periodId={periodId} memberId={picked.id} wallets={wallets} onDone={() => setPicked(null)} />
        </Sheet>
      ) : null}
    </Card>
  );
}
```

- [ ] **Step 4: Assemble the Desk**

Replace `src/features/desk/DeskPage.tsx` with:

```tsx
import { ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { useGroupMembers } from '@/features/group/GroupPage';
import { activeMembers, currentPeriod } from '@/features/ledger/model';
import { useDeclarations, useLedgerCycle, useWallets } from '@/features/ledger/queries';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { Alert, Button, EmptyState, PageHeader, Skeleton } from '@/ui';
import { DeclarationInbox } from './DeclarationInbox';
import { MonthPanel } from './MonthPanel';
import { NotYetDeclared } from './NotYetDeclared';

function DeskBody() {
  const { group } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const members = useGroupMembers(group.id);
  const wallets = useWallets(group.id);
  const open = cycle.data ? currentPeriod(cycle.data.periods) : null;
  const declarations = useDeclarations(group.id, open?.id);

  if (cycle.data === undefined) {
    return cycle.isError ? (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void cycle.refetch()}>Try again</Button>}>
        {friendlyError(cycle.error)}
      </Alert>
    ) : (
      <div role="status" className="grid gap-3">
        <span className="sr-only">Loading the desk</span>
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!cycle.data.cycle) {
    return <EmptyState icon={<ClipboardCheck className="size-7" />} title="No active cycle">The desk works on the group’s active cycle. Set one up in Settings first.</EmptyState>;
  }

  const ready = declarations.data && members.data && wallets.data;
  return (
    <div className="grid gap-4 md:gap-5 lg:max-w-2xl">
      <MonthPanel cycleId={cycle.data.cycle.id} periods={cycle.data.periods} />
      {open ? (
        ready ? (
          <>
            <DeclarationInbox declarations={declarations.data!} members={activeMembers(members.data!)} wallets={wallets.data!} />
            <NotYetDeclared periodId={open.id} members={activeMembers(members.data!)} declarations={declarations.data!} wallets={wallets.data!} />
          </>
        ) : (
          <div role="status"><span className="sr-only">Loading declarations</span><Skeleton className="h-40" /></div>
        )
      ) : null}
    </div>
  );
}

export function DeskPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader
        title="Treasurer desk"
        actions={
          <Link
            to="/desk/ledger-check"
            className="inline-flex h-12 items-center rounded-xl px-5 font-semibold text-accent underline transition duration-150 hover:bg-surface-2 active:scale-[.97]"
          >
            Open the ledger check
          </Link>
        }
      />
      <DeskBody />
    </>
  );
}
```

- [ ] **Step 5: Run the desk tests**

Run: `bun run test src/features/desk`
Expected: PASS. If the `Not yet declared` test finds duplicate `Ann` (once in the list only is expected), check `activeMembers` is applied to the mocked rows and `Old` (status `left`) is excluded.

- [ ] **Step 6: Full verification**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: all green; the build warns only about the existing chunk-size notice.

- [ ] **Step 7: Check for leftover placeholder copy**

Run: `grep -rn "February 2027\|arrives with the ledger" src`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/features/desk
git commit -m "feat: treasurer desk for the live month

Month panel, declaration inbox and a not-yet-declared list that lets the
treasurer declare for a member. Replaces the February 2027 placeholder."
```

- [ ] **Step 9: Align the spec with what was built, and hand over**

In `docs/superpowers/specs/2026-10-11-live-month-loop-design.md` §5 "Month panel", change "count of declarations by status" to "(the counts by status are in the inbox section headings)". Do not commit the spec file unless the user asks.

Then give the user this manual check for the dev database (it needs `bun run db:push` done first, which the user runs):
1. Sign in as an admin, open `/desk`, open October with a deadline.
2. Sign in as a member (or use "Declare for member"), declare K250 from Airtel.
3. As the admin, approve it and confirm an `entries` row of kind `saving` exists for that member and period.
4. Return another declaration with a reason and confirm the member sees it on `/declare`.
