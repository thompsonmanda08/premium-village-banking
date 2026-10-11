import { owedFigure } from '@/features/ledger/memberViews';
import type { CloseGroup, CloseMember, ClosePreview } from '@/features/ledger/queries';
import { money } from '@/lib/format';
import { Alert } from '@/ui';
import { DifferenceList } from './DifferenceList';

const GROUP_LINES: Array<[keyof CloseGroup, string]> = [
  ['opening_cash', 'Opening cash'],
  ['received', 'Received this month'],
  ['savings', 'Saved this month'],
  ['loans_sent', 'Loans sent'],
  ['idle_cash', 'Idle cash'],
  ['excess_billed', 'Excess billed'],
  ['interest_collected', 'Interest collected'],
  ['fee_pot_balance', 'Fee pot'],
  ['meeting_pot_balance', 'Meeting pot'],
  ['total_savings', 'Total savings'],
  ['total_owed', 'Total owed'],
];

// Corrections land in the open month, so a line can be negative; only an untouched zero is hidden.
const memberLines = (m: CloseMember): Array<[string, number]> =>
  (
    [
      ['Owed at the start', m.opening_owed],
      ['Saved this month', m.saving],
      ['Loan sent', m.loan_principal_sent],
      ['Loan interest charged', m.loan_interest_charged],
      ['Excess charged', m.excess_charged],
      ['Penalties charged', m.penalties_charged],
      ['Paid in total', m.paid_total],
      ['Paid to excess', m.paid_to_excess],
      ['Paid to penalties', m.paid_to_penalties],
      ['Paid to interest', m.paid_to_interest],
      ['Paid to loan principal', m.paid_to_principal],
      ['Interest earned this month', m.interest_earned],
      ['Interest earned so far', m.interest_earned_to_date],
    ] as Array<[string, number]>
  ).filter(([, value]) => value !== 0);

const Row = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
  <div className={`flex items-baseline justify-between gap-4 ${strong ? 'font-semibold' : ''}`}>
    <dt className={strong ? 'text-fg' : 'text-muted'}>{label}</dt>
    <dd className="tabular text-right text-fg">{money(value)}</dd>
  </div>
);

/** What the close would write: the group's figures, every member's statement, and the comparison with the workbook. */
export function ClosePreviewView({ preview }: { preview: ClosePreview }) {
  return (
    <div className="grid gap-6">
      <section aria-labelledby="close-group" className="grid gap-3">
        <h2 id="close-group" className="text-xl font-semibold text-fg">Group statement</h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {GROUP_LINES.map(([key, label]) => (
            <div key={key} className="rounded-xl border border-line bg-surface p-3">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="tabular text-base font-semibold text-fg">{money(preview.group[key])}</dd>
            </div>
          ))}
        </dl>
        {preview.group.fee_pot_balance < 0 ? (
          <Alert tone="warning">The fee pot is short: loan transfer fees are more than members declared.</Alert>
        ) : null}
      </section>

      <section aria-labelledby="close-members" className="grid gap-3">
        <h2 id="close-members" className="text-xl font-semibold text-fg">Members ({preview.members.length})</h2>
        {preview.members.map((m) => {
          const owed = owedFigure(m.closing_owed);
          return (
            <div key={m.member_id} className="rounded-2xl border border-line bg-surface shadow-sm dark:shadow-none">
              <details>
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-lg font-semibold text-fg md:px-5">
                  <span>{m.short_name}</span>
                  <span className="tabular text-base font-normal text-muted">{`${owed.label === 'In credit' ? 'In credit' : 'Owed'} ${money(owed.amount)}`}</span>
                </summary>
                <dl className="grid gap-2 border-t border-line px-4 py-4 text-sm md:px-5">
                  {memberLines(m).map(([label, value]) => <Row key={label} label={label} value={value} />)}
                  <Row label={m.closing_owed < 0 ? 'Closing credit' : 'Closing owed'} value={owed.amount} strong />
                  <Row label="Total saved so far" value={m.cum_savings} />
                  <Row label="Next minimum" value={m.next_minimum} />
                </dl>
              </details>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="close-compare" className="grid gap-3">
        <h2 id="close-compare" className="text-xl font-semibold text-fg">Workbook comparison</h2>
        {preview.diff.length === 0 ? (
          <p className="text-sm text-muted">No workbook figures are loaded for this month, so there is nothing to compare.</p>
        ) : (
          <>
            {preview.unexplained > 0 ? (
              <Alert tone="danger">{`${preview.unexplained} difference${preview.unexplained === 1 ? '' : 's'} from the workbook ${preview.unexplained === 1 ? 'is' : 'are'} unexplained.`}</Alert>
            ) : null}
            <DifferenceList diff={preview.diff} />
          </>
        )}
      </section>
    </div>
  );
}
