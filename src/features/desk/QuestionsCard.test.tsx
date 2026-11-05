import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const open = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/features/queries/queryHooks', async (orig) => ({ ...(await orig<typeof import('@/features/queries/queryHooks')>()), useOpenQueries: (...a: unknown[]) => open(...a) }));
const { QuestionsCard } = await import('./QuestionsCard');

const q = (o = {}) => ({ id: 'q1', created_at: '2026-10-05T08:00:00Z', group_id: 'g1', period_id: 'p8', member_id: 'm1', field: 'next_minimum', note: 'Looks high', status: 'open', reply: null, answered_by: null, answered_at: null, short_name: 'Eve', ...o });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: q(), error: null });
  open.mockReset();
  open.mockReturnValue({ data: [q(), q({ id: 'q2', short_name: 'Ann', field: 'closing_owed', note: 'Not what I paid' })], isPending: false, isError: false });
});

test('lists each open question with who, which figure and the note', () => {
  renderLedger(<QuestionsCard />, { isAdmin: true });
  expect(screen.getByText('Eve')).toBeInTheDocument();
  expect(screen.getByText('Next minimum')).toBeInTheDocument();
  expect(screen.getByText('Looks high')).toBeInTheDocument();
  expect(screen.getByText('Ann')).toBeInTheDocument();
  expect(screen.getByText('Not what I paid')).toBeInTheDocument();
});

test('answering sends the trimmed reply for that question', async () => {
  renderLedger(<QuestionsCard />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Answer Ann' }));
  await userEvent.type(screen.getByLabelText('Your answer'), '  Fixed it  ');
  await userEvent.click(screen.getByRole('button', { name: 'Send answer' }));
  expect(rpc).toHaveBeenCalledWith('answer_query', { p_query: 'q2', p_reply: 'Fixed it' });
  expect(await screen.findByText('Answer sent.')).toBeInTheDocument();
});

test('a blank answer shows a field error and sends nothing', async () => {
  renderLedger(<QuestionsCard />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Answer Eve' }));
  await userEvent.click(screen.getByRole('button', { name: 'Send answer' }));
  expect(await screen.findByText('Write your answer.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('renders nothing when there are no open questions', () => {
  open.mockReturnValue({ data: [], isPending: false, isError: false });
  const { container } = renderLedger(<QuestionsCard />, { isAdmin: true });
  expect(container.querySelector('h3, [role=alert], ul')).toBeNull();
});

test('renders nothing for a member', () => {
  const { container } = renderLedger(<QuestionsCard />, { isAdmin: false });
  expect(container.querySelector('h3, [role=alert], ul')).toBeNull();
});

test('a failure to load is said in plain words', () => {
  open.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('x'), refetch: vi.fn() });
  renderLedger(<QuestionsCard />, { isAdmin: true });
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

test('Enter in the answer box sends it', async () => {
  renderLedger(<QuestionsCard />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Answer Ann' }));
  await userEvent.type(screen.getByLabelText('Your answer'), 'Fixed it{Enter}');
  expect(rpc).toHaveBeenCalledWith('answer_query', { p_query: 'q2', p_reply: 'Fixed it' });
});

test('a question answered or removed meanwhile closes the sheet and says so', async () => {
  for (const [message, said] of [['already_answered', 'That question has already been answered.'], ['query_not_found', 'That question no longer exists.']] as const) {
    rpc.mockResolvedValue({ data: null, error: { message, code: 'P0001' } });
    const { unmount } = renderLedger(<QuestionsCard />, { isAdmin: true });
    await userEvent.click(screen.getByRole('button', { name: 'Answer Ann' }));
    await userEvent.type(screen.getByLabelText('Your answer'), 'Fixed it');
    await userEvent.click(screen.getByRole('button', { name: 'Send answer' }));
    expect(await screen.findByText(said)).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.queryByLabelText('Your answer')).toBeNull());
    unmount();
  }
});

test('another failure keeps the sheet open for a retry', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
  renderLedger(<QuestionsCard />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Answer Ann' }));
  await userEvent.type(screen.getByLabelText('Your answer'), 'Fixed it');
  await userEvent.click(screen.getByRole('button', { name: 'Send answer' }));
  expect(await screen.findByText(/offline/)).toBeInTheDocument();
  expect(screen.getByLabelText('Your answer')).toBeInTheDocument();
});

test('the hook is asked for only when the viewer is an admin', () => {
  renderLedger(<QuestionsCard />, { isAdmin: true });
  expect(open).toHaveBeenLastCalledWith('g1', true);
  open.mockClear();
  renderLedger(<QuestionsCard />, { isAdmin: false });
  expect(open).toHaveBeenLastCalledWith('g1', false);
});
