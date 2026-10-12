import { expect, test } from 'vitest';
import { correctionLine, correctionsOf, effectiveAmount, isCorrectable, isWaivable } from './corrections';
import { entry } from './testFixtures';

// The same scenario as supabase/tests/database/19_correction_parity.sql: 100, waive 30, correct to 90 (+20), correct to 80 (-10).
const ORIGINAL = entry({ id: 'e1', kind: 'penalty', amount: 100, source: 'app', period_id: 'p8', created_at: '2026-09-05T08:00:00Z' });
const SCENARIO = [
  ORIGINAL,
  entry({ id: 'c1', kind: 'waiver', amount: 30, source: 'correction', corrects_entry_id: 'e1', reason: 'Slip found', period_id: 'p9', created_at: '2026-10-08T08:00:00Z' }),
  entry({ id: 'c2', kind: 'penalty', amount: 20, source: 'correction', corrects_entry_id: 'e1', reason: 'Treasurer raised it', period_id: 'p9', created_at: '2026-10-08T08:01:00Z' }),
  entry({ id: 'c3', kind: 'adjustment', amount: 10, source: 'correction', corrects_entry_id: 'e1', reason: 'Settled on 80', period_id: 'p9', created_at: '2026-10-08T08:02:00Z' }),
];

test('the current amount is the original plus increases less waivers and adjustments: 100 + 20 - 30 - 10 = 80, as the engine says', () => {
  expect(effectiveAmount(ORIGINAL, SCENARIO)).toBe(80);
});

test('an entry nobody corrected is just its amount, and other entries’ corrections do not leak in', () => {
  const other = entry({ id: 'e2', kind: 'saving', amount: 250 });
  expect(effectiveAmount(other, [...SCENARIO, other])).toBe(250);
});

test('ngwee add up exactly', () => {
  const e = entry({ id: 'e3', kind: 'excess_charge', amount: 0.1, source: 'app' });
  const c = entry({ id: 'c9', kind: 'excess_charge', amount: 0.2, source: 'correction', corrects_entry_id: 'e3', reason: 'x' });
  expect(effectiveAmount(e, [e, c])).toBe(0.3);
});

test('correctionsOf lists an entry’s corrections oldest first', () => {
  expect(correctionsOf('e1', SCENARIO).map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  expect(correctionsOf('nope', SCENARIO)).toEqual([]);
});

test('correctionLine says which way a correction moved, with its amount', () => {
  expect(correctionLine(SCENARIO[1]!)).toBe('−K 30 waived');
  expect(correctionLine(SCENARIO[2]!)).toBe('+K 20 added');
  expect(correctionLine(SCENARIO[3]!)).toBe('−K 10 reduced');
});

test('only these kinds can be corrected, and never a correction or an entry with no member', () => {
  for (const kind of ['saving', 'payment', 'membership', 'txn_fee', 'penalty', 'excess_charge']) {
    expect(isCorrectable(entry({ kind, source: 'app' })), kind).toBe(true);
  }
  for (const kind of ['loan_sent', 'loan_interest', 'interest_share', 'payout_fee', 'waiver', 'adjustment']) {
    expect(isCorrectable(entry({ kind, source: 'app' })), kind).toBe(false);
  }
  expect(isCorrectable(entry({ kind: 'saving', source: 'correction', corrects_entry_id: 'e1', reason: 'x' }))).toBe(false);
  expect(isCorrectable(entry({ kind: 'saving', member_id: null }))).toBe(false);
});

test('only charges can be waived, and never a correction', () => {
  for (const kind of ['loan_interest', 'excess_charge', 'penalty']) expect(isWaivable(entry({ kind, source: 'app' })), kind).toBe(true);
  for (const kind of ['saving', 'payment', 'loan_sent', 'interest_share', 'waiver']) expect(isWaivable(entry({ kind, source: 'app' })), kind).toBe(false);
  expect(isWaivable(entry({ kind: 'penalty', source: 'correction', corrects_entry_id: 'e1', reason: 'x' }))).toBe(false);
});
