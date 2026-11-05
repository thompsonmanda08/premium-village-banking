import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { renderLedger, statement, year } from '@/features/ledger/testFixtures';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useCycleRules: () => ({ data: { loan_rate: 0.15, excess_rate: 0.1, min_saving: 250 } }),
  useGroupStatements: () => ({
    data: [{ id: 'g8', period_id: 'p8', savings: 4000, total_savings: 30000, loans_sent: 5000, total_owed: 12000, idle_cash: 3000, excess_billed: 0, interest_collected: 0 }],
  }),
}));
const { PlanProjection } = await import('./PlanProjection');

const periods = year(8, 'open');
const mine = [statement({ period_id: 'p8', saving: 250, cum_savings: 2000, interest_earned_to_date: 100 })];

test('saving more raises the estimate, and reset restores the statements', async () => {
  renderLedger(<PlanProjection statements={mine} periods={periods} />);
  const payout = () => screen.getByText('Estimated payout').nextElementSibling!.textContent;
  const before = payout();
  const field = screen.getByLabelText('I save each month (K)');
  await userEvent.clear(field);
  await userEvent.type(field, '2000');
  expect(payout()).not.toBe(before);
  await userEvent.click(screen.getByRole('button', { name: /reset/i }));
  expect(payout()).toBe(before);
});

test('nothing renders before the first statement', () => {
  renderLedger(<PlanProjection statements={[]} periods={periods} />);
  expect(screen.queryByText('Project my savings')).toBeNull();
});

test('a number with a comma shows an error and no estimate', async () => {
  renderLedger(<PlanProjection statements={mine} periods={periods} />);
  const field = screen.getByLabelText('I save each month (K)');
  await userEvent.clear(field);
  await userEvent.type(field, '1,000');
  expect(screen.getAllByText(/no commas/i).length).toBeGreaterThan(0);
  expect(screen.queryByText('Estimated payout')).toBeNull();
});
