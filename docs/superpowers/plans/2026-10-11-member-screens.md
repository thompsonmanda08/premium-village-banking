# Member screens (S2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Coming soon" placeholders with a real Passbook, Record and Plan that show the signed-in member's own figures from the imported 2026 data and live months.

**Architecture:** UI only, no migration. Four read hooks join `src/features/ledger/queries.ts`; pure view helpers live in `memberViews.ts`; a small `MemberScreen` shell gives all three screens the same unlinked / error / loading behaviour. Each page is a component over mocked-hook-testable queries. The client never computes a stored figure.

**Tech Stack:** React 19, react-router, TanStack Query, supabase-js (typed `from` / `rpc`), Tailwind tokens from `src/ui`, Vitest + Testing Library (`bun run test`), eslint (`bun run lint`), `tsc` (`bun run typecheck`).

**Spec:** `docs/superpowers/specs/2026-10-11-member-screens-design.md` (builds on the S1 spec and the ledger-engine spec §4, §9).

## Global Constraints

- No database change and no migration number taken.
- Own figures only: every query filters by the signed-in member's id (open-visibility groups would otherwise return other members' rows). No member picker.
- Read-only: no RPC writes. Money is formatted with the existing `money()` from `@/lib/format`; sums use `sumKwacha` (integer ngwee). The client never computes a stored figure.
- Every screen has loading, error-with-retry, empty and unlinked-member states; 48px targets (`Button` / `TextField` already are); tokens only; sections are labelled; `<details>` for expandable rows.
- Copy uses the curly apostrophe `’`. Server errors go through `friendlyError`.
- Tests: synthetic data only, no real member names or figures. In tests find loading text with `getByText` (the toast region also has `role="status"`).
- Commits: subject + body, **no `Co-Authored-By` trailer**. Never `git push`, never `git add -A`, never stage anything under `docs/` or `semantic-review/`.

## Review Focus

- Another member's rows never reach the screen: every hook filters by member id. (Task 2 tests.)
- An unknown entry kind renders as its raw name instead of disappearing. (Task 1 test.)
- A statement or entry whose month is missing from the periods list renders with a fallback label instead of crashing. (Task 1 test.)
- A loan whose instalments are all in closed months shows "No instalments left" and K 0, not an empty card. (Task 1 and Task 6 tests.)
- `payout_preview` failing must not hide the rest of the Plan. (Task 6 test.)
- An owner with no member row sees the unlinked message and the member queries stay disabled. (Task 3 test.)
- Zero balances show "K 0", not blank. (Task 4 test.)

---

## File structure

| File | Responsibility |
|---|---|
| `src/features/ledger/memberViews.ts` | Row types, `kindLabel`, `entryTone`, `toneLabel`, `statementViews`, `latestStatement`, `groupEntriesByPeriod`, `remainingInstalments`, `periodLabel` |
| `src/features/ledger/queries.ts` | + `useMyStatements`, `useMyEntries`, `useMyLoans`, `usePayoutPreview` (modified) |
| `src/features/ledger/MemberScreen.tsx` | Shell: header, unlinked message, error + retry, loading skeleton |
| `src/features/ledger/Figure.tsx` | A headline figure tile (label + value) |
| `src/features/ledger/testFixtures.tsx` | + `statement`, `entry`, `loan`, `instalment` builders (modified) |
| `src/features/passbook/PassbookPage.tsx` | `/passbook` |
| `src/features/record/RecordPage.tsx` | `/record` |
| `src/features/plan/PlanPage.tsx` | `/plan` |
| `src/app/router.tsx` | Route swaps (modified); `src/features/shells/ComingSoon.tsx` deleted |

---

### Task 1: View helpers and fixtures

**Files:**
- Create: `src/features/ledger/memberViews.ts`
- Modify: `src/features/ledger/testFixtures.tsx`
- Test: `src/features/ledger/memberViews.test.ts`

**Interfaces:**
- Consumes: `PeriodRow` from `./model`; `sumKwacha` from `./money`.
- Produces:
  - Types: `StatementRow`, `EntryRow`, `LoanRow`, `InstalmentRow`, `LoanWithInstalments = LoanRow & { instalments: InstalmentRow[] }`, `PayoutRow`, `KindTone = 'in' | 'charged' | 'earned' | 'correction' | 'other'`, `StatementView = { statement: StatementRow; period: PeriodRow | undefined }`, `EntryGroup = { periodId: string; period: PeriodRow | undefined; entries: EntryRow[]; paidIn: number }`, `RemainingInstalment = { id: string; label: string; amount: number }`
  - Functions: `kindLabel(kind: string): string`, `entryTone(e: EntryRow): KindTone`, `toneLabel(t: KindTone): string`, `periodLabel(p: PeriodRow | undefined): string`, `statementViews(statements, periods): StatementView[]`, `latestStatement(statements, periods): StatementView | null`, `groupEntriesByPeriod(entries, periods): EntryGroup[]`, `remainingInstalments(loan, periods): { items: RemainingInstalment[]; total: number }`
  - Fixtures: `statement(o?)`, `entry(o?)`, `loan(o?)`, `instalment(o?)`

- [ ] **Step 1: Add the fixtures**

In `src/features/ledger/testFixtures.tsx` add the import `import type { EntryRow, InstalmentRow, LoanRow, StatementRow } from './memberViews';` next to the existing `./model` import, and append:

```tsx
export const statement = (o: Partial<StatementRow> = {}): StatementRow => ({
  id: 's8', created_at: '2026-10-01T00:00:00Z', group_id: 'g1', period_id: 'p8', member_id: 'm1',
  opening_owed: 0, saving: 250, cum_savings: 2000, loan_principal_sent: 0, loan_interest_charged: 0, excess_charged: 0,
  penalties_charged: 0, paid_total: 250, paid_to_excess: 0, paid_to_penalties: 0, paid_to_interest: 0, paid_to_principal: 0,
  closing_owed: 0, next_minimum: 0, unpaid_minimum: 0, interest_earned: 0, interest_earned_to_date: 0, source: 'import', ...o,
});

export const entry = (o: Partial<EntryRow> = {}): EntryRow => ({
  id: 'e1', created_at: '2026-09-05T08:00:00Z', group_id: 'g1', period_id: 'p8', member_id: 'm1', kind: 'saving', amount: 250,
  loan_id: null, wallet_id: null, source: 'import', declaration_id: null, corrects_entry_id: null, reason: null, created_by: null, ...o,
});

export const loan = (o: Partial<LoanRow> = {}): LoanRow => ({
  id: 'l1', created_at: '2026-09-02T09:00:00Z', group_id: 'g1', member_id: 'm1', period_id: 'p8', principal: 1000, interest: 150,
  term_months: 3, sent_at: '2026-09-02T09:00:00Z', wallet_id: null, cap_warning: null, arrears_warning: null, approved_reason: null,
  status: 'open', ...o,
});

export const instalment = (o: Partial<InstalmentRow> = {}): InstalmentRow => ({
  id: 'i1', created_at: '2026-09-02T09:00:00Z', group_id: 'g1', loan_id: 'l1', period_id: 'p9', amount_due: 383.33, ...o,
});
```

- [ ] **Step 2: Write the failing test**

`src/features/ledger/memberViews.test.ts`:

```ts
import { expect, test } from 'vitest';
import {
  entryTone, groupEntriesByPeriod, kindLabel, latestStatement, periodLabel, remainingInstalments, statementViews, toneLabel,
  type LoanWithInstalments,
} from './memberViews';
import { entry, instalment, loan, statement, year } from './testFixtures';

const KINDS = ['saving', 'payment', 'membership', 'txn_fee', 'loan_sent', 'loan_interest', 'excess_charge', 'penalty', 'interest_share', 'payout_fee', 'waiver', 'adjustment'];

test('every ledger kind has a plain label, and an unknown kind shows as itself', () => {
  for (const k of KINDS) expect(kindLabel(k), k).not.toBe(k);
  expect(kindLabel('mystery')).toBe('mystery');
});

test('entryTone: corrections are corrections whatever their kind; unknown kinds are neutral', () => {
  expect(entryTone(entry({ kind: 'saving' }))).toBe('in');
  expect(entryTone(entry({ kind: 'penalty' }))).toBe('charged');
  expect(entryTone(entry({ kind: 'interest_share' }))).toBe('earned');
  expect(entryTone(entry({ kind: 'waiver', source: 'correction', corrects_entry_id: 'e0', reason: 'x' }))).toBe('correction');
  expect(entryTone(entry({ kind: 'penalty', source: 'correction', corrects_entry_id: 'e0', reason: 'x' }))).toBe('correction');
  expect(entryTone(entry({ kind: 'mystery' }))).toBe('other');
});

test('toneLabel gives the tag text, empty for neutral', () => {
  expect([toneLabel('in'), toneLabel('charged'), toneLabel('earned'), toneLabel('correction'), toneLabel('other')]).toEqual(['Paid in', 'Charged', 'Earned', 'Correction', '']);
});

test('statementViews puts the newest month first and an unknown month last; latestStatement is the first', () => {
  const periods = year(8);
  const s8 = statement({ id: 's8', period_id: 'p8' });
  const s7 = statement({ id: 's7', period_id: 'p7' });
  const gone = statement({ id: 'sx', period_id: 'gone' });
  expect(statementViews([gone, s7, s8], periods).map((v) => v.statement.id)).toEqual(['s8', 's7', 'sx']);
  expect(latestStatement([s7, s8], periods)?.statement.id).toBe('s8');
  expect(latestStatement([], periods)).toBeNull();
});

test('periodLabel falls back for a month that is not in the list', () => {
  expect(periodLabel(year(8)[7])).toBe('Sep 2026');
  expect(periodLabel(undefined)).toBe('Earlier month');
});

test('groupEntriesByPeriod groups by month newest first, entries newest first, and totals what was paid in', () => {
  const periods = year(8, 'open');
  const groups = groupEntriesByPeriod(
    [
      entry({ id: 'e1', period_id: 'p8', kind: 'saving', amount: 250, created_at: '2026-09-05T08:00:00Z' }),
      entry({ id: 'e2', period_id: 'p8', kind: 'payment', amount: 100.5, created_at: '2026-09-06T08:00:00Z' }),
      entry({ id: 'e3', period_id: 'p9', kind: 'penalty', amount: 50, created_at: '2026-10-08T08:00:00Z' }),
      entry({ id: 'e4', period_id: 'gone', kind: 'saving', amount: 10, created_at: '2026-01-01T08:00:00Z' }),
    ],
    periods,
  );
  expect(groups.map((g) => g.periodId)).toEqual(['p9', 'p8', 'gone']);
  expect(groups[1]!.entries.map((e) => e.id)).toEqual(['e2', 'e1']);
  expect(groups[1]!.paidIn).toBe(350.5);
  expect(groups[0]!.paidIn).toBe(0);
  expect(groups[2]!.period).toBeUndefined();
});

test('remainingInstalments keeps only months that are not closed, in month order, with a total', () => {
  const periods = year(8, 'open'); // Sep closed, Oct open, Nov planned
  const l: LoanWithInstalments = {
    ...loan(),
    instalments: [
      instalment({ id: 'i10', period_id: 'p10', amount_due: 200 }),
      instalment({ id: 'i8', period_id: 'p8', amount_due: 200 }),
      instalment({ id: 'i9', period_id: 'p9', amount_due: 200.5 }),
    ],
  };
  const r = remainingInstalments(l, periods);
  expect(r.items.map((i) => i.label)).toEqual(['Oct 2026', 'Nov 2026']);
  expect(r.total).toBe(400.5);
});

test('a loan whose instalments are all in closed months has none left', () => {
  const l: LoanWithInstalments = { ...loan(), instalments: [instalment({ period_id: 'p8' })] };
  expect(remainingInstalments(l, year(8))).toEqual({ items: [], total: 0 });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bun run test src/features/ledger/memberViews.test.ts`
Expected: FAIL (`./memberViews` not found)

- [ ] **Step 4: Implement the helpers**

`src/features/ledger/memberViews.ts`:

```ts
import type { Tables } from '@/lib/database.types';
import type { PeriodRow } from './model';
import { sumKwacha } from './money';

export type StatementRow = Tables<'statements'>;
export type EntryRow = Tables<'entries'>;
export type LoanRow = Tables<'loans'>;
export type InstalmentRow = Tables<'loan_instalments'>;
export type LoanWithInstalments = LoanRow & { instalments: InstalmentRow[] };
export type PayoutRow = { member_id: string; short_name: string; savings: number; interest_earned: number; owed: number; pot_share: number; payout: number };

export type KindTone = 'in' | 'charged' | 'earned' | 'correction' | 'other';
export type StatementView = { statement: StatementRow; period: PeriodRow | undefined };
export type EntryGroup = { periodId: string; period: PeriodRow | undefined; entries: EntryRow[]; paidIn: number };
export type RemainingInstalment = { id: string; label: string; amount: number };

const KINDS: Record<string, { label: string; tone: KindTone }> = {
  saving: { label: 'Savings', tone: 'in' },
  payment: { label: 'Payment', tone: 'in' },
  membership: { label: 'Membership', tone: 'in' },
  txn_fee: { label: 'Mobile-money fee', tone: 'in' },
  loan_sent: { label: 'Loan sent', tone: 'charged' },
  loan_interest: { label: 'Loan interest', tone: 'charged' },
  excess_charge: { label: 'Excess charge', tone: 'charged' },
  penalty: { label: 'Penalty', tone: 'charged' },
  interest_share: { label: 'Interest earned', tone: 'earned' },
  payout_fee: { label: 'Payout fee', tone: 'charged' },
  waiver: { label: 'Waiver', tone: 'correction' },
  adjustment: { label: 'Adjustment', tone: 'correction' },
};

/** Plain label for an entry kind; a kind added later shows as itself rather than hiding the row. */
export const kindLabel = (kind: string): string => KINDS[kind]?.label ?? kind;

export const entryTone = (e: EntryRow): KindTone => (e.source === 'correction' ? 'correction' : (KINDS[e.kind]?.tone ?? 'other'));

export const toneLabel = (t: KindTone): string =>
  ({ in: 'Paid in', charged: 'Charged', earned: 'Earned', correction: 'Correction', other: '' })[t];

export const periodLabel = (p: PeriodRow | undefined): string => p?.label ?? 'Earlier month';

const byMonthDesc = (a: PeriodRow | undefined, b: PeriodRow | undefined) => (b?.month_index ?? -1) - (a?.month_index ?? -1);

export function statementViews(statements: StatementRow[], periods: PeriodRow[]): StatementView[] {
  const byId = new Map(periods.map((p) => [p.id, p]));
  return statements.map((statement) => ({ statement, period: byId.get(statement.period_id) })).sort((a, b) => byMonthDesc(a.period, b.period));
}

export const latestStatement = (statements: StatementRow[], periods: PeriodRow[]): StatementView | null => statementViews(statements, periods)[0] ?? null;

export function groupEntriesByPeriod(entries: EntryRow[], periods: PeriodRow[]): EntryGroup[] {
  const byId = new Map(periods.map((p) => [p.id, p]));
  const groups = new Map<string, EntryGroup>();
  for (const e of [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const g = groups.get(e.period_id) ?? { periodId: e.period_id, period: byId.get(e.period_id), entries: [], paidIn: 0 };
    g.entries.push(e);
    if (entryTone(e) === 'in') g.paidIn = sumKwacha(g.paidIn, e.amount);
    groups.set(e.period_id, g);
  }
  return [...groups.values()].sort((a, b) => byMonthDesc(a.period, b.period));
}

/** Instalments in months that are not closed yet. Instalments carry no paid flag; the statement's closing balance is the authority. */
export function remainingInstalments(loan: LoanWithInstalments, periods: PeriodRow[]): { items: RemainingInstalment[]; total: number } {
  const byId = new Map(periods.map((p) => [p.id, p]));
  const items = loan.instalments
    .flatMap((i) => {
      const p = byId.get(i.period_id);
      return p && p.status !== 'closed' ? [{ month: p.month_index, item: { id: i.id, label: p.label, amount: i.amount_due } }] : [];
    })
    .sort((a, b) => a.month - b.month)
    .map((x) => x.item);
  return { items, total: sumKwacha(...items.map((i) => i.amount)) };
}
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `bun run test src/features/ledger && bun run typecheck`
Expected: PASS, clean

- [ ] **Step 6: Commit**

```bash
git add src/features/ledger
git commit -m "feat: view helpers for the member screens

Plain labels and tags for every entry kind (unknown kinds show as
themselves), statements newest first, entries grouped by month with what was
paid in, and a loan's remaining instalments. Plus row fixtures for tests."
```

---

### Task 2: Read hooks

**Files:**
- Modify: `src/features/ledger/queries.ts`
- Test: `src/features/ledger/memberQueries.test.tsx`

**Interfaces:**
- Consumes: `StatementRow`, `EntryRow`, `LoanWithInstalments`, `PayoutRow` from `./memberViews`.
- Produces:
  - `useMyStatements(memberId: string | undefined)` → `StatementRow[]`
  - `useMyEntries(memberId: string | undefined)` → `EntryRow[]` (newest first)
  - `useMyLoans(memberId: string | undefined)` → `LoanWithInstalments[]` (open loans only)
  - `usePayoutPreview(cycleId: string | undefined, memberId: string | undefined)` → `PayoutRow | null`
  All are disabled until their ids exist.

- [ ] **Step 1: Write the failing test**

`src/features/ledger/memberQueries.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

const calls = vi.hoisted(() => ({
  eq: [] as Array<[string, unknown]>,
  in: [] as Array<[string, unknown]>,
  rpc: [] as unknown[][],
  result: vi.fn(),
  rpcResult: vi.fn(),
}));
vi.mock('@/lib/supabase', () => {
  // A chainable stand-in: every method returns the chain; awaiting it yields calls.result().
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit']) chain[m] = () => chain;
  chain.eq = (col: string, val: unknown) => {
    calls.eq.push([col, val]);
    return chain;
  };
  chain.in = (col: string, val: unknown) => {
    calls.in.push([col, val]);
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
const { useMyEntries, useMyLoans, useMyStatements, usePayoutPreview } = await import('./queries');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  calls.eq.length = 0;
  calls.in.length = 0;
  calls.rpc.length = 0;
  calls.result.mockReset();
  calls.rpcResult.mockReset();
});

test('statements and entries are asked for by the member’s own id only', async () => {
  calls.result.mockReturnValue({ data: [], error: null });
  const s = renderHook(() => useMyStatements('m1'), { wrapper });
  await waitFor(() => expect(s.result.current.isSuccess).toBe(true));
  const e = renderHook(() => useMyEntries('m1'), { wrapper });
  await waitFor(() => expect(e.result.current.isSuccess).toBe(true));
  expect(calls.eq).toEqual([['member_id', 'm1'], ['member_id', 'm1']]);
});

test('nothing is asked without a member', () => {
  const s = renderHook(() => useMyStatements(undefined), { wrapper });
  const e = renderHook(() => useMyEntries(undefined), { wrapper });
  const l = renderHook(() => useMyLoans(undefined), { wrapper });
  const p = renderHook(() => usePayoutPreview('c1', undefined), { wrapper });
  for (const q of [s, e, l, p]) expect(q.result.current.fetchStatus).toBe('idle');
});

test('open loans come with their instalments', async () => {
  calls.result
    .mockReturnValueOnce({ data: [{ id: 'l1' }, { id: 'l2' }], error: null })
    .mockReturnValueOnce({ data: [{ id: 'i1', loan_id: 'l1' }, { id: 'i2', loan_id: 'l1' }, { id: 'i3', loan_id: 'l2' }], error: null });
  const { result } = renderHook(() => useMyLoans('m1'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.eq).toEqual([['member_id', 'm1'], ['status', 'open']]);
  expect(calls.in).toEqual([['loan_id', ['l1', 'l2']]]);
  expect(result.current.data!.map((l) => [l.id, l.instalments.length])).toEqual([['l1', 2], ['l2', 1]]);
});

test('no open loans means no second request', async () => {
  calls.result.mockReturnValueOnce({ data: [], error: null });
  const { result } = renderHook(() => useMyLoans('m1'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual([]);
  expect(calls.result).toHaveBeenCalledTimes(1);
});

test('the payout preview keeps only the member’s own row, or null', async () => {
  const rows = [
    { member_id: 'm2', short_name: 'Ann', savings: 1, interest_earned: 0, owed: 0, pot_share: 0, payout: 1 },
    { member_id: 'm1', short_name: 'Eve', savings: 2000, interest_earned: 40, owed: 300, pot_share: 12, payout: 1752 },
  ];
  calls.rpcResult.mockReturnValueOnce({ data: rows, error: null });
  const a = renderHook(() => usePayoutPreview('c1', 'm1'), { wrapper });
  await waitFor(() => expect(a.result.current.data?.payout).toBe(1752));
  expect(calls.rpc[0]).toEqual(['payout_preview', { p_cycle: 'c1' }]);
  calls.rpcResult.mockReturnValueOnce({ data: [rows[0]], error: null });
  const b = renderHook(() => usePayoutPreview('c1', 'm1'), { wrapper });
  await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
  expect(b.result.current.data).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/features/ledger/memberQueries.test.tsx`
Expected: FAIL (the hooks are not exported)

- [ ] **Step 3: Implement the hooks**

In `src/features/ledger/queries.ts` add this import below the existing ones:

```ts
import type { EntryRow, LoanWithInstalments, PayoutRow, StatementRow } from './memberViews';
```

and append:

```ts
/** The member's own statements, one per closed month. Always filtered by member: open-visibility groups let RLS return everyone's. */
export function useMyStatements(memberId: string | undefined) {
  return useQuery({
    queryKey: ['statements', memberId],
    enabled: Boolean(memberId),
    queryFn: async (): Promise<StatementRow[]> => {
      const { data, error } = await supabase.from('statements').select('*').eq('member_id', memberId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useMyEntries(memberId: string | undefined) {
  return useQuery({
    queryKey: ['entries', memberId],
    enabled: Boolean(memberId),
    queryFn: async (): Promise<EntryRow[]> => {
      const { data, error } = await supabase.from('entries').select('*').eq('member_id', memberId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** The member's open loans, each with its instalments. */
export function useMyLoans(memberId: string | undefined) {
  return useQuery({
    queryKey: ['loans', memberId],
    enabled: Boolean(memberId),
    queryFn: async (): Promise<LoanWithInstalments[]> => {
      const loans = await supabase.from('loans').select('*').eq('member_id', memberId!).eq('status', 'open').order('sent_at');
      if (loans.error) throw loans.error;
      if (loans.data.length === 0) return [];
      const instalments = await supabase.from('loan_instalments').select('*').in('loan_id', loans.data.map((l) => l.id));
      if (instalments.error) throw instalments.error;
      return loans.data.map((l) => ({ ...l, instalments: instalments.data.filter((i) => i.loan_id === l.id) }));
    },
  });
}

/** What the member would receive if the cycle paid out now: their own row of payout_preview, or null. */
export function usePayoutPreview(cycleId: string | undefined, memberId: string | undefined) {
  return useQuery({
    queryKey: ['payout-preview', cycleId, memberId],
    enabled: Boolean(cycleId && memberId),
    queryFn: async (): Promise<PayoutRow | null> => {
      const { data, error } = await supabase.rpc('payout_preview', { p_cycle: cycleId! });
      if (error) throw error;
      return data.find((r) => r.member_id === memberId) ?? null;
    },
  });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `bun run test src/features/ledger && bun run typecheck && bun run lint`
Expected: PASS, clean. If typecheck rejects `.in('loan_id', …)` or the row spread, fix the types; do not cast to `any`.

- [ ] **Step 5: Commit**

```bash
git add src/features/ledger/queries.ts src/features/ledger/memberQueries.test.tsx
git commit -m "feat: read hooks for the member screens

The member's own statements, entries, open loans with instalments, and their
row of the payout preview. Every query filters by member id."
```

---

### Task 3: MemberScreen shell and Figure tile

**Files:**
- Create: `src/features/ledger/MemberScreen.tsx`, `src/features/ledger/Figure.tsx`
- Test: `src/features/ledger/MemberScreen.test.tsx`

**Interfaces:**
- Produces:
  - `MemberScreen({ title: string; subtitle?: ReactNode; loadingLabel: string; queries: GateQuery[]; children: ReactNode })` where `GateQuery = { data: unknown; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }`. Renders the page header, then: the unlinked message when `useGroup().member` is null; a danger alert with "Try again" (refetching all) when any query has errored with no data; a labelled skeleton while any query has `data === undefined`; otherwise `children`.
  - `Figure({ label: string; value: ReactNode; note?: ReactNode })`: a tile whose value is the tile's second paragraph (`label` is its first, so tests can find a tile by its label's `parentElement`).

- [ ] **Step 1: Write the failing test**

`src/features/ledger/MemberScreen.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Figure } from './Figure';
import { MemberScreen } from './MemberScreen';
import { renderLedger } from './testFixtures';

const q = (o: Partial<{ data: unknown; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }> = {}) => ({
  data: [], isPending: false, isError: false, error: null, refetch: vi.fn(), ...o,
});
const screenWith = (queries: ReturnType<typeof q>[]) => (
  <MemberScreen title="Passbook" subtitle="As at Sep 2026" loadingLabel="Loading your passbook" queries={queries}>
    <p>the content</p>
  </MemberScreen>
);

test('shows the content once every query has data', () => {
  renderLedger(screenWith([q(), q({ data: null })]));
  expect(screen.getByRole('heading', { name: 'Passbook' })).toBeInTheDocument();
  expect(screen.getByText('As at Sep 2026')).toBeInTheDocument();
  expect(screen.getByText('the content')).toBeInTheDocument();
});

test('an owner with no member row gets the unlinked message and no content', () => {
  renderLedger(screenWith([q()]), { member: null });
  expect(screen.getByText('Your account isn’t linked to a member')).toBeInTheDocument();
  expect(screen.queryByText('the content')).toBeNull();
});

test('loading shows a labelled skeleton and no content', () => {
  renderLedger(screenWith([q({ data: undefined, isPending: true })]));
  expect(screen.getByText('Loading your passbook')).toBeInTheDocument();
  expect(screen.queryByText('the content')).toBeNull();
});

test('a failed load with nothing to show offers a retry that refetches every query', async () => {
  const a = q({ data: undefined, isError: true, error: { message: 'x', code: 'PGRST301' } });
  const b = q();
  renderLedger(screenWith([a, b]));
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(a.refetch).toHaveBeenCalled();
  expect(b.refetch).toHaveBeenCalled();
});

test('a failed refetch that still has data keeps showing the data', () => {
  renderLedger(screenWith([q({ data: [], isError: true, error: { message: 'x' } })]));
  expect(screen.getByText('the content')).toBeInTheDocument();
});

test('Figure puts the label and the value in one tile', () => {
  renderLedger(<Figure label="You owe" value="K 700" note="As at Sep 2026" />);
  expect(screen.getByText('You owe').parentElement).toHaveTextContent('K 700');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/features/ledger/MemberScreen.test.tsx`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement**

`src/features/ledger/Figure.tsx`:

```tsx
import type { ReactNode } from 'react';

/** A headline figure: the label, then the value. */
export function Figure({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 md:p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="tabular mt-auto pt-4 text-xl font-semibold tracking-tight text-fg md:pt-6 md:text-2xl">{value}</p>
      {note ? <p className="mt-1 text-sm text-muted">{note}</p> : null}
    </div>
  );
}
```

`src/features/ledger/MemberScreen.tsx`:

```tsx
import { Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { friendlyError } from '@/lib/errors';
import { Alert, Button, EmptyState, PageHeader, Skeleton } from '@/ui';

type GateQuery = { data: unknown; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
type Props = { title: string; subtitle?: ReactNode; loadingLabel: string; queries: GateQuery[]; children: ReactNode };

/** The frame every member screen shares: unlinked message, error with retry, labelled skeleton, then the content. */
export function MemberScreen({ title, subtitle, loadingLabel, queries, children }: Props) {
  const { member } = useGroup();
  const header = <PageHeader title={title} subtitle={subtitle} />;

  if (!member) {
    return (
      <>
        {header}
        <EmptyState icon={<Users className="size-7" />} title="Your account isn’t linked to a member">
          Ask your treasurer to link this account to your name, then come back.
        </EmptyState>
      </>
    );
  }
  // Data wins over a failed background refetch: the error state is only for when there is nothing to show.
  const failed = queries.find((q) => q.isError && q.data === undefined);
  if (failed) {
    return (
      <>
        {header}
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => queries.forEach((q) => void q.refetch())}>Try again</Button>}>
          {friendlyError(failed.error)}
        </Alert>
      </>
    );
  }
  if (queries.some((q) => q.data === undefined)) {
    return (
      <>
        {header}
        <div role="status" className="grid gap-3">
          <span className="sr-only">{loadingLabel}</span>
          <Skeleton className="h-28" />
          <Skeleton className="h-56" />
        </div>
      </>
    );
  }
  return (
    <>
      {header}
      {children}
    </>
  );
}
```

- [ ] **Step 4: Run tests, lint and typecheck**

Run: `bun run test src/features/ledger && bun run lint && bun run typecheck`
Expected: PASS, clean

- [ ] **Step 5: Commit**

```bash
git add src/features/ledger/MemberScreen.tsx src/features/ledger/Figure.tsx src/features/ledger/MemberScreen.test.tsx
git commit -m "feat: shared frame for the member screens

Unlinked-member message, error with retry, labelled skeleton, and a headline
figure tile, so Passbook, Record and Plan behave the same way."
```

---

### Task 4: Passbook

**Files:**
- Create: `src/features/passbook/PassbookPage.tsx`
- Modify: `src/app/router.tsx` (the `passbook` route)
- Test: `src/features/passbook/PassbookPage.test.tsx`

**Interfaces:**
- Consumes: `useLedgerCycle`, `useMyStatements`; `statementViews`, `latestStatement`, `periodLabel`; `currentPeriod`; `MemberScreen`, `Figure`.
- Produces: `PassbookPage()` (route `/passbook`).

- [ ] **Step 1: Write the failing test**

`src/features/passbook/PassbookPage.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger, statement, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ cycle: vi.fn(), statements: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useMyStatements: () => hooks.statements(),
}));
const { PassbookPage } = await import('./PassbookPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const cycle = (periods = year(8, 'open')) => ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods });

beforeEach(() => {
  hooks.cycle.mockReturnValue(cycle());
  hooks.statements.mockReturnValue(ok([]));
});

test('headline figures come from the latest statement and name its month', () => {
  hooks.statements.mockReturnValue(
    ok([
      statement({ id: 's7', period_id: 'p7', cum_savings: 1750, closing_owed: 100 }),
      statement({ id: 's8', period_id: 'p8', cum_savings: 2500, closing_owed: 700, next_minimum: 300, interest_earned_to_date: 41.5 }),
    ]),
  );
  renderLedger(<PassbookPage />);
  expect(screen.getByText('As at Sep 2026')).toBeInTheDocument();
  expect(screen.getByText('Total saved').parentElement).toHaveTextContent('K 2,500');
  expect(screen.getByText('You owe').parentElement).toHaveTextContent('K 700');
  expect(screen.getByText('Next minimum').parentElement).toHaveTextContent('K 300');
  expect(screen.getByText('Interest earned to date').parentElement).toHaveTextContent('K 41.50');
});

test('months are listed newest first, each with its breakdown, hiding lines that are zero', () => {
  hooks.statements.mockReturnValue(
    ok([
      statement({ id: 's7', period_id: 'p7', saving: 250, paid_total: 250 }),
      statement({ id: 's8', period_id: 'p8', saving: 300, loan_interest_charged: 45, paid_total: 345, paid_to_interest: 45, closing_owed: 0 }),
    ]),
  );
  renderLedger(<PassbookPage />);
  const cards = screen.getAllByRole('group');
  expect(within(cards[0]!).getByText('Sep 2026')).toBeInTheDocument();
  expect(within(cards[1]!).getByText('Aug 2026')).toBeInTheDocument();
  expect(within(cards[0]!).getByText('Loan interest charged')).toBeInTheDocument();
  expect(within(cards[0]!).queryByText('Penalties charged')).toBeNull();
  expect(within(cards[0]!).getByText('Closing owed').parentElement).toHaveTextContent('K 0');
});

test('a statement whose month is not in the list still shows, under a fallback label', () => {
  hooks.statements.mockReturnValue(ok([statement({ id: 'sx', period_id: 'gone' })]));
  renderLedger(<PassbookPage />);
  expect(screen.getByText('Earlier month')).toBeInTheDocument();
});

test('the open month is explained: its statement comes when the treasurer closes it', () => {
  hooks.statements.mockReturnValue(ok([statement()]));
  renderLedger(<PassbookPage />);
  expect(screen.getByText('Your Oct 2026 statement appears when the treasurer closes the month.')).toBeInTheDocument();
});

test('no statements yet: an empty state', () => {
  renderLedger(<PassbookPage />);
  expect(screen.getByText('No statements yet')).toBeInTheDocument();
});

test('a member without a profile, a failed load and a slow load are handled by the shared frame', () => {
  renderLedger(<PassbookPage />, { member: null });
  expect(screen.getByText('Your account isn’t linked to a member')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/features/passbook`
Expected: FAIL (`./PassbookPage` not found)

- [ ] **Step 3: Implement the page**

`src/features/passbook/PassbookPage.tsx`:

```tsx
import { BookOpen } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { Figure } from '@/features/ledger/Figure';
import { MemberScreen } from '@/features/ledger/MemberScreen';
import { periodLabel, statementViews, type StatementRow } from '@/features/ledger/memberViews';
import { currentPeriod } from '@/features/ledger/model';
import { useLedgerCycle, useMyStatements } from '@/features/ledger/queries';
import { money } from '@/lib/format';
import { EmptyState } from '@/ui';

function breakdown(s: StatementRow): Array<{ label: string; value: number }> {
  const lines = [
    { label: 'Saved this month', value: s.saving },
    { label: 'Loan sent', value: s.loan_principal_sent },
    { label: 'Loan interest charged', value: s.loan_interest_charged },
    { label: 'Excess charged', value: s.excess_charged },
    { label: 'Penalties charged', value: s.penalties_charged },
    { label: 'Paid in total', value: s.paid_total },
    { label: 'Paid to excess', value: s.paid_to_excess },
    { label: 'Paid to penalties', value: s.paid_to_penalties },
    { label: 'Paid to interest', value: s.paid_to_interest },
    { label: 'Paid to loan principal', value: s.paid_to_principal },
  ];
  return lines.filter((l) => l.value > 0);
}

export function PassbookPage() {
  const { group, member } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const statements = useMyStatements(member?.id);
  const periods = cycle.data?.periods ?? [];
  const views = statementViews(statements.data ?? [], periods);
  const latest = views[0];
  const open = currentPeriod(periods);

  return (
    <MemberScreen
      title="Passbook"
      subtitle={latest ? `As at ${periodLabel(latest.period)}` : undefined}
      loadingLabel="Loading your passbook"
      queries={[cycle, statements]}
    >
      <div className="grid gap-4 md:gap-5 lg:max-w-3xl">
        {latest ? (
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <Figure label="Total saved" value={money(latest.statement.cum_savings)} />
            <Figure label="You owe" value={money(latest.statement.closing_owed)} />
            <Figure label="Next minimum" value={money(latest.statement.next_minimum)} />
            <Figure label="Interest earned to date" value={money(latest.statement.interest_earned_to_date)} />
          </div>
        ) : (
          <EmptyState icon={<BookOpen className="size-7" />} title="No statements yet">
            Your statements appear here once the treasurer closes each month.
          </EmptyState>
        )}

        {open ? <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">Your {open.label} statement appears when the treasurer closes the month.</p> : null}

        {views.map(({ statement: s, period }) => (
          <div key={s.id} className="rounded-2xl border border-line bg-surface shadow-sm dark:shadow-none">
            <details>
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-lg font-semibold text-fg md:px-5">
                <span>{periodLabel(period)}</span>
                <span className="tabular text-base font-normal text-muted">Owed {money(s.closing_owed)}</span>
              </summary>
              <dl className="grid gap-2 border-t border-line px-4 py-4 text-sm md:px-5">
                {breakdown(s).map((l) => (
                  <div key={l.label} className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">{l.label}</dt>
                    <dd className="tabular text-right text-fg">{money(l.value)}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 font-semibold">
                  <dt className="text-fg">Closing owed</dt>
                  <dd className="tabular text-right text-fg">{money(s.closing_owed)}</dd>
                </div>
              </dl>
            </details>
          </div>
        ))}
      </div>
    </MemberScreen>
  );
}
```

Note for the tests: `<details>` elements expose the ARIA role `group`; `getAllByRole('group')` returns one per statement card.

- [ ] **Step 4: Swap the route**

In `src/app/router.tsx` add `import { PassbookPage } from '@/features/passbook/PassbookPage';` (keep the import list in its existing order) and change

```tsx
page('passbook', 'Passbook', <ComingSoon title="Passbook" />),
```

to

```tsx
page('passbook', 'Passbook', <PassbookPage />),
```

- [ ] **Step 5: Run tests, lint and typecheck**

Run: `bun run test src/features/passbook && bun run lint && bun run typecheck`
Expected: PASS, clean. If `Closing owed` has two matches (the visible summary says "Owed K…", so it should not), narrow the query to the `dl`.

- [ ] **Step 6: Commit**

```bash
git add src/features/passbook src/app/router.tsx
git commit -m "feat: member Passbook

Headline figures from the latest statement and a month-by-month breakdown,
newest first. Replaces the coming-soon placeholder."
```

---

### Task 5: Record

**Files:**
- Create: `src/features/record/RecordPage.tsx`
- Modify: `src/app/router.tsx` (the `record` route)
- Test: `src/features/record/RecordPage.test.tsx`

**Interfaces:**
- Consumes: `useLedgerCycle`, `useMyEntries`; `groupEntriesByPeriod`, `kindLabel`, `entryTone`, `toneLabel`, `periodLabel`; `MemberScreen`; `Badge`.
- Produces: `RecordPage()` (route `/record`).

- [ ] **Step 1: Write the failing test**

`src/features/record/RecordPage.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { entry, renderLedger, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ cycle: vi.fn(), entries: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useMyEntries: () => hooks.entries(),
}));
const { RecordPage } = await import('./RecordPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });

beforeEach(() => {
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8, 'open') }));
  hooks.entries.mockReturnValue(ok([]));
});

test('entries are grouped by month, newest month first, with what was paid in', () => {
  hooks.entries.mockReturnValue(
    ok([
      entry({ id: 'e1', period_id: 'p8', kind: 'saving', amount: 250, created_at: '2026-09-05T08:00:00Z' }),
      entry({ id: 'e2', period_id: 'p8', kind: 'payment', amount: 100, created_at: '2026-09-06T08:00:00Z', source: 'app' }),
      entry({ id: 'e3', period_id: 'p9', kind: 'penalty', amount: 50, created_at: '2026-10-08T08:00:00Z', source: 'app' }),
    ]),
  );
  renderLedger(<RecordPage />);
  const months = screen.getAllByRole('heading', { level: 2 });
  expect(months.map((h) => h.textContent)).toEqual(['Oct 2026', 'Sep 2026']);
  const sep = screen.getByRole('heading', { name: 'Sep 2026' }).closest('section')!;
  expect(within(sep).getByText('Paid in K 350')).toBeInTheDocument();
  expect(within(sep).getByText('Savings')).toBeInTheDocument();
  expect(within(sep).getByText('Payment')).toBeInTheDocument();
});

test('each row has its tag; imported rows say they came from the workbook; app rows show their date', () => {
  hooks.entries.mockReturnValue(
    ok([
      entry({ id: 'e1', kind: 'saving', source: 'import' }),
      entry({ id: 'e3', period_id: 'p9', kind: 'penalty', amount: 50, source: 'app', created_at: '2026-10-08T08:00:00Z' }),
      entry({ id: 'e5', period_id: 'p9', kind: 'interest_share', amount: 12, source: 'close', created_at: '2026-10-09T08:00:00Z' }),
    ]),
  );
  renderLedger(<RecordPage />);
  expect(screen.getByText('Paid in')).toBeInTheDocument();
  expect(screen.getByText('Charged')).toBeInTheDocument();
  expect(screen.getByText('Earned')).toBeInTheDocument();
  expect(screen.getByText('From the workbook')).toBeInTheDocument();
  expect(screen.getByText('8 Oct 2026')).toBeInTheDocument();
});

test('a correction shows its reason', () => {
  hooks.entries.mockReturnValue(
    ok([entry({ id: 'e4', kind: 'waiver', amount: 50, source: 'correction', corrects_entry_id: 'e3', reason: 'Penalty waived: late payment slip found', period_id: 'p9' })]),
  );
  renderLedger(<RecordPage />);
  expect(screen.getByText('Correction')).toBeInTheDocument();
  expect(screen.getByText(/Penalty waived: late payment slip found/)).toBeInTheDocument();
});

test('an unknown kind still shows, as its own name', () => {
  hooks.entries.mockReturnValue(ok([entry({ id: 'e9', kind: 'mystery', amount: 7 })]));
  renderLedger(<RecordPage />);
  expect(screen.getByText('mystery')).toBeInTheDocument();
  expect(screen.getByText('K 7')).toBeInTheDocument();
});

test('an entry whose month is not in the list shows under a fallback heading', () => {
  hooks.entries.mockReturnValue(ok([entry({ id: 'e8', period_id: 'gone' })]));
  renderLedger(<RecordPage />);
  expect(screen.getByRole('heading', { name: 'Earlier month' })).toBeInTheDocument();
});

test('nothing recorded yet: an empty state', () => {
  renderLedger(<RecordPage />);
  expect(screen.getByText('Nothing recorded yet')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/features/record`
Expected: FAIL (`./RecordPage` not found)

- [ ] **Step 3: Implement the page**

`src/features/record/RecordPage.tsx`:

```tsx
import { ScrollText } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { MemberScreen } from '@/features/ledger/MemberScreen';
import { entryTone, groupEntriesByPeriod, kindLabel, periodLabel, toneLabel, type KindTone } from '@/features/ledger/memberViews';
import { useLedgerCycle, useMyEntries } from '@/features/ledger/queries';
import { formatDate, money } from '@/lib/format';
import { Badge, EmptyState, type Tone } from '@/ui';

const BADGE: Record<KindTone, Tone> = { in: 'success', charged: 'warning', earned: 'accent', correction: 'info', other: 'neutral' };

export function RecordPage() {
  const { group, member } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const entries = useMyEntries(member?.id);
  const groups = groupEntriesByPeriod(entries.data ?? [], cycle.data?.periods ?? []);

  return (
    <MemberScreen title="Record" subtitle="Everything recorded against you" loadingLabel="Loading your record" queries={[cycle, entries]}>
      {groups.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-7" />} title="Nothing recorded yet">
          Your savings, payments and charges appear here as the treasurer records them.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:gap-5 lg:max-w-3xl">
          {groups.map((g) => (
            <div key={g.periodId} className="rounded-2xl border border-line bg-surface shadow-sm dark:shadow-none">
              <section aria-labelledby={`month-${g.periodId}`}>
                <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 md:px-5">
                  <h2 id={`month-${g.periodId}`} className="text-lg font-semibold text-fg">{periodLabel(g.period)}</h2>
                  {g.paidIn > 0 ? <p className="tabular text-sm text-muted">Paid in {money(g.paidIn)}</p> : null}
                </header>
                <ul role="list" className="divide-y divide-line px-4 md:px-5">
                  {g.entries.map((e) => {
                    const tone = entryTone(e);
                    return (
                      <li key={e.id} className="grid gap-1 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-fg">{kindLabel(e.kind)}</span>
                          <span className="tabular font-semibold text-fg">{money(e.amount)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                          {toneLabel(tone) ? <Badge tone={BADGE[tone]}>{toneLabel(tone)}</Badge> : null}
                          <span>{e.source === 'import' ? 'From the workbook' : formatDate(e.created_at)}</span>
                        </div>
                        {e.reason ? <p className="text-sm text-muted">Reason: {e.reason}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          ))}
        </div>
      )}
    </MemberScreen>
  );
}
```

- [ ] **Step 4: Swap the route**

In `src/app/router.tsx` add `import { RecordPage } from '@/features/record/RecordPage';` and change

```tsx
page('record', 'My record', <ComingSoon title="Record" />),
```

to

```tsx
page('record', 'My record', <RecordPage />),
```

- [ ] **Step 5: Run tests, lint and typecheck**

Run: `bun run test src/features/record && bun run lint && bun run typecheck`
Expected: PASS, clean. If `Paid in K 350` fails because the text is split across nodes, assert with `toHaveTextContent` on the paragraph instead.

- [ ] **Step 6: Commit**

```bash
git add src/features/record src/app/router.tsx
git commit -m "feat: member Record

Every ledger entry against the member, grouped by month with a plain label,
a tag, the date or 'from the workbook', and a correction's reason."
```

---

### Task 6: Plan, remove ComingSoon, final checks

**Files:**
- Create: `src/features/plan/PlanPage.tsx`
- Modify: `src/app/router.tsx` (the `plan` route and the `ComingSoon` import)
- Delete: `src/features/shells/ComingSoon.tsx`
- Test: `src/features/plan/PlanPage.test.tsx`

**Interfaces:**
- Consumes: `useLedgerCycle`, `useMyLoans`, `useMyStatements`, `usePayoutPreview`; `latestStatement`, `periodLabel`, `remainingInstalments`; `MemberScreen`, `Figure`.
- Produces: `PlanPage()` (route `/plan`).

- [ ] **Step 1: Write the failing test**

`src/features/plan/PlanPage.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { instalment, loan, renderLedger, statement, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ cycle: vi.fn(), loans: vi.fn(), statements: vi.fn(), payout: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useMyLoans: () => hooks.loans(),
  useMyStatements: () => hooks.statements(),
  usePayoutPreview: () => hooks.payout(),
}));
const { PlanPage } = await import('./PlanPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const PAYOUT = { member_id: 'm1', short_name: 'Eve', savings: 2500, interest_earned: 40, owed: 700, pot_share: 12.5, payout: 1852.5 };

beforeEach(() => {
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8, 'open') }));
  hooks.loans.mockReturnValue(ok([]));
  hooks.statements.mockReturnValue(ok([statement({ closing_owed: 700, next_minimum: 300 })]));
  hooks.payout.mockReturnValue(ok(PAYOUT));
});

test('shows what you owe and the next minimum from the latest statement', () => {
  renderLedger(<PlanPage />);
  expect(screen.getByText('As at Sep 2026')).toBeInTheDocument();
  expect(screen.getByText('You owe').parentElement).toHaveTextContent('K 700');
  expect(screen.getByText('Next minimum').parentElement).toHaveTextContent('K 300');
});

test('open loans list their remaining instalments and total; closed months are left out', () => {
  hooks.loans.mockReturnValue(
    ok([
      {
        ...loan({ id: 'l1', principal: 1000, interest: 150, term_months: 3, sent_at: '2026-09-02T09:00:00Z' }),
        instalments: [
          instalment({ id: 'i8', period_id: 'p8', amount_due: 383.33 }),
          instalment({ id: 'i9', period_id: 'p9', amount_due: 383.33 }),
          instalment({ id: 'i10', period_id: 'p10', amount_due: 383.34 }),
        ],
      },
    ]),
  );
  renderLedger(<PlanPage />);
  const card = screen.getByRole('heading', { name: 'Loan of K 1,000' }).closest('section')!;
  expect(within(card).getByText(/Interest K 150/)).toBeInTheDocument();
  expect(within(card).getByText(/3 months/)).toBeInTheDocument();
  expect(within(card).getByText('Oct 2026')).toBeInTheDocument();
  expect(within(card).getByText('Nov 2026')).toBeInTheDocument();
  expect(within(card).queryByText('Sep 2026')).toBeNull();
  expect(within(card).getByText('Still to pay in instalments K 766.67')).toBeInTheDocument();
});

test('a loan whose instalments are all in closed months says none are left', () => {
  hooks.loans.mockReturnValue(ok([{ ...loan(), instalments: [instalment({ period_id: 'p8' })] }]));
  renderLedger(<PlanPage />);
  expect(screen.getByText('No instalments left in the schedule.')).toBeInTheDocument();
  expect(screen.getByText('Still to pay in instalments K 0')).toBeInTheDocument();
});

test('no open loans: says so', () => {
  renderLedger(<PlanPage />);
  expect(screen.getByText('You have no open loans.')).toBeInTheDocument();
});

test('the payout projection shows the member’s own figures and is labelled a projection', () => {
  renderLedger(<PlanPage />);
  const block = screen.getByRole('heading', { name: 'If the cycle paid out today' }).closest('section')!;
  expect(within(block).getByText('Savings').nextElementSibling).toHaveTextContent('K 2,500');
  expect(within(block).getByText('Interest earned').nextElementSibling).toHaveTextContent('K 40');
  expect(within(block).getByText('Less what you owe').nextElementSibling).toHaveTextContent('K 700');
  expect(within(block).getByText('Share of the pots').nextElementSibling).toHaveTextContent('K 12.50');
  expect(within(block).getByText('You would receive').nextElementSibling).toHaveTextContent('K 1,852.50');
  expect(within(block).getByText(/projection from today’s figures, not a promise/)).toBeInTheDocument();
});

test('with no preview row the payout block is left out', () => {
  hooks.payout.mockReturnValue(ok(null));
  renderLedger(<PlanPage />);
  expect(screen.queryByRole('heading', { name: 'If the cycle paid out today' })).toBeNull();
});

test('a failed payout preview does not hide the rest of the plan', () => {
  hooks.payout.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch: vi.fn() });
  renderLedger(<PlanPage />);
  expect(screen.getByText('You owe').parentElement).toHaveTextContent('K 700');
  expect(screen.getByText('The payout projection couldn’t be loaded just now.')).toBeInTheDocument();
});

test('no statement yet: the figures say so instead of showing zeros', () => {
  hooks.statements.mockReturnValue(ok([]));
  renderLedger(<PlanPage />);
  expect(screen.getByText('Your first statement appears when the treasurer closes a month.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/features/plan`
Expected: FAIL (`./PlanPage` not found)

- [ ] **Step 3: Implement the page**

`src/features/plan/PlanPage.tsx`:

```tsx
import { useGroup } from '@/features/group/GroupContext';
import { Figure } from '@/features/ledger/Figure';
import { MemberScreen } from '@/features/ledger/MemberScreen';
import { latestStatement, periodLabel, remainingInstalments } from '@/features/ledger/memberViews';
import { useLedgerCycle, useMyLoans, useMyStatements, usePayoutPreview } from '@/features/ledger/queries';
import { formatDate, money } from '@/lib/format';
import { Card } from '@/ui';

export function PlanPage() {
  const { group, member } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const loans = useMyLoans(member?.id);
  const statements = useMyStatements(member?.id);
  const periods = cycle.data?.periods ?? [];
  const payout = usePayoutPreview(cycle.data?.cycle?.id, member?.id);
  const latest = latestStatement(statements.data ?? [], periods);

  return (
    <MemberScreen
      title="Plan"
      subtitle={latest ? `As at ${periodLabel(latest.period)}` : undefined}
      loadingLabel="Loading your plan"
      queries={[cycle, loans, statements]}
    >
      <div className="grid gap-4 md:gap-5 lg:max-w-3xl">
        {latest ? (
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Figure label="You owe" value={money(latest.statement.closing_owed)} />
            <Figure label="Next minimum" value={money(latest.statement.next_minimum)} />
          </div>
        ) : (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">Your first statement appears when the treasurer closes a month.</p>
        )}

        <section aria-labelledby="loans-heading" className="grid gap-3">
          <h2 id="loans-heading" className="text-lg font-semibold text-fg">Your loans</h2>
          {(loans.data ?? []).length === 0 ? (
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">You have no open loans.</p>
          ) : (
            (loans.data ?? []).map((l) => {
              const rest = remainingInstalments(l, periods);
              return (
                <Card key={l.id}>
                  <section aria-labelledby={`loan-${l.id}`}>
                    <h3 id={`loan-${l.id}`} className="text-lg font-semibold text-fg">Loan of {money(l.principal)}</h3>
                    <p className="mt-0.5 text-sm text-muted">
                      Interest {money(l.interest)} · {l.term_months} month{l.term_months === 1 ? '' : 's'} · sent {formatDate(l.sent_at)}
                    </p>
                    {rest.items.length === 0 ? (
                      <p className="mt-3 text-sm text-muted">No instalments left in the schedule.</p>
                    ) : (
                      <ul role="list" className="mt-3 divide-y divide-line">
                        {rest.items.map((i) => (
                          <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                            <span className="text-fg">{i.label}</span>
                            <span className="tabular text-fg">{money(i.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 font-semibold text-fg">Still to pay in instalments {money(rest.total)}</p>
                  </section>
                </Card>
              );
            })
          )}
        </section>

        {payout.data ? (
          <Card>
            <section aria-labelledby="payout-heading">
              <h2 id="payout-heading" className="text-lg font-semibold text-fg">If the cycle paid out today</h2>
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted">Savings</dt>
                <dd className="tabular text-right text-fg">{money(payout.data.savings)}</dd>
                <dt className="text-muted">Interest earned</dt>
                <dd className="tabular text-right text-fg">{money(payout.data.interest_earned)}</dd>
                <dt className="text-muted">Less what you owe</dt>
                <dd className="tabular text-right text-fg">{money(payout.data.owed)}</dd>
                <dt className="text-muted">Share of the pots</dt>
                <dd className="tabular text-right text-fg">{money(payout.data.pot_share)}</dd>
                <dt className="font-semibold text-fg">You would receive</dt>
                <dd className="tabular text-right font-semibold text-fg">{money(payout.data.payout)}</dd>
              </dl>
              <p className="mt-3 text-sm text-muted">
                A projection from today’s figures, not a promise. It changes as the group saves and repays.
              </p>
            </section>
          </Card>
        ) : payout.isError ? (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">The payout projection couldn’t be loaded just now.</p>
        ) : null}
      </div>
    </MemberScreen>
  );
}
```

- [ ] **Step 4: Swap the last route and delete ComingSoon**

In `src/app/router.tsx` add `import { PlanPage } from '@/features/plan/PlanPage';`, change

```tsx
page('plan', 'Plan', <ComingSoon title="Plan" />),
```

to

```tsx
page('plan', 'Plan', <PlanPage />),
```

remove the line `import { ComingSoon } from '@/features/shells/ComingSoon';`, then delete the file:

```bash
git rm src/features/shells/ComingSoon.tsx
```

- [ ] **Step 5: Run the plan tests**

Run: `bun run test src/features/plan`
Expected: PASS. If `getByText('Savings').nextElementSibling` finds the wrong element, remember `dt`/`dd` are siblings in a flat `dl`; the label text must be the exact `dt` text.

- [ ] **Step 6: Full verification**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: all green; the build warns only about the existing chunk-size notice.

- [ ] **Step 7: Check for leftovers**

Run: `grep -rn "ComingSoon\|Coming soon\|February 2027" src`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/features/plan src/app/router.tsx
git commit -m "feat: member Plan; remove the coming-soon placeholder

What you owe and the next minimum, open loans with their remaining
instalments, and the payout projection from the member's own preview row.
ComingSoon is gone now that nothing uses it."
```

- [ ] **Step 9: Hand over**

Give the user this manual check on dev (data must be present there, so only meaningful after the Feb–Sep import has run on dev; otherwise check on production after deploy):
1. Sign in as a member. `/passbook` shows the latest closed month's four figures; the month list matches the treasurer's workbook for that member.
2. `/record` lists that member's entries by month; spot-check one month's savings and a penalty.
3. `/plan` shows the open loans and their remaining instalments; the payout block's Payout equals Savings + Interest earned − You owe + Share of the pots.
4. Sign in as a different member and confirm none of the first member's figures appear.
