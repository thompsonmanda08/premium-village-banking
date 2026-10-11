import { expect, test } from 'vitest';
import {
  entryTone, groupEntriesByPeriod, kindLabel, latestStatement, periodLabel, remainingInstalments, statementViews, toneLabel,
  type LoanWithInstalments,
} from './memberViews';
import { entry, instalment, loan, statement, year } from './testFixtures';

const KINDS = ['saving', 'payment', 'membership', 'txn_fee', 'loan_sent', 'loan_interest', 'excess_charge', 'penalty', 'interest_share', 'payout_fee', 'waiver', 'adjustment'];

test('every ledger kind has a plain label, and an unknown kind shows as itself', () => {
  for (const k of KINDS) expect(kindLabel(k), k).not.toBe(k);
  expect(kindLabel('mystery')).toBe('mystery');
});

test('entryTone: corrections are corrections whatever their kind; unknown kinds are neutral', () => {
  expect(entryTone(entry({ kind: 'saving' }))).toBe('in');
  expect(entryTone(entry({ kind: 'penalty' }))).toBe('charged');
  expect(entryTone(entry({ kind: 'interest_share' }))).toBe('earned');
  expect(entryTone(entry({ kind: 'waiver', source: 'correction', corrects_entry_id: 'e0', reason: 'x' }))).toBe('correction');
  expect(entryTone(entry({ kind: 'penalty', source: 'correction', corrects_entry_id: 'e0', reason: 'x' }))).toBe('correction');
  expect(entryTone(entry({ kind: 'mystery' }))).toBe('other');
});

test('toneLabel gives the tag text, empty for neutral', () => {
  expect([toneLabel('in'), toneLabel('charged'), toneLabel('earned'), toneLabel('correction'), toneLabel('other')]).toEqual(['Paid in', 'Charged', 'Earned', 'Correction', '']);
});

test('statementViews puts the newest month first and an unknown month last; latestStatement is the first', () => {
  const periods = year(8);
  const s8 = statement({ id: 's8', period_id: 'p8' });
  const s7 = statement({ id: 's7', period_id: 'p7' });
  const gone = statement({ id: 'sx', period_id: 'gone' });
  expect(statementViews([gone, s7, s8], periods).map((v) => v.statement.id)).toEqual(['s8', 's7', 'sx']);
  expect(latestStatement([s7, s8], periods)?.statement.id).toBe('s8');
  expect(latestStatement([], periods)).toBeNull();
});

test('periodLabel falls back for a month that is not in the list', () => {
  expect(periodLabel(year(8)[7])).toBe('Sep 2026');
  expect(periodLabel(undefined)).toBe('Earlier month');
});

test('groupEntriesByPeriod groups by month newest first, entries newest first, and totals what was paid in', () => {
  const periods = year(8, 'open');
  const groups = groupEntriesByPeriod(
    [
      entry({ id: 'e1', period_id: 'p8', kind: 'saving', amount: 250, created_at: '2026-09-05T08:00:00Z' }),
      entry({ id: 'e2', period_id: 'p8', kind: 'payment', amount: 100.5, created_at: '2026-09-06T08:00:00Z' }),
      entry({ id: 'e3', period_id: 'p9', kind: 'penalty', amount: 50, created_at: '2026-10-08T08:00:00Z' }),
      entry({ id: 'e4', period_id: 'gone', kind: 'saving', amount: 10, created_at: '2026-01-01T08:00:00Z' }),
    ],
    periods,
  );
  expect(groups.map((g) => g.periodId)).toEqual(['p9', 'p8', 'gone']);
  expect(groups[1]!.entries.map((e) => e.id)).toEqual(['e2', 'e1']);
  expect(groups[1]!.paidIn).toBe(350.5);
  expect(groups[0]!.paidIn).toBe(0);
  expect(groups[2]!.period).toBeUndefined();
});

test('remainingInstalments keeps only months that are not closed, in month order, with a total', () => {
  const periods = year(8, 'open'); // Sep closed, Oct open, Nov planned
  const l: LoanWithInstalments = {
    ...loan(),
    instalments: [
      instalment({ id: 'i10', period_id: 'p10', amount_due: 200 }),
      instalment({ id: 'i8', period_id: 'p8', amount_due: 200 }),
      instalment({ id: 'i9', period_id: 'p9', amount_due: 200.5 }),
    ],
  };
  const r = remainingInstalments(l, periods);
  expect(r.items.map((i) => i.label)).toEqual(['Oct 2026', 'Nov 2026']);
  expect(r.total).toBe(400.5);
});

test('a loan whose instalments are all in closed months has none left', () => {
  const l: LoanWithInstalments = { ...loan(), instalments: [instalment({ period_id: 'p8' })] };
  expect(remainingInstalments(l, year(8))).toEqual({ items: [], total: 0 });
});
