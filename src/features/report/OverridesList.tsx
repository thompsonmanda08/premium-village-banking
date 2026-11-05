import { money } from '@/lib/format';
import type { OverrideKind, OverrideRow } from './reportQueries';

const LABEL: Record<OverrideKind, string> = {
  correction: 'Correction posted',
  waiver: 'Charge waived',
  penalty_applied: 'Penalty applied',
  penalty_waived: 'Penalty waived',
  loan_over_cap: 'Loan sent over the limit',
  default_set: 'Marked as in default',
  default_cleared: 'Default cleared',
  deadline_extended: 'Deadline extended',
};

const day = (at: string) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lusaka' });

/** Where the treasurer departed from the rules, in the month. A hidden row (private group) names nobody and gives no amount or reason. */
export function OverridesList({ overrides, recorded }: { overrides: OverrideRow[]; recorded: boolean }) {
  if (!recorded) return <p className="text-sm text-muted">Overrides were not recorded before November 2026.</p>;
  if (overrides.length === 0) return <p className="text-sm text-muted">No overrides this month.</p>;
  // A hidden row loses member_id too; an open group's row with only a missing short name is not private.
  // A correction of an entry that has no member keeps its reason: it is a group-level row, not a hidden one.
  const groupLevel = (o: OverrideRow) => o.member === null && o.member_id === null && o.reason !== null && o.kind !== 'deadline_extended';
  const someHidden = overrides.some((o) => o.member === null && o.member_id === null && o.kind !== 'deadline_extended' && !groupLevel(o));
  return (
    <div className="grid gap-2">
      <ul role="list" className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {overrides.map((o, i) => (
          <li key={`${o.at}-${o.kind}-${i}`} className="grid gap-0.5 px-4 py-3">
            <p className="flex flex-wrap items-baseline justify-between gap-2 font-medium text-fg">
              <span>{LABEL[o.kind]}{o.kind === 'deadline_extended' || groupLevel(o) ? '' : ` · ${o.member ?? 'A member'}`}</span>
              <span className="text-sm font-normal text-muted">{day(o.at)}</span>
            </p>
            {o.amount !== null ? <p className="tabular text-sm text-fg">{money(o.amount)}</p> : null}
            {o.reason ? <p className="text-sm text-muted">{o.reason}</p> : null}
          </li>
        ))}
      </ul>
      {someHidden ? <p className="text-sm text-muted">Other members’ details are kept private.</p> : null}
    </div>
  );
}
