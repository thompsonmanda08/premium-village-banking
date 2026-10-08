import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import { ToastProvider } from '@/ui';

const MEMBER = {
  id: 'm2', group_id: 'g1', user_id: 'u2', full_name: 'Sapi Mulimbika', short_name: 'Sapi', email: 'sapi@example.com', phone: null,
  role: 'admin', status: 'active', joined_on: '2026-01-01', created_at: '2026-01-01T00:00:00Z', invites: [],
};
const order = vi.fn();
const updateSelect = vi.fn();
const update = vi.fn(() => ({ eq: () => ({ select: updateSelect }) }));
const rpc = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order }) }), update }), rpc },
}));
const { PeopleSection } = await import('./PeopleSection');

beforeEach(() => {
  order.mockReset().mockResolvedValue({ data: [MEMBER], error: null });
  updateSelect.mockReset().mockResolvedValue({ data: [{ id: 'm2' }], error: null });
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  update.mockClear();
});

async function renderPeople() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <GroupProvider value={{ group: { id: 'g1', name: 'Premium', currency: 'ZMW', owner_user_id: 'o', figures_visibility: 'open' }, member: null, isAdmin: true }}>
          <PeopleSection />
        </GroupProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  await userEvent.click(await screen.findByText('Sapi Mulimbika'));
}

test('lists each member with role and joined state as text', async () => {
  await renderPeople();
  expect(screen.getByText('Admin')).toBeInTheDocument();
  expect(screen.getByText('Joined')).toBeInTheDocument();
});

test('marking a member as left needs a second tap', async () => {
  await renderPeople();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as left' }));
  expect(update).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to mark as left' }));
  expect(update).toHaveBeenCalledWith({ status: 'left' });
  expect(await screen.findByText('Sapi marked as left')).toBeInTheDocument();
});

test('the database refusing to drop the last admin shows the plain-language reason', async () => {
  updateSelect.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'last_admin' } });
  await renderPeople();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as left' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to mark as left' }));
  expect(await screen.findByText('The group needs at least one admin. Make someone else an admin first.')).toBeInTheDocument();
  expect(screen.queryByText('Sapi marked as left')).toBeNull();
});

test('removing admin needs a second tap and goes through set_admin', async () => {
  await renderPeople();
  await userEvent.click(screen.getByRole('button', { name: 'Remove admin' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to remove admin' }));
  expect(rpc).toHaveBeenCalledWith('set_admin', { p_member_id: 'm2', p_make_admin: false });
});
