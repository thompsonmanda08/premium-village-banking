import { screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { BreakdownPanel } = await import('./BreakdownPanel');

const closed = { instalments: 400, excess: 50, earlier_shortfall: 30, capped_to_owed: false, minimum: 480 };
const show = (data: unknown) => {
  rpc.mockResolvedValue({ data, error: null });
  renderLedger(<BreakdownPanel memberId="m1" periodId="p8" />);
};

beforeEach(() => rpc.mockReset());

test('asks for the breakdown of that member and month', async () => {
  show(closed);
  await screen.findByText('Instalments due');
  expect(rpc).toHaveBeenCalledWith('minimum_breakdown', { p_member: 'm1', p_period: 'p8' });
});

test('shows the three parts and their total', async () => {
  show(closed);
  expect((await screen.findByText('Instalments due')).nextElementSibling).toHaveTextContent('K 400');
  expect(screen.getByText('Excess charged').nextElementSibling).toHaveTextContent('K 50');
  expect(screen.getByText('Earlier shortfall').nextElementSibling).toHaveTextContent('K 30');
  expect(screen.getByText('Next minimum').nextElementSibling).toHaveTextContent('K 480');
  expect(screen.queryByText(/Capped to what you owe|Nothing owed/)).toBeNull();
});

test('a cap that leaves something to pay is said so', async () => {
  show({ ...closed, capped_to_owed: true, minimum: 300 });
  expect(await screen.findByText('Capped to what you owe')).toBeInTheDocument();
});

test('a cap that leaves nothing to pay says nothing is owed', async () => {
  show({ ...closed, capped_to_owed: true, minimum: 0 });
  expect(await screen.findByText('Nothing owed')).toBeInTheDocument();
  expect(screen.queryByText('Capped to what you owe')).toBeNull();
});

test('an imported month is not itemised', async () => {
  show({ imported: true, minimum: 480 });
  expect(await screen.findByText('From the treasurer’s workbook; not itemised')).toBeInTheDocument();
  expect(screen.queryByText('Instalments due')).toBeNull();
});

test('a member with no statement gets nothing', async () => {
  show({ none: true });
  await vi.waitFor(() => expect(rpc).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.queryByText(/Instalments due|not itemised|Loading/)).toBeNull();
});

test('a failure is said in plain words', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'boom', code: 'XX000' } });
  renderLedger(<BreakdownPanel memberId="m1" periodId="p8" />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});
