import { screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, renderLedger, year } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const hooks = vi.hoisted(() => ({ cycle: vi.fn(), wallets: vi.fn(), declarations: vi.fn(), members: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useWallets: () => hooks.wallets(),
  useDeclarations: () => hooks.declarations(),
}));
vi.mock('@/features/group/GroupPage', () => ({ useGroupMembers: () => hooks.members() }));
const { DeskPage } = await import('./DeskPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const MEMBER_ROWS = [
  { id: 'm1', short_name: 'Eve', status: 'active' },
  { id: 'm2', short_name: 'Ann', status: 'active' },
  { id: 'm3', short_name: 'Old', status: 'left' },
];

beforeEach(() => {
  rpc.mockReset();
  hooks.cycle.mockReset();
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8, 'open') }));
  hooks.wallets.mockReturnValue(ok([{ id: 'w1', name: 'Airtel' }]));
  hooks.declarations.mockReturnValue(ok([declaration({ member_id: 'm1' })]));
  hooks.members.mockReturnValue(ok(MEMBER_ROWS));
});

test('members get the admins-only screen and no ledger request is made', () => {
  renderLedger(<DeskPage />, { isAdmin: false });
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(hooks.cycle).not.toHaveBeenCalled();
  expect(screen.queryByText(/is open/)).toBeNull();
});

test('admin with an open month sees the month panel, the inbox and who has not declared', () => {
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByText('Oct 2026 is open')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Waiting (1)' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Not yet declared' })).toBeInTheDocument();
  expect(screen.getByText('Ann')).toBeInTheDocument();
  expect(screen.queryByText('Old')).toBeNull();
});

test('admin with the next month still to open sees the open button and no inbox', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8) }));
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByRole('button', { name: 'Open Oct 2026' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /Waiting/ })).toBeNull();
});

test('no active cycle: an empty state', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: null, periods: [] }));
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByText('No active cycle')).toBeInTheDocument();
});

test('loading and failure states', () => {
  hooks.cycle.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByText('Loading the desk')).toBeInTheDocument();
  unmount();
  hooks.cycle.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'not_admin', code: '42501' }, refetch: vi.fn() });
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByText('Only admins can do this.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

test('keeps the way to the ledger check', () => {
  renderLedger(<DeskPage />, { isAdmin: true });
  expect(screen.getByRole('link', { name: 'Open the ledger check' })).toHaveAttribute('href', '/desk/ledger-check');
});
