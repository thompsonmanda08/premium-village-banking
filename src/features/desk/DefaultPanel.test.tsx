import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { memberStatus, renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { DefaultPanel } = await import('./DefaultPanel');

const renderPanel = (status?: ReturnType<typeof memberStatus>) =>
  renderLedger(<DefaultPanel memberId="m1" memberName="Eve" cycleId="c1" status={status} />, { isAdmin: true });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
});

test('a member with no record is in good standing and can be marked', () => {
  renderPanel();
  expect(screen.getByText('In good standing')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mark as defaulted' })).toBeInTheDocument();
});

test('a defaulted member shows when and why, and what it means', () => {
  renderPanel(memberStatus({ defaulted: true, reason: 'Missed three months', changed_at: '2026-10-08T08:00:00Z' }));
  expect(screen.getByText('Defaulted')).toBeInTheDocument();
  expect(screen.getByText(/Changed 8 Oct 2026: Missed three months/)).toBeInTheDocument();
  expect(screen.getByText(/earns no further interest share/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reverse the default' })).toBeInTheDocument();
});

test('a reversed default reads as good standing, keeping the history line', () => {
  renderPanel(memberStatus({ defaulted: false, reason: 'Paid up' }));
  expect(screen.getByText('In good standing')).toBeInTheDocument();
  expect(screen.getByText(/Paid up/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mark as defaulted' })).toBeInTheDocument();
});

test('marking a default needs a reason and a second tap, and sends the exact values once', async () => {
  renderPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as defaulted' }));
  await userEvent.click(screen.getByRole('button', { name: 'Record default' }));
  expect(await screen.findByText('Say why.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText('Reason'), 'Missed three months');
  await userEvent.click(screen.getByRole('button', { name: 'Record default' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to mark Eve as defaulted' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('set_default', { p_member: 'm1', p_cycle: 'c1', p_defaulted: true, p_reason: 'Missed three months' });
  expect(await screen.findByText('Default recorded.')).toBeInTheDocument();
});

test('reversing sends defaulted false', async () => {
  renderPanel(memberStatus({ defaulted: true }));
  await userEvent.click(screen.getByRole('button', { name: 'Reverse the default' }));
  await userEvent.type(screen.getByLabelText('Reason'), 'Paid up');
  await userEvent.click(screen.getByRole('button', { name: 'Record reversal' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to reverse Eve’s default' }));
  expect(rpc).toHaveBeenCalledWith('set_default', { p_member: 'm1', p_cycle: 'c1', p_defaulted: false, p_reason: 'Paid up' });
  expect(await screen.findByText('Default reversed.')).toBeInTheDocument();
});

test('editing the reason disarms the second tap', async () => {
  renderPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as defaulted' }));
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Record default' }));
  await userEvent.type(screen.getByLabelText('Reason'), 'y');
  expect(screen.getByRole('button', { name: 'Record default' })).toBeInTheDocument();
});

test('tapping again while the request runs records once, and the sheet cannot be closed meanwhile', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as defaulted' }));
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Record default' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to mark Eve as defaulted' }));
  await userEvent.click(screen.getByRole('button', { name: /Record default|Tap again/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Reason')).toBeInTheDocument();
});

test('a refusal shows its friendly sentence and keeps the sheet open', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'not_admin', code: '42501' } });
  renderPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as defaulted' }));
  await userEvent.type(screen.getByLabelText('Reason'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Record default' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to mark Eve as defaulted' }));
  expect(await screen.findByText('Only admins can do this.')).toBeInTheDocument();
  expect(screen.getByLabelText('Reason')).toBeInTheDocument();
});

test('the sheet keeps the change it was opened for even if the status changes underneath it, and says so', async () => {
  const { rerender } = renderPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as defaulted' }));
  rerender(<DefaultPanel memberId="m1" memberName="Eve" cycleId="c1" status={memberStatus({ defaulted: true, reason: 'Other admin' })} />);
  expect(screen.getByRole('dialog', { name: 'Mark Eve as defaulted' })).toBeInTheDocument();
  expect(screen.getByText('This was already recorded by someone else. Close this and check the status.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Record default' })).toBeDisabled();
});

test('it says who made the change when it knows', () => {
  renderLedger(<DefaultPanel memberId="m1" memberName="Eve" cycleId="c1" changedBy="Ann" status={memberStatus({ defaulted: true, reason: 'Missed three months', changed_at: '2026-10-08T08:00:00Z' })} />, { isAdmin: true });
  expect(screen.getByText('Changed 8 Oct 2026 by Ann: Missed three months')).toBeInTheDocument();
});
