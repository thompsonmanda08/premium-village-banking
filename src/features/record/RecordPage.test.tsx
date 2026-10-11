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

test('entries from outside the active cycle are not shown', () => {
  hooks.entries.mockReturnValue(ok([entry({ id: 'e8', period_id: 'gone' })]));
  renderLedger(<RecordPage />);
  expect(screen.queryByRole('heading', { name: /20\d\d/ })).toBeNull();
  expect(screen.getByText('Nothing recorded yet')).toBeInTheDocument();
});

test('nothing recorded yet: an empty state', () => {
  renderLedger(<RecordPage />);
  expect(screen.getByText('Nothing recorded yet')).toBeInTheDocument();
});
