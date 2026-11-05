import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger, statement, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ members: vi.fn(), cycle: vi.fn(), statuses: vi.fn(), payout: vi.fn(), statements: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/features/group/GroupPage', () => ({ useGroupMembers: () => hooks.members() }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useMemberStatuses: () => hooks.statuses(),
  useGroupPayout: (...a: unknown[]) => hooks.payout(...a),
  useCycleStatements: () => hooks.statements(),
}));
const { PoolPage } = await import('./PoolPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const row = (id: string, name: string, savings: number, payout: number) => ({ member_id: id, short_name: name, savings, interest_earned: 0, owed: 0, pot_share: 0, payout });

beforeEach(() => {
  hooks.members.mockReturnValue(ok([
    { id: 'm1', short_name: 'Eve', full_name: 'Eve Example', status: 'active' },
    { id: 'm2', short_name: 'Ann', full_name: 'Ann Example', status: 'active' },
  ]));
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8, 'open') }));
  hooks.statuses.mockReturnValue(ok([]));
  hooks.payout.mockReturnValue(ok([row('m1', 'Eve', 1000, 1100), row('m2', 'Ann', 3000, 3300)]));
  hooks.statements.mockReturnValue(ok([
    statement({ id: 's1', member_id: 'm1', period_id: 'p7', cum_savings: 1000 }),
    statement({ id: 's2', member_id: 'm2', period_id: 'p7', cum_savings: 3000 }),
  ]));
});

test('members get the admins-only screen and no request is made', () => {
  renderLedger(<PoolPage />);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(hooks.payout).not.toHaveBeenCalled();
});

test('pool lines, member rows by savings, totals and sorting', async () => {
  renderLedger(<PoolPage />, { isAdmin: true });
  expect(screen.getByText('= Estimated payout pool').nextElementSibling).toHaveTextContent('4,400');
  const body = () => within(screen.getAllByRole('rowgroup')[1]!).getAllByRole('row').map((r) => within(r).getAllByRole('link')[0]!.textContent);
  expect(body()).toEqual(['Ann', 'Eve']);
  await userEvent.click(screen.getByRole('button', { name: /^Savings/ }));
  expect(screen.getByRole('columnheader', { name: /^Savings/ })).toHaveAttribute('aria-sort', 'ascending');
  expect(body()).toEqual(['Eve', 'Ann']);
  expect(screen.getByRole('row', { name: /^Total/ })).toHaveTextContent('4,000');
});

test('empty cycle shows the empty state', () => {
  hooks.members.mockReturnValue(ok([]));
  hooks.payout.mockReturnValue(ok([]));
  hooks.statements.mockReturnValue(ok([]));
  renderLedger(<PoolPage />, { isAdmin: true });
  expect(screen.getByText('Nothing to show yet')).toBeInTheDocument();
});

test('an error shows a retry that asks again', async () => {
  const refetch = vi.fn();
  hooks.payout.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('boom'), refetch });
  renderLedger(<PoolPage />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
});

test('a defaulted member carries a badge, and the picker changes the donut centre', async () => {
  hooks.statuses.mockReturnValue(ok([{ member_id: 'm1', defaulted: true }]));
  renderLedger(<PoolPage />, { isAdmin: true });
  expect(screen.getAllByText('Defaulted').length).toBeGreaterThan(0);
  const share = document.querySelector('[aria-labelledby="share-heading"]') as HTMLElement;
  expect(share).toHaveTextContent('75.0%'); // Ann, the largest saver, is the default
  await userEvent.selectOptions(within(share).getByLabelText('Member'), 'm1');
  expect(share).toHaveTextContent('25.0%');
});
