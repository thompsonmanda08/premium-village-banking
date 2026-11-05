import { money } from '@/lib/format';
import type { MyStats } from './myStats';

export type Advice = { tone: 'good' | 'watch'; text: string };

/** Plain talking points for the treasurer's conversation with one member, worked out from that member's own closed statements. */
export function memberAdvice(s: MyStats, minSaving: number): Advice[] {
  if (s.months.length === 0) return [];
  const last = s.months[s.months.length - 1]!;
  const out: Advice[] = [];
  if (s.net < 0) out.push({ tone: 'watch', text: `Charged ${money(-s.net)} more than they have earned. Look at what their loans and charges are costing them.` });
  const below = s.months.length - s.monthsAtMinimum;
  if (below > 0) out.push({ tone: 'watch', text: `Saved less than the ${money(minSaving)} minimum in ${below} of ${s.months.length} months. Agree an amount they can keep up every month.` });
  if (last.owed > 0) out.push({ tone: 'watch', text: `Owes ${money(last.owed)} at the last close, of which ${money(s.loans)} was lent to them this cycle. Agree how it will be repaid.` });
  if (s.penalties > 0) out.push({ tone: 'watch', text: `Has been charged ${money(s.penalties)} in penalties. Ask whether the 5th to 7th window is the problem.` });
  if (out.length === 0) out.push({ tone: 'good', text: 'Nothing to raise: ahead on interest, on the minimum every month and nothing overdue.' });
  return out;
}
