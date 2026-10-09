import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import type { Membership } from '@/features/group/useMembership';

const cyclesQuery = vi.fn();
const membersQuery = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => ({ select: () => ({ eq: () => ({ order: () => (table === 'group_members' ? membersQuery() : cyclesQuery()) }) }) }) },
}));
const { HomePage } = await import('./HomePage');

const MEMBERSHIP: Membership = {
  group: { id: 'g1', name: 'Premium Village Banking', currency: 'ZMW', owner_user_id: 'x', figures_visibility: 'open' },
  member: { id: 'm1', group_id: 'g1', full_name: 'Tafara', short_name: 'Tafara', role: 'member', status: 'active', email: null },
  isAdmin: false,
};
const RULES = {
  cycle_id: 'c1', created_at: '', min_saving: 250, loan_rate: 0.15, excess_rate: 0.1, penalty_per_day: 50, membership_fee: 50,
  window_open_day: 5, window_close_day: 7, loan_multiples: [], tenor_bands: [],
};
const CYCLE = { id: 'c1', group_id: 'g1', label: 'Cycle 2027', status: 'planned', starts_on: '2027-02-15', ends_on: '2028-02-15', payout_on: '2028-02-05', created_at: '', cycle_rules: RULES };

const renderHome = (qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GroupProvider value={MEMBERSHIP}><HomePage /></GroupProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return qc;
};

beforeEach(() => {
  cyclesQuery.mockReset();
  membersQuery.mockReset();
  membersQuery.mockResolvedValue({
    data: [
      { id: 'm1', full_name: 'Tafara', short_name: 'Tafara', role: 'member', status: 'active', linked: true },
      { id: 'm2', full_name: 'Chanda', short_name: 'Chanda', role: 'admin', status: 'active', linked: false },
      { id: 'm3', full_name: 'Mwila', short_name: 'Mwila', role: 'member', status: 'left', linked: true },
    ],
    error: null,
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T10:00:00'));
});
afterEach(() => vi.useRealTimers());

test('loading: a labelled skeleton, no content yet', () => {
  cyclesQuery.mockReturnValue(new Promise(() => {}));
  renderHome();
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(screen.queryByText('Cycle 2027')).toBeNull();
});

test('shows the cycle, its payout and the upcoming dates', async () => {
  cyclesQuery.mockResolvedValue({ data: [CYCLE], error: null });
  renderHome();
  expect(await screen.findByText('Hello, Tafara')).toBeInTheDocument();
  expect(await screen.findByText('Cycle 2027')).toBeInTheDocument();
  expect(screen.getByText('Starts soon')).toBeInTheDocument();
  expect(screen.getAllByText('5 Feb 2028').length).toBeGreaterThan(0);
  expect(screen.getByText('Cycle starts')).toBeInTheDocument();
});

test('headline tiles: payout countdown, rules figures and member count, each linking to its page', async () => {
  cyclesQuery.mockResolvedValue({ data: [CYCLE], error: null });
  renderHome();
  expect(await screen.findByText('In 485 days')).toBeInTheDocument(); // 8 Oct 2026 to 5 Feb 2028
  expect(screen.getByText('K 250')).toBeInTheDocument();
  expect(screen.getByText('15%')).toBeInTheDocument();
  expect(await screen.findByText('1 joined the app')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open the group' })).toHaveAttribute('href', '/group');
  expect(screen.getByRole('img', { name: /^Starts in 130 days\. 0% of the cycle has passed\.$/ })).toBeInTheDocument();
});

test('empty: says no cycle yet and offers a way to check again', async () => {
  cyclesQuery.mockResolvedValue({ data: [], error: null });
  renderHome();
  expect(await screen.findByText('No savings cycle yet')).toBeInTheDocument();
  cyclesQuery.mockResolvedValue({ data: [CYCLE], error: null });
  await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
  expect(await screen.findByText('Cycle 2027')).toBeInTheDocument();
});

test('error with nothing cached: friendly message and a working retry', async () => {
  cyclesQuery.mockResolvedValue({ data: null, error: { message: 'secret-detail', code: 'PGRST301' } });
  renderHome();
  expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired. Please sign in again.');
  expect(screen.queryByText(/secret-detail/)).toBeNull();
  cyclesQuery.mockResolvedValue({ data: [CYCLE], error: null });
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Cycle 2027')).toBeInTheDocument();
});

test('a failed background refetch keeps the cycle on screen', async () => {
  cyclesQuery.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  qc.setQueryData(['cycles', 'g1'], [{ ...CYCLE, rules: RULES }]); // as restored from the persisted cache
  renderHome(qc);
  expect(await screen.findByText('Cycle 2027')).toBeInTheDocument();
  await vi.waitFor(() => expect(qc.getQueryState(['cycles', 'g1'])?.status).toBe('error'));
  await act(() => new Promise((r) => setTimeout(r, 0))); // observers are notified on the next tick
  expect(screen.getByText('Cycle 2027')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});
