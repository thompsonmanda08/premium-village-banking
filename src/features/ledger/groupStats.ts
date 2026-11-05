import type { Tables } from '@/lib/database.types';
import { percent } from '@/features/charts/format';
import { money } from '@/lib/format';
import { TARGETS } from './healthTargets';
import type { StatementRow } from './memberViews';
import type { PeriodRow } from './model';
import { sumKwacha } from './money';

export type GroupStatementRow = Tables<'group_statements'>;
export type Person = { id: string; short_name: string };
export type Status = 'good' | 'watch' | 'bad';

export type MonthStat = {
  period: PeriodRow; label: string;
  saved: number; cum: number; loans: number; owed: number; idle: number; use: number; excessBilled: number; interestCollected: number;
  /** Member-level fields are null when member statements are not available to the viewer. */
  count: number | null; savers: number | null; minDue: number | null; minMet: number | null; metPct: number | null;
};

export type MemberStat = {
  id: string; name: string; savings: number; share: number; loans: number; interestCharged: number; penalties: number;
  earned: number; net: number; roi: number; due: number; rank: number;
};

export type Indicator = { key: 'pool' | 'minimums' | 'atRisk' | 'savers' | 'ahead' | 'concentration'; label: string; value: number; target: string; status: Status; say: string };
export type Verdict = { status: Status; title: string; say: string };
export type FollowUp = { id: string; name: string; why: string; amount: number; kind: 'owes' | 'saved' };

const byIndex = (a: PeriodRow, b: PeriodRow) => a.month_index - b.month_index;

/** The months that are closed, in order: the only ones whose figures are final. */
export const closedPeriods = (periods: PeriodRow[]): PeriodRow[] => periods.filter((p) => p.status === 'closed').sort(byIndex);

const group = (rows: StatementRow[]): Map<string, StatementRow[]> => {
  const out = new Map<string, StatementRow[]>();
  for (const r of rows) out.set(r.period_id, [...(out.get(r.period_id) ?? []), r]);
  return out;
};

/** One entry per closed month that has a group statement: the group's figures, and (when member statements are given) who saved and who met their minimum. */
export function monthStats(periods: PeriodRow[], groupRows: GroupStatementRow[], statements: StatementRow[] | null, minSaving: number): MonthStat[] {
  const closed = closedPeriods(periods);
  const byPeriod = group(statements ?? []);
  return closed.flatMap<MonthStat>((p, i) => {
    const g = groupRows.find((r) => r.period_id === p.id);
    if (!g) return [];
    const base = {
      period: p, label: p.label, saved: g.savings, cum: g.total_savings, loans: g.loans_sent, owed: g.total_owed, idle: g.idle_cash,
      use: g.total_owed + g.idle_cash > 0 ? g.total_owed / (g.total_owed + g.idle_cash) : 0, excessBilled: g.excess_billed, interestCollected: g.interest_collected,
    };
    if (!statements) return [{ ...base, count: null, savers: null, minDue: null, minMet: null, metPct: null }];
    const now = byPeriod.get(p.id) ?? [];
    const before = i > 0 ? (byPeriod.get(closed[i - 1]!.id) ?? []) : [];
    const owedLastMonth = new Set(before.filter((s) => s.next_minimum > 0).map((s) => s.member_id));
    const due = now.filter((s) => owedLastMonth.has(s.member_id));
    const met = due.filter((s) => s.unpaid_minimum === 0).length;
    return [{ ...base, count: now.length, savers: now.filter((s) => s.saving >= minSaving).length, minDue: due.length, minMet: met, metPct: due.length > 0 ? met / due.length : null }];
  });
}

/** Each person's position over the closed months, ranked by savings (ties by name). People without a statement are left out. */
export function memberStats(periods: PeriodRow[], statements: StatementRow[], people: Person[]): MemberStat[] {
  const order = new Map(closedPeriods(periods).map((p) => [p.id, p.month_index]));
  const rows = people.flatMap((person) => {
    const mine = statements.filter((s) => s.member_id === person.id && order.has(s.period_id)).sort((a, b) => order.get(a.period_id)! - order.get(b.period_id)!);
    const last = mine.at(-1);
    if (!last) return [];
    const interestCharged = sumKwacha(...mine.map((s) => s.loan_interest_charged + s.excess_charged));
    const penalties = sumKwacha(...mine.map((s) => s.penalties_charged));
    const net = sumKwacha(last.interest_earned_to_date, -interestCharged, -penalties);
    return [{
      id: person.id, name: person.short_name, savings: last.cum_savings, loans: sumKwacha(...mine.map((s) => s.loan_principal_sent)),
      interestCharged, penalties, earned: last.interest_earned_to_date, net, roi: last.cum_savings > 0 ? net / last.cum_savings : 0, due: last.closing_owed,
    }];
  });
  const total = rows.reduce((sum, r) => sum + r.savings, 0);
  return rows
    .sort((a, b) => b.savings - a.savings || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, share: total > 0 ? r.savings / total : 0, rank: i + 1 }));
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/** The typical member's saving in each closed month (null for a month with no statements). */
export function medianSavings(periods: PeriodRow[], statements: StatementRow[]): Array<number | null> {
  const byPeriod = group(statements);
  return closedPeriods(periods).map((p) => median((byPeriod.get(p.id) ?? []).map((s) => s.saving)));
}

/** Members who owed a minimum after each of the two months before the last, and paid nothing in each of the last two. Needs three closed months. */
export function atRiskIds(periods: PeriodRow[], statements: StatementRow[]): string[] {
  const closed = closedPeriods(periods);
  if (closed.length < 3) return [];
  const [p0, a, b] = closed.slice(-3);
  const at = (id: string) => new Map(statements.filter((s) => s.period_id === id).map((s) => [s.member_id, s]));
  const s0 = at(p0!.id);
  const sa = at(a!.id);
  const sb = at(b!.id);
  return [...sb.keys()].filter((id) => {
    const x0 = s0.get(id);
    const xa = sa.get(id);
    return !!x0 && !!xa && x0.next_minimum > 1 && xa.next_minimum > 1 && xa.paid_total === 0 && sb.get(id)!.paid_total === 0;
  });
}

const higher = (v: number, t: { good: number; watch: number }): Status => (v >= t.good ? 'good' : v >= t.watch ? 'watch' : 'bad');
const lower = (v: number, t: { good: number; watch: number }): Status => (v < t.good ? 'good' : v < t.watch ? 'watch' : 'bad');
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The group's health signs against the targets, and an overall verdict. A sign with no data is left out. */
export function healthIndicators({ months, members, atRisk, minSaving }: { months: MonthStat[]; members: MemberStat[]; atRisk: MemberStat[]; minSaving: number }): { indicators: Indicator[]; verdict: Verdict } {
  const last = months.at(-1);
  const indicators: Indicator[] = [];
  if (last) {
    indicators.push({
      key: 'pool', label: 'Pool working', value: last.use, target: TARGETS.poolWorking.text, status: higher(last.use, TARGETS.poolWorking),
      say: `${money(last.idle)} sat idle as cash in ${last.label}, so members were billed ${money(last.excessBilled)} in excess interest that month.`,
    });
    const withMinimum = [...months].reverse().find((m) => m.metPct !== null);
    if (withMinimum && withMinimum.metPct !== null) {
      indicators.push({
        key: 'minimums', label: 'Minimum payments met', value: withMinimum.metPct, target: TARGETS.minimumsMet.text, status: higher(withMinimum.metPct, TARGETS.minimumsMet),
        say: `${withMinimum.minMet} of ${withMinimum.minDue} members paid at least their ${withMinimum.label} minimum.`,
      });
    }
    const owedByRisk = sumKwacha(...atRisk.map((m) => m.due));
    const atRiskShare = last.cum > 0 ? owedByRisk / last.cum : 0;
    indicators.push({
      key: 'atRisk', label: 'Balances at risk', value: atRiskShare, target: TARGETS.atRisk.text, status: lower(atRiskShare, TARGETS.atRisk),
      say: atRisk.length === 0 ? 'Nobody has missed the last two statements.' : `${atRisk.length} ${plural(atRisk.length, 'member', 'members')} paid nothing on the last two statements. Together they owe ${money(owedByRisk)}.`,
    });
    const asked = last.count ?? members.length; // that month's members; today's roster when the count is not known
    if (last.savers !== null && asked > 0) {
      const share = last.savers / asked;
      indicators.push({
        key: 'savers', label: `Saving at least ${money(minSaving)}`, value: share, target: TARGETS.savers.text, status: higher(share, TARGETS.savers),
        say: `${last.savers} of ${asked} members met the ${money(minSaving)} minimum in ${last.label}.`,
      });
    }
  }
  if (members.length > 0) {
    const behind = members.filter((m) => m.net < 0).length;
    indicators.push({
      key: 'ahead', label: 'Members ahead', value: (members.length - behind) / members.length, target: TARGETS.behind.text,
      status: behind <= TARGETS.behind.good ? 'good' : behind <= TARGETS.behind.watch ? 'watch' : 'bad',
      say: `${members.length - behind} ${plural(members.length - behind, 'member has', 'members have')} earned more interest than they’ve been charged. ${behind} ${plural(behind, 'is', 'are')} behind.`,
    });
    const top = members[0]!;
    indicators.push({
      key: 'concentration', label: 'Largest saver’s share', value: top.share, target: TARGETS.concentration.text, status: lower(top.share, TARGETS.concentration),
      say: `One member holds ${percent(top.share)} of all savings, so the pool depends heavily on them staying in.`,
    });
  }
  const bad = indicators.filter((i) => i.status === 'bad').length;
  const watch = indicators.filter((i) => i.status === 'watch').length;
  const verdict: Verdict =
    indicators.length === 0
      ? { status: 'good', title: 'Not enough data yet', say: 'The health check appears once members have statements.' }
      : bad > 0
        ? { status: 'bad', title: 'Needs attention', say: `${bad} of ${indicators.length} health signs ${plural(bad, 'is', 'are')} red.` }
        : watch >= 2
          ? { status: 'watch', title: 'Worth watching', say: `${watch} of ${indicators.length} health signs need watching.` }
          : { status: 'good', title: 'Healthy', say: `The group is on track on all ${indicators.length} health signs.` };
  return { indicators, verdict };
}

/** People the committee may want to check in with: those at risk first (what they owe), then those who saved below the minimum last month. */
export function followUp({ periods, statements, people, minSaving }: { periods: PeriodRow[]; statements: StatementRow[]; people: Person[]; minSaving: number }): FollowUp[] {
  const last = closedPeriods(periods).at(-1);
  if (!last) return [];
  const names = new Map(people.map((p) => [p.id, p.short_name]));
  const latest = new Map(statements.filter((s) => s.period_id === last.id).map((s) => [s.member_id, s]));
  const risky = atRiskIds(periods, statements).filter((id) => names.has(id));
  const owes: FollowUp[] = risky.map((id) => ({ id, name: names.get(id)!, why: 'No payment on the last two statements', amount: latest.get(id)?.closing_owed ?? 0, kind: 'owes' }));
  const saved: FollowUp[] = [...latest.values()]
    .filter((s) => names.has(s.member_id) && !risky.includes(s.member_id) && s.saving < minSaving)
    .map((s) => ({ id: s.member_id, name: names.get(s.member_id)!, why: `Saved less than ${money(minSaving)} in ${last.label}`, amount: s.saving, kind: 'saved' as const }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...owes, ...saved];
}
