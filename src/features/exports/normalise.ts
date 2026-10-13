import type { GroupFigures, MemberMonth } from './types';

const MEMBER_FIELDS = [
  'saving', 'cum_savings', 'opening_owed', 'loan_principal_sent', 'loan_interest_charged', 'excess_charged', 'penalties_charged',
  'paid_total', 'paid_to_penalties', 'paid_to_excess', 'paid_to_interest', 'paid_to_principal', 'closing_owed', 'next_minimum',
  'unpaid_minimum', 'interest_earned', 'interest_earned_to_date',
] as const satisfies readonly (keyof MemberMonth)[];

const GROUP_FIELDS = [
  'opening_cash', 'received', 'savings', 'loans_sent', 'idle_cash', 'excess_rate', 'excess_billed', 'interest_collected',
  'fee_pot_in', 'fee_pot_out', 'fee_pot_balance', 'meeting_pot_in', 'meeting_pot_balance', 'total_savings', 'total_owed',
] as const satisfies readonly (keyof GroupFigures)[];

/**
 * A statement row or a close-preview member as figures only: nothing else on the row (its id, creation time, source) travels into a file.
 * A figure the source lacks is 0; numeric strings become numbers.
 */
export function memberMonth(row: Record<string, unknown> & { member_id: string }): MemberMonth {
  const out: Record<string, unknown> = { member_id: row.member_id };
  for (const key of MEMBER_FIELDS) out[key] = Number(row[key] ?? 0);
  return out as MemberMonth;
}

export function groupFigures(row: Record<string, unknown>): GroupFigures {
  const out: Record<string, unknown> = {};
  for (const key of GROUP_FIELDS) out[key] = Number(row[key] ?? 0);
  return out as GroupFigures;
}
