import type { EntryRow, LoanRow, PayoutRow } from '@/features/ledger/memberViews';
import type { PeriodRow } from '@/features/ledger/model';
import type { MemberStatusRow } from '@/features/ledger/queries';

/** One month's group-level figures (a group statement, or the group part of a close preview). */
export type GroupFigures = {
  opening_cash: number; received: number; savings: number; loans_sent: number; idle_cash: number;
  excess_rate: number; excess_billed: number; interest_collected: number;
  fee_pot_in: number; fee_pot_out: number; fee_pot_balance: number;
  meeting_pot_in: number; meeting_pot_balance: number; total_savings: number; total_owed: number;
};

/** One member's figures for one month (a statement row, or a member of a close preview): the figures and no ids but the member's. */
export type MemberMonth = {
  member_id: string;
  saving: number; cum_savings: number; opening_owed: number; loan_principal_sent: number; loan_interest_charged: number;
  excess_charged: number; penalties_charged: number; paid_total: number; paid_to_penalties: number; paid_to_excess: number;
  paid_to_interest: number; paid_to_principal: number; closing_owed: number; next_minimum: number; unpaid_minimum: number;
  interest_earned: number; interest_earned_to_date: number;
};

/**
 * A closed month, or the open month as a preview (always last, `preview` true, `closedOn` null). A month loaded from the treasurer's
 * workbook is `imported` with no `closedOn`: the date it was closed in the database is the import date, which would mislead.
 */
export type MonthFigures = { period: PeriodRow; closedOn: string | null; imported: boolean; preview: boolean; group: GroupFigures; members: MemberMonth[] };

// The columns the exports read, and no others: never an account id (created_by, changed_by), a default's reason or a loan's warnings.
export type ExportEntry = Pick<EntryRow, 'id' | 'member_id' | 'kind' | 'amount' | 'period_id' | 'source' | 'reason' | 'created_at' | 'corrects_entry_id'>;
export type ExportLoan = Pick<LoanRow, 'id' | 'member_id' | 'period_id' | 'principal' | 'interest' | 'term_months' | 'status' | 'sent_at'>;
export type ExportStatus = Pick<MemberStatusRow, 'member_id' | 'defaulted'>;
export type ExportStatement = MemberMonth & { period_id: string };
export type ExportGroupStatement = GroupFigures & { period_id: string; source: string };

/** The only member fields ever read: no e-mail, phone or account id. */
export type Person = { id: string; short_name: string; full_name: string; status: string };

export type MonthExport = {
  groupName: string; cycleLabel: string; generatedOn: Date;
  figures: MonthFigures;
  /** Last month's `next_minimum` per member: what was due this month. Empty for the first month. */
  minimumDue: Record<string, number>;
  people: Person[]; periods: PeriodRow[];
  /** Every entry recorded in the month, and the earlier entries its corrections point at. */
  entries: ExportEntry[]; originals: ExportEntry[];
};

export type PeriodExport = {
  groupName: string; cycleLabel: string; generatedOn: Date;
  /** Closed months in order, then the open month as a preview when the engine could preview it. */
  months: MonthFigures[];
  /** The open month, when its preview was refused only because declarations are waiting. */
  openLeftOut: PeriodRow | null;
  /** Label of the month `payout` is worked from: the open month, else the last closed one. */
  payoutAsAt: string | null;
  people: Person[]; periods: PeriodRow[]; loans: ExportLoan[]; statuses: ExportStatus[]; payout: PayoutRow[];
};

export type MemberMonthEntry = { period: PeriodRow; closedOn: string | null; preview: boolean; row: MemberMonth };

/** Only this member's data. */
export type MemberExport = {
  groupName: string; cycleLabel: string; generatedOn: Date;
  person: Person;
  months: MemberMonthEntry[];
  openLeftOut: PeriodRow | null;
  payoutAsAt: string | null;
  periods: PeriodRow[]; loans: ExportLoan[]; status: ExportStatus | null; payout: PayoutRow | null; entries: ExportEntry[];
};
