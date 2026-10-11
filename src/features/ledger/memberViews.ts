import type { Tables } from '@/lib/database.types';
import type { PeriodRow } from './model';
import { sumKwacha } from './money';

export type StatementRow = Tables<'statements'>;
export type EntryRow = Tables<'entries'>;
export type LoanRow = Tables<'loans'>;
export type InstalmentRow = Tables<'loan_instalments'>;
export type LoanWithInstalments = LoanRow & { instalments: InstalmentRow[] };
export type PayoutRow = { member_id: string; short_name: string; savings: number; interest_earned: number; owed: number; pot_share: number; payout: number };

export type KindTone = 'in' | 'charged' | 'earned' | 'correction' | 'other';
export type StatementView = { statement: StatementRow; period: PeriodRow };
export type EntryGroup = { periodId: string; period: PeriodRow; entries: EntryRow[]; paidIn: number };
export type RemainingInstalment = { id: string; label: string; amount: number };

const KINDS: Record<string, { label: string; tone: KindTone }> = {
  saving: { label: 'Savings', tone: 'in' },
  payment: { label: 'Payment', tone: 'in' },
  membership: { label: 'Membership', tone: 'in' },
  txn_fee: { label: 'Mobile-money fee', tone: 'in' },
  loan_sent: { label: 'Loan sent', tone: 'charged' },
  loan_interest: { label: 'Loan interest', tone: 'charged' },
  excess_charge: { label: 'Excess charge', tone: 'charged' },
  penalty: { label: 'Penalty', tone: 'charged' },
  interest_share: { label: 'Interest earned', tone: 'earned' },
  payout_fee: { label: 'Payout fee', tone: 'charged' },
  waiver: { label: 'Waiver', tone: 'correction' },
  adjustment: { label: 'Adjustment', tone: 'correction' },
};

/** Plain label for an entry kind; a kind added later shows as itself rather than hiding the row. */
export const kindLabel = (kind: string): string => KINDS[kind]?.label ?? kind;

export const entryTone = (e: EntryRow): KindTone => (e.source === 'correction' ? 'correction' : (KINDS[e.kind]?.tone ?? 'other'));

export const toneLabel = (t: KindTone): string =>
  ({ in: 'Paid in', charged: 'Charged', earned: 'Earned', correction: 'Correction', other: '' })[t];

/** A balance the member can read: a negative balance is a credit, shown as an amount, never as "owe K −50". */
export const owedFigure = (balance: number): { label: string; amount: number } =>
  balance < 0 ? { label: 'In credit', amount: -balance } : { label: 'You owe', amount: balance };

const byMonthDesc = (a: PeriodRow, b: PeriodRow) => b.month_index - a.month_index;

/** The member's statements for the active cycle's months, newest first. Statements from any other cycle are left out. */
export function statementViews(statements: StatementRow[], periods: PeriodRow[]): StatementView[] {
  const byId = new Map(periods.map((p) => [p.id, p]));
  return statements
    .flatMap((statement) => {
      const period = byId.get(statement.period_id);
      return period ? [{ statement, period }] : [];
    })
    .sort((a, b) => byMonthDesc(a.period, b.period));
}

export const latestStatement = (statements: StatementRow[], periods: PeriodRow[]): StatementView | null => statementViews(statements, periods)[0] ?? null;

export function groupEntriesByPeriod(entries: EntryRow[], periods: PeriodRow[]): EntryGroup[] {
  const byId = new Map(periods.map((p) => [p.id, p]));
  const groups = new Map<string, EntryGroup>();
  for (const e of [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const period = byId.get(e.period_id);
    if (!period) continue; // another cycle's entry
    const g = groups.get(e.period_id) ?? { periodId: e.period_id, period, entries: [], paidIn: 0 };
    g.entries.push(e);
    if (entryTone(e) === 'in') g.paidIn = sumKwacha(g.paidIn, e.amount);
    groups.set(e.period_id, g);
  }
  return [...groups.values()].sort((a, b) => byMonthDesc(a.period, b.period));
}

/**
 * A loan's scheduled instalments in months that are not closed yet. They are caps on what the close bills in a month, not a
 * balance (an imported loan keeps its original instalment for the first app month and spreads the whole remaining balance after
 * it), so they must never be added up. The statement's closing balance is the authority on what is owed.
 */
export function remainingInstalments(loan: LoanWithInstalments, periods: PeriodRow[]): RemainingInstalment[] {
  const byId = new Map(periods.map((p) => [p.id, p]));
  return loan.instalments
    .flatMap((i) => {
      const p = byId.get(i.period_id);
      return p && p.status !== 'closed' ? [{ month: p.month_index, item: { id: i.id, label: p.label, amount: i.amount_due } }] : [];
    })
    .sort((a, b) => a.month - b.month)
    .map((x) => x.item);
}
