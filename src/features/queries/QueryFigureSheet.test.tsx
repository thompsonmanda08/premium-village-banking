import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const mine = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('./queryHooks', async (orig) => ({ ...(await orig<typeof import('./queryHooks')>()), useMyQueries: () => mine() }));
const { QueryFigureSheet } = await import('./QueryFigureSheet');

const row = (o = {}) => ({ id: 'q1', created_at: '2026-10-05T08:00:00Z', group_id: 'g1', period_id: 'p8', member_id: 'm1', field: 'next_minimum', note: 'Looks high', status: 'open', reply: null, answered_by: null, answered_at: null, ...o });
const onClose = vi.fn();
const renderSheet = () => renderLedger(<QueryFigureSheet periodId="p8" field="next_minimum" open onClose={onClose} />);

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: row(), error: null });
  mine.mockReset();
  mine.mockReturnValue({ data: [], isError: false });
  onClose.mockReset();
});

test('sending asks the treasurer about that figure with the trimmed note, once, then closes', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('What looks wrong?'), '  Looks high  ');
  await userEvent.click(screen.getByRole('button', { name: 'Send question' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('raise_query', { p_period: 'p8', p_field: 'next_minimum', p_note: 'Looks high' });
  expect(await screen.findByText('Question sent.')).toBeInTheDocument();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('the Enter key sends it too', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('What looks wrong?'), 'Looks high{Enter}');
  expect(rpc).toHaveBeenCalledWith('raise_query', { p_period: 'p8', p_field: 'next_minimum', p_note: 'Looks high' });
});

test('a blank note shows a field error and sends nothing', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('What looks wrong?'), '   ');
  await userEvent.click(screen.getByRole('button', { name: 'Send question' }));
  expect(await screen.findByText('Say what looks wrong.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('a fourth open question shows the friendly refusal', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'too_many_queries', code: 'P0001' } });
  renderSheet();
  await userEvent.type(screen.getByLabelText('What looks wrong?'), 'Again');
  await userEvent.click(screen.getByRole('button', { name: 'Send question' }));
  expect(await screen.findByText('You already have 3 open questions. Wait for an answer before asking another.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

test('earlier questions on this figure and their replies show; other figures do not', () => {
  mine.mockReturnValue({
    data: [
      row({ id: 'a', note: 'First go', status: 'answered', reply: 'Checked, it is right' }),
      row({ id: 'b', note: 'Second go' }),
      row({ id: 'c', note: 'About savings', field: 'cum_savings' }),
      row({ id: 'd', note: 'Older month', period_id: 'p7' }),
    ],
    isError: false,
  });
  renderSheet();
  expect(screen.getByText('First go')).toBeInTheDocument();
  expect(screen.getByText('Checked, it is right')).toBeInTheDocument();
  expect(screen.getByText('Second go')).toBeInTheDocument();
  expect(screen.queryByText('About savings')).toBeNull();
  expect(screen.queryByText('Older month')).toBeNull();
});
