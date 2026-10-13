import { expect, test } from 'vitest';
import { MONTHS, PERIODS, mm } from './exportFixtures';
import { standpointOf, type MonthRow } from './standpoint';

const history = (id: string): MonthRow[] =>
  MONTHS.flatMap((m) => {
    const row = m.members.find((x) => x.member_id === id);
    return row ? [{ period: m.period, preview: m.preview, row }] : [];
  });

test('Bob’s standpoint through the May preview', () => {
  expect(standpointOf(history('m3'))).toEqual({
    savedToDate: 400, interestToDate: 6, loansTaken: 1000, loanInterest: 150, penalties: 100,
    paidIn: 400 + 300 + 500, owedNow: 200, nextMinimum: 200, monthsShort: 1,
  });
});

test('months short counts closed months only: a preview’s shortfall is not final', () => {
  const rows: MonthRow[] = [
    { period: PERIODS[1]!, preview: false, row: mm('m1', { unpaid_minimum: 10 }) },
    { period: PERIODS[3]!, preview: true, row: mm('m1', { unpaid_minimum: 99 }) },
  ];
  expect(standpointOf(rows).monthsShort).toBe(1);
});

test('the latest month decides the balances, whatever order the rows come in', () => {
  const rows = history('m1').reverse();
  expect(standpointOf(rows)).toMatchObject({ savedToDate: 1000, owedNow: 0, interestToDate: 10 });
});

test('a member with no months is all zeros, never NaN', () => {
  expect(standpointOf([])).toEqual({ savedToDate: 0, interestToDate: 0, loansTaken: 0, loanInterest: 0, penalties: 0, paidIn: 0, owedNow: 0, nextMinimum: 0, monthsShort: 0 });
});

test('ngwee add up exactly', () => {
  const rows: MonthRow[] = [
    { period: PERIODS[0]!, preview: false, row: mm('m1', { paid_total: 0.1 }) },
    { period: PERIODS[1]!, preview: false, row: mm('m1', { paid_total: 0.2 }) },
  ];
  expect(standpointOf(rows).paidIn).toBe(0.3);
});
