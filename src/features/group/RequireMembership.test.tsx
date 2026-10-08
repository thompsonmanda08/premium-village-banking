import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Membership } from './useMembership';

vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1', email: 'tafara@example.com' } }, loading: false }),
}));
const members = vi.fn();
const groups = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => ({ select: () => ({ eq: () => (table === 'members' ? members() : groups()) }) }) },
}));
const { RequireMembership } = await import('./RequireMembership');

const GROUP = { id: 'g1', name: 'Premium Village Banking', currency: 'ZMW', owner_user_id: 'x', figures_visibility: 'open' };
const MEMBER = { id: 'm1', group_id: 'g1', full_name: 'Tafara', short_name: 'Tafara', role: 'member', status: 'active', email: null };
const FOUND: Membership = { group: GROUP, member: MEMBER, isAdmin: false } as Membership;

const renderGuard = (qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Routes>
          <Route element={<RequireMembership />}>
            <Route index element={<p>App body</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return qc;
};

beforeEach(() => {
  members.mockReset();
  groups.mockReset();
});

test('loading: shows the loader, not the app', () => {
  members.mockReturnValue(new Promise(() => {}));
  groups.mockReturnValue(new Promise(() => {}));
  renderGuard();
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(screen.queryByText('App body')).toBeNull();
});

test('found: renders the app', async () => {
  members.mockResolvedValue({ data: [{ ...MEMBER, groups: GROUP }], error: null });
  groups.mockResolvedValue({ data: [], error: null });
  renderGuard();
  expect(await screen.findByText('App body')).toBeInTheDocument();
});

test('none: explains the account is not linked to a group', async () => {
  members.mockResolvedValue({ data: [], error: null });
  groups.mockResolvedValue({ data: [], error: null });
  renderGuard();
  expect(await screen.findByText('Your account isn’t linked to a group')).toBeInTheDocument();
  expect(screen.queryByText('App body')).toBeNull();
});

test('error with nothing cached: friendly message and a working retry', async () => {
  members.mockResolvedValue({ data: null, error: { message: 'JWT secret-detail', code: 'PGRST301' } });
  groups.mockResolvedValue({ data: [], error: null });
  renderGuard();
  expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired. Please sign in again.');
  expect(screen.queryByText(/secret-detail/)).toBeNull();
  members.mockResolvedValue({ data: [{ ...MEMBER, groups: GROUP }], error: null });
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('App body')).toBeInTheDocument();
});

test('a failed background refetch keeps the app up when membership is already cached', async () => {
  members.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
  groups.mockResolvedValue({ data: [], error: null });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['membership', 'u1'], FOUND); // as restored from the persisted cache
  renderGuard(qc);
  await waitFor(() => expect(qc.getQueryState(['membership', 'u1'])?.status).toBe('error'));
  expect(qc.getQueryData(['membership', 'u1'])).toBe(FOUND);
  expect(screen.getByText('App body')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});
