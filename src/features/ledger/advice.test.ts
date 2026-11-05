import { expect, test } from 'vitest';
import { memberAdvice } from './advice';
import { myStats } from './myStats';
import { period, statement } from './testFixtures';

const ps = [period({ id: 'p1', month_index: 1, label: 'M1', status: 'closed' }), period({ id: 'p2', month_index: 2, label: 'M2', status: 'closed' })];

test('a member who is behind, under the minimum and owing gets three talking points', () => {
  const s = myStats(
    [
      statement({ id: 'a', period_id: 'p1', saving: 100, cum_savings: 100, loan_principal_sent: 400, loan_interest_charged: 60, interest_earned_to_date: 5 }),
      statement({ id: 'b', period_id: 'p2', saving: 250, cum_savings: 350, closing_owed: 300, interest_earned_to_date: 20 }),
    ],
    ps,
    250,
  );
  const texts = memberAdvice(s, 250).map((a) => a.text);
  expect(texts).toHaveLength(3);
  expect(texts[0]).toContain('K 40 more than they have earned');
  expect(texts[1]).toContain('1 of 2 months');
  expect(texts[2]).toContain('Owes K 300');
});

test('a member with nothing to raise is told so, and no statements gives no advice', () => {
  const s = myStats([statement({ id: 'a', period_id: 'p1', saving: 250, cum_savings: 250, interest_earned_to_date: 30 })], ps, 250);
  expect(memberAdvice(s, 250)).toEqual([{ tone: 'good', text: expect.stringContaining('Nothing to raise') }]);
  expect(memberAdvice(myStats([], ps, 250), 250)).toEqual([]);
});
