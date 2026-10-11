import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { DeclarationInbox } = await import('./DeclarationInbox');

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
const WALLETS = [{ id: 'w1', name: 'Airtel' }];
const render = (declarations: ReturnType<typeof declaration>[]) =>
  renderLedger(<DeclarationInbox periodId="p9" deadline="2026-10-07" declarations={declarations} members={MEMBERS} wallets={WALLETS} />, { isAdmin: true });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
});

test('groups live declarations by status with counts, naming each member', () => {
  render([
    declaration({ id: 'd1', member_id: 'm1', status: 'submitted' }),
    declaration({ id: 'd2', member_id: 'm2', status: 'returned', return_reason: 'Amount unclear' }),
    declaration({ id: 'd3', member_id: 'm1', status: 'approved', saving: 300 }),
  ]);
  expect(screen.getByRole('heading', { name: 'Waiting (1)' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Returned (1)' })).toBeInTheDocument();
  expect(screen.getByText('Approved (1)')).toBeInTheDocument();
  const waiting = screen.getAllByRole('listitem')[0]!;
  expect(within(waiting).getByText('Eve')).toBeInTheDocument();
  expect(within(waiting).getByText('Sending K 250 from Airtel')).toBeInTheDocument();
  expect(screen.getByText(/Amount unclear/)).toBeInTheDocument();
});

test('says so when nothing has been declared', () => {
  render([]);
  expect(screen.getByText('No declarations yet this month.')).toBeInTheDocument();
});

test('Approve needs a second tap, then sends once even if tapped again', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  render([declaration({ id: 'd1' })]);
  await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to approve' }));
  await userEvent.click(screen.getByRole('button', { name: /Approve/ }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('approve_declaration', { p_declaration: 'd1' });
});

test('Return needs a reason, then sends it', async () => {
  render([declaration({ id: 'd1' })]);
  await userEvent.click(screen.getByRole('button', { name: 'Return' }));
  await userEvent.click(screen.getByRole('button', { name: 'Return declaration' }));
  expect(await screen.findByText('Say what the member should fix.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText('Reason'), 'Amount does not match the receipt');
  await userEvent.click(screen.getByRole('button', { name: 'Return declaration' }));
  expect(rpc).toHaveBeenCalledWith('return_declaration', { p_declaration: 'd1', p_reason: 'Amount does not match the receipt' });
});

test('an approval refused because the declaration was already handled shows the friendly sentence', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'declaration_not_found', code: 'P0001' } });
  render([declaration({ id: 'd1' })]);
  await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to approve' }));
  expect(await screen.findByText('That declaration was already handled or replaced. Refresh and try again.')).toBeInTheDocument();
});

test('a waiting declaration shows when it arrived in local time, and flags a late one', () => {
  render([declaration({ id: 'd1', submitted_at: new Date(2026, 9, 8, 0, 30).toISOString() })]);
  expect(screen.getByText('Late · 8 Oct 2026 00:30')).toBeInTheDocument();
});

test('an on-time declaration is not flagged late', () => {
  render([declaration({ id: 'd1', submitted_at: new Date(2026, 9, 7, 23, 59).toISOString() })]);
  expect(screen.getByText('7 Oct 2026 23:59')).toBeInTheDocument();
  expect(screen.queryByText(/Late/)).toBeNull();
});

test('a waiting declaration says when the member already has an approved one this month', () => {
  render([
    declaration({ id: 'd1', member_id: 'm1', saving: 100, status: 'submitted' }),
    declaration({ id: 'd3', member_id: 'm1', saving: 300, status: 'approved' }),
  ]);
  const waiting = screen.getAllByRole('listitem')[0]!;
  expect(within(waiting).getByText('Also approved: K 300')).toBeInTheDocument();
});

test('the treasurer can type in the correction for a returned declaration', async () => {
  render([declaration({ id: 'd2', member_id: 'm2', status: 'returned', return_reason: 'Amount unclear', saving: 250, wallet_id: 'w1' })]);
  await userEvent.click(screen.getByRole('button', { name: 'Declare for Ann' }));
  expect(screen.getByLabelText('Savings')).toHaveValue('250');
  await userEvent.clear(screen.getByLabelText('Savings'));
  await userEvent.type(screen.getByLabelText('Savings'), '300');
  await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
  expect(rpc).toHaveBeenCalledWith('submit_declaration', expect.objectContaining({ p_period: 'p9', p_member: 'm2', p_saving: 300 }));
});

test('the treasurer can add another payment for a member who is already approved', async () => {
  render([declaration({ id: 'd3', member_id: 'm1', status: 'approved' })]);
  await userEvent.click(screen.getByText('Approved (1)'));
  await userEvent.click(screen.getByRole('button', { name: 'Add a payment for Eve' }));
  expect(screen.getByLabelText('Savings')).toHaveValue('');
});
