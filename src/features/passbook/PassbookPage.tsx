import { BookOpen } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { Figure } from '@/features/ledger/Figure';
import { MemberScreen } from '@/features/ledger/MemberScreen';
import { periodLabel, statementViews, type StatementRow } from '@/features/ledger/memberViews';
import { currentPeriod } from '@/features/ledger/model';
import { useLedgerCycle, useMyStatements } from '@/features/ledger/queries';
import { money } from '@/lib/format';
import { EmptyState } from '@/ui';

function breakdown(s: StatementRow): Array<{ label: string; value: number }> {
  const lines = [
    { label: 'Saved this month', value: s.saving },
    { label: 'Loan sent', value: s.loan_principal_sent },
    { label: 'Loan interest charged', value: s.loan_interest_charged },
    { label: 'Excess charged', value: s.excess_charged },
    { label: 'Penalties charged', value: s.penalties_charged },
    { label: 'Paid in total', value: s.paid_total },
    { label: 'Paid to excess', value: s.paid_to_excess },
    { label: 'Paid to penalties', value: s.paid_to_penalties },
    { label: 'Paid to interest', value: s.paid_to_interest },
    { label: 'Paid to loan principal', value: s.paid_to_principal },
  ];
  return lines.filter((l) => l.value > 0);
}

export function PassbookPage() {
  const { group, member } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const statements = useMyStatements(member?.id);
  const periods = cycle.data?.periods ?? [];
  const views = statementViews(statements.data ?? [], periods);
  const latest = views[0];
  const open = currentPeriod(periods);

  return (
    <MemberScreen
      title="Passbook"
      subtitle={latest ? `As at ${periodLabel(latest.period)}` : undefined}
      loadingLabel="Loading your passbook"
      queries={[cycle, statements]}
    >
      <div className="grid gap-4 md:gap-5 lg:max-w-3xl">
        {latest ? (
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <Figure label="Total saved" value={money(latest.statement.cum_savings)} />
            <Figure label="You owe" value={money(latest.statement.closing_owed)} />
            <Figure label="Next minimum" value={money(latest.statement.next_minimum)} />
            <Figure label="Interest earned to date" value={money(latest.statement.interest_earned_to_date)} />
          </div>
        ) : (
          <EmptyState icon={<BookOpen className="size-7" />} title="No statements yet">
            Your statements appear here once the treasurer closes each month.
          </EmptyState>
        )}

        {open ? <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">Your {open.label} statement appears when the treasurer closes the month.</p> : null}

        {views.map(({ statement: s, period }) => (
          <div key={s.id} className="rounded-2xl border border-line bg-surface shadow-sm dark:shadow-none">
            <details>
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-lg font-semibold text-fg md:px-5">
                <span>{periodLabel(period)}</span>
                <span className="tabular text-base font-normal text-muted">Owed {money(s.closing_owed)}</span>
              </summary>
              <dl className="grid gap-2 border-t border-line px-4 py-4 text-sm md:px-5">
                {breakdown(s).map((l) => (
                  <div key={l.label} className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">{l.label}</dt>
                    <dd className="tabular text-right text-fg">{money(l.value)}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 font-semibold">
                  <dt className="text-fg">Closing owed</dt>
                  <dd className="tabular text-right text-fg">{money(s.closing_owed)}</dd>
                </div>
              </dl>
            </details>
          </div>
        ))}
      </div>
    </MemberScreen>
  );
}
