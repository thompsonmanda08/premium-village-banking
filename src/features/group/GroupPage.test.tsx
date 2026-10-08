import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { GroupProvider } from './GroupContext';
import type { GroupRow, Membership } from './useMembership';

const membersQuery = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => membersQuery() }) }) }) },
}));
const { GroupPage } = await import('./GroupPage');

const GROUP: GroupRow = { id: 'g1', name: 'Premium Village Banking', currency: 'ZMW', owner_user_id: 'x', figures_visibility: 'open' };
const membership = (group: GroupRow = GROUP): Membership => ({ group, member: null, isAdmin: false });
const ROWS = [
  { id: 'm1', group_id: 'g1', full_name: 'Nsama', short_name: 'Nsama', role: 'admin', status: 'active', linked: true },
  { id: 'm2', group_id: 'g1', full_name: 'Sapi Mulimbika', short_name: 'Sapi', role: 'member', status: 'active', linked: false },
  { id: 'm3', group_id: 'g1', full_name: 'Heri', short_name: 'Heri', role: 'member', status: 'left', linked: true },
];

const renderGroup = (qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }), group?: GroupRow) => {
  render(
    <QueryClientProvider client={qc}>
      <GroupProvider value={membership(group)}><GroupPage /></GroupProvider>
    </QueryClientProvider>,
  );
  return qc;
};

beforeEach(() => {
  membersQuery.mockReset();
});

test('loading: a labelled skeleton, no list yet', () => {
  membersQuery.mockReturnValue(new Promise(() => {}));
  renderGroup();
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(screen.queryByRole('list')).toBeNull();
});

test('lists name, role and whether each member has joined, plus the visibility notice', async () => {
  membersQuery.mockResolvedValue({ data: ROWS, error: null });
  renderGroup();
  const items = await screen.findAllByRole('listitem');
  expect(items).toHaveLength(3);
  expect(within(items[0]!).getByText('Nsama')).toBeInTheDocument();
  expect(within(items[0]!).getByText('Admin')).toBeInTheDocument();
  expect(within(items[1]!).getByText('Not joined')).toBeInTheDocument();
  expect(within(items[2]!).getByText('Left')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Group' }).parentElement).toHaveTextContent('2 active members');
  expect(screen.getByText('Everyone in the group can see each member’s figures.')).toBeInTheDocument();
});

test('private mode changes the one-line notice', async () => {
  membersQuery.mockResolvedValue({ data: ROWS, error: null });
  renderGroup(undefined, { ...GROUP, figures_visibility: 'private' });
  expect(await screen.findByText(/Members see only their own figures/)).toBeInTheDocument();
});

test('empty: says there are no members and offers a way to check again', async () => {
  membersQuery.mockResolvedValue({ data: [], error: null });
  renderGroup();
  expect(await screen.findByText('No members yet')).toBeInTheDocument();
  membersQuery.mockResolvedValue({ data: ROWS, error: null });
  await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
  expect(await screen.findByText('Sapi Mulimbika')).toBeInTheDocument();
});

test('error with nothing cached: friendly message and a working retry', async () => {
  membersQuery.mockResolvedValue({ data: null, error: { message: 'secret-detail', code: 'PGRST301' } });
  renderGroup();
  expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired. Please sign in again.');
  expect(screen.queryByText(/secret-detail/)).toBeNull();
  membersQuery.mockResolvedValue({ data: ROWS, error: null });
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Sapi Mulimbika')).toBeInTheDocument();
});

test('the Refresh button is the equivalent of pulling to refresh', async () => {
  membersQuery.mockResolvedValue({ data: ROWS, error: null });
  renderGroup();
  await screen.findByText('Sapi Mulimbika');
  membersQuery.mockResolvedValue({ data: [...ROWS, { id: 'm4', group_id: 'g1', full_name: 'Tafara', short_name: 'Tafara', role: 'member', status: 'active', linked: true }], error: null });
  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText('Tafara')).toBeInTheDocument();
});

test('a failed background refetch keeps the list on screen', async () => {
  membersQuery.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  qc.setQueryData(['group-members', 'g1'], ROWS);
  renderGroup(qc);
  await vi.waitFor(() => expect(qc.getQueryState(['group-members', 'g1'])?.status).toBe('error'));
  await act(() => new Promise((r) => setTimeout(r, 0))); // observers are notified on the next tick
  expect(screen.getByText('Sapi Mulimbika')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});
