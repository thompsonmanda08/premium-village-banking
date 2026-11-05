import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, renderLedger } from './testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const proofLib = vi.hoisted(() => ({ prepareProof: vi.fn(), uploadProof: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/lib/proof', () => ({ ...proofLib, PROOF_ACCEPT: 'image/jpeg', fetchProof: vi.fn() }));
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

test('the less common amounts start folded, open when they hold a figure, and the total follows what is typed', async () => {
  const { container } = renderForm();
  const groups = () => [...container.querySelectorAll('details')].map((d) => d.open);
  expect(groups()).toEqual([false, false]);
  await userEvent.type(screen.getByLabelText('Savings'), '250');
  await userEvent.type(screen.getByLabelText('Loan repayment'), '100.50');
  expect(screen.getByText('You are sending').nextElementSibling).toHaveTextContent('350.50');
});

test('a saved declaration with a penalty opens Other charges, and a group opened by hand stays open when a box is cleared', async () => {
  const { container, unmount } = renderForm(declaration({ penalty: 50 }));
  expect([...container.querySelectorAll('details')].map((d) => d.open)).toEqual([true, false]);
  unmount();

  const fresh = renderForm();
  await userEvent.click(screen.getByText('Other charges'));
  const penalty = screen.getByLabelText('Penalty');
  await userEvent.type(penalty, '5');
  await userEvent.clear(penalty);
  expect(fresh.container.querySelectorAll('details')[0]!.open).toBe(true);
});

const PHOTO = () => new File(['x'], 'payment.jpg', { type: 'image/jpeg' });
const sendWithProof = async () => {
  await userEvent.type(screen.getByLabelText('Savings'), '250');
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  await userEvent.upload(screen.getByLabelText('Proof of payment (optional)'), PHOTO());
  await userEvent.click(screen.getByRole('button', { name: 'Submit declaration' }));
};

test('a chosen proof is uploaded to the month after the declaration is sent', async () => {
  rpc.mockResolvedValue({ data: {}, error: null });
  const prepared = new Blob(['small'], { type: 'image/jpeg' });
  proofLib.prepareProof.mockResolvedValue(prepared);
  proofLib.uploadProof.mockResolvedValue('proof-1');
  renderForm();
  await sendWithProof();
  await vi.waitFor(() => expect(proofLib.uploadProof).toHaveBeenCalledWith('p9', 'm1', prepared));
  expect(rpc).toHaveBeenCalledWith('submit_declaration', expect.anything());
});

test('a proof that cannot be uploaded does not undo the declaration, and says so', async () => {
  rpc.mockResolvedValue({ data: {}, error: null });
  proofLib.prepareProof.mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
  proofLib.uploadProof.mockRejectedValue(Object.assign(new Error('upload_failed'), { code: 'upload_failed' }));
  renderForm();
  await sendWithProof();
  expect(await screen.findByText(/Declaration sent, but the proof was not attached/)).toBeInTheDocument();
  await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
});

test('a file that cannot be used is refused on its field and nothing is sent', async () => {
  proofLib.prepareProof.mockRejectedValue(Object.assign(new Error('file_too_large'), { code: 'file_too_large' }));
  renderForm();
  await sendWithProof();
  expect(await screen.findByText(/too big/i)).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});
