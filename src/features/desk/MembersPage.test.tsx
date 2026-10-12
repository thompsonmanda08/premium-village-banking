import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { memberStatus, renderLedger, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ members: vi.fn(), cycle: vi.fn(), statuses: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/features/group/GroupPage', () => ({ useGroupMembers: () => hooks.members() }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useMemberStatuses: () => hooks.statuses(),
}));
const { MembersPage } = await import('./MembersPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const ROWS = [
  { id: 'm1', short_name: 'Eve', full_name: 'Eve Example', status: 'active' },
  { id: 'm2', short_name: 'Ann', full_name: 'Ann Example', status: 'active' },
  { id: 'm3', short_name: 'Old', full_name: 'Old Example', status: 'left' },
];
const renderPage = (isAdmin = true) => renderLedger(<MembersPage />, { isAdmin });

beforeEach(() => {
  hooks.members.mockReturnValue(ok(ROWS));
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8, 'open') }));
  hooks.statuses.mockReturnValue(ok([]));
});

test('members get the admins-only screen and no ledger request is made', () => {
  renderPage(false);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(hooks.members).not.toHaveBeenCalled();
});

test('lists active members alphabetically, each linking to their ledger; members who left are not listed', () => {
  renderPage();
  const links = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/desk/members/'));
  expect(links.map((l) => l.textContent)).toEqual(['Ann', 'Eve']);
  expect(links.map((l) => l.getAttribute('href'))).toEqual(['/desk/members/m2', '/desk/members/m1']);
  expect(screen.queryByText('Old')).toBeNull();
});

test('a defaulted member carries a badge', () => {
  hooks.statuses.mockReturnValue(ok([memberStatus({ member_id: 'm1', defaulted: true }), memberStatus({ id: 'ms2', member_id: 'm2', defaulted: false })]));
  renderPage();
  const eve = screen.getByRole('link', { name: 'Eve' }).closest('li')!;
  expect(eve).toHaveTextContent('Defaulted');
  expect(screen.getByRole('link', { name: 'Ann' }).closest('li')).not.toHaveTextContent('Defaulted');
});

test('if the default flags cannot be loaded the list still shows, with a note', () => {
  hooks.statuses.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch: vi.fn() });
  renderPage();
  expect(screen.getByRole('link', { name: 'Eve' })).toBeInTheDocument();
  expect(screen.getByText('Default flags could not be loaded just now.')).toBeInTheDocument();
});

test('no active members says so', () => {
  hooks.members.mockReturnValue(ok([ROWS[2]]));
  renderPage();
  expect(screen.getByText('No active members.')).toBeInTheDocument();
});

test('loading and failure', async () => {
  hooks.members.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderPage();
  expect(screen.getByText('Loading the members')).toBeInTheDocument();
  unmount();
  const refetch = vi.fn();
  hooks.members.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch });
  renderPage();
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
});
