import { expect, test } from 'vitest';
import { entry } from '@/features/ledger/testFixtures';
import { entryOrder, loanStatusLabel } from './sheetKit';

test('loan statuses read as words, and one added later still shows as itself', () => {
  expect(loanStatusLabel('open')).toBe('Open');
  expect(loanStatusLabel('repaid')).toBe('Repaid');
  expect(loanStatusLabel('written_against_payout')).toBe('Taken from the payout');
  expect(loanStatusLabel('mystery')).toBe('mystery');
});

test('entries order by time; rows recorded in the same instant (an import) fall back to member, then kind in a natural order', () => {
  const at = '2026-04-01T00:00:00Z';
  const names = new Map([['m1', 'Eve'], ['m2', 'Ann']]);
  const rows = [
    entry({ id: 'z', created_at: at, member_id: 'm1', kind: 'txn_fee' }),
    entry({ id: 'y', created_at: at, member_id: 'm1', kind: 'saving' }),
    entry({ id: 'x', created_at: at, member_id: 'm2', kind: 'penalty' }),
    entry({ id: 'w', created_at: at, member_id: 'm2', kind: 'membership' }),
    entry({ id: 'v', created_at: '2026-03-01T00:00:00Z', member_id: 'm1', kind: 'saving' }),
    entry({ id: 'u', created_at: at, member_id: null, kind: 'payout_fee' }),
  ];
  const sorted = [...rows].sort(entryOrder(names));
  expect(sorted.map((e) => e.id)).toEqual(['v', 'u', 'w', 'x', 'y', 'z']);
});
