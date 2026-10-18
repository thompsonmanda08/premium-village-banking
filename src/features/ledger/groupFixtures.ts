import { groupStatement, statement, year } from './testFixtures';
import type { StatementRow } from './memberViews';

// Four closed months (Feb–May), four members. Eve m1, Ann m2, Bob m3, Cy m4. Minimum saving K250.
export const PERIODS = year(4);
export const PEOPLE = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }, { id: 'm3', short_name: 'Bob' }, { id: 'm4', short_name: 'Cy' }];
const ZERO: Partial<StatementRow> = {
  saving: 0, cum_savings: 0, opening_owed: 0, loan_principal_sent: 0, loan_interest_charged: 0, excess_charged: 0, penalties_charged: 0, paid_total: 0,
  paid_to_excess: 0, paid_to_penalties: 0, paid_to_interest: 0, paid_to_principal: 0, closing_owed: 0, next_minimum: 0, unpaid_minimum: 0,
  interest_earned: 0, interest_earned_to_date: 0,
};
export const S = (p: string, m: string, o: Partial<StatementRow>): StatementRow => statement({ ...ZERO, id: `${p}-${m}`, period_id: p, member_id: m, ...o });
export const STATEMENTS: StatementRow[] = [
  S('p1', 'm1', { saving: 250, cum_savings: 250 }),
  S('p1', 'm2', { saving: 500, cum_savings: 500 }),
  S('p1', 'm3', { saving: 100, cum_savings: 100, closing_owed: 1000, next_minimum: 400, loan_principal_sent: 1000, loan_interest_charged: 150 }),
  S('p1', 'm4', { saving: 250, cum_savings: 250 }),
  S('p2', 'm1', { saving: 250, cum_savings: 500, interest_earned_to_date: 5 }),
  S('p2', 'm2', { saving: 500, cum_savings: 1000, interest_earned_to_date: 10 }),
  S('p2', 'm3', { saving: 250, cum_savings: 350, paid_total: 400, next_minimum: 400, closing_owed: 600, excess_charged: 20, interest_earned_to_date: 2 }),
  S('p2', 'm4', { saving: 250, cum_savings: 500, closing_owed: 200, next_minimum: 100, interest_earned_to_date: 5 }),
  S('p3', 'm1', { saving: 250, cum_savings: 750, interest_earned_to_date: 10 }),
  S('p3', 'm2', { saving: 500, cum_savings: 1500, interest_earned_to_date: 20 }),
  S('p3', 'm3', { saving: 250, cum_savings: 600, unpaid_minimum: 400, closing_owed: 700, next_minimum: 500, excess_charged: 20, interest_earned_to_date: 2 }),
  S('p3', 'm4', { saving: 250, cum_savings: 750, unpaid_minimum: 100, closing_owed: 300, next_minimum: 150, interest_earned_to_date: 10 }),
  S('p4', 'm1', { saving: 250, cum_savings: 1000, interest_earned_to_date: 10 }),
  S('p4', 'm2', { saving: 500, cum_savings: 2000, interest_earned_to_date: 20 }),
  S('p4', 'm3', { saving: 100, cum_savings: 700, paid_total: 500, closing_owed: 200, next_minimum: 200, interest_earned_to_date: 6 }),
  S('p4', 'm4', { saving: 250, cum_savings: 1000, unpaid_minimum: 150, closing_owed: 400, next_minimum: 200, interest_earned_to_date: 10 }),
];
export const GROUPS = [
  groupStatement({ id: 'g1', period_id: 'p1', savings: 1100, total_savings: 1100, total_owed: 1000, idle_cash: 100, loans_sent: 1000, excess_billed: 10, interest_collected: 0 }),
  groupStatement({ id: 'g2', period_id: 'p2', savings: 1250, total_savings: 2350, total_owed: 800, idle_cash: 1500, loans_sent: 0, excess_billed: 150, interest_collected: 10 }),
  groupStatement({ id: 'g3', period_id: 'p3', savings: 1250, total_savings: 3600, total_owed: 1000, idle_cash: 1800, loans_sent: 0, excess_billed: 180, interest_collected: 20 }),
  groupStatement({ id: 'g4', period_id: 'p4', savings: 1100, total_savings: 4700, total_owed: 600, idle_cash: 2400, loans_sent: 0, excess_billed: 240, interest_collected: 40 }),
];

