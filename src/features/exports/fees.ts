import type { EntryRow } from '@/features/ledger/memberViews';
import { sumKwacha } from '@/features/ledger/money';

export type FeeTotals = { txn_fee: number; membership: number };
const SUBTRACTS = ['waiver', 'adjustment'];

/**
 * Each member's transfer fees and membership fees recorded in one period, counted the way the engine counts them
 * (private.ledger_lines, pinned by supabase/tests/database/20_export_fee_fold.sql): a waiver or adjustment counts negative under the
 * kind of the entry it points at, so a fee corrected in April shows in April and March keeps its closing figure.
 * `originals` are the earlier entries the period's corrections point at.
 */
export function feeFold(periodEntries: EntryRow[], originals: EntryRow[]): Map<string, FeeTotals> {
  const byId = new Map([...originals, ...periodEntries].map((e) => [e.id, e]));
  const parts = new Map<string, { txn_fee: number[]; membership: number[] }>();
  for (const e of periodEntries) {
    if (e.member_id === null) continue;
    const subtracts = SUBTRACTS.includes(e.kind);
    const kind = subtracts ? byId.get(e.corrects_entry_id ?? '')?.kind : e.kind;
    if (kind !== 'txn_fee' && kind !== 'membership') continue;
    const slot = parts.get(e.member_id) ?? { txn_fee: [], membership: [] };
    slot[kind].push(subtracts ? -e.amount : e.amount);
    parts.set(e.member_id, slot);
  }
  return new Map([...parts].map(([id, p]) => [id, { txn_fee: sumKwacha(...p.txn_fee), membership: sumKwacha(...p.membership) }]));
}
