import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import { ToastProvider } from '@/ui';

const BASE = { group_id: 'g1', phone: null, joined_on: '2026-01-01', created_at: '2026-01-01T00:00:00Z', status: 'active', invites: [] };
const ADMIN = { ...BASE, id: 'm2', user_id: 'u2', full_name: 'Sapi Mulimbika', short_name: 'Sapi', email: 'sapi@example.com', role: 'admin' };
const PLAIN = { ...BASE, id: 'm3', user_id: 'u3', full_name: 'Tafara Moyo', short_name: 'Tafara', email: null, role: 'member' };
const invite = (over: object) => ({ id: 'i1', email: 'charles@exmaple.com', created_at: '2026-10-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z', accepted_at: null, revoked_at: null, ...over });
const INVITED = { ...BASE, id: 'm4', user_id: null, full_name: 'Charles Banda', short_name: 'Charles', email: 'charles@exmaple.com', role: 'member', invites: [invite({})] };
const LAPSED = { ...BASE, id: 'm5', user_id: null, full_name: 'Heri Phiri', short_name: 'Heri', email: 'heri@example.com', role: 'member', invites: [invite({ id: 'i2', email: 'heri@exmaple.com', expires_at: '2026-10-05T00:00:00Z' })] };

const invokeInvite = vi.fn();
vi.mock('@/lib/functions', () => ({ invokeInvite }));
const from = vi.fn();
const order = vi.fn();
const updateSelect = vi.fn();
const insertSelect = vi.fn();
const update = vi.fn(() => ({ eq: () => ({ select: updateSelect }) }));
const insert = vi.fn(() => ({ select: insertSelect }));
const rpc = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      from(table);
      return { select: () => ({ eq: () => ({ order }) }), update, insert };
    },
    rpc,
  },
}));
const { PeopleSection } = await import('./PeopleSection');

beforeEach(() => {
  from.mockClear();
  update.mockClear();
  insert.mockClear();
  order.mockReset().mockResolvedValue({ data: [ADMIN], error: null });
  updateSelect.mockReset().mockResolvedValue({ data: [{ id: 'x' }], error: null });
  insertSelect.mockReset().mockResolvedValue({ data: [{ id: 'new' }], error: null });
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  invokeInvite.mockReset().mockResolvedValue({ expiresAt: '2099-01-01T00:00:00Z' });
});

async function renderPeople(members: object[] = [ADMIN], openName?: string, viewerId?: string) {
  order.mockResolvedValue({ data: members, error: null });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <GroupProvider value={{
            group: { id: 'g1', name: 'Premium', currency: 'ZMW', owner_user_id: 'o', figures_visibility: 'open' },
            member: viewerId ? { id: viewerId, group_id: 'g1', full_name: 'Viewer', short_name: 'Viewer', role: 'admin', status: 'active', email: null } : null,
            isAdmin: true,
          }}
        >
          <PeopleSection />
        </GroupProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  const first = openName ?? (members[0] as { full_name: string }).full_name;
  await userEvent.click(await screen.findByText(first));
  return () => within(screen.getByText(first).closest('details')!);
}

test('lists each member with role and joined state as text', async () => {
  await renderPeople();
  expect(screen.getByText('Admin')).toBeInTheDocument();
  expect(screen.getByText('Joined')).toBeInTheDocument();
});

test('a pending or lapsed invite shows the address it went to next to its expiry, so a typo is visible', async () => {
  await renderPeople([INVITED, LAPSED]);
  expect(screen.getByText(/Sent to charles@exmaple\.com/)).toHaveTextContent(/Expires/);
  expect(screen.getByText(/Sent to heri@exmaple\.com/)).toHaveTextContent(/Expired/);
});

test('marking a member as left needs a second tap', async () => {
  const row = await renderPeople([PLAIN]);
  await userEvent.click(row().getByRole('button', { name: 'Mark as left' }));
  expect(update).not.toHaveBeenCalled();
  await userEvent.click(row().getByRole('button', { name: 'Tap again to mark as left' }));
  expect(update).toHaveBeenCalledWith({ status: 'left' });
  expect(rpc).not.toHaveBeenCalled(); // a plain member has no admin rights to drop
  expect(await screen.findByText('Tafara marked as left')).toBeInTheDocument();
});

test('marking an admin as left takes the admin role away first, then sets the status', async () => {
  const row = await renderPeople([ADMIN]);
  await userEvent.click(row().getByRole('button', { name: 'Mark as left' }));
  await userEvent.click(row().getByRole('button', { name: 'Tap again to mark as left' }));
  expect(rpc).toHaveBeenCalledWith('set_admin', { p_member_id: 'm2', p_make_admin: false });
  expect(update).toHaveBeenCalledWith({ status: 'left' });
  expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]!);
  expect(await screen.findByText('Sapi marked as left')).toBeInTheDocument();
});

test('the last admin cannot be marked left: the refusal shows, the status is not touched', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'last_admin' } });
  const row = await renderPeople([ADMIN]);
  await userEvent.click(row().getByRole('button', { name: 'Mark as left' }));
  await userEvent.click(row().getByRole('button', { name: 'Tap again to mark as left' }));
  expect(await screen.findByText('The group needs at least one admin. Make someone else an admin first.')).toBeInTheDocument();
  expect(update).not.toHaveBeenCalled();
  expect(screen.queryByText('Sapi marked as left')).toBeNull();
});

test('a status update the database refuses shows its reason, never the success toast', async () => {
  updateSelect.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'last_admin' } });
  const row = await renderPeople([PLAIN]);
  await userEvent.click(row().getByRole('button', { name: 'Mark as left' }));
  await userEvent.click(row().getByRole('button', { name: 'Tap again to mark as left' }));
  expect(await screen.findByText('The group needs at least one admin. Make someone else an admin first.')).toBeInTheDocument();
  expect(screen.queryByText('Tafara marked as left')).toBeNull();
});

test('removing admin needs a second tap and goes through set_admin', async () => {
  const row = await renderPeople([ADMIN]);
  await userEvent.click(row().getByRole('button', { name: 'Remove admin' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(row().getByRole('button', { name: 'Tap again to remove admin' }));
  expect(rpc).toHaveBeenCalledWith('set_admin', { p_member_id: 'm2', p_make_admin: false });
});

test('cancelling an invite needs a second tap', async () => {
  const row = await renderPeople([INVITED]);
  await userEvent.click(row().getByRole('button', { name: 'Cancel invite' }));
  expect(update).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalledWith('invites');
  await userEvent.click(row().getByRole('button', { name: 'Tap again to cancel the invite' }));
  expect(from).toHaveBeenCalledWith('invites');
  expect(update).toHaveBeenCalledWith({ revoked_at: expect.any(String) });
  expect(await screen.findByText('Invite cancelled')).toBeInTheDocument();
});

test('editing: a blank name, a long short name or a bad email shows a field error and sends nothing', async () => {
  const row = await renderPeople([PLAIN]);
  await userEvent.clear(row().getByLabelText('Full name'));
  await userEvent.click(row().getByRole('button', { name: 'Save details' }));
  expect(row().getByText('Enter the member’s full name.')).toBeInTheDocument();
  await userEvent.type(row().getByLabelText('Full name'), 'Tafara Moyo');
  await userEvent.clear(row().getByLabelText('Short name'));
  await userEvent.type(row().getByLabelText('Email'), 'not-an-email');
  await userEvent.click(row().getByRole('button', { name: 'Save details' }));
  expect(row().getByText('Enter a short name.')).toBeInTheDocument();
  expect(row().getByText('Enter a valid email address.')).toBeInTheDocument();
  expect(update).not.toHaveBeenCalled();
});

test('editing: valid details are saved with a trimmed, nullable email', async () => {
  const row = await renderPeople([PLAIN]);
  await userEvent.type(row().getByLabelText('Email'), ' tafara@example.com ');
  await userEvent.click(row().getByRole('button', { name: 'Save details' }));
  expect(update).toHaveBeenCalledWith({ full_name: 'Tafara Moyo', short_name: 'Tafara', email: 'tafara@example.com', phone: null });
  expect(await screen.findByText('Details saved')).toBeInTheDocument();
});

test('a mistyped email blocks Send invite instead of reaching the server', async () => {
  const row = await renderPeople([{ ...INVITED, invites: [], email: null }]);
  await userEvent.type(row().getByLabelText('Email'), 'charles@example');
  await userEvent.click(row().getByRole('button', { name: 'Send invite' }));
  expect(row().getByText('Enter a valid email address.')).toBeInTheDocument();
  expect(invokeInvite).not.toHaveBeenCalled();
});

test('a valid email sends the invite to exactly that address', async () => {
  const row = await renderPeople([{ ...INVITED, invites: [], email: null }]);
  await userEvent.type(row().getByLabelText('Email'), 'charles@example.com');
  await userEvent.click(row().getByRole('button', { name: 'Send invite' }));
  expect(invokeInvite).toHaveBeenCalledWith('m4', 'charles@example.com');
  expect(await screen.findByText('Invite sent to charles@example.com')).toBeInTheDocument();
});

test('your own row has no "Mark as left" (it would demote you, then fail as a non-admin), only a note; Remove admin stays', async () => {
  const row = await renderPeople([ADMIN], undefined, 'm2');
  expect(row().queryByRole('button', { name: 'Mark as left' })).toBeNull();
  expect(row().getByText('Another admin can mark you as left.')).toBeInTheDocument();
  expect(row().getByRole('button', { name: 'Remove admin' })).toBeInTheDocument();
});

test('another admin\'s row still offers "Mark as left"', async () => {
  const row = await renderPeople([ADMIN], undefined, 'm9');
  expect(row().getByRole('button', { name: 'Mark as left' })).toBeInTheDocument();
  expect(row().queryByText('Another admin can mark you as left.')).toBeNull();
});

test('adding: a first name too long to be a short name is caught before the insert', async () => {
  await renderPeople([PLAIN]);
  const add = within(screen.getByText('Add a member').closest('details')!);
  await userEvent.type(add.getByLabelText('Full name'), `${'a'.repeat(41)} Banda`);
  await userEvent.click(add.getByRole('button', { name: 'Add member' }));
  expect(add.getByText('Use 40 characters or fewer.')).toBeInTheDocument();
  expect(insert).not.toHaveBeenCalled();
});

test('adding: the short name defaults to the first name', async () => {
  await renderPeople([PLAIN]);
  const add = within(screen.getByText('Add a member').closest('details')!);
  await userEvent.type(add.getByLabelText('Full name'), 'Test Person');
  await userEvent.click(add.getByRole('button', { name: 'Add member' }));
  expect(insert).toHaveBeenCalledWith({ group_id: 'g1', full_name: 'Test Person', short_name: 'Test' });
  expect(await screen.findByText('Member added')).toBeInTheDocument();
});
