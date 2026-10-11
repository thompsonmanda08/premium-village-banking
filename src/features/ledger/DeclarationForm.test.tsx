import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, renderLedger } from './testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { DeclarationForm } = await import('./DeclarationForm');

const WALLETS = [{ id: 'w1', name: 'Airtel' }, { id: 'w2', name: 'MTN' }];
const onDone = vi.fn();
const renderForm = (initial?: ReturnType<typeof declaration>) =>
  renderLedger(<DeclarationForm periodId="p9" memberId="m1" wallets={WALLETS} initial={initial} onDone={onDone} />);

beforeEach(() => {
  rpc.mockReset();
  onDone.mockReset();
});

test('sends the typed amounts and the chosen wallet', async () => {
  rpc.mockResolvedValue({ data: {}, error: null });
  renderForm();
  await userEvent.type(screen.getByLabelText('Savings'), '250');
  await userEvent.type(screen.getByLabelText('Loan repayment'), '100.5');
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
  expect(rpc).toHaveBeenCalledWith('submit_declaration', {
    p_period: 'p9', p_member: 'm1', p_saving: 250, p_loan_repayment: 100.5, p_excess: 0, p_membership: 0, p_penalty: 0,
    p_txn_fee: 0, p_borrowing_request: 0, p_wallet: 'w1', p_note: undefined,
  });
  expect(await screen.findByText('Declaration sent to the treasurer.')).toBeInTheDocument();
  await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
});

test('refuses malformed amounts and sends nothing', async () => {
  renderForm();
  for (const bad of ['1,000', '250.555', '-5', '1e3']) {
    const field = screen.getByLabelText('Savings');
    await userEvent.clear(field);
    await userEvent.type(field, bad);
    await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
    expect(await screen.findByText('Use kwacha and ngwee, like 250 or 250.50.'), bad).toBeInTheDocument();
  }
  expect(rpc).not.toHaveBeenCalled();
});

test('needs at least one amount, and a wallet when money is sent', async () => {
  renderForm();
  await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
  expect(await screen.findByText('Enter at least one amount.')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Savings'), '250');
  await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
  expect(await screen.findByText('Choose the wallet you paid from.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('a refusal from the database shows the friendly sentence and keeps what was typed', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'period_not_open', code: 'P0001' } });
  renderForm();
  await userEvent.type(screen.getByLabelText('Savings'), '250');
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w2');
  await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
  expect(await screen.findByText('That month isn’t open. Pick the current month, or open it first.')).toBeInTheDocument();
  expect(screen.getByLabelText('Savings')).toHaveValue('250');
  expect(onDone).not.toHaveBeenCalled();
});

test('a double tap sends one request', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderForm();
  await userEvent.type(screen.getByLabelText('Savings'), '250');
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  const submit = screen.getByRole('button', { name: 'Submit declaration' });
  await userEvent.click(submit);
  await userEvent.click(submit);
  expect(rpc).toHaveBeenCalledTimes(1);
});

test('editing a returned declaration starts from its figures', () => {
  renderForm(declaration({ saving: 250, note: 'May payment', status: 'returned' }));
  expect(screen.getByLabelText('Savings')).toHaveValue('250');
  expect(screen.getByLabelText('Wallet')).toHaveValue('w1');
  expect(screen.getByLabelText('Note (optional)')).toHaveValue('May payment');
});
