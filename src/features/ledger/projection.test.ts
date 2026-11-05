import { expect, test } from 'vitest';
import { project, type ProjectionInput } from './projection';

const base: ProjectionInput = {
  months: 2, monthly: 100, balance: 1000, earnedToDate: 50, groupSavings: 10000, owed: 4000, idle: 1000,
  groupSaves: 900, newLoans: 2000, repaidShare: 0.25, loanRate: 0.15, excessRate: 0.1,
};

test('two-month horizon, worked by hand', () => {
  // Month 1: repaid 1000; funds 1000+1000+900+100 = 3000; loans 2000; idle 1000; loan interest 300; excess 100;
  //   owed 4000-1000+2000+300+100 = 5400; pool 11000; balance 1100; share 0.1; earned 0.1*400 = 40.
  // Month 2 (last, no loans): repaid 1350; funds 1000+1350+1000 = 3350; idle 3350; excess 335; pool 12000; balance 1200;
  //   share 0.1; earned 40 + 33.5 = 73.5; excess cost 10 + 33.5 = 43.5.
  const p = project(base);
  expect(p.months.map((m) => m.interestEarned)).toEqual([40, 73.5]);
  expect(p).toMatchObject({ payout: 1200 + 50 + 73.5, interestToCome: 73.5, excessCost: 43.5, netGain: 30 });
});

test('stopping now earns less than saving on, and zero months changes nothing', () => {
  expect(project({ ...base, monthly: 0 }).payout).toBeLessThan(project(base).payout);
  expect(project({ ...base, months: 0 })).toMatchObject({ months: [], payout: 1050, netGain: 0 });
});

test('no savings anywhere never divides by zero', () => {
  const p = project({ ...base, balance: 0, groupSavings: 0, monthly: 0, groupSaves: 0 });
  expect(Number.isFinite(p.payout)).toBe(true);
  expect(p.interestToCome).toBe(0);
});
