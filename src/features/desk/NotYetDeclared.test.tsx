import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { NotYetDeclared } = await import('./NotYetDeclared');

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
const WALLETS = [{ id: 'w1', name: 'Airtel' }];

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
});

test('lists only members with no live declaration', () => {
  renderLedger(<NotYetDeclared periodId="p9" members={MEMBERS} declarations={[declaration({ member_id: 'm1' })]} wallets={WALLETS} />, { isAdmin: true });
  expect(screen.getByText('Ann')).toBeInTheDocument();
  expect(screen.queryByText('Eve')).toBeNull();
});

test('renders nothing when everyone has declared', () => {
  const { container } = renderLedger(
    <NotYetDeclared periodId="p9" members={MEMBERS} declarations={[declaration({ member_id: 'm1' }), declaration({ id: 'd2', member_id: 'm2' })]} wallets={WALLETS} />,
    { isAdmin: true },
  );
  expect(container.querySelector('h3')).toBeNull();
});

test('declares on a member’s behalf', async () => {
  renderLedger(<NotYetDeclared periodId="p9" members={MEMBERS} declarations={[]} wallets={WALLETS} />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Declare for Ann' }));
  await userEvent.type(screen.getByLabelText('Savings'), '250');
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
  expect(rpc).toHaveBeenCalledWith('submit_declaration', expect.objectContaining({ p_period: 'p9', p_member: 'm2', p_saving: 250, p_wallet: 'w1' }));
});
