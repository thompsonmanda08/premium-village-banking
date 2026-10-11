import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, renderLedger, year } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const hooks = vi.hoisted(() => ({ cycle: vi.fn(), wallets: vi.fn(), declarations: vi.fn(), minimum: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useWallets: () => hooks.wallets(),
  useDeclarations: () => hooks.declarations(),
  useMinimumPayable: () => hooks.minimum(),
}));
const { DeclarePage } = await import('./DeclarePage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const OPEN = ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8, 'open') });
const NOT_OPEN = ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8) });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T10:00:00'));
  rpc.mockReset();
  hooks.cycle.mockReturnValue(OPEN);
  hooks.wallets.mockReturnValue(ok([{ id: 'w1', name: 'Airtel' }]));
  hooks.declarations.mockReturnValue(ok([]));
  hooks.minimum.mockReturnValue(ok(300));
});

test('a member profile is required: no request, a clear message', () => {
  renderLedger(<DeclarePage />, { member: null });
  expect(screen.getByText('Your account isn’t linked to a member')).toBeInTheDocument();
  expect(screen.queryByLabelText('Savings')).toBeNull();
});

test('no open month: says so, shows no form', () => {
  hooks.cycle.mockReturnValue(NOT_OPEN);
  renderLedger(<DeclarePage />);
  expect(screen.getByText('Next month isn’t open yet')).toBeInTheDocument();
  expect(screen.getByText(/Sep 2026/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Savings')).toBeNull();
});

test('loading shows a labelled skeleton; a failed load offers a retry', () => {
  hooks.cycle.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderLedger(<DeclarePage />);
  expect(screen.getByText('Loading your declaration')).toBeInTheDocument();
  unmount();
  hooks.cycle.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch: vi.fn() });
  renderLedger(<DeclarePage />);
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

test('open month, nothing declared: deadline, minimum hint and the form', () => {
  renderLedger(<DeclarePage />);
  expect(screen.getByText('7 Oct 2026')).toBeInTheDocument();
  expect(screen.getByText('2 days left')).toBeInTheDocument();
  expect(screen.getByText('K 300')).toBeInTheDocument();
  expect(screen.getByLabelText('Savings')).toBeInTheDocument();
});

test('a waiting declaration shows its status and offers Edit before the form', async () => {
  hooks.declarations.mockReturnValue(ok([declaration({ status: 'submitted' })]));
  renderLedger(<DeclarePage />);
  expect(screen.getByText('Waiting for the treasurer')).toBeInTheDocument();
  expect(screen.queryByLabelText('Savings')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(screen.getByLabelText('Savings')).toHaveValue('250');
});

test('a returned declaration shows the reason and the prefilled form', () => {
  hooks.declarations.mockReturnValue(ok([declaration({ status: 'returned', return_reason: 'Amount does not match the receipt' })]));
  renderLedger(<DeclarePage />);
  expect(screen.getByText('Returned by the treasurer')).toBeInTheDocument();
  expect(screen.getByText('Amount does not match the receipt')).toBeInTheDocument();
  expect(screen.getByLabelText('Savings')).toHaveValue('250');
});

test('a resubmitted declaration shows only the live one', () => {
  hooks.declarations.mockReturnValue(
    ok([declaration({ id: 'd2', saving: 400, supersedes_id: 'd1' }), declaration({ id: 'd1', saving: 250, status: 'returned' })]),
  );
  renderLedger(<DeclarePage />);
  expect(screen.getByText('K 400')).toBeInTheDocument();
  expect(screen.queryByText('K 250')).toBeNull();
});

test('an approved declaration is read-only; another payment can still be declared', async () => {
  hooks.declarations.mockReturnValue(ok([declaration({ status: 'approved' })]));
  renderLedger(<DeclarePage />);
  expect(screen.getByText('Approved')).toBeInTheDocument();
  expect(screen.queryByLabelText('Savings')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Declare another payment' }));
  expect(screen.getByLabelText('Savings')).toHaveValue('');
});
