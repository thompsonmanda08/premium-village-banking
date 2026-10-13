import { money } from '@/lib/format';
import type { EntryRow } from './memberViews';
import { sumKwacha } from './money';

// The engine's rules (20261010001100 / 20261010001700): what post_correction and post_waiver accept, and how the current amount is worked out.
const CORRECTABLE = ['saving', 'payment', 'membership', 'txn_fee', 'penalty', 'excess_charge'];
const WAIVABLE = ['loan_interest', 'excess_charge', 'penalty'];
const SUBTRACTS = ['waiver', 'adjustment'];

/** A member-bound original (never a correction) of a kind the engine lets the treasurer correct. payout_fee has no member, so no member page reaches it. */
export const isCorrectable = (e: EntryRow): boolean => e.source !== 'correction' && e.member_id !== null && CORRECTABLE.includes(e.kind);

export const isWaivable = (e: EntryRow): boolean => e.source !== 'correction' && e.member_id !== null && WAIVABLE.includes(e.kind);

/** The corrections that point back at an entry, oldest first. */
export const correctionsOf = <T extends Pick<EntryRow, 'id' | 'corrects_entry_id' | 'created_at'>>(entryId: string, entries: T[]): T[] =>
  entries
    .filter((c) => c.corrects_entry_id === entryId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));

/**
 * The entry's amount plus the corrections that raise it, less the waivers and adjustments. Display only: the engine works out the same
 * figure itself and re-checks every post (pinned by supabase/tests/database/19_correction_parity.sql and the same scenario in the tests).
 */
export const effectiveAmount = (e: Pick<EntryRow, 'id' | 'amount'>, entries: Pick<EntryRow, 'id' | 'amount' | 'kind' | 'corrects_entry_id' | 'created_at'>[]): number =>
  sumKwacha(e.amount, ...correctionsOf(e.id, entries).map((c) => (SUBTRACTS.includes(c.kind) ? -c.amount : c.amount)));

/** "−K 30 waived", "+K 20 added", "−K 10 reduced". */
export function correctionLine(c: Pick<EntryRow, 'kind' | 'amount'>): string {
  if (c.kind === 'waiver') return `−${money(c.amount)} waived`;
  if (c.kind === 'adjustment') return `−${money(c.amount)} reduced`;
  return `+${money(c.amount)} added`;
}
