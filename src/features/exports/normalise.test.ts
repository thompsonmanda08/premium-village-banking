import { expect, test } from 'vitest';
import { closeMember, statement } from '@/features/ledger/testFixtures';
import { groupFigures, memberMonth } from './normalise';

test('a statement row becomes the figures and nothing else', () => {
  const m = memberMonth(statement({ member_id: 'm1', saving: 250, cum_savings: 2000, closing_owed: -50 }));
  expect(m).toMatchObject({ member_id: 'm1', saving: 250, cum_savings: 2000, closing_owed: -50 });
  for (const leaked of ['id', 'group_id', 'period_id', 'created_at', 'source']) expect(m).not.toHaveProperty(leaked);
});

test('a close-preview member has the same shape; a figure it lacks is 0 and numeric strings become numbers', () => {
  const preview = { ...closeMember({ member_id: 'm2', short_name: 'Ann' }), cum_savings: '1500.50' } as unknown as Record<string, unknown> & { member_id: string };
  const m = memberMonth(preview);
  expect(m.member_id).toBe('m2');
  expect(m.cum_savings).toBe(1500.5);
  expect(m.unpaid_minimum).toBe(0);
  expect(m).not.toHaveProperty('short_name');
});

test('group figures keep only the named fields', () => {
  const g = groupFigures({ id: 'x', group_id: 'g1', period_id: 'p1', source: 'close', created_at: 'now', opening_cash: 5000, received: 900, excess_rate: 0.1, fee_pot_balance: -3.2 });
  expect(g).toMatchObject({ opening_cash: 5000, received: 900, excess_rate: 0.1, fee_pot_balance: -3.2, loans_sent: 0, total_owed: 0 });
  for (const leaked of ['id', 'group_id', 'period_id', 'source', 'created_at']) expect(g).not.toHaveProperty(leaked);
});
