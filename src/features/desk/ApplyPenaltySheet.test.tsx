import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { ApplyPenaltySheet } = await import('./ApplyPenaltySheet');

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
const SUGGESTION = { member_id: 'm1', short_name: 'Eve', ground: 'late_declaration', amount: 100, detail: 'Declared 2 days after the deadline' };
const onClose = vi.fn();
const renderSheet = (suggestion?: typeof SUGGESTION) =>
  renderLedger(<ApplyPenaltySheet periodId="p9" members={MEMBERS} suggestion={suggestion} onClose={onClose} />, { isAdmin: true });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
  onClose.mockReset();
});

test('a suggestion fixes the member and ground and prefills the amount and the reason', () => {
  renderSheet(SUGGESTION);
  expect(screen.getByText('Eve')).toBeInTheDocument();
  expect(screen.getByText('Late declaration')).toBeInTheDocument();
  expect(screen.queryByLabelText('Member')).toBeNull();
  expect(screen.getByLabelText('Amount')).toHaveValue('100');
  expect(screen.getByLabelText('Reason')).toHaveValue('Declared 2 days after the deadline');
});

test('applying takes a second tap, sends the edited amount with the suggestion’s ground, once', async () => {
  renderSheet(SUGGESTION);
  await userEvent.clear(screen.getByLabelText('Amount'));
  await userEvent.type(screen.getByLabelText('Amount'), '50');
  await userEvent.click(screen.getByRole('button', { name: 'Apply penalty' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to apply K 50 to Eve' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('apply_penalty', {
    p_member: 'm1', p_period: 'p9', p_amount: 50, p_ground: 'late_declaration', p_reason: 'Declared 2 days after the deadline',
  });
  expect(await screen.findByText('Penalty applied.')).toBeInTheDocument();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('a new penalty needs a member, an amount above zero and a reason', async () => {
  renderSheet();
  await userEvent.click(screen.getByRole('button', { name: 'Apply penalty' }));
  expect(await screen.findByText('Choose a member.')).toBeInTheDocument();
  expect(screen.getByText('Enter an amount above zero.')).toBeInTheDocument();
  expect(screen.getByText('Say why.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.selectOptions(screen.getByLabelText('Member'), 'm2');
  await userEvent.type(screen.getByLabelText('Amount'), '25');
  await userEvent.type(screen.getByLabelText('Reason'), 'Missed the meeting');
  await userEvent.click(screen.getByRole('button', { name: 'Apply penalty' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to apply K 25 to Ann' }));
  expect(rpc).toHaveBeenCalledWith('apply_penalty', { p_member: 'm2', p_period: 'p9', p_amount: 25, p_ground: 'other', p_reason: 'Missed the meeting' });
});

test('malformed or zero amounts are refused before any request', async () => {
  renderSheet(SUGGESTION);
  for (const bad of ['1,000', '250.555', '-5', '0']) {
    await userEvent.clear(screen.getByLabelText('Amount'));
    await userEvent.type(screen.getByLabelText('Amount'), bad);
    await userEvent.click(screen.getByRole('button', { name: /Apply penalty|Tap again/ }));
    expect(await screen.findByText(/Use kwacha and ngwee|Enter an amount above zero/), bad).toBeInTheDocument();
  }
  expect(rpc).not.toHaveBeenCalled();
});

test('tapping again while the request runs does not apply a second penalty', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderSheet(SUGGESTION);
  await userEvent.click(screen.getByRole('button', { name: 'Apply penalty' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to apply K 100 to Eve' }));
  await userEvent.click(screen.getByRole('button', { name: /Apply penalty|Tap again/ }));
  expect(rpc).toHaveBeenCalledTimes(1);
});

test('a refusal shows the friendly sentence and keeps the sheet open', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'period_not_open', code: 'P0001' } });
  renderSheet(SUGGESTION);
  await userEvent.click(screen.getByRole('button', { name: 'Apply penalty' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to apply K 100 to Eve' }));
  expect(await screen.findByText('That month isn’t open. Pick the current month, or open it first.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});
