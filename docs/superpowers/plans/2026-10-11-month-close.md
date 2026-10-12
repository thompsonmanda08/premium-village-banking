# Month close (S3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the treasurer a deliberate way to see exactly what closing the open month would write, check nothing is missing, and commit it, from a new `/desk/close` page.

**Architecture:** UI only, no migration: `close_month` already previews (`p_commit = false`) and commits through one code path. A pure `closeChecklist` helper turns data the Desk already loads into the "Before you close" list. `ClosePreviewView` renders the preview; `ClosePage` assembles checklist, preview and a two-tap commit. The workbook-differences list is extracted from `LedgerCheckPage` into a shared `DifferenceList`.

**Tech Stack:** React 19, react-router, TanStack Query, supabase-js (typed `rpc`), Tailwind tokens from `src/ui`, Vitest + Testing Library, eslint, `tsc`.

**Spec:** `docs/superpowers/specs/2026-10-11-month-close-design.md` (builds on the ledger-engine spec §5, §6 and the S1/S3a specs).

## Global Constraints

- No database change, no migration, never `bun run db:push`.
- Closing cannot be undone. The commit button is a two-tap confirm, disabled while the request runs, while the preview is loading, errored or refetching, while declarations are waiting, and (when any difference is `unexplained`) until a reason is typed. Any edit or refresh disarms the second tap.
- The close preview holds every member's figures: it is never written to IndexedDB (`close-preview` joins `NEVER_PERSISTED`) and has `gcTime: 0`.
- Money maths only in SQL. The client formats what comes back; signs go through the S2 `owedFigure` (a negative balance is "In credit"). Nothing new is computed except counts for the checklist.
- Every section has loading (labelled), error-with-retry and empty states; 48px targets; tokens only; labelled sections; curly apostrophes `’`. Server errors go through `friendlyError` (all codes used here already have messages).
- Tests: synthetic data only. Find loading text with `getByText` (the toast region has `role="status"`). Mock `react-router`'s `useNavigate` where navigation is asserted.
- Commits: subject + body, **no `Co-Authored-By` trailer**. Never `git push`, never `git add -A`, never stage anything under `docs/` or `semantic-review/`.

## Review Focus

- A double tap on Close, or a retry after a dropped connection, closes once; `already_closed` reads as "already closed", not as a failure. (Task 4.)
- Commit stays disabled while declarations wait, while the preview is loading, errored or refetching, and while an unexplained difference has no reason. (Task 4.)
- Edits and Refresh disarm the second tap. (Task 4.)
- The preview is never persisted and is dropped from memory when unused. (Task 1.)
- A returned or superseded declaration is not "waiting"; a member with any live declaration is "declared". (Task 1.)
- Member cards hide untouched zero lines but show negative lines; a negative balance reads "In credit". (Task 3.)
- A negative fee pot warns. (Task 3.)
- A non-admin makes no requests. (Task 4.)
- `LedgerCheckPage` behaves exactly as before after the extraction. (Task 2.)

---

## File structure

| File | Responsibility |
|---|---|
| `src/features/ledger/queries.ts` | + `ClosePreview` types, `useClosePreview`; refresh keys extended (modified) |
| `src/lib/queryClient.ts` | `close-preview` never persisted (modified) |
| `src/features/ledger/closeChecklist.ts` | Pure "Before you close" counts |
| `src/features/desk/DifferenceList.tsx` | Shared workbook-differences list (extracted) |
| `src/features/desk/LedgerCheckPage.tsx` | Uses `DifferenceList` (modified) |
| `src/features/desk/ClosePreviewView.tsx` | Group statement, member cards, comparison |
| `src/features/desk/ClosePage.tsx` | `/desk/close` |
| `src/app/router.tsx` | + route (modified) |
| `src/features/desk/DeskPage.tsx` | + "Close the month" card (modified) |
| `src/features/ledger/testFixtures.tsx` | + `closeMember`, `closePreview` (modified) |

---

### Task 1: Preview hook, persistence rule, refresh keys, checklist helper

**Files:**
- Modify: `src/features/ledger/queries.ts`, `src/lib/queryClient.ts`, `src/lib/queryClient.test.ts`
- Create: `src/features/ledger/closeChecklist.ts`
- Test: `src/features/ledger/closeQueries.test.tsx`, `src/features/ledger/closeChecklist.test.ts`

**Interfaces:**
- Produces:
  - Types in `queries.ts`: `CloseGroup`, `CloseMember`, `CloseDiff` (same shape as the ledger check's `LedgerDiff`), `ClosePreview = { period_id: string; label: string; month_index: number; committed: boolean; group: CloseGroup; members: CloseMember[]; diff: CloseDiff[]; unexplained: number }`
  - `useClosePreview(periodId: string | undefined)` → `ClosePreview` (`staleTime: 0`, `gcTime: 0`, `retry: false`; disabled without a period)
  - `useRefreshLedger` also invalidates `['close-preview']`, `['statements']`, `['entries']`, `['loans']`, `['payout-preview']`, `['minimum-payable']`
  - `closeChecklist({ declarations, members, suggestions, appliedEntries, loans, deadline, today })` → `{ waiting: number; notDeclared: ActiveMember[]; penaltiesPending: number; requestsUnsent: number; deadline: { text: string; tone: 'neutral' | 'warning' | 'danger' }; blocked: boolean }`

- [ ] **Step 1: Write the failing tests**

`src/features/ledger/closeQueries.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

const calls = vi.hoisted(() => ({ rpc: [] as unknown[][], rpcResult: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => {
      calls.rpc.push(args);
      return Promise.resolve(calls.rpcResult());
    },
  },
}));
const { useClosePreview, useRefreshLedger } = await import('./queries');

const makeWrapper = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

beforeEach(() => {
  calls.rpc.length = 0;
  calls.rpcResult.mockReset();
});

test('the preview is asked with p_commit false, never committing', async () => {
  calls.rpcResult.mockReturnValue({ data: { label: 'Oct 2026', members: [], diff: [], unexplained: 0 }, error: null });
  const { result } = renderHook(() => useClosePreview('p9'), { wrapper: makeWrapper(new QueryClient()) });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.rpc).toEqual([['close_month', { p_period: 'p9', p_commit: false }]]);
});

test('nothing is asked without a period', () => {
  const { result } = renderHook(() => useClosePreview(undefined), { wrapper: makeWrapper(new QueryClient()) });
  expect(result.current.fetchStatus).toBe('idle');
});

test('a refusal (declarations still waiting) is an error at once, not retried', async () => {
  calls.rpcResult.mockReturnValue({ data: null, error: { message: 'declarations_pending', code: 'P0001' } });
  const { result } = renderHook(() => useClosePreview('p9'), { wrapper: makeWrapper(new QueryClient()) });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(calls.rpc).toHaveLength(1);
});

test('a close rewrites what members see, so every ledger action refreshes those too', async () => {
  const client = new QueryClient();
  const spy = vi.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(() => useRefreshLedger('g1'), { wrapper: makeWrapper(client) });
  await result.current();
  const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey[0]);
  for (const k of ['close-preview', 'statements', 'entries', 'loans', 'payout-preview', 'minimum-payable', 'declarations', 'ledger-cycle']) {
    expect(keys, k).toContain(k);
  }
});
```

Append to `src/lib/queryClient.test.ts`:

```ts

test('a close preview holds every member’s figures: it is never written to IndexedDB', async () => {
  const { dehydrate } = await import('@tanstack/react-query');
  const qc = makeQueryClient();
  qc.setQueryData(['membership', 'u1'], { group: 'Premium' });
  qc.setQueryData(['close-preview', 'p9'], { members: [{ short_name: 'Eve' }] });
  const keys = dehydrate(qc, { shouldDehydrateQuery: shouldPersistQuery }).queries.map((q) => q.queryKey);
  expect(keys).toEqual([['membership', 'u1']]);
});
```

`src/features/ledger/closeChecklist.test.ts`:

```ts
import { expect, test } from 'vitest';
import { closeChecklist } from './closeChecklist';
import { declaration, entry } from './testFixtures';

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }, { id: 'm3', short_name: 'Bob' }];
const base = { members: MEMBERS, suggestions: [], appliedEntries: [], loans: [], deadline: '2026-10-07', today: '2026-10-05' };

test('only live submitted declarations are waiting, and only they block the close', () => {
  const r = closeChecklist({
    ...base,
    declarations: [
      declaration({ id: 'd1', member_id: 'm1', status: 'returned' }),
      declaration({ id: 'd1b', member_id: 'm1', status: 'submitted', supersedes_id: 'd1' }),
      declaration({ id: 'd2', member_id: 'm2', status: 'approved' }),
    ],
  });
  expect(r.waiting).toBe(1);
  expect(r.blocked).toBe(true);
  expect(closeChecklist({ ...base, declarations: [declaration({ id: 'd2', member_id: 'm2', status: 'approved' })] }).blocked).toBe(false);
});

test('a member with any live declaration has declared; the rest are listed', () => {
  const r = closeChecklist({
    ...base,
    declarations: [declaration({ member_id: 'm1', status: 'returned' }), declaration({ id: 'd2', member_id: 'm2', status: 'approved' })],
  });
  expect(r.notDeclared.map((m) => m.short_name)).toEqual(['Bob']);
});

test('suggested penalties already applied are not pending', () => {
  const s = (member_id: string, ground: string) => ({ member_id, short_name: member_id, ground, amount: 50, detail: '' });
  const r = closeChecklist({
    ...base,
    declarations: [],
    suggestions: [s('m1', 'late_declaration'), s('m2', 'late_declaration')],
    appliedEntries: [entry({ kind: 'penalty', member_id: 'm1', source: 'app', reason: 'late_declaration: x' })],
  });
  expect(r.penaltiesPending).toBe(1);
});

test('borrowing requests not yet answered with a loan are counted; returned ones are not requests', () => {
  const r = closeChecklist({
    ...base,
    declarations: [
      declaration({ id: 'd1', member_id: 'm1', borrowing_request: 1000, status: 'approved' }),
      declaration({ id: 'd2', member_id: 'm2', borrowing_request: 500, status: 'approved' }),
      declaration({ id: 'd3', member_id: 'm3', borrowing_request: 300, status: 'returned' }),
    ],
    loans: [{ member_id: 'm2', principal: 500 }],
  });
  expect(r.requestsUnsent).toBe(1);
});

test('the deadline note says how long is left or that it has passed', () => {
  expect(closeChecklist({ ...base, declarations: [] }).deadline).toEqual({ text: '2 days left', tone: 'warning' });
  expect(closeChecklist({ ...base, declarations: [], today: '2026-10-09' }).deadline).toEqual({ text: 'Past the deadline', tone: 'danger' });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `bun run test src/features/ledger/closeQueries.test.tsx src/features/ledger/closeChecklist.test.ts src/lib/queryClient.test.ts`
Expected: FAIL (`useClosePreview` not exported, `./closeChecklist` not found, `close-preview` still persisted)

- [ ] **Step 3: Implement**

In `src/lib/queryClient.ts` change the list: `const NEVER_PERSISTED = ['invite-preview', 'loan-check', 'close-preview'];` and extend its comment's second sentence: `... a loan check holds lending cash, which moves and must never be read back days later as if it were current, and a close preview holds every member's figures.`

In `src/features/ledger/queries.ts`, extend `useRefreshLedger`'s list with:

```ts
      qc.invalidateQueries({ queryKey: ['close-preview'] }),
      qc.invalidateQueries({ queryKey: ['statements'] }),
      qc.invalidateQueries({ queryKey: ['entries'] }),
      qc.invalidateQueries({ queryKey: ['loans'] }),
      qc.invalidateQueries({ queryKey: ['payout-preview'] }),
      qc.invalidateQueries({ queryKey: ['minimum-payable'] }),
```

and append:

```ts
export type CloseGroup = {
  opening_cash: number;
  received: number;
  savings: number;
  loans_sent: number;
  idle_cash: number;
  excess_billed: number;
  interest_collected: number;
  fee_pot_balance: number;
  meeting_pot_balance: number;
  total_savings: number;
  total_owed: number;
};
export type CloseMember = {
  member_id: string;
  short_name: string;
  opening_owed: number;
  saving: number;
  cum_savings: number;
  loan_principal_sent: number;
  loan_interest_charged: number;
  excess_charged: number;
  penalties_charged: number;
  paid_total: number;
  paid_to_excess: number;
  paid_to_penalties: number;
  paid_to_interest: number;
  paid_to_principal: number;
  closing_owed: number;
  next_minimum: number;
  interest_earned: number;
  interest_earned_to_date: number;
};
export type CloseDiff = {
  member_id: string | null;
  short_name: string | null;
  field: string;
  app: number | null;
  workbook: number;
  difference: number | null;
  reason_code: string;
};
export type ClosePreview = {
  period_id: string;
  label: string;
  month_index: number;
  committed: boolean;
  group: CloseGroup;
  members: CloseMember[];
  diff: CloseDiff[];
  unexplained: number;
};

/**
 * What closing the month would write, computed by the engine and written to nothing. It holds every member's figures, so it is
 * dropped from memory when unused and never persisted; a refusal (declarations waiting, previous month open) will not fix itself, so no retry.
 */
export function useClosePreview(periodId: string | undefined) {
  return useQuery({
    queryKey: ['close-preview', periodId],
    enabled: Boolean(periodId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async (): Promise<ClosePreview> => {
      const { data, error } = await supabase.rpc('close_month', { p_period: periodId!, p_commit: false });
      if (error) throw error;
      return data as unknown as ClosePreview;
    },
  });
}
```

`src/features/ledger/closeChecklist.ts`:

```ts
import { loanRequests, openSuggestions, appliedGrounds, type PenaltySuggestion } from './deskMoney';
import type { EntryRow } from './memberViews';
import { deadlineNote, liveDeclarations, undeclared, type ActiveMember, type DeclarationRow } from './model';

export type CloseChecklist = {
  waiting: number;
  notDeclared: ActiveMember[];
  penaltiesPending: number;
  requestsUnsent: number;
  deadline: { text: string; tone: 'neutral' | 'warning' | 'danger' };
  blocked: boolean;
};

type Input = {
  declarations: DeclarationRow[];
  members: ActiveMember[];
  suggestions: PenaltySuggestion[];
  appliedEntries: EntryRow[];
  loans: Array<{ member_id: string; principal: number }>;
  deadline: string;
  today: string;
};

/** What the treasurer should know before closing. Only waiting declarations block: that is the engine's own rule. */
export function closeChecklist(i: Input): CloseChecklist {
  const live = liveDeclarations(i.declarations);
  const waiting = live.filter((d) => d.status === 'submitted').length;
  return {
    waiting,
    notDeclared: undeclared(i.members, live),
    penaltiesPending: openSuggestions(i.suggestions, appliedGrounds(i.appliedEntries), new Set()).length,
    requestsUnsent: loanRequests(i.declarations, i.loans).filter((r) => r.sent === 0).length,
    deadline: deadlineNote(i.today, i.deadline),
    blocked: waiting > 0,
  };
}
```

- [ ] **Step 4: Run tests, lint and typecheck**

Run: `bun run test src/features/ledger src/lib && bun run lint && bun run typecheck`
Expected: PASS, clean

- [ ] **Step 5: Commit**

```bash
git add src/features/ledger src/lib
git commit -m "feat: data for the month close

A preview hook that never commits and is never persisted, a checklist helper
(only waiting declarations block, as the engine does), and every ledger action
now refreshes the statements, entries, loans and payout members see."
```

---

### Task 2: Extract the shared difference list

**Files:**
- Create: `src/features/desk/DifferenceList.tsx`
- Modify: `src/features/desk/LedgerCheckPage.tsx`
- Test: `src/features/desk/DifferenceList.test.tsx` (the existing `LedgerCheckPage.test.tsx` is the regression net and must stay green untouched)

**Interfaces:**
- Produces: `DifferenceList({ diff: LedgerDiff[] })` (`LedgerDiff` from `./useLedgerCheck`): the differences grouped by reason code (unexplained first, unknown codes under "Other differences"), each row "Member · Field" with "App … · Workbook … · Difference …".

- [ ] **Step 1: Write the failing test**

`src/features/desk/DifferenceList.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { DifferenceList } from './DifferenceList';

const d = (o: Partial<Parameters<typeof DifferenceList>[0]['diff'][number]>) => ({
  member_id: 'm1', short_name: 'Eve', field: 'cum_savings', app: 300, workbook: 350, difference: -50, reason_code: 'unexplained', ...o,
});

test('groups by reason with unexplained first, and shows the three figures', () => {
  render(
    <DifferenceList
      diff={[
        d({ field: 'idle_cash', member_id: null, short_name: null, app: 299, workbook: 289, difference: 10, reason_code: 'fee_pot_vs_cash' }),
        d({}),
        d({ short_name: 'Ann', member_id: 'm2', field: 'excess_charged', app: 4.09, workbook: 4.1, difference: -0.01, reason_code: 'workbook_rounded' }),
      ]}
    />,
  );
  expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
    'Unexplained1', 'Loan fees paid from the fee pot, not lending cash1', 'Workbook rounding1',
  ]);
  expect(screen.getByText('Eve · Savings to date')).toBeInTheDocument();
  expect(screen.getByText('App K 300 · Workbook K 350 · Difference −K 50')).toBeInTheDocument();
  expect(screen.getByText('Group · Idle cash')).toBeInTheDocument();
});

test('an unknown reason code is still shown, and a missing app figure reads none', () => {
  render(<DifferenceList diff={[d({ app: null, difference: null, reason_code: 'brand_new_code' })]} />);
  const other = screen.getByRole('heading', { level: 3, name: /Other differences/ }).closest('section')!;
  expect(within(other).getByText('App none · Workbook K 350 · Difference not available')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test src/features/desk/DifferenceList.test.tsx`
Expected: FAIL (`./DifferenceList` not found)

- [ ] **Step 3: Create the shared component**

`src/features/desk/DifferenceList.tsx` (the constants and helpers are moved verbatim from `LedgerCheckPage.tsx`):

```tsx
import { money } from '@/lib/format';
import { Badge, type Tone } from '@/ui';
import type { LedgerDiff } from './useLedgerCheck';

// The spec's fixed reason codes, in the order the treasurer should read them.
const REASONS: { code: string; label: string; tone: Tone }[] = [
  { code: 'unexplained', label: 'Unexplained', tone: 'danger' },
  { code: 'workbook_missed_loan', label: 'Workbook left a loan out of the minimum', tone: 'warning' },
  { code: 'workbook_term_differs', label: 'Workbook used a different repayment term', tone: 'warning' },
  { code: 'penalty_not_charged', label: 'Workbook asked for a charge the app does not raise', tone: 'warning' },
  { code: 'workbook_counts_excess_twice', label: 'Workbook counted the month\'s excess twice in the minimum', tone: 'warning' },
  { code: 'penalty_in_minimum', label: 'Workbook included the month\'s penalty in the minimum', tone: 'warning' },
  { code: 'waiver', label: 'Waived by the treasurer', tone: 'info' },
  { code: 'fee_pot_vs_cash', label: 'Loan fees paid from the fee pot, not lending cash', tone: 'info' },
  { code: 'workbook_rounded', label: 'Workbook rounding', tone: 'neutral' },
];

// A code the page does not know is still shown, never dropped.
const OTHER = { code: '*', label: 'Other differences', tone: 'warning' as Tone };
const KNOWN = new Set(REASONS.map((r) => r.code));

const FIELDS: Record<string, string> = {
  cum_savings: 'Savings to date',
  excess_charged: 'Excess charge',
  closing_owed: 'Owed',
  next_minimum: 'Minimum due',
  opening_cash: 'Opening cash',
  idle_cash: 'Idle cash',
  excess_billed: 'Excess billed',
};

// money() puts the minus after the K (K −50); a difference reads better as −K 50.
const signed = (n: number | null) => (n === null ? 'not available' : n < 0 ? `−${money(-n)}` : money(n));
// A figure the app has none for (the workbook lists a member the close does not).
const orNone = (n: number | null) => (n === null ? 'none' : money(n));

/** The differences between the app's figures and the workbook's, grouped by reason code. */
export function DifferenceList({ diff }: { diff: LedgerDiff[] }) {
  return (
    <div className="grid gap-4">
      {[...REASONS, OTHER].map(({ code, label, tone }) => {
        const rows = diff.filter((d) => (code === OTHER.code ? !KNOWN.has(d.reason_code) : d.reason_code === code));
        if (rows.length === 0) return null;
        return (
          <section key={code}>
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-fg">
              {label}
              <Badge tone={tone}>{rows.length}</Badge>
            </h3>
            <ul role="list" className="grid gap-2">
              {rows.map((d) => (
                <li key={`${d.member_id ?? 'group'}-${d.field}`} className="rounded-xl bg-surface-2 p-3 text-sm text-fg">
                  <p className="font-semibold">{`${d.short_name ?? 'Group'} · ${FIELDS[d.field] ?? d.field}`}</p>
                  <p className="tabular text-muted">{`App ${orNone(d.app)} · Workbook ${money(d.workbook)} · Difference ${signed(d.difference)}`}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Switch `LedgerCheckPage` to it**

In `src/features/desk/LedgerCheckPage.tsx`, with a small script that fails loudly if a block is missing (run from the repo root):

```bash
python3 - <<'EOF'
p = 'src/features/desk/LedgerCheckPage.tsx'
s = open(p).read()
def cut(start, end):
    global s
    a, b = s.index(start), s.index(end)
    assert a < b, (start, end)
    s = s[:a] + s[b:]
# the reason table, OTHER, KNOWN and FIELDS now live in DifferenceList.tsx
cut("// The spec's fixed reason codes", "const GROUP_FIGURES")
cut("// money() puts the minus", "function summary")
a, b = s.index("function Differences"), s.index("function PeriodCard")
s = s[:a] + """function Differences({ period }: { period: LedgerPeriod }) {
  if (!period.checked) return <p className="mt-4 text-sm text-muted">No workbook figures for this month.</p>;
  if (period.diff.length === 0) {
    return (
      <div className="mt-4">
        <Alert tone="success">Matches the workbook.</Alert>
      </div>
    );
  }
  return (
    <div className="mt-4">
      <DifferenceList diff={period.diff} />
    </div>
  );
}

""" + s[b:]
s = s.replace("import { useLedgerCheck,", "import { DifferenceList } from './DifferenceList';\nimport { useLedgerCheck,", 1)
open(p, 'w').write(s)
EOF
```

Then run `bun run lint`: remove any import it reports as now unused (`Tone` is still used by `STATUS`; `Badge` and `money` are still used by `PeriodCard`).

- [ ] **Step 5: Run the regression net and the new test**

Run: `bun run test src/features/desk/DifferenceList.test.tsx src/features/desk/LedgerCheckPage.test.tsx && bun run lint && bun run typecheck`
Expected: PASS, clean. `LedgerCheckPage.test.tsx` must pass **unchanged**; if it needs editing the extraction changed behaviour, so fix the extraction instead.

- [ ] **Step 6: Commit**

```bash
git add src/features/desk
git commit -m "refactor: share the workbook-differences list

Moved out of the ledger check page, unchanged, so the month close page can
show the same list. The ledger check's own tests pass untouched."
```

---

### Task 3: ClosePreviewView

**Files:**
- Modify: `src/features/ledger/testFixtures.tsx`
- Create: `src/features/desk/ClosePreviewView.tsx`
- Test: `src/features/desk/ClosePreviewView.test.tsx`

**Interfaces:**
- Consumes: `ClosePreview`, `CloseMember`, `CloseGroup` from `@/features/ledger/queries`; `owedFigure`; `DifferenceList`.
- Produces: `ClosePreviewView({ preview: ClosePreview })`; fixtures `closeMember(o?)`, `closePreview(o?)`.

- [ ] **Step 1: Add the fixtures and write the failing test**

In `src/features/ledger/testFixtures.tsx` add `import type { ClosePreview, CloseMember } from './queries';` beside the other type imports and append:

```tsx
export const closeMember = (o: Partial<CloseMember> = {}): CloseMember => ({
  member_id: 'm1', short_name: 'Eve', opening_owed: 0, saving: 250, cum_savings: 2250, loan_principal_sent: 0, loan_interest_charged: 0,
  excess_charged: 0, penalties_charged: 0, paid_total: 250, paid_to_excess: 0, paid_to_penalties: 0, paid_to_interest: 0, paid_to_principal: 0,
  closing_owed: 0, next_minimum: 300, interest_earned: 0, interest_earned_to_date: 0, ...o,
});

export const closePreview = (o: Partial<ClosePreview> = {}): ClosePreview => ({
  period_id: 'p9', label: 'Oct 2026', month_index: 9, committed: false,
  group: {
    opening_cash: 5000, received: 900, savings: 3000, loans_sent: 1000, idle_cash: 7000, excess_billed: 700, interest_collected: 120,
    fee_pot_balance: 40, meeting_pot_balance: 900, total_savings: 40500, total_owed: 2300,
  },
  members: [closeMember(), closeMember({ member_id: 'm2', short_name: 'Ann' })],
  diff: [], unexplained: 0, ...o,
});
```

`src/features/desk/ClosePreviewView.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { closeMember, closePreview } from '@/features/ledger/testFixtures';
import { ClosePreviewView } from './ClosePreviewView';

test('shows the group statement the close would write', () => {
  render(<ClosePreviewView preview={closePreview()} />);
  const group = screen.getByRole('heading', { name: 'Group statement' }).closest('section')!;
  expect(within(group).getByText('Idle cash').nextElementSibling).toHaveTextContent('K 7,000');
  expect(within(group).getByText('Excess billed').nextElementSibling).toHaveTextContent('K 700');
  expect(within(group).getByText('Interest collected').nextElementSibling).toHaveTextContent('K 120');
  expect(within(group).getByText('Fee pot').nextElementSibling).toHaveTextContent('K 40');
  expect(within(group).getByText('Meeting pot').nextElementSibling).toHaveTextContent('K 900');
  expect(within(group).getByText('Total owed').nextElementSibling).toHaveTextContent('K 2,300');
  expect(screen.queryByText(/fee pot is short/i)).toBeNull();
});

test('a negative fee pot is a warning', () => {
  const p = closePreview();
  render(<ClosePreviewView preview={{ ...p, group: { ...p.group, fee_pot_balance: -15 } }} />);
  expect(screen.getByText(/The fee pot is short/)).toBeInTheDocument();
});

test('one expandable card per member, with the count in the heading', () => {
  render(<ClosePreviewView preview={closePreview()} />);
  expect(screen.getByRole('heading', { name: 'Members (2)' })).toBeInTheDocument();
  expect(screen.getAllByRole('group')).toHaveLength(2);
});

test('a member card hides untouched zero lines but shows negative ones, and always shows closing owed and the next minimum', () => {
  render(
    <ClosePreviewView
      preview={closePreview({
        members: [closeMember({ penalties_charged: -50, paid_to_principal: -100, loan_interest_charged: 45, closing_owed: 300, next_minimum: 400 })],
      })}
    />,
  );
  const card = screen.getByRole('group');
  expect(within(card).getByText('Loan interest charged').nextElementSibling).toHaveTextContent('K 45');
  expect(within(card).getByText('Penalties charged').nextElementSibling).toHaveTextContent('−50');
  expect(within(card).getByText('Paid to loan principal').nextElementSibling).toHaveTextContent('−100');
  expect(within(card).queryByText('Excess charged')).toBeNull();
  expect(within(card).getByText('Closing owed').nextElementSibling).toHaveTextContent('K 300');
  expect(within(card).getByText('Next minimum').nextElementSibling).toHaveTextContent('K 400');
});

test('a credit reads In credit in the card and in the summary', () => {
  render(<ClosePreviewView preview={closePreview({ members: [closeMember({ closing_owed: -50 })] })} />);
  const card = screen.getByRole('group');
  expect(within(card).getByText('In credit K 50')).toBeInTheDocument();
  expect(within(card).getByText('Closing credit').nextElementSibling).toHaveTextContent('K 50');
});

test('with no differences it says there is nothing to compare', () => {
  render(<ClosePreviewView preview={closePreview()} />);
  expect(screen.getByText('No workbook figures are loaded for this month, so there is nothing to compare.')).toBeInTheDocument();
});

test('differences are listed by reason, and unexplained ones are counted', () => {
  render(
    <ClosePreviewView
      preview={closePreview({
        unexplained: 1,
        diff: [{ member_id: 'm1', short_name: 'Eve', field: 'cum_savings', app: 300, workbook: 350, difference: -50, reason_code: 'unexplained' }],
      })}
    />,
  );
  expect(screen.getByText('Eve · Savings to date')).toBeInTheDocument();
  expect(screen.getByText('1 difference from the workbook is unexplained.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test src/features/desk/ClosePreviewView.test.tsx`
Expected: FAIL (`./ClosePreviewView` not found)

- [ ] **Step 3: Implement**

`src/features/desk/ClosePreviewView.tsx`:

```tsx
import { owedFigure } from '@/features/ledger/memberViews';
import type { CloseGroup, CloseMember, ClosePreview } from '@/features/ledger/queries';
import { money } from '@/lib/format';
import { Alert } from '@/ui';
import { DifferenceList } from './DifferenceList';

const GROUP_LINES: Array<[keyof CloseGroup, string]> = [
  ['opening_cash', 'Opening cash'],
  ['received', 'Received this month'],
  ['savings', 'Saved this month'],
  ['loans_sent', 'Loans sent'],
  ['idle_cash', 'Idle cash'],
  ['excess_billed', 'Excess billed'],
  ['interest_collected', 'Interest collected'],
  ['fee_pot_balance', 'Fee pot'],
  ['meeting_pot_balance', 'Meeting pot'],
  ['total_savings', 'Total savings'],
  ['total_owed', 'Total owed'],
];

// Corrections land in the open month, so a line can be negative; only an untouched zero is hidden.
const memberLines = (m: CloseMember): Array<[string, number]> =>
  (
    [
      ['Owed at the start', m.opening_owed],
      ['Saved this month', m.saving],
      ['Loan sent', m.loan_principal_sent],
      ['Loan interest charged', m.loan_interest_charged],
      ['Excess charged', m.excess_charged],
      ['Penalties charged', m.penalties_charged],
      ['Paid in total', m.paid_total],
      ['Paid to excess', m.paid_to_excess],
      ['Paid to penalties', m.paid_to_penalties],
      ['Paid to interest', m.paid_to_interest],
      ['Paid to loan principal', m.paid_to_principal],
      ['Interest earned this month', m.interest_earned],
    ] as Array<[string, number]>
  ).filter(([, value]) => value !== 0);

const Row = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
  <div className={`flex items-baseline justify-between gap-4 ${strong ? 'font-semibold' : ''}`}>
    <dt className={strong ? 'text-fg' : 'text-muted'}>{label}</dt>
    <dd className="tabular text-right text-fg">{money(value)}</dd>
  </div>
);

/** What the close would write: the group's figures, every member's statement, and the comparison with the workbook. */
export function ClosePreviewView({ preview }: { preview: ClosePreview }) {
  return (
    <div className="grid gap-6">
      <section aria-labelledby="close-group" className="grid gap-3">
        <h2 id="close-group" className="text-xl font-semibold text-fg">Group statement</h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {GROUP_LINES.map(([key, label]) => (
            <div key={key} className="rounded-xl border border-line bg-surface p-3">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="tabular text-base font-semibold text-fg">{money(preview.group[key])}</dd>
            </div>
          ))}
        </dl>
        {preview.group.fee_pot_balance < 0 ? (
          <Alert tone="warning">The fee pot is short: loan transfer fees are more than members declared.</Alert>
        ) : null}
      </section>

      <section aria-labelledby="close-members" className="grid gap-3">
        <h2 id="close-members" className="text-xl font-semibold text-fg">Members ({preview.members.length})</h2>
        {preview.members.map((m) => {
          const owed = owedFigure(m.closing_owed);
          return (
            <div key={m.member_id} className="rounded-2xl border border-line bg-surface shadow-sm dark:shadow-none">
              <details>
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-lg font-semibold text-fg md:px-5">
                  <span>{m.short_name}</span>
                  <span className="tabular text-base font-normal text-muted">{`${owed.label === 'In credit' ? 'In credit' : 'Owed'} ${money(owed.amount)}`}</span>
                </summary>
                <dl className="grid gap-2 border-t border-line px-4 py-4 text-sm md:px-5">
                  {memberLines(m).map(([label, value]) => <Row key={label} label={label} value={value} />)}
                  <Row label={m.closing_owed < 0 ? 'Closing credit' : 'Closing owed'} value={owed.amount} strong />
                  <Row label="Total saved so far" value={m.cum_savings} />
                  <Row label="Next minimum" value={m.next_minimum} />
                </dl>
              </details>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="close-compare" className="grid gap-3">
        <h2 id="close-compare" className="text-xl font-semibold text-fg">Workbook comparison</h2>
        {preview.diff.length === 0 ? (
          <p className="text-sm text-muted">No workbook figures are loaded for this month, so there is nothing to compare.</p>
        ) : (
          <>
            {preview.unexplained > 0 ? (
              <Alert tone="danger">{`${preview.unexplained} difference${preview.unexplained === 1 ? '' : 's'} from the workbook ${preview.unexplained === 1 ? 'is' : 'are'} unexplained.`}</Alert>
            ) : null}
            <DifferenceList diff={preview.diff} />
          </>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, lint and typecheck**

Run: `bun run test src/features/desk/ClosePreviewView.test.tsx && bun run lint && bun run typecheck`
Expected: PASS, clean. `getAllByRole('group')` counts the `<details>` elements; if a `dl` or other element also exposes the group role in this DOM, scope the count to `closest('section')`.

- [ ] **Step 5: Commit**

```bash
git add src/features/ledger/testFixtures.tsx src/features/desk/ClosePreviewView.tsx src/features/desk/ClosePreviewView.test.tsx
git commit -m "feat: the month close preview view

The group statement, an expandable card per member (negative lines shown,
untouched zeros hidden, a credit read as a credit) and the workbook comparison,
with a plain sentence when there is nothing to compare."
```

---

### Task 4: ClosePage and its route

**Files:**
- Create: `src/features/desk/ClosePage.tsx`
- Modify: `src/app/router.tsx`
- Test: `src/features/desk/ClosePage.test.tsx`

**Interfaces:**
- Consumes: `useLedgerCycle`, `useDeclarations`, `useSuggestedPenalties`, `useMonthPenalties`, `useMonthLoans`, `useClosePreview`, `useLedgerAction`, `closeChecklist`, `activeMembers`, `currentPeriod`, `ClosePreviewView`, `useGroupMembers` (from `@/features/group/GroupPage`), `useConfirmTap`.
- Produces: `ClosePage()` (route `/desk/close`).

- [ ] **Step 1: Write the failing test**

`src/features/desk/ClosePage.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { closePreview, declaration, loan, renderLedger, year } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const hooks = vi.hoisted(() => ({
  cycle: vi.fn(), declarations: vi.fn(), members: vi.fn(), suggestions: vi.fn(), applied: vi.fn(), loans: vi.fn(), preview: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => navigate }));
vi.mock('@/features/group/GroupPage', () => ({ useGroupMembers: () => hooks.members() }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useDeclarations: () => hooks.declarations(),
  useSuggestedPenalties: () => hooks.suggestions(),
  useMonthPenalties: () => hooks.applied(),
  useMonthLoans: () => hooks.loans(),
  useClosePreview: () => hooks.preview(),
}));
const { ClosePage } = await import('./ClosePage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const previewOk = (p = closePreview(), extra: Record<string, unknown> = {}) => ({
  ...ok(p), isSuccess: true, isFetching: false, isPlaceholderData: false, ...extra,
});
const MEMBER_ROWS = [
  { id: 'm1', short_name: 'Eve', status: 'active' },
  { id: 'm2', short_name: 'Ann', status: 'active' },
  { id: 'm3', short_name: 'Bob', status: 'active' },
];
const renderPage = (isAdmin = true) => renderLedger(<ClosePage />, { isAdmin });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
  navigate.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T10:00:00'));
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8, 'open') }));
  hooks.declarations.mockReturnValue(
    ok([declaration({ id: 'd1', member_id: 'm1', status: 'approved' }), declaration({ id: 'd2', member_id: 'm2', status: 'approved' }), declaration({ id: 'd3', member_id: 'm3', status: 'approved' })]),
  );
  hooks.members.mockReturnValue(ok(MEMBER_ROWS));
  hooks.suggestions.mockReturnValue(ok([]));
  hooks.applied.mockReturnValue(ok([]));
  hooks.loans.mockReturnValue(ok([]));
  hooks.preview.mockReturnValue(previewOk());
});

test('members get the admins-only screen and no ledger request is made', () => {
  renderPage(false);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(hooks.cycle).not.toHaveBeenCalled();
  expect(hooks.preview).not.toHaveBeenCalled();
});

test('with no open month there is nothing to close', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8) }));
  renderPage();
  expect(screen.getByText('No month is open to close.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Close / })).toBeNull();
});

test('the checklist says what is ready and what is not', () => {
  hooks.declarations.mockReturnValue(ok([declaration({ id: 'd1', member_id: 'm1', status: 'approved', borrowing_request: 1000 })]));
  hooks.suggestions.mockReturnValue(ok([{ member_id: 'm2', short_name: 'Ann', ground: 'late_declaration', amount: 50, detail: 'x' }]));
  renderPage();
  const list = screen.getByRole('heading', { name: 'Before you close' }).closest('section')!;
  expect(within(list).getByText('No declarations are waiting.')).toBeInTheDocument();
  expect(within(list).getByText(/2 members have not declared: Ann, Bob/)).toBeInTheDocument();
  expect(within(list).getByText('1 suggested penalty has not been applied.')).toBeInTheDocument();
  expect(within(list).getByText('1 borrowing request has not been sent.')).toBeInTheDocument();
  expect(within(list).getByText(/Declarations due 7 Oct 2026/)).toBeInTheDocument();
  expect(within(list).getByText('2 days left')).toBeInTheDocument();
});

test('a waiting declaration blocks the close and points back to the Desk', () => {
  hooks.declarations.mockReturnValue(ok([declaration({ id: 'd1', member_id: 'm1', status: 'submitted' })]));
  renderPage();
  expect(screen.getByText('1 declaration is waiting. Approve or return it on the Desk first.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to the Desk' })).toHaveAttribute('href', '/desk');
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeDisabled();
});

test('the preview loading and failing are handled; a refusal reads as its friendly sentence with a retry', async () => {
  hooks.preview.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn(), isSuccess: false, isFetching: true, isPlaceholderData: false });
  const { unmount } = renderPage();
  expect(screen.getByText('Loading the preview')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeDisabled();
  unmount();
  const refetch = vi.fn();
  hooks.preview.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'declarations_pending', code: 'P0001' }, refetch, isSuccess: false, isFetching: false, isPlaceholderData: false });
  renderPage();
  expect(screen.getByText('Some declarations are still waiting. Approve or return them first.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeDisabled();
});

test('the preview is shown, with the commit text naming how many statements it writes', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: 'Group statement' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Members (2)' })).toBeInTheDocument();
  expect(screen.getByText('This writes 2 statements and locks Oct 2026. Anything you correct later goes into the next month.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeEnabled();
});

test('Refresh preview asks again', async () => {
  const refetch = vi.fn();
  hooks.preview.mockReturnValue(previewOk(closePreview(), { refetch }));
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Refresh preview' }));
  expect(refetch).toHaveBeenCalled();
});

test('closing takes a second tap and sends the commit once, then goes back to the Desk', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to close Oct 2026' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('close_month', { p_period: 'p9', p_commit: true, p_reason: undefined });
  expect(await screen.findByText('Oct 2026 is closed.')).toBeInTheDocument();
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/desk'));
});

test('unexplained differences need a written reason before the close can be sent, and the reason is sent', async () => {
  hooks.preview.mockReturnValue(
    previewOk(closePreview({ unexplained: 1, diff: [{ member_id: 'm1', short_name: 'Eve', field: 'cum_savings', app: 300, workbook: 350, difference: -50, reason_code: 'unexplained' }] })),
  );
  renderPage();
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Why the differences are acceptable'), 'Workbook typo, checked by hand');
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to close Oct 2026' }));
  expect(rpc).toHaveBeenCalledWith('close_month', { p_period: 'p9', p_commit: true, p_reason: 'Workbook typo, checked by hand' });
});

test('no reason field when nothing is unexplained', () => {
  renderPage();
  expect(screen.queryByLabelText('Why the differences are acceptable')).toBeNull();
});

test('editing the reason or refreshing the preview disarms the second tap', async () => {
  hooks.preview.mockReturnValue(previewOk(closePreview({ unexplained: 1, diff: [{ member_id: 'm1', short_name: 'Eve', field: 'cum_savings', app: 300, workbook: 350, difference: -50, reason_code: 'unexplained' }] })));
  renderPage();
  await userEvent.type(screen.getByLabelText('Why the differences are acceptable'), 'ok');
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  expect(screen.getByRole('button', { name: 'Tap again to close Oct 2026' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Why the differences are acceptable'), '!');
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'Refresh preview' }));
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeInTheDocument();
});

test('a preview that is refetching cannot be committed', () => {
  hooks.preview.mockReturnValue(previewOk(closePreview(), { isFetching: true }));
  renderPage();
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeDisabled();
});

test('tapping again while the close is running does not send a second one', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to close Oct 2026' }));
  await userEvent.click(screen.getByRole('button', { name: /Close Oct 2026|Tap again/ }));
  expect(rpc).toHaveBeenCalledTimes(1);
});

test('already closed (a retry after a dropped connection) says so and stays put', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'already_closed', code: 'P0001' } });
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to close Oct 2026' }));
  expect(await screen.findByText('This month is already closed.')).toBeInTheDocument();
  expect(navigate).not.toHaveBeenCalled();
});

test('an unexplained-differences refusal from the server is shown in plain words', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'unexplained_differences', code: 'P0001' } });
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to close Oct 2026' }));
  expect(await screen.findByText('Some differences from the workbook aren’t explained. Add a reason to close the month anyway.')).toBeInTheDocument();
});

test('loans already sent to a requester are not counted as unsent requests', () => {
  hooks.declarations.mockReturnValue(ok([declaration({ id: 'd1', member_id: 'm1', status: 'approved', borrowing_request: 1000 }), declaration({ id: 'd2', member_id: 'm2', status: 'approved' }), declaration({ id: 'd3', member_id: 'm3', status: 'approved' })]));
  hooks.loans.mockReturnValue(ok([loan({ member_id: 'm1', principal: 1000 })]));
  renderPage();
  expect(screen.getByText('No borrowing requests are waiting.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test src/features/desk/ClosePage.test.tsx`
Expected: FAIL (`./ClosePage` not found)

- [ ] **Step 3: Implement the page**

`src/features/desk/ClosePage.tsx`:

```tsx
import { Link, useNavigate } from 'react-router';
import { useState, type ReactNode } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { useGroupMembers } from '@/features/group/GroupPage';
import { useLedgerAction } from '@/features/ledger/actions';
import { closeChecklist } from '@/features/ledger/closeChecklist';
import { activeMembers, currentPeriod } from '@/features/ledger/model';
import { useClosePreview, useDeclarations, useLedgerCycle, useMonthLoans, useMonthPenalties, useSuggestedPenalties } from '@/features/ledger/queries';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { formatDate, localISODate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Skeleton, TextField, useConfirmTap, type Tone } from '@/ui';
import { ClosePreviewView } from './ClosePreviewView';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const inline = 'font-semibold text-accent underline underline-offset-4';

function Item({ tone, badge, children }: { tone: Tone; badge: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-start gap-2 py-3 text-sm text-fg">
      <Badge tone={tone}>{badge}</Badge>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

function CloseBody() {
  const { group } = useGroup();
  const navigate = useNavigate();
  const cycle = useLedgerCycle(group.id);
  const open = cycle.data ? currentPeriod(cycle.data.periods) : null;
  const declarations = useDeclarations(group.id, open?.id);
  const membersQuery = useGroupMembers(group.id);
  const suggestions = useSuggestedPenalties(group.id, open?.id);
  const applied = useMonthPenalties(group.id, open?.id);
  const loans = useMonthLoans(group.id, open?.id);
  const preview = useClosePreview(open?.id);
  const [reason, setReason] = useState('');

  const label = open?.label ?? 'the month';
  const closing = useLedgerAction<void>(async () => {
    const { error } = await supabase.rpc('close_month', { p_period: open!.id, p_commit: true, p_reason: reason.trim() || undefined });
    if (error) throw error;
  }, `${label} is closed.`);
  const confirm = useConfirmTap(() => closing.mutate(undefined, { onSuccess: () => navigate('/desk') }));

  if (cycle.data === undefined) {
    return cycle.isError ? (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void cycle.refetch()}>Try again</Button>}>
        {friendlyError(cycle.error)}
      </Alert>
    ) : (
      <div role="status" className="grid gap-3">
        <span className="sr-only">Loading the close</span>
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!open) {
    return (
      <EmptyState title="No month is open to close.">
        Open the next month from the Desk first. <Link to="/desk" className={inline}>Go to the Desk</Link>
      </EmptyState>
    );
  }

  const ready = declarations.data && membersQuery.data && suggestions.data && applied.data && loans.data;
  const checklist = ready
    ? closeChecklist({
        declarations: declarations.data!,
        members: activeMembers(membersQuery.data!),
        suggestions: suggestions.data!,
        appliedEntries: applied.data!,
        loans: loans.data!,
        deadline: open.deadline,
        today: localISODate(new Date()),
      })
    : null;
  const failed = [declarations, membersQuery, suggestions, applied, loans].find((q) => q.isError && !q.data);
  const needsReason = (preview.data?.unexplained ?? 0) > 0;
  const previewReady = preview.isSuccess && !preview.isFetching && !preview.isPlaceholderData && Boolean(preview.data);
  const canClose = previewReady && checklist !== null && !checklist.blocked && (!needsReason || reason.trim().length > 0) && reason.trim().length <= 500;
  const why = !previewReady
    ? 'The close can be sent once the preview has loaded.'
    : checklist === null
      ? 'The close can be sent once the checklist has loaded.'
      : checklist.blocked
        ? 'Resolve the waiting declarations to enable this.'
        : needsReason && reason.trim().length === 0
          ? 'Add a reason to enable this.'
          : null;

  return (
    <div className="grid gap-4 md:gap-5 lg:max-w-3xl">
      <Card>
        <section aria-labelledby="before-close">
          <h2 id="before-close" className="text-lg font-semibold text-fg">Before you close</h2>
          {failed ? (
            <div className="mt-2">
              <Alert
                tone="danger"
                action={<Button size="sm" variant="secondary" onClick={() => { void declarations.refetch(); void membersQuery.refetch(); void suggestions.refetch(); void applied.refetch(); void loans.refetch(); }}>Try again</Button>}
              >
                {friendlyError(failed.error)}
              </Alert>
            </div>
          ) : checklist === null ? (
            <div role="status" className="mt-2"><span className="sr-only">Loading the checklist</span><Skeleton className="h-32" /></div>
          ) : (
            <ul role="list" className="divide-y divide-line">
              {checklist.waiting > 0 ? (
                <Item tone="danger" badge="Blocks the close">
                  {`${plural(checklist.waiting, 'declaration is', 'declarations are')} waiting. Approve or return ${checklist.waiting === 1 ? 'it' : 'them'} on the Desk first.`}{' '}
                  <Link to="/desk" className={inline}>Go to the Desk</Link>
                </Item>
              ) : (
                <Item tone="success" badge="Ready">No declarations are waiting.</Item>
              )}
              {checklist.notDeclared.length > 0 ? (
                <Item tone="warning" badge="Check">
                  {`${plural(checklist.notDeclared.length, 'member has', 'members have')} not declared: ${checklist.notDeclared.map((m) => m.short_name).join(', ')}. They will close with nothing paid in.`}
                </Item>
              ) : (
                <Item tone="success" badge="Ready">Everyone has declared.</Item>
              )}
              {checklist.penaltiesPending > 0 ? (
                <Item tone="warning" badge="Check">{`${plural(checklist.penaltiesPending, 'suggested penalty has', 'suggested penalties have')} not been applied.`}</Item>
              ) : (
                <Item tone="success" badge="Ready">No suggested penalties are waiting.</Item>
              )}
              {checklist.requestsUnsent > 0 ? (
                <Item tone="info" badge="Note">{`${plural(checklist.requestsUnsent, 'borrowing request has', 'borrowing requests have')} not been sent.`}</Item>
              ) : (
                <Item tone="success" badge="Ready">No borrowing requests are waiting.</Item>
              )}
              <Item tone={checklist.deadline.tone} badge={checklist.deadline.text}>{`Declarations due ${formatDate(open.deadline)}.`}</Item>
            </ul>
          )}
        </section>
      </Card>

      <section aria-labelledby="close-preview-title" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="close-preview-title" className="text-xl font-semibold text-fg">What the close will write</h2>
          <Button
            size="sm"
            variant="secondary"
            isLoading={preview.isFetching}
            onClick={() => {
              confirm.reset();
              void preview.refetch();
            }}
          >
            Refresh preview
          </Button>
        </div>
        <p className="text-sm text-muted">Figures change if anything is recorded before you close. The close always uses the figures at the moment you commit.</p>
        {preview.isError && !preview.data ? (
          <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void preview.refetch()}>Try again</Button>}>
            {friendlyError(preview.error)}
          </Alert>
        ) : preview.data ? (
          <ClosePreviewView preview={preview.data} />
        ) : (
          <div role="status"><span className="sr-only">Loading the preview</span><Skeleton className="h-64" /></div>
        )}
      </section>

      <Card>
        <section aria-labelledby="commit-title" className="grid gap-3">
          <h2 id="commit-title" className="text-lg font-semibold text-fg">{`Close ${open.label}`}</h2>
          <p className="text-sm text-muted">
            {`This writes ${preview.data?.members.length ?? 0} statements and locks ${open.label}. Anything you correct later goes into the next month.`}
          </p>
          {needsReason ? (
            <TextField
              label="Why the differences are acceptable"
              maxLength={500}
              autoComplete="off"
              value={reason}
              onChange={(e) => {
                confirm.reset();
                setReason(e.target.value);
              }}
            />
          ) : null}
          <Button fullWidth disabled={!canClose} isLoading={closing.isPending} onClick={confirm.tap}>
            {confirm.armed ? `Tap again to close ${open.label}` : `Close ${open.label}`}
          </Button>
          {why ? <p className="text-sm text-muted">{why}</p> : null}
        </section>
      </Card>
    </div>
  );
}

export function ClosePage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader title="Close the month" actions={<Link to="/desk" className={inline}>Back to the Desk</Link>} />
      <CloseBody />
    </>
  );
}
```

- [ ] **Step 4: Register the route**

In `src/app/router.tsx` add `import { ClosePage } from '@/features/desk/ClosePage';` next to the other desk imports and, after the `desk/ledger-check` line, add:

```tsx
                  page('desk/close', 'Close the month', <ClosePage />),
```

- [ ] **Step 5: Run tests, lint and typecheck**

Run: `bun run test src/features/desk/ClosePage.test.tsx && bun run lint && bun run typecheck`
Expected: PASS, clean. Notes: in the "already closed" test the hook-level `onError` toasts the friendly sentence; in the checklist test the deadline badge text is `2 days left` (today is faked to 5 Oct, the deadline is 7 Oct); the blocked-state helper line is "Resolve the waiting declarations to enable this." and the Close button must be disabled.

- [ ] **Step 6: Commit**

```bash
git add src/features/desk/ClosePage.tsx src/features/desk/ClosePage.test.tsx src/app/router.tsx
git commit -m "feat: the month close page

A checklist of what is ready, the engine's preview of everything the close
will write, and a two-tap commit that stays disabled until the preview is
fresh, no declaration is waiting and any unexplained difference has a reason."
```

---

### Task 5: The Desk entry point and final checks

**Files:**
- Modify: `src/features/desk/DeskPage.tsx`, `src/features/desk/DeskPage.test.tsx`

**Interfaces:**
- Produces: a "Close the month" card on the Desk (open month only) linking to `/desk/close`.

- [ ] **Step 1: Add the failing Desk tests**

Append to `src/features/desk/DeskPage.test.tsx`:

```tsx

test('with a month open the Desk offers the month close', () => {
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByRole('heading', { name: 'Close the month' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Review the close' })).toHaveAttribute('href', '/desk/close');
});

test('without an open month there is nothing to close', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8) }));
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.queryByRole('link', { name: 'Review the close' })).toBeNull();
});
```

Run: `bun run test src/features/desk/DeskPage.test.tsx`. Expected: the first new test FAILS (no card yet).

- [ ] **Step 2: Add the card**

In `src/features/desk/DeskPage.tsx`: change the `ui` import to include `Card, CardHeader` (`import { Alert, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton } from '@/ui';`) and, right after the `NotYetDeclared` element inside the `ready` branch, add:

```tsx
            <Card>
              <CardHeader
                title="Close the month"
                subtitle="Closing writes everyone’s statement and locks the month. Check the list first."
                action={
                  <Link
                    to="/desk/close"
                    className="inline-flex h-12 items-center rounded-xl px-5 font-semibold text-accent underline transition duration-150 hover:bg-surface-2 active:scale-[.97]"
                  >
                    Review the close
                  </Link>
                }
              />
            </Card>
```

- [ ] **Step 3: Full verification**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: all green; the build warns only about the existing chunk-size notice. `LedgerCheckPage.test.tsx` passes unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/features/desk/DeskPage.tsx src/features/desk/DeskPage.test.tsx
git commit -m "feat: reach the month close from the Desk

A Close the month card with the open month, linking to the new page."
```

- [ ] **Step 5: Hand over**

Tell the user: there is no migration, so this works on dev as soon as it is built. Manual check on dev with a throwaway group: open a month, get every declaration approved or returned, open the close page, read the checklist and preview, close it, then confirm the `statements`, `group_statements` and audit-log rows, that the Desk now offers the next month, and that a member's Passbook shows the new statement. Closing cannot be undone, so use a throwaway group, not the real one, for this check.
