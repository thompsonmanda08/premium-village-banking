import { expect, test } from 'vitest';
import { cycleMonths, daysBetween, ordinal, pickCurrentCycle, upcomingDates } from './calendar';

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

const loanDays = (c: { starts_on: string; ends_on: string; payout_on: string }, closeDay: number) =>
  upcomingDates(c, { window_open_day: 5, window_close_day: closeDay }, '2020-01-01', 50).filter((e) => e.kind === 'loans').map((e) => e.date);

test('a loan day past the end of the month is clamped to the last day of that month', () => {
  const feb = { starts_on: '2027-02-01', ends_on: '2027-03-31', payout_on: '2027-03-20' };
  expect(loanDays(feb, 28)).toEqual(['2027-02-28', '2027-03-29']); // 28 + 1 = 29 Feb does not exist in 2027
});

test('leap years keep 29 February', () => {
  const leap = { starts_on: '2028-02-01', ends_on: '2028-03-31', payout_on: '2028-03-20' };
  expect(loanDays(leap, 28)).toEqual(['2028-02-29', '2028-03-29']);
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

test('daysBetween counts calendar days across months and years', () => {
  expect(daysBetween('2027-02-15', '2027-03-15')).toBe(28);
  expect(daysBetween('2027-12-31', '2028-01-01')).toBe(1);
  expect(daysBetween('2027-03-01', '2027-02-28')).toBe(-1);
});

test('cycleMonths: a 15 Feb to 15 Feb cycle is twelve months, Feb to Jan, with the current one part filled', () => {
  const months = cycleMonths({ starts_on: '2027-02-15', ends_on: '2028-02-15' }, '2027-04-22');
  expect(months.map((m) => m.label)).toEqual(['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']);
  expect(months.slice(0, 3).map((m) => m.state)).toEqual(['past', 'past', 'current']);
  expect(months[2]!.fill).toBeCloseTo(7 / 30);
  expect(months[3]).toMatchObject({ state: 'future', fill: 0 });
});

test('cycleMonths before the start is all future, after the end all past', () => {
  const c = { starts_on: '2027-02-15', ends_on: '2028-02-15' };
  expect(cycleMonths(c, '2027-01-01').every((m) => m.state === 'future' && m.fill === 0)).toBe(true);
  expect(cycleMonths(c, '2028-03-01').every((m) => m.state === 'past' && m.fill === 1)).toBe(true);
});
