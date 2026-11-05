import { screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { period, renderLedger, statement } from './testFixtures';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('./queries', async (orig) => ({
  ...(await orig<typeof import('./queries')>()),
  useLedgerCycle: () => ({ data: { cycle: { id: 'c1', label: 'C' }, periods: [] } }),
  useCycleRules: () => ({ data: { min_saving: 250 } }),
}));
const { MyCharts } = await import('./MyCharts');

const periods = [period({ id: 'p1', month_index: 1, label: 'Feb 2026', status: 'closed' })];

test('a member who was charged more than earned is told they are behind', () => {
  renderLedger(<MyCharts view="record" periods={periods} statements={[statement({ period_id: 'p1', penalties_charged: 50, interest_earned_to_date: 20 })]} />);
  expect(screen.getByText(/Behind by/)).toHaveTextContent('Behind by K 30');
});

test('nothing closed yet renders nothing', () => {
  const { container } = renderLedger(<MyCharts view="passbook" periods={periods} statements={[]} />);
  expect(container.querySelector('h2')).toBeNull();
});
