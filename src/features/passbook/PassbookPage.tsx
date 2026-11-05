import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { Figure } from '@/features/ledger/Figure';
import { MemberScreen } from '@/features/ledger/MemberScreen';
import { owedFigure, statementViews, type StatementRow } from '@/features/ledger/memberViews';
import { MyCharts } from '@/features/ledger/MyCharts';
import { currentPeriod, lastClosed } from '@/features/ledger/model';
import { useLedgerCycle, useMyStatements } from '@/features/ledger/queries';
import { reportPath } from '@/features/report/reportQueries';
import { QueryFigureSheet } from '@/features/queries/QueryFigureSheet';
import { QUERY_FIELDS, fieldLabel, useMyQueries } from '@/features/queries/queryHooks';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { Alert, Button, EmptyState } from '@/ui';
import { BreakdownPanel } from './BreakdownPanel';

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
  // Corrections land in the open month, so a line can be negative; only an untouched zero is hidden.
  return lines.filter((l) => l.value !== 0);
}

export function PassbookPage() {
  const { group, member } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const statements = useMyStatements(member?.id);
  const periods = cycle.data?.periods ?? [];
  const views = statementViews(statements.data ?? [], periods);
  const latest = views[0];
  const open = currentPeriod(periods);
  const closed = lastClosed(periods);
  const myQueries = useMyQueries(member?.id);
  const [questioning, setQuestioning] = useState<string | null>(null);

  return (
    <MemberScreen
      title="Passbook"
      subtitle={latest ? `As at ${latest.period.label}` : undefined}
      loadingLabel="Loading your passbook"
      queries={[cycle, statements]}
    >
      <div className="grid gap-4 md:gap-5">
        {latest ? (
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <Figure label="Total saved" value={money(latest.statement.cum_savings)} />
            <Figure
              label={owedFigure(latest.statement.closing_owed).label}
              value={money(owedFigure(latest.statement.closing_owed).amount)}
              note={`At close of ${latest.period.label}`}
            />
            <Figure label="Next minimum" value={money(latest.statement.next_minimum)} />
            <Figure label="Interest earned to date" value={money(latest.statement.interest_earned_to_date)} />
          </div>
        ) : (
          <EmptyState icon={<BookOpen className="size-7" />} title="No statements yet">
            Your statements appear here once the treasurer closes each month.
          </EmptyState>
        )}

        {latest && member ? (
          <>
            <BreakdownPanel memberId={member.id} periodId={latest.period.id} />
            <div className="rounded-2xl border border-line bg-surface p-4 md:p-5">
              <h3 className="text-base font-semibold text-fg">Does a figure look wrong?</h3>
              <ul role="list" className="mt-1 divide-y divide-line">
                {Object.entries(QUERY_FIELDS).map(([field, label]) => (
                  <li key={field} className="py-1">
                    <Button size="sm" variant="secondary" fullWidth onClick={() => setQuestioning(field)}>Question {label}</Button>
                  </li>
                ))}
              </ul>
            </div>
            {questioning ? <QueryFigureSheet periodId={latest.period.id} field={questioning} open onClose={() => setQuestioning(null)} /> : null}
          </>
        ) : null}

        {member ? (
          <section aria-labelledby="my-questions" className="rounded-2xl border border-line bg-surface p-4 md:p-5">
            <h3 id="my-questions" className="text-base font-semibold text-fg">Your questions</h3>
            {myQueries.isError ? (
              <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void myQueries.refetch()}>Try again</Button>}>
                {friendlyError(myQueries.error)}
              </Alert>
            ) : myQueries.data && myQueries.data.length === 0 ? (
              <p className="mt-1 text-sm text-muted">You haven’t asked any questions.</p>
            ) : myQueries.data ? (
              <ul role="list" className="mt-1 divide-y divide-line text-sm">
                {myQueries.data.map((q) => (
                  <li key={q.id} className="py-3">
                    <p className="text-muted">{fieldLabel(q.field)} · {periods.find((p) => p.id === q.period_id)?.label ?? 'Earlier month'}</p>
                    <p className="text-fg"><span className="sr-only">Your question: </span>{q.note}</p>
                    {q.reply ? <p className="mt-1 text-muted"><span className="sr-only">Reply: </span>{q.reply}</p> : <p className="mt-1 text-muted">Waiting for a reply</p>}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {open ? <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">Your {open.label} statement appears when the treasurer closes the month.</p> : null}

        {closed ? <Link to={reportPath(closed.starts_on)} className="inline-flex min-h-12 items-center font-semibold text-accent underline-offset-4 hover:underline">Read the {closed.label} report</Link> : null}

        <MyCharts statements={statements.data ?? []} periods={periods} view="passbook" />

        <div className="grid gap-4 md:gap-5 lg:grid-cols-2 lg:items-start">
        {views.map(({ statement: s, period }) => (
          <div key={s.id} className="rounded-2xl border border-line bg-surface shadow-sm dark:shadow-none">
            <details>
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-lg font-semibold text-fg md:px-5">
                <span>{period.label}</span>
                <span className="tabular text-base font-normal text-muted">{s.closing_owed < 0 ? 'In credit' : 'Owed'} {money(Math.abs(s.closing_owed))}</span>
              </summary>
              <dl className="grid gap-2 border-t border-line px-4 py-4 text-sm md:px-5">
                {breakdown(s).map((l) => (
                  <div key={l.label} className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">{l.label}</dt>
                    <dd className="tabular text-right text-fg">{money(l.value)}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 font-semibold">
                  <dt className="text-fg">{s.closing_owed < 0 ? 'Closing credit' : 'Closing owed'}</dt>
                  <dd className="tabular text-right text-fg">{money(Math.abs(s.closing_owed))}</dd>
                </div>
              </dl>
            </details>
          </div>
        ))}
        </div>
      </div>
    </MemberScreen>
  );
}
