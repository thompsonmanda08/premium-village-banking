import type { PeriodRow } from './model';
import { statementViews, type StatementRow } from './memberViews';
import { sumKwacha } from './money';

export type MyMonth = {
  label: string; saving: number; balance: number; loan: number; loanInterest: number; excess: number; penalty: number;
  owed: number; paid: number; earned: number; charges: number; net: number;
};
export type MyStats = {
  months: MyMonth[];
  savings: number; loans: number; interestCharged: number; penalties: number; earned: number;
  /** Interest earned minus loan interest, excess interest and penalties charged. Fees are not in the statements. */
  net: number; roi: number; monthsAtMinimum: number;
};

/** The member's closed months in order, with running totals and the profit-or-loss line. */
export function myStats(statements: StatementRow[], periods: PeriodRow[], minSaving: number): MyStats {
  const asc = statementViews(statements, periods.filter((p) => p.status === 'closed')).reverse();
  let charges = 0;
  const months = asc.map(({ statement: s, period }): MyMonth => {
    charges = sumKwacha(charges, s.loan_interest_charged, s.excess_charged, s.penalties_charged);
    return {
      label: period.label, saving: s.saving, balance: s.cum_savings, loan: s.loan_principal_sent, loanInterest: s.loan_interest_charged,
      excess: s.excess_charged, penalty: s.penalties_charged, owed: s.closing_owed, paid: s.paid_total,
      earned: s.interest_earned_to_date, charges, net: sumKwacha(s.interest_earned_to_date, -charges),
    };
  });
  const last = months[months.length - 1];
  const sum = (k: 'loan' | 'loanInterest' | 'excess' | 'penalty') => months.reduce((t, m) => sumKwacha(t, m[k]), 0);
  const savings = last?.balance ?? 0;
  const net = last?.net ?? 0;
  return {
    months, savings, loans: sum('loan'), interestCharged: sumKwacha(sum('loanInterest'), sum('excess')), penalties: sum('penalty'),
    earned: last?.earned ?? 0, net, roi: savings > 0 ? net / savings : 0, monthsAtMinimum: months.filter((m) => m.saving >= minSaving).length,
  };
}
