import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const hooks = vi.hoisted(() => ({ pots: vi.fn(), expenses: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  usePots: () => hooks.pots(),
  useExpenses: () => hooks.expenses(),
}));
const { PotsCard } = await import('./PotsCard');

const ok = <T,>(data: T) => ({ data });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
  hooks.pots.mockReturnValue(ok([
    { pot: 'hosting', collected: 900, spent: 90, remaining: 810 },
    { pot: 'fees', collected: 15, spent: 15, remaining: 0 },
  ]));
  hooks.expenses.mockReturnValue(ok([{ id: 'e1', pot: 'hosting', amount: 90, spent_on: '2026-03-14', note: 'Hall hire' }]));
});

test('shows what each pot holds and the latest spending', () => {
  renderLedger(<PotsCard cycleId="c1" />, { isAdmin: true });
  expect(screen.getByText('Meeting hosting').nextElementSibling).toHaveTextContent('K 810');
  expect(screen.getByText('K 900 collected · K 90 spent')).toBeInTheDocument();
  expect(screen.getByText('Hall hire')).toBeInTheDocument();
});

test('only the treasurer can record spending, and it needs an amount and a note', async () => {
  const { unmount } = renderLedger(<PotsCard cycleId="c1" />);
  expect(screen.queryByRole('button', { name: 'Record spending' })).toBeNull();
  unmount();

  renderLedger(<PotsCard cycleId="c1" />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Record spending' }));
  await userEvent.click(screen.getAllByRole('button', { name: 'Record spending' }).at(-1)!);
  expect(screen.getByText('Say what it was for.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();

  await userEvent.type(screen.getByLabelText('Amount'), '120');
  await userEvent.type(screen.getByLabelText('What was it for?'), 'Chairs');
  await userEvent.click(screen.getAllByRole('button', { name: 'Record spending' }).at(-1)!);
  await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('record_expense', expect.objectContaining({ p_cycle: 'c1', p_pot: 'hosting', p_amount: 120, p_note: 'Chairs' })));
});
