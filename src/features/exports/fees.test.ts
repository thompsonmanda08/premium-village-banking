import { expect, test } from 'vitest';
import { entry } from '@/features/ledger/testFixtures';
import { feeFold } from './fees';

// The same scenario as supabase/tests/database/20_export_fee_fold.sql: February fee 10 and membership 30;
// in March the fee is corrected to 6 (an adjustment of 4) and the membership to 35 (a membership entry of +5).
const FEB_FEE = entry({ id: 'f1', member_id: 'm1', kind: 'txn_fee', amount: 10, period_id: 'p1', source: 'app' });
const FEB_MEMBERSHIP = entry({ id: 'f2', member_id: 'm1', kind: 'membership', amount: 30, period_id: 'p1', source: 'app' });
const MARCH = [
  entry({ id: 'a1', member_id: 'm1', kind: 'adjustment', amount: 4, period_id: 'p2', source: 'correction', corrects_entry_id: 'f1', reason: 'Fee was 6' }),
  entry({ id: 'a2', member_id: 'm1', kind: 'membership', amount: 5, period_id: 'p2', source: 'correction', corrects_entry_id: 'f2', reason: 'Membership was 35' }),
];

test('February carries the fees, March carries the corrections under the same kinds', () => {
  expect(feeFold([FEB_FEE, FEB_MEMBERSHIP], []).get('m1')).toEqual({ txn_fee: 10, membership: 30 });
  expect(feeFold(MARCH, [FEB_FEE, FEB_MEMBERSHIP]).get('m1')).toEqual({ txn_fee: -4, membership: 5 });
});

test('the cycle total is the sum of the months: 6 and 35, as the engine says', () => {
  const feb = feeFold([FEB_FEE, FEB_MEMBERSHIP], []).get('m1')!;
  const mar = feeFold(MARCH, [FEB_FEE, FEB_MEMBERSHIP]).get('m1')!;
  expect(feb.txn_fee + mar.txn_fee).toBe(6);
  expect(feb.membership + mar.membership).toBe(35);
});

test('a waiver counts negative under the kind it points at, and other kinds are ignored', () => {
  const waiver = entry({ id: 'w1', member_id: 'm2', kind: 'waiver', amount: 2, source: 'correction', corrects_entry_id: 'f1' });
  const saving = entry({ id: 's1', member_id: 'm2', kind: 'saving', amount: 250 });
  const penaltyWaiver = entry({ id: 'w2', member_id: 'm2', kind: 'waiver', amount: 9, source: 'correction', corrects_entry_id: 'pen' });
  const penalty = entry({ id: 'pen', member_id: 'm2', kind: 'penalty', amount: 50, period_id: 'p1' });
  expect(feeFold([waiver, saving, penaltyWaiver], [FEB_FEE, penalty]).get('m2')).toEqual({ txn_fee: -2, membership: 0 });
});

test('ngwee add up exactly, entries with no member are skipped, a correction with an unknown original is skipped', () => {
  const a = entry({ id: 'x1', member_id: 'm1', kind: 'txn_fee', amount: 0.1, source: 'app' });
  const b = entry({ id: 'x2', member_id: 'm1', kind: 'txn_fee', amount: 0.2, source: 'app' });
  const group = entry({ id: 'x3', member_id: null, kind: 'txn_fee', amount: 5 });
  const lost = entry({ id: 'x4', member_id: 'm1', kind: 'adjustment', amount: 1, source: 'correction', corrects_entry_id: 'gone' });
  expect(feeFold([a, b, group, lost], []).get('m1')).toEqual({ txn_fee: 0.3, membership: 0 });
  expect(feeFold([a, b, group, lost], []).size).toBe(1);
});
