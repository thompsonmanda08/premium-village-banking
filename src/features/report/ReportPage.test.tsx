import { screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { groupStatement, renderLedger, year } from '@/features/ledger/testFixtures';
import { RULE_CATALOG } from '@/features/rules/ruleCatalog';
import type { MonthReport } from './reportQueries';
import { reportPath } from './reportQueries';

const hooks = vi.hoisted(() => ({ cycle: vi.fn(), report: vi.fn(), month: undefined as string | undefined }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useParams: () => ({ month: hooks.month }) }));
vi.mock('@/features/ledger/queries', async (orig) => ({ ...(await orig<typeof import('@/features/ledger/queries')>()), useLedgerCycle: () => hooks.cycle() }));
vi.mock('./reportQueries', async (orig) => ({ ...(await orig<typeof import('./reportQueries')>()), useMonthReport: (id?: string) => hooks.report(id) }));
const { ReportPage } = await import('./ReportPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const REPORT: MonthReport = {
  period: { id: 'p9', label: 'Oct 2026', month_index: 9, closed_at: '2026-11-01T00:00:00Z' },
  group: groupStatement({ total_savings: 40500, savings: 3000, interest_collected: 120, idle_cash: 7000 }),
  loans: { sent_count: 2, sent_principal: 1500, members_owing: 5, total_owed: 2300 },
  arrears: { count: 2, total: 400, members: [{ member_id: 'm2', name: 'Zed Arrears', unpaid: 150 }, { member_id: 'm3', name: 'Yan Late', unpaid: 250 }] },
  overrides: [], overrides_recorded: true, rules: { ratified_by_close: 4 },
};

beforeEach(() => {
  hooks.month = undefined;
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(9, 'open') }));
  hooks.report.mockReset();
  hooks.report.mockImplementation((id?: string) => (id ? ok(REPORT) : { data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() }));
});

test('shows the figures, loans, arrears and the rules line for the latest closed month', () => {
  renderLedger(<ReportPage />);
  expect(hooks.report).toHaveBeenCalledWith('p9');
  expect(screen.getByRole('heading', { name: 'Oct 2026 report' })).toBeInTheDocument();
  expect(screen.getByText('K 40,500')).toBeInTheDocument();
  expect(screen.getByText('K 1,500')).toBeInTheDocument();
  expect(screen.getByText(/2 members did not pay last month’s minimum, K 400 in all/)).toBeInTheDocument();
  expect(screen.getByText('Zed Arrears')).toBeInTheDocument();
  expect(screen.getByText(`4 of ${RULE_CATALOG.length} rules ratified by the close`)).toBeInTheDocument();
  expect(screen.getByText('No overrides this month.')).toBeInTheDocument();
});

test('with names hidden no name appears and the page says why', () => {
  hooks.report.mockReturnValue(ok({
    ...REPORT, arrears: { count: 2, total: 400, members: null },
    overrides: [{ at: '2026-10-10T08:00:00Z', kind: 'waiver', member_id: null, member: null, amount: null, reason: null }],
  }));
  renderLedger(<ReportPage />);
  expect(screen.getByText('Names are hidden by the group’s setting.')).toBeInTheDocument();
  const page = document.body.textContent ?? '';
  expect(page).not.toContain('Zed Arrears');
  expect(page).not.toContain('Yan Late');
  expect(screen.getByText('Charge waived · A member')).toBeInTheDocument();
});

test('an import month says overrides were not recorded', () => {
  hooks.report.mockReturnValue(ok({ ...REPORT, overrides_recorded: false }));
  renderLedger(<ReportPage />);
  expect(screen.getByText('Overrides were not recorded before November 2026.')).toBeInTheDocument();
});

test('the month in the address picks the period and links to its neighbours', () => {
  hooks.month = '2026-05';
  renderLedger(<ReportPage />);
  expect(hooks.report).toHaveBeenCalledWith('p4');
  expect(screen.getByRole('link', { name: 'Previous: Apr 2026' })).toHaveAttribute('href', '/report/2026-04');
  expect(screen.getByRole('link', { name: 'Next: Jun 2026' })).toHaveAttribute('href', '/report/2026-06');
});

test('an unknown month and an open month show an empty state, with no report asked for', () => {
  for (const m of ['2031-01', '2026-11']) {
    hooks.month = m;
    hooks.report.mockClear();
    const { unmount } = renderLedger(<ReportPage />);
    expect(screen.getByText('No report for that month')).toBeInTheDocument();
    expect(hooks.report).toHaveBeenCalledWith(undefined);
    unmount();
  }
});

test('loading and error states', () => {
  hooks.report.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderLedger(<ReportPage />);
  expect(screen.getByText('Loading the monthly report')).toBeInTheDocument();
  unmount();
  hooks.report.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { code: 'P0001', message: 'period_not_closed' }, refetch: vi.fn() });
  renderLedger(<ReportPage />);
  expect(screen.getByText('That month isn’t closed yet.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

test('reportPath is the month of the start date', () => {
  expect(reportPath('2026-05-01')).toBe('/report/2026-05');
});
