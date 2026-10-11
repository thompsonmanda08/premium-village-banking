import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger, year } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const { MonthPanel } = await import('./MonthPanel');

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
});

test('opens the next month with the chosen deadline', async () => {
  renderLedger(<MonthPanel cycleId="c1" periods={year(8)} />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Open Oct 2026' }));
  const date = screen.getByLabelText('Declaration deadline');
  expect(date).toHaveValue('2026-10-07');
  expect(date).toHaveAttribute('min', '2026-10-01');
  fireEvent.change(date, { target: { value: '2026-10-14' } });
  await userEvent.click(screen.getByRole('button', { name: 'Open month' }));
  expect(rpc).toHaveBeenCalledWith('open_period', { p_cycle: 'c1', p_month_index: 9, p_deadline: '2026-10-14' });
  expect(await screen.findByText('Oct 2026 is open for declarations.')).toBeInTheDocument();
});

test('a deadline before the month starts is blocked before any request', async () => {
  renderLedger(<MonthPanel cycleId="c1" periods={year(8)} />, { isAdmin: true });
  await userEvent.click(screen.getByRole('button', { name: 'Open Oct 2026' }));
  fireEvent.change(screen.getByLabelText('Declaration deadline'), { target: { value: '2026-09-30' } });
  await userEvent.click(screen.getByRole('button', { name: 'Open month' }));
  expect(await screen.findByText('Pick a date in Oct 2026 or later.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('an open month shows its deadline; changing it needs a date and a reason', async () => {
  renderLedger(<MonthPanel cycleId="c1" periods={year(8, 'open')} />, { isAdmin: true });
  expect(screen.getByText('Oct 2026 is open')).toBeInTheDocument();
  expect(screen.getByText(/7 Oct 2026/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Change deadline' }));
  fireEvent.change(screen.getByLabelText('New deadline'), { target: { value: '2026-10-14' } });
  await userEvent.click(screen.getByRole('button', { name: 'Save deadline' }));
  expect(await screen.findByText('Add a reason first.')).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText('Reason'), 'Members asked for a week');
  await userEvent.click(screen.getByRole('button', { name: 'Save deadline' }));
  expect(rpc).toHaveBeenCalledWith('set_deadline', { p_period: 'p9', p_deadline: '2026-10-14', p_reason: 'Members asked for a week' });
});

test('with nothing to open, says so', () => {
  renderLedger(<MonthPanel cycleId="c1" periods={year(8, 'closing')} />, { isAdmin: true });
  expect(screen.getByText('No month is waiting to be opened.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Open/ })).toBeNull();
});
