import type { MemberStat } from './groupStats';
import type { PayoutRow } from './memberViews';
import { sumKwacha } from './money';

export type PoolLines = { savings: number; interest: number; entitled: number; owed: number; pots: number; estimated: number };
export type PoolRow = MemberStat & { payout: number | null; defaulted: boolean };
export type SortKey = 'name' | 'savings' | 'share' | 'loans' | 'interestCharged' | 'earned' | 'net' | 'roi' | 'due' | 'payout';

const total = (rows: PayoutRow[], k: 'savings' | 'interest_earned' | 'owed' | 'pot_share' | 'payout'): number => sumKwacha(...rows.map((r) => r[k]));

/** The whole group's payout lines, added from the engine's rows (nothing is recomputed). */
export function poolLines(rows: PayoutRow[]): PoolLines {
  const savings = total(rows, 'savings');
  const interest = total(rows, 'interest_earned');
  return { savings, interest, entitled: sumKwacha(savings, interest), owed: total(rows, 'owed'), pots: total(rows, 'pot_share'), estimated: total(rows, 'payout') };
}

export function memberRows(members: MemberStat[], payout: PayoutRow[], defaulted: Set<string>): PoolRow[] {
  const byId = new Map(payout.map((p) => [p.member_id, p.payout]));
  return members.map((m) => ({ ...m, payout: byId.get(m.id) ?? null, defaulted: defaulted.has(m.id) }));
}

/** Stable sort; a missing payout sorts last in both directions. The input is not changed. */
export function sortRows(rows: PoolRow[], key: SortKey, dir: 'asc' | 'desc'): PoolRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      if (key === 'payout' && (a.r.payout === null || b.r.payout === null)) return a.r.payout === b.r.payout ? a.i - b.i : a.r.payout === null ? 1 : -1;
      const x = key === 'name' ? a.r.name.localeCompare(b.r.name) : (a.r[key] as number) - (b.r[key] as number);
      return x * sign || a.i - b.i;
    })
    .map((x) => x.r);
}
