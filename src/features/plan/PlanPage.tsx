import { useGroup } from '@/features/group/GroupContext';
import { Figure } from '@/features/ledger/Figure';
import { MemberScreen } from '@/features/ledger/MemberScreen';
import { latestStatement, periodLabel, remainingInstalments } from '@/features/ledger/memberViews';
import { useLedgerCycle, useMyLoans, useMyStatements, usePayoutPreview } from '@/features/ledger/queries';
import { formatDate, money } from '@/lib/format';
import { Card } from '@/ui';

export function PlanPage() {
  const { group, member } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const loans = useMyLoans(member?.id);
  const statements = useMyStatements(member?.id);
  const periods = cycle.data?.periods ?? [];
  const payout = usePayoutPreview(cycle.data?.cycle?.id, member?.id);
  const latest = latestStatement(statements.data ?? [], periods);

  return (
    <MemberScreen
      title="Plan"
      subtitle={latest ? `As at ${periodLabel(latest.period)}` : undefined}
      loadingLabel="Loading your plan"
      queries={[cycle, loans, statements]}
    >
      <div className="grid gap-4 md:gap-5 lg:max-w-3xl">
        {latest ? (
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Figure label="You owe" value={money(latest.statement.closing_owed)} />
            <Figure label="Next minimum" value={money(latest.statement.next_minimum)} />
          </div>
        ) : (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">Your first statement appears when the treasurer closes a month.</p>
        )}

        <section aria-labelledby="loans-heading" className="grid gap-3">
          <h2 id="loans-heading" className="text-lg font-semibold text-fg">Your loans</h2>
          {(loans.data ?? []).length === 0 ? (
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">You have no open loans.</p>
          ) : (
            (loans.data ?? []).map((l) => {
              const rest = remainingInstalments(l, periods);
              return (
                <Card key={l.id}>
                  <section aria-labelledby={`loan-${l.id}`}>
                    <h3 id={`loan-${l.id}`} className="text-lg font-semibold text-fg">Loan of {money(l.principal)}</h3>
                    <p className="mt-0.5 text-sm text-muted">
                      Interest {money(l.interest)} · {l.term_months} month{l.term_months === 1 ? '' : 's'} · sent {formatDate(l.sent_at)}
                    </p>
                    {rest.items.length === 0 ? (
                      <p className="mt-3 text-sm text-muted">No instalments left in the schedule.</p>
                    ) : (
                      <ul role="list" className="mt-3 divide-y divide-line">
                        {rest.items.map((i) => (
                          <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                            <span className="text-fg">{i.label}</span>
                            <span className="tabular text-fg">{money(i.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 font-semibold text-fg">Still to pay in instalments {money(rest.total)}</p>
                  </section>
                </Card>
              );
            })
          )}
        </section>

        {payout.data ? (
          <Card>
            <section aria-labelledby="payout-heading">
              <h2 id="payout-heading" className="text-lg font-semibold text-fg">If the cycle paid out today</h2>
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted">Savings</dt>
                <dd className="tabular text-right text-fg">{money(payout.data.savings)}</dd>
                <dt className="text-muted">Interest earned</dt>
                <dd className="tabular text-right text-fg">{money(payout.data.interest_earned)}</dd>
                <dt className="text-muted">Less what you owe</dt>
                <dd className="tabular text-right text-fg">{money(payout.data.owed)}</dd>
                <dt className="text-muted">Share of the pots</dt>
                <dd className="tabular text-right text-fg">{money(payout.data.pot_share)}</dd>
                <dt className="font-semibold text-fg">You would receive</dt>
                <dd className="tabular text-right font-semibold text-fg">{money(payout.data.payout)}</dd>
              </dl>
              <p className="mt-3 text-sm text-muted">
                A projection from today’s figures, not a promise. It changes as the group saves and repays.
              </p>
            </section>
          </Card>
        ) : payout.isError ? (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">The payout projection couldn’t be loaded just now.</p>
        ) : null}
      </div>
    </MemberScreen>
  );
}
