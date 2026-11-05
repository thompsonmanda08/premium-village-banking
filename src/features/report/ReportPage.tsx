import { FileText } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { Figure } from '@/features/ledger/Figure';
import { closedPeriods } from '@/features/ledger/groupStats';
import { useLedgerCycle } from '@/features/ledger/queries';
import { RULE_CATALOG } from '@/features/rules/ruleCatalog';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { Alert, Button, Card, EmptyState, PageHeader, Skeleton } from '@/ui';
import { OverridesList } from './OverridesList';
import { useMonthReport } from './reportQueries';

export const reportPath = (startsOn: string) => `/report/${startsOn.slice(0, 7)}`;
const nav = 'inline-flex min-h-12 items-center font-semibold text-accent underline-offset-4 hover:underline';

export function ReportPage() {
  const { group } = useGroup();
  const { month } = useParams();
  const cycle = useLedgerCycle(group.id);
  const closed = closedPeriods(cycle.data?.periods ?? []);
  const at = month ? closed.findIndex((p) => p.starts_on.slice(0, 7) === month) : closed.length - 1;
  const selected = closed[at];
  const report = useMonthReport(selected?.id);

  const failed = [cycle, report].find((q) => q.isError && q.data === undefined);
  if (failed) {
    const retry = () => void failed.refetch();
    return (
      <>
        <PageHeader title="Monthly report" />
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={retry}>Try again</Button>}>{friendlyError(failed.error)}</Alert>
      </>
    );
  }
  if (cycle.data === undefined || (selected && report.data === undefined)) {
    return (
      <>
        <PageHeader title="Monthly report" />
        <div role="status" className="grid gap-3">
          <span className="sr-only">Loading the monthly report</span>
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }
  if (!selected || !report.data) {
    return (
      <>
        <PageHeader title="Monthly report" />
        <EmptyState icon={<FileText className="size-7" />} title="No report for that month">
          A report appears once the treasurer closes the month.
        </EmptyState>
      </>
    );
  }

  const r = report.data;
  const prev = closed[at - 1];
  const next = closed[at + 1];
  const g = r.group;
  return (
    <>
      <PageHeader title={`${r.period.label} report`} subtitle="How the month closed, for every member." />
      <div className="grid gap-4 md:gap-5">
        <nav aria-label="Other months" className="flex justify-between gap-3">
          {prev ? <Link to={reportPath(prev.starts_on)} className={nav}>Previous: {prev.label}</Link> : <span />}
          {next ? <Link to={reportPath(next.starts_on)} className={nav}>Next: {next.label}</Link> : <span />}
        </nav>

        <section aria-labelledby="rp-group" className="grid gap-3">
          <h2 id="rp-group" className="text-xl font-semibold text-fg">The group</h2>
          {g ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Figure label="Total savings" value={money(g.total_savings)} />
              <Figure label="Saved this month" value={money(g.savings)} />
              <Figure label="Interest collected" value={money(g.interest_collected)} />
              <Figure label="Idle cash" value={money(g.idle_cash)} />
            </div>
          ) : (
            <p className="text-sm text-muted">The group figures for this month are missing.</p>
          )}
        </section>

        <section aria-labelledby="rp-loans" className="grid gap-3">
          <h2 id="rp-loans" className="text-xl font-semibold text-fg">Loans</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Figure label="Loans sent" value={r.loans.sent_count} note={money(r.loans.sent_principal)} />
            <Figure label="Members owing" value={r.loans.members_owing} />
            <Figure label="Owed to the pool" value={r.loans.total_owed === null ? '—' : money(r.loans.total_owed)} />
          </div>
        </section>

        <section aria-labelledby="rp-arrears" className="grid gap-3">
          <h2 id="rp-arrears" className="text-xl font-semibold text-fg">Minimums not paid</h2>
          <Card>
            <p className="text-fg">
              {r.arrears.count === 0
                ? 'Every member paid last month’s minimum.'
                : `${r.arrears.count} ${r.arrears.count === 1 ? 'member' : 'members'} did not pay last month’s minimum, ${money(r.arrears.total)} in all.`}
            </p>
            {r.arrears.members === null ? (
              r.arrears.count > 0 ? <p className="mt-2 text-sm text-muted">Names are hidden by the group’s setting.</p> : null
            ) : (
              <ul role="list" className="mt-2 divide-y divide-line">
                {r.arrears.members.map((m) => (
                  <li key={m.member_id} className="flex justify-between gap-3 py-2">
                    <span className="text-fg">{m.name}</span>
                    <span className="tabular text-fg">{money(m.unpaid)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section aria-labelledby="rp-overrides" className="grid gap-3">
          <h2 id="rp-overrides" className="text-xl font-semibold text-fg">Overrides</h2>
          <OverridesList overrides={r.overrides} recorded={r.overrides_recorded} />
        </section>

        <section aria-labelledby="rp-rules" className="grid gap-3">
          <h2 id="rp-rules" className="text-xl font-semibold text-fg">Rules</h2>
          <p className="text-fg">{r.rules.ratified_by_close} of {RULE_CATALOG.length} rules ratified by the close</p>
        </section>
      </div>
    </>
  );
}
