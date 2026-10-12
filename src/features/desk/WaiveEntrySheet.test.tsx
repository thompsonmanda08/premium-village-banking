import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { entry, renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { WaiveEntrySheet } = await import('./WaiveEntrySheet');

const PENALTY = entry({ id: 'e1', kind: 'penalty', amount: 120, source: 'app' });
const onClose = vi.fn();
const renderSheet = (current = 120) => renderLedger(<WaiveEntrySheet entry={PENALTY} current={current} onClose={onClose} />, { isAdmin: true });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
  onClose.mockReset();
});

test('shows the charge and how much is still charged', () => {
  renderSheet(80);
  expect(screen.getByText('Penalty')).toBeInTheDocument();
  expect(screen.getByText('Still charged').nextElementSibling).toHaveTextContent('K 80');
});

test('zero, blank and malformed amounts are refused before any request', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post waiver' }));
  expect(await screen.findByText('Enter an amount above zero.')).toBeInTheDocument();
  for (const bad of ['0', '1,000', '-5', '1e3']) {
    await userEvent.clear(screen.getByLabelText('Amount to waive'));
    await userEvent.type(screen.getByLabelText('Amount to waive'), bad);
    await userEvent.click(screen.getByRole('button', { name: /Post waiver|Tap again/ }));
    expect(await screen.findByText(/Use kwacha and ngwee|Enter an amount above zero/), bad).toBeInTheDocument();
  }
  expect(rpc).not.toHaveBeenCalled();
});

test('more than is still charged is refused', async () => {
  renderSheet(80);
  await userEvent.type(screen.getByLabelText('Amount to waive'), '80.01');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post waiver' }));
  expect(await screen.findByText('You can waive at most K 80.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('a reason is required', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('Amount to waive'), '50');
  await userEvent.click(screen.getByRole('button', { name: 'Post waiver' }));
  expect(await screen.findByText('Say why.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('waiving takes a second tap that states the change, sends the exact values once, and closes', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('Amount to waive'), '50');
  await userEvent.type(screen.getByLabelText('Reason'), 'Slip found');
  await userEvent.click(screen.getByRole('button', { name: 'Post waiver' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to waive K 50 of K 120' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('post_waiver', { p_entry: 'e1', p_amount: 50, p_reason: 'Slip found' });
  expect(await screen.findByText('Waiver posted.')).toBeInTheDocument();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('tapping again while the request runs waives once, and the sheet cannot be closed meanwhile', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderSheet();
  await userEvent.type(screen.getByLabelText('Amount to waive'), '50');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post waiver' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to waive K 50 of K 120' }));
  await userEvent.click(screen.getByRole('button', { name: /Post waiver|Tap again/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
});

test('a refusal from the engine shows its friendly sentence and keeps the sheet open', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'invalid_amount', code: 'P0001' } });
  renderSheet();
  await userEvent.type(screen.getByLabelText('Amount to waive'), '50');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post waiver' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to waive K 50 of K 120' }));
  expect(await screen.findByText('Check the amount: kwacha and ngwee only, and not below zero.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});
