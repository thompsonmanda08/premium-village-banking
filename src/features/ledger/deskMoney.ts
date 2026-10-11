import type { EntryRow } from './memberViews';
import { liveDeclarations, type DeclarationRow } from './model';
import { sumKwacha } from './money';

export type LoanRequest = { declaration: DeclarationRow; memberId: string; amount: number; sent: number };

/** Borrowing requests from this month's live declarations (a returned one is not a request), with what has already gone to that member. */
export function loanRequests(declarations: DeclarationRow[], loans: Array<{ member_id: string; principal: number }>): LoanRequest[] {
  return liveDeclarations(declarations)
    .filter((d) => d.borrowing_request > 0 && d.status !== 'returned')
    .map((d) => ({
      declaration: d,
      memberId: d.member_id,
      amount: d.borrowing_request,
      sent: sumKwacha(...loans.filter((l) => l.member_id === d.member_id).map((l) => l.principal)),
    }));
}

export const GROUNDS: Record<string, string> = {
  late_declaration: 'Late declaration',
  missed_minimum: 'Missed minimum',
  under_saving: 'Saved under the minimum',
  other: 'Other',
};
export const groundLabel = (ground: string): string => GROUNDS[ground] ?? ground;

export type PenaltySuggestion = { member_id: string; short_name: string; ground: string; amount: number; detail: string };

export const appliedKey = (memberId: string, ground: string): string => `${memberId}:${ground}`;

/** apply_penalty stores the reason as "<ground>: <text>". */
export function splitReason(reason: string | null): { ground: string; text: string } {
  if (!reason) return { ground: '', text: '' };
  const i = reason.indexOf(': ');
  return i === -1 ? { ground: '', text: reason } : { ground: reason.slice(0, i), text: reason.slice(i + 2) };
}

/** The member+ground pairs already penalised this month by the app (corrections are not applications). */
export function appliedGrounds(entries: EntryRow[]): Set<string> {
  const applied = new Set<string>();
  for (const e of entries) {
    if (e.kind === 'penalty' && e.source === 'app' && e.member_id) applied.add(appliedKey(e.member_id, splitReason(e.reason).ground));
  }
  return applied;
}

/** The engine keeps suggesting a penalty after it has been applied, so hide those, and the ones put off for now. */
export const openSuggestions = (suggestions: PenaltySuggestion[], applied: Set<string>, dismissed: Set<string>): PenaltySuggestion[] =>
  suggestions.filter((s) => {
    const key = appliedKey(s.member_id, s.ground);
    return !applied.has(key) && !dismissed.has(key);
  });
