import { money } from '@/lib/format';
import { Badge, type Tone } from '@/ui';
import type { LedgerDiff } from './useLedgerCheck';

// The spec's fixed reason codes, in the order the treasurer should read them.
const REASONS: { code: string; label: string; tone: Tone }[] = [
  { code: 'unexplained', label: 'Unexplained', tone: 'danger' },
  { code: 'workbook_missed_loan', label: 'Workbook left a loan out of the minimum', tone: 'warning' },
  { code: 'workbook_term_differs', label: 'Workbook used a different repayment term', tone: 'warning' },
  { code: 'penalty_not_charged', label: 'Workbook asked for a charge the app does not raise', tone: 'warning' },
  { code: 'workbook_counts_excess_twice', label: 'Workbook counted the month\'s excess twice in the minimum', tone: 'warning' },
  { code: 'penalty_in_minimum', label: 'Workbook included the month\'s penalty in the minimum', tone: 'warning' },
  { code: 'waiver', label: 'Waived by the treasurer', tone: 'info' },
  { code: 'fee_pot_vs_cash', label: 'Loan fees paid from the fee pot, not lending cash', tone: 'info' },
  { code: 'workbook_rounded', label: 'Workbook rounding', tone: 'neutral' },
];

// A code the page does not know is still shown, never dropped.
const OTHER = { code: '*', label: 'Other differences', tone: 'warning' as Tone };
const KNOWN = new Set(REASONS.map((r) => r.code));

const FIELDS: Record<string, string> = {
  cum_savings: 'Savings to date',
  excess_charged: 'Excess charge',
  closing_owed: 'Owed',
  next_minimum: 'Minimum due',
  opening_cash: 'Opening cash',
  idle_cash: 'Idle cash',
  excess_billed: 'Excess billed',
};

// money() puts the minus after the K (K −50); a difference reads better as −K 50.
const signed = (n: number | null) => (n === null ? 'not available' : n < 0 ? `−${money(-n)}` : money(n));
// A figure the app has none for (the workbook lists a member the close does not).
const orNone = (n: number | null) => (n === null ? 'none' : money(n));

/** The differences between the app's figures and the workbook's, grouped by reason code. */
export function DifferenceList({ diff }: { diff: LedgerDiff[] }) {
  return (
    <div className="grid gap-4">
      {[...REASONS, OTHER].map(({ code, label, tone }) => {
        const rows = diff.filter((d) => (code === OTHER.code ? !KNOWN.has(d.reason_code) : d.reason_code === code));
        if (rows.length === 0) return null;
        return (
          <section key={code}>
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-fg">
              {label}
              <Badge tone={tone}>{rows.length}</Badge>
            </h3>
            <ul role="list" className="grid gap-2">
              {rows.map((d) => (
                <li key={`${d.member_id ?? 'group'}-${d.field}`} className="rounded-xl bg-surface-2 p-3 text-sm text-fg">
                  <p className="font-semibold">{`${d.short_name ?? 'Group'} · ${FIELDS[d.field] ?? d.field}`}</p>
                  <p className="tabular text-muted">{`App ${orNone(d.app)} · Workbook ${money(d.workbook)} · Difference ${signed(d.difference)}`}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
