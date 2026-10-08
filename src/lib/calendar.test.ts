import { expect, test } from 'vitest';
import { ordinal, pickCurrentCycle, upcomingDates } from './calendar';

const cycle = { starts_on: '2027-02-15', ends_on: '2028-02-15', payout_on: '2028-02-05' };
const rules = { window_open_day: 5, window_close_day: 7 };

test('before the cycle: start first, then monthly windows and loan days', () => {
  expect(upcomingDates(cycle, rules, '2027-01-10', 4)).toEqual([
    { date: '2027-02-15', label: 'Cycle starts', kind: 'start' },
    { date: '2027-03-05', label: 'Declarations open (5th–7th)', kind: 'window' },
    { date: '2027-03-08', label: 'Loans sent out', kind: 'loans' },
    { date: '2027-04-05', label: 'Declarations open (5th–7th)', kind: 'window' },
  ]);
});

test('end of the cycle: payout and end are included, nothing after the end', () => {
  expect(upcomingDates(cycle, rules, '2028-01-20', 10).map((e) => `${e.date} ${e.kind}`)).toEqual([
    '2028-02-05 window',
    '2028-02-05 payout',
    '2028-02-08 loans',
    '2028-02-15 end',
  ]);
});

test('ordinals', () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd']);
});

test('current cycle: active wins, then the next planned, then the latest', () => {
  const c = (status: string, starts_on: string, ends_on: string) => ({ status, starts_on, ends_on });
  expect(pickCurrentCycle([c('planned', '2027-02-15', '2028-02-15'), c('active', '2026-02-15', '2027-02-15')], '2026-10-08')?.status).toBe('active');
  expect(pickCurrentCycle([c('closed', '2026-02-15', '2027-02-15'), c('planned', '2027-02-15', '2028-02-15')], '2027-02-20')?.status).toBe('planned');
  expect(pickCurrentCycle([c('closed', '2025-02-15', '2026-02-15'), c('closed', '2026-02-15', '2027-02-15')], '2028-01-01')?.starts_on).toBe('2026-02-15');
  expect(pickCurrentCycle([], '2027-01-01')).toBeNull();
});
