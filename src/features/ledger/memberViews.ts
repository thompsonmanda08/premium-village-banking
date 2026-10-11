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
export type StatementView = { statement: StatementRow; period: PeriodRow | undefined };
export type EntryGroup = { periodId: string; period: PeriodRow | undefined; entries: EntryRow[]; paidIn: number };
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

export const periodLabel = (p: PeriodRow | undefined): string => p?.label ?? 'Earlier month';

const byMonthDesc = (a: PeriodRow | undefined, b: PeriodRow | undefined) => (b?.month_index ?? -1) - (a?.month_index ?? -1);

export function statementViews(statements: StatementRow[], periods: PeriodRow[]): StatementView[] {
  const byId = new Map(periods.map((p) => [p.id, p]));
  return statements.map((statement) => ({ statement, period: byId.get(statement.period_id) })).sort((a, b) => byMonthDesc(a.period, b.period));
}

export const latestStatement = (statements: StatementRow[], periods: PeriodRow[]): StatementView | null => statementViews(statements, periods)[0] ?? null;

export function groupEntriesByPeriod(entries: EntryRow[], periods: PeriodRow[]): EntryGroup[] {
  const byId = new Map(periods.map((p) => [p.id, p]));
  const groups = new Map<string, EntryGroup>();
  for (const e of [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const g = groups.get(e.period_id) ?? { periodId: e.period_id, period: byId.get(e.period_id), entries: [], paidIn: 0 };
    g.entries.push(e);
    if (entryTone(e) === 'in') g.paidIn = sumKwacha(g.paidIn, e.amount);
    groups.set(e.period_id, g);
  }
  return [...groups.values()].sort((a, b) => byMonthDesc(a.period, b.period));
}

/** Instalments in months that are not closed yet. Instalments carry no paid flag; the statement's closing balance is the authority. */
export function remainingInstalments(loan: LoanWithInstalments, periods: PeriodRow[]): { items: RemainingInstalment[]; total: number } {
  const byId = new Map(periods.map((p) => [p.id, p]));
  const items = loan.instalments
    .flatMap((i) => {
      const p = byId.get(i.period_id);
      return p && p.status !== 'closed' ? [{ month: p.month_index, item: { id: i.id, label: p.label, amount: i.amount_due } }] : [];
    })
    .sort((a, b) => a.month - b.month)
    .map((x) => x.item);
  return { items, total: sumKwacha(...items.map((i) => i.amount)) };
}
