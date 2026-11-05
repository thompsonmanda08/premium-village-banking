import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger } from '@/features/ledger/testFixtures';
import { RULE_CATALOG } from './ruleCatalog';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { RecordVoteSheet } = await import('./RecordVoteSheet');

const onClose = vi.fn();
const RULE = RULE_CATALOG[0]!;
const renderSheet = () => renderLedger(<RecordVoteSheet rule={RULE} cycleId="c1" open onClose={onClose} />, { isAdmin: true });
const fill = async (decided: string, votesFor: string, total: string) => {
  await userEvent.type(screen.getByLabelText('Date of the vote'), decided);
  await userEvent.type(screen.getByLabelText('Votes for'), votesFor);
  await userEvent.type(screen.getByLabelText('Members who voted'), total);
};

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
  onClose.mockReset();
});

test('submitting sends the entered values to the engine and closes', async () => {
  renderSheet();
  await fill('2026-10-14', '12', '18');
  await userEvent.click(screen.getByRole('button', { name: 'Record vote' }));
  expect(rpc).toHaveBeenCalledWith('record_ratification', {
    p_cycle: 'c1', p_rule_key: RULE.key, p_decided_on: '2026-10-14', p_votes_for: 12, p_votes_total: 18, p_meeting_ref: undefined, p_note: undefined,
  });
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('votes for above votes counted is refused before any request', async () => {
  renderSheet();
  await fill('2026-10-14', '19', '18');
  await userEvent.click(screen.getByRole('button', { name: 'Record vote' }));
  expect(await screen.findByText('Votes for can’t be more than the members who voted.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('a refusal shows the friendly sentence and keeps the sheet open', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'invalid_vote', code: 'P0001' } });
  renderSheet();
  await fill('2026-10-14', '12', '18');
  await userEvent.click(screen.getByRole('button', { name: 'Record vote' }));
  expect(await screen.findByText('Check the vote: votes for can\'t be more than votes counted, and the date can\'t be in the future.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

test('a date in the future is refused before any request', async () => {
  renderSheet();
  await fill('2999-01-01', '12', '18');
  await userEvent.click(screen.getByRole('button', { name: 'Record vote' }));
  expect(await screen.findByText('The date can’t be in the future.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('nobody having voted is refused before any request', async () => {
  renderSheet();
  await fill('2026-10-14', '0', '0');
  await userEvent.click(screen.getByRole('button', { name: 'Record vote' }));
  expect(await screen.findByText('At least one member must have voted.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

// user-event only looks for a submit button inside the form, so it cannot press Enter for a button tied by the `form` attribute.
// A browser can, so the test checks the tie (what makes Enter work there) and that submitting the form records the vote.
test('Enter records the vote: the footer button submits the form', async () => {
  renderSheet();
  await fill('2026-10-14', '12', '18');
  const button = screen.getByRole('button', { name: 'Record vote' });
  const form = screen.getByLabelText('Votes for').closest('form')!;
  expect(button).toHaveAttribute('type', 'submit');
  expect(form.id).not.toBe('');
  expect(button).toHaveAttribute('form', form.id);
  fireEvent.submit(form);
  await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('says what to do about a vote entered by mistake', () => {
  renderSheet();
  expect(screen.getByText(/Entered a vote by mistake\? Record it again and the latest one counts\./)).toBeInTheDocument();
});
