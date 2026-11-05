import { sumKwacha } from './money';

export type ProjectionInput = {
  /** Months still to run, counting the open one. */
  months: number;
  /** What the member saves each month. */
  monthly: number;
  /** The member's savings balance now, and interest earned to date. */
  balance: number;
  earnedToDate: number;
  /** The group now: total savings, owed back to the pool, idle cash. */
  groupSavings: number;
  owed: number;
  idle: number;
  /** Assumptions about the others, per month: what the rest of the group saves, new loans issued, share of what is owed repaid. */
  groupSaves: number;
  newLoans: number;
  repaidShare: number;
  loanRate: number;
  excessRate: number;
};

export type ProjectionMonth = { month: number; balance: number; interestEarned: number; payout: number };
export type Projection = {
  months: ProjectionMonth[];
  payout: number;
  /** Interest the member's share earns from now to the end. */
  interestToCome: number;
  /** The member's share of the excess interest billed to everyone, from now to the end. */
  excessCost: number;
  /** Interest to come minus the excess cost. */
  netGain: number;
};

const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Month by month, the pool lends what is idle (never in the last month), bills loan interest on new loans and excess interest on what
 * stays idle, and the member earns their share of both by savings. It is an estimate: it leaves out transfer and membership fees, assumes
 * interest billed is collected, and assumes what the member owes is repaid on schedule.
 */
export function project(i: ProjectionInput): Projection {
  let idle = Math.max(0, i.idle);
  let owed = Math.max(0, i.owed);
  let pool = Math.max(0, i.groupSavings);
  let balance = Math.max(0, i.balance);
  let earned = 0;
  let excessCost = 0;
  const months: ProjectionMonth[] = [];
  for (let m = 1; m <= Math.max(0, Math.floor(i.months)); m++) {
    const repaid = i.repaidShare * owed;
    const funds = idle + repaid + i.groupSaves + i.monthly;
    const loans = m === i.months ? 0 : Math.min(i.newLoans, funds);
    idle = funds - loans;
    const loanInterest = i.loanRate * loans;
    const excess = i.excessRate * idle;
    owed = owed - repaid + loans + loanInterest + excess;
    pool += i.groupSaves + i.monthly;
    balance += i.monthly;
    const share = pool > 0 ? balance / pool : 0;
    earned += share * (loanInterest + excess);
    excessCost += share * excess;
    months.push({ month: m, balance: r2(balance), interestEarned: r2(earned), payout: r2(balance + i.earnedToDate + earned) });
  }
  const last = months[months.length - 1];
  return {
    months,
    payout: last?.payout ?? r2(i.balance + i.earnedToDate),
    interestToCome: r2(earned),
    excessCost: r2(excessCost),
    netGain: sumKwacha(earned, -excessCost),
  };
}
