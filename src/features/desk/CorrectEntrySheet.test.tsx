import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { entry, renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { CorrectEntrySheet } = await import('./CorrectEntrySheet');

const PAYMENT = entry({ id: 'e1', kind: 'payment', amount: 250, source: 'app' });
const onClose = vi.fn();
const renderSheet = (current = 250) => renderLedger(<CorrectEntrySheet entry={PAYMENT} current={current} onClose={onClose} />, { isAdmin: true });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
  onClose.mockReset();
});

test('shows what is being corrected and what it is now', () => {
  renderSheet(200);
  expect(screen.getByText('Payment')).toBeInTheDocument();
  expect(screen.getByText('Recorded').nextElementSibling).toHaveTextContent('K 250');
  expect(screen.getByText('Now').nextElementSibling).toHaveTextContent('K 200');
});

test('a blank total is refused, not read as zero', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('Reason'), 'Wrong amount typed');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  expect(await screen.findByText('Enter the new total.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('the same total as now is refused, since it would change nothing', async () => {
  renderSheet(250);
  await userEvent.type(screen.getByLabelText('New total'), '250');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  expect(await screen.findByText('That is already the amount.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('malformed totals are refused before any request, and zero is a valid total', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  for (const bad of ['1,000', '250.555', '-5', '1e3']) {
    await userEvent.clear(screen.getByLabelText('New total'));
    await userEvent.type(screen.getByLabelText('New total'), bad);
    await userEvent.click(screen.getByRole('button', { name: /Post correction|Tap again/ }));
    expect(await screen.findByText('Use kwacha and ngwee, like 250 or 250.50.'), bad).toBeInTheDocument();
  }
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.clear(screen.getByLabelText('New total'));
  await userEvent.type(screen.getByLabelText('New total'), '0');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  expect(screen.getByRole('button', { name: 'Tap again to change K 250 to K 0' })).toBeInTheDocument();
});

test('a reason is required', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('New total'), '200');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  expect(await screen.findByText('Say why.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('posting takes a second tap that states the change, sends the exact values once, and closes', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('New total'), '200');
  await userEvent.type(screen.getByLabelText('Reason'), 'Paid 200, not 250');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to change K 250 to K 200' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('post_correction', { p_entry: 'e1', p_new_amount: 200, p_reason: 'Paid 200, not 250' });
  expect(await screen.findByText('Correction posted.')).toBeInTheDocument();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('editing a field disarms the second tap', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('New total'), '200');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  await userEvent.type(screen.getByLabelText('New total'), '0');
  expect(screen.getByRole('button', { name: 'Post correction' })).toBeInTheDocument();
});

test('tapping again while the request runs posts once, and the sheet cannot be closed meanwhile', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderSheet();
  await userEvent.type(screen.getByLabelText('New total'), '200');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to change K 250 to K 200' }));
  await userEvent.click(screen.getByRole('button', { name: /Post correction|Tap again/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
});

test('a refusal from the engine shows its friendly sentence and keeps the sheet open', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'period_not_open', code: 'P0001' } });
  renderSheet();
  await userEvent.type(screen.getByLabelText('New total'), '200');
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Post correction' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to change K 250 to K 200' }));
  expect(await screen.findByText('That month isn’t open. Pick the current month, or open it first.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});
