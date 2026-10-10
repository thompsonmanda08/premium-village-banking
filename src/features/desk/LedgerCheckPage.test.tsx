import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import type { Membership } from '@/features/group/useMembership';

const rpc = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
const { LedgerCheckPage } = await import('./LedgerCheckPage');

const membership = (isAdmin: boolean): Membership => ({
  group: { id: 'g1', name: 'Premium Village Banking', currency: 'ZMW', owner_user_id: 'x', figures_visibility: 'open' },
  member: null,
  isAdmin,
});

// Synthetic figures.
const GROUP = { opening_cash: 0, idle_cash: 299, excess_billed: 29.9, interest_collected: 0, fee_pot_balance: 5, meeting_pot_balance: 900 };
const REPORT = {
  cycle_id: 'c1',
  cycle_label: 'Cycle 2026',
  periods: [
    {
      id: 'p1', label: 'Feb 2026', month_index: 1, status: 'closed', group: GROUP, checked: true,
      diff: [
        { member_id: null, short_name: null, field: 'idle_cash', app: 299, workbook: 289, difference: 10, reason_code: 'fee_pot_vs_cash' },
        { member_id: 'm1', short_name: 'Eve', field: 'cum_savings', app: 300, workbook: 350, difference: -50, reason_code: 'unexplained' },
        { member_id: 'm2', short_name: 'Ann', field: 'excess_charged', app: 4.09, workbook: 4.1, difference: -0.01, reason_code: 'workbook_rounded' },
      ],
    },
    { id: 'p2', label: 'Mar 2026', month_index: 2, status: 'closed', group: GROUP, checked: true, diff: [] },
    { id: 'p3', label: 'Apr 2026', month_index: 3, status: 'open', group: null, checked: false, diff: [] },
  ],
};

const renderPage = (isAdmin = true) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <GroupProvider value={membership(isAdmin)}>
          <LedgerCheckPage />
        </GroupProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  rpc.mockReset();
});

test('members get the admins-only screen and no request is made', () => {
  renderPage(false);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('loading: a labelled skeleton', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderPage();
  expect(screen.getByRole('status')).toHaveTextContent('Loading the ledger check');
  await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('ledger_check', { p_group: 'g1' }));
});

test('error: the friendly sentence and a 48px retry', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'not_admin', code: '42501' } });
  renderPage();
  expect(await screen.findByText('Only admins can do this.')).toBeInTheDocument();
  const retry = screen.getByRole('button', { name: 'Try again' });
  expect(retry.className).toContain('h-12');
  rpc.mockResolvedValueOnce({ data: REPORT, error: null });
  await userEvent.click(retry);
  expect(await screen.findByText('Feb 2026')).toBeInTheDocument();
});

test('empty: no months yet', async () => {
  rpc.mockResolvedValue({ data: { cycle_id: null, cycle_label: null, periods: [] }, error: null });
  renderPage();
  expect(await screen.findByText('No months to check yet')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Check again' }).className).toContain('h-12');
});

test('each month shows its status, group figures and differences grouped by reason', async () => {
  rpc.mockResolvedValue({ data: REPORT, error: null });
  renderPage();
  expect(await screen.findByText('Cycle 2026')).toBeInTheDocument();
  const feb = screen.getByRole('region', { name: 'Feb 2026' });
  expect(within(feb).getByText('Closed')).toBeInTheDocument();
  expect(within(feb).getByText('K 299')).toBeInTheDocument();
  expect(within(feb).getByText('K 29.90')).toBeInTheDocument();
  // unexplained first, then the explained reasons
  const headings = within(feb).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  expect(headings).toEqual(['Unexplained1', 'Loan fees paid from the fee pot, not lending cash1', 'Workbook rounding1']);
  expect(within(feb).getByText('Eve · Savings to date')).toBeInTheDocument();
  expect(within(feb).getByText('App K 300 · Workbook K 350 · Difference −K 50')).toBeInTheDocument();
  expect(within(feb).getByText('Group · Idle cash')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Mar 2026' })).getByText('Matches the workbook.')).toBeInTheDocument();
  const apr = screen.getByRole('region', { name: 'Apr 2026' });
  expect(within(apr).getByText('Open')).toBeInTheDocument();
  expect(within(apr).getByText('Figures appear once this month is closed.')).toBeInTheDocument();
  expect(within(apr).getByText('No workbook figures for this month.')).toBeInTheDocument();
});

test('the cycle summary counts unexplained differences; unknown codes and a missing app figure still show', async () => {
  const odd = {
    ...REPORT,
    periods: [
      {
        ...REPORT.periods[0]!,
        diff: [
          { member_id: 'm1', short_name: 'Eve', field: 'closing_owed', app: null, workbook: 350, difference: null, reason_code: 'unexplained' },
          { member_id: 'm2', short_name: 'Ann', field: 'next_minimum', app: 10, workbook: 12, difference: -2, reason_code: 'brand_new_code' },
        ],
      },
      REPORT.periods[2]!,
    ],
  };
  rpc.mockResolvedValue({ data: odd, error: null });
  renderPage();
  expect(await screen.findByText('1 unexplained · 2 differences · 1 of 2 months checked')).toBeInTheDocument();
  const feb = screen.getByRole('region', { name: 'Feb 2026' });
  expect(within(feb).getByText('App none · Workbook K 350 · Difference not available')).toBeInTheDocument();
  expect(within(feb).getByRole('heading', { level: 3, name: /Other differences/ })).toBeInTheDocument();
});
