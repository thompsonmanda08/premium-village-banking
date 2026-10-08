import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import type { Membership } from '@/features/group/useMembership';

const cyclesQuery = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => cyclesQuery() }) }) }) },
}));
const { RulesPage } = await import('./RulesPage');

const MEMBERSHIP: Membership = {
  group: { id: 'g1', name: 'Premium Village Banking', currency: 'ZMW', owner_user_id: 'x', figures_visibility: 'open' },
  member: null,
  isAdmin: false,
};
const RULES = {
  cycle_id: 'c1', created_at: '', min_saving: 250, loan_rate: 0.15, excess_rate: 0.1, penalty_per_day: 50, membership_fee: 50,
  window_open_day: 5, window_close_day: 7,
  loan_multiples: [{ from_month: 1, to_month: 4, multiple: 3 }, { from_month: 12, to_month: 12, multiple: 0 }],
  tenor_bands: [{ max: 3000, months: 1 }, { max: 5000, months: 2 }, { max: 9999.99, months: 3 }, { max: null, months: 4 }],
};
const CYCLE = { id: 'c1', group_id: 'g1', label: 'Cycle 2027', status: 'planned', starts_on: '2027-02-15', ends_on: '2028-02-15', payout_on: '2028-02-05', created_at: '', cycle_rules: RULES };

const renderRules = (qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  render(
    <QueryClientProvider client={qc}>
      <GroupProvider value={MEMBERSHIP}><RulesPage /></GroupProvider>
    </QueryClientProvider>,
  );
  return qc;
};

beforeEach(() => {
  cyclesQuery.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T10:00:00'));
});
afterEach(() => vi.useRealTimers());

test('loading: a labelled skeleton under the page title', () => {
  cyclesQuery.mockReturnValue(new Promise(() => {}));
  renderRules();
  expect(screen.getByRole('heading', { name: 'Rules' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
});

test('lists the rules, loan limits, unambiguous repayment periods and key dates', async () => {
  cyclesQuery.mockResolvedValue({ data: [CYCLE], error: null });
  renderRules();
  expect(await screen.findByText('K 250 a month')).toBeInTheDocument();
  expect(screen.getByText('5th–7th of each month')).toBeInTheDocument();
  expect(screen.getByText('15%, charged once')).toBeInTheDocument();
  expect(screen.getByText('Months 1–4: up to 3× your savings')).toBeInTheDocument();
  expect(screen.getByText('K 3,000.01 to K 5,000: 2 months')).toBeInTheDocument();
  expect(screen.getByText('K 10,000 and above: 4 months')).toBeInTheDocument();
  expect(screen.getByText('Cycle starts')).toBeInTheDocument();
});

test('rates are shown exactly, not rounded to whole percentages', async () => {
  cyclesQuery.mockResolvedValue({ data: [{ ...CYCLE, cycle_rules: { ...RULES, loan_rate: 0.125, excess_rate: 0.0725 } }], error: null });
  renderRules();
  expect(await screen.findByText('12.5%, charged once')).toBeInTheDocument();
  expect(screen.getByText('7.25% a month on idle cash')).toBeInTheDocument();
});

test('empty: says no rules yet and offers a way to check again', async () => {
  cyclesQuery.mockResolvedValue({ data: [], error: null });
  renderRules();
  expect(await screen.findByText('No rules yet')).toBeInTheDocument();
  cyclesQuery.mockResolvedValue({ data: [CYCLE], error: null });
  await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
  expect(await screen.findByText('K 250 a month')).toBeInTheDocument();
});

test('error with nothing cached: friendly message and a working retry', async () => {
  cyclesQuery.mockResolvedValue({ data: null, error: { message: 'secret-detail', code: 'PGRST301' } });
  renderRules();
  expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired. Please sign in again.');
  expect(screen.queryByText(/secret-detail/)).toBeNull();
  cyclesQuery.mockResolvedValue({ data: [CYCLE], error: null });
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('K 250 a month')).toBeInTheDocument();
});

test('a failed background refetch keeps the rules on screen', async () => {
  cyclesQuery.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  qc.setQueryData(['cycles', 'g1'], [{ ...CYCLE, rules: RULES }]);
  renderRules(qc);
  await vi.waitFor(() => expect(qc.getQueryState(['cycles', 'g1'])?.status).toBe('error'));
  await act(() => new Promise((r) => setTimeout(r, 0))); // observers are notified on the next tick
  expect(screen.getByText('K 250 a month')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});
