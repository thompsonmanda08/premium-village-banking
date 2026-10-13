import type { PeriodRow } from '@/features/ledger/model';
import { sumKwacha } from '@/features/ledger/money';
import type { MemberMonth } from './types';

export type MonthRow = { period: PeriodRow; preview: boolean; row: MemberMonth };

export type Standpoint = {
  savedToDate: number; interestToDate: number; loansTaken: number; loanInterest: number; penalties: number; paidIn: number;
  owedNow: number; nextMinimum: number; monthsShort: number;
};

/**
 * Where a member stands after the months given. Balances are the latest month's own engine figures (cumulative savings, interest to date,
 * owed, next minimum); flows are summed. A month still open (a preview) counts toward the balances and flows but not toward "months short",
 * because its shortfall is not final until it is closed.
 */
export function standpointOf(rows: MonthRow[]): Standpoint {
  const ordered = [...rows].sort((a, b) => a.period.month_index - b.period.month_index);
  const last = ordered.at(-1)?.row;
  return {
    savedToDate: last?.cum_savings ?? 0,
    interestToDate: last?.interest_earned_to_date ?? 0,
    loansTaken: sumKwacha(...ordered.map((r) => r.row.loan_principal_sent)),
    loanInterest: sumKwacha(...ordered.map((r) => r.row.loan_interest_charged)),
    penalties: sumKwacha(...ordered.map((r) => r.row.penalties_charged)),
    paidIn: sumKwacha(...ordered.map((r) => r.row.paid_total)),
    owedNow: last?.closing_owed ?? 0,
    nextMinimum: last?.next_minimum ?? 0,
    monthsShort: ordered.filter((r) => !r.preview && r.row.unpaid_minimum > 0).length,
  };
}
