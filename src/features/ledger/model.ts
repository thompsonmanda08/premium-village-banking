import { daysBetween } from '@/lib/calendar';
import type { Tables } from '@/lib/database.types';

export type PeriodRow = Pick<Tables<'periods'>, 'id' | 'cycle_id' | 'month_index' | 'label' | 'starts_on' | 'deadline' | 'status'>;
export type DeclarationRow = Tables<'declarations'>;
export type Wallet = { id: string; name: string };
export type ActiveMember = { id: string; short_name: string };

/** The month members are declaring for: the open one. */
export const currentPeriod = (periods: PeriodRow[]): PeriodRow | null => periods.find((p) => p.status === 'open') ?? null;

/** The most recent closed month. */
export const lastClosed = (periods: PeriodRow[]): PeriodRow | null =>
  periods.filter((p) => p.status === 'closed').sort((a, b) => b.month_index - a.month_index)[0] ?? null;

/** The month the treasurer can open next: the first planned one, only when nothing is open or closing and every earlier month is closed. */
export function nextToOpen(periods: PeriodRow[]): PeriodRow | null {
  if (periods.some((p) => p.status === 'open' || p.status === 'closing')) return null;
  const next = periods.filter((p) => p.status === 'planned').sort((a, b) => a.month_index - b.month_index)[0];
  if (!next) return null;
  return periods.every((p) => p.month_index >= next.month_index || p.status === 'closed') ? next : null;
}

/** A resubmission replaces the waiting or returned declaration it points at; what nothing replaced is the live one. */
export function liveDeclarations(rows: DeclarationRow[]): DeclarationRow[] {
  const replaced = new Set(rows.map((r) => r.supersedes_id).filter((id): id is string => id !== null));
  return rows.filter((r) => !replaced.has(r.id));
}

type MemberViewRow = { id: string | null; short_name: string | null; status: string | null };
export const activeMembers = (rows: MemberViewRow[]): ActiveMember[] =>
  rows.flatMap((r) => (r.status === 'active' && r.id && r.short_name ? [{ id: r.id, short_name: r.short_name }] : []));

export const undeclared = (members: ActiveMember[], live: DeclarationRow[]): ActiveMember[] => {
  const declared = new Set(live.map((d) => d.member_id));
  return members.filter((m) => !declared.has(m.id));
};

export function deadlineNote(today: string, deadline: string): { text: string; tone: 'neutral' | 'warning' | 'danger' } {
  const n = daysBetween(today, deadline);
  if (n < 0) return { text: 'Past the deadline', tone: 'danger' };
  if (n === 0) return { text: 'Due today', tone: 'warning' };
  return { text: `${n} day${n === 1 ? '' : 's'} left`, tone: n <= 2 ? 'warning' : 'neutral' };
}
