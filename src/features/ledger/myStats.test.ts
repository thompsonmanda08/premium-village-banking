import { expect, test } from 'vitest';
import { myStats } from './myStats';
import { period, statement } from './testFixtures';

const p = (i: number, status: 'closed' | 'open' = 'closed') => period({ id: `p${i}`, month_index: i, label: `M${i}`, status });

test('running charges, net position and return over closed months only', () => {
  const s = myStats(
    [
      statement({ id: 'a', period_id: 'p1', saving: 250, cum_savings: 250, loan_interest_charged: 30, interest_earned_to_date: 10 }),
      statement({ id: 'b', period_id: 'p2', saving: 100, cum_savings: 350, excess_charged: 5, penalties_charged: 15, interest_earned_to_date: 80 }),
      statement({ id: 'c', period_id: 'p3', cum_savings: 9999 }),
    ],
    [p(1), p(2), p(3, 'open')],
    250,
  );
  expect(s.months.map((m) => m.net)).toEqual([-20, 30]);
  expect(s).toMatchObject({ savings: 350, interestCharged: 35, penalties: 15, earned: 80, net: 30, monthsAtMinimum: 1 });
  expect(s.roi).toBeCloseTo(30 / 350);
});

test('no statements gives zeros, never NaN', () => {
  expect(myStats([], [p(1)], 250)).toMatchObject({ months: [], savings: 0, net: 0, roi: 0 });
});

test('agrees with the group statistics on net position and charges for the same member', async () => {
  const { memberStats } = await import('./groupStats');
  const sts = [
    statement({ id: 'a', period_id: 'p1', member_id: 'm1', cum_savings: 250, loan_interest_charged: 30, excess_charged: 4, interest_earned_to_date: 10, loan_principal_sent: 200 }),
    statement({ id: 'b', period_id: 'p2', member_id: 'm1', cum_savings: 350, penalties_charged: 15, interest_earned_to_date: 80 }),
  ];
  const ps = [p(1), p(2)];
  const mine = myStats(sts, ps, 250);
  const g = memberStats(ps, sts, [{ id: 'm1', short_name: 'Eve' }])[0]!;
  expect([mine.net, mine.interestCharged, mine.penalties, mine.loans, mine.roi]).toEqual([g.net, g.interestCharged, g.penalties, g.loans, g.roi]);
});
