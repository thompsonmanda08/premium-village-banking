import { ScrollText } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { useCycles } from '@/features/cycles/useCycles';
import { UpcomingList } from '@/features/home/UpcomingList';
import { ordinal, pickCurrentCycle, upcomingDates } from '@/lib/calendar';
import { friendlyError } from '@/lib/errors';
import { localISODate, money, rate } from '@/lib/format';
import { loanLimitLines, tenorLines } from '@/lib/rulesText';
import { Alert, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton } from '@/ui';

export function RulesPage() {
  const { group } = useGroup();
  const cycles = useCycles(group.id);
  const today = localISODate(new Date());
  const { data } = cycles;
  const cycle = data ? pickCurrentCycle(data, today) : null;
  const r = cycle?.rules;
  const refetch = () => void cycles.refetch();

  if (data === undefined) {
    return (
      <>
        <PageHeader title="Rules" subtitle="From the group constitution" />
        {/* Data wins over a failed background refetch: the error state is only for when there is nothing to show. */}
        {cycles.isError ? (
          <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={refetch}>Try again</Button>}>
            {friendlyError(cycles.error)}
          </Alert>
        ) : (
          <div role="status">
            <span className="sr-only">Loading the rules…</span>
            <Skeleton className="h-96" />
          </div>
        )}
      </>
    );
  }
  if (!cycle || !r) {
    return (
      <>
        <PageHeader title="Rules" subtitle="From the group constitution" />
        <EmptyState
          icon={<ScrollText className="size-7" />}
          title="No rules yet"
          action={<Button size="sm" variant="secondary" onClick={refetch}>Check again</Button>}
        >
          Your treasurer sets the rules when they create a cycle.
        </EmptyState>
      </>
    );
  }

  const rows: [string, string][] = [
    ['Minimum saving', `${money(r.min_saving)} a month`],
    ['Declaration window', `${ordinal(r.window_open_day)}–${ordinal(r.window_close_day)} of each month`],
    ['Loan interest', `${rate(r.loan_rate)}, charged once`],
    ['Excess interest', `${rate(r.excess_rate)} a month on idle cash`],
    ['Late penalty', `${money(r.penalty_per_day)} per day after the ${ordinal(r.window_close_day)}`],
    ['Membership fee', `${money(r.membership_fee)} a quarter`],
  ];

  return (
    <>
      <PageHeader title="Rules" subtitle={`${cycle.label} · from the group constitution`} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Saving and declaring" />
          <dl className="divide-y divide-line">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-base text-muted">{k}</dt>
                <dd className="tabular text-right text-base font-semibold text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Borrowing" />
          <h3 className="mb-1 text-sm font-semibold text-muted">How much you can borrow</h3>
          <ul role="list" className="tabular mb-4 grid gap-1 text-base text-fg">{loanLimitLines(r.loan_multiples).map((l) => <li key={l}>{l}</li>)}</ul>
          <h3 className="mb-1 text-sm font-semibold text-muted">How long you have to repay</h3>
          <ul role="list" className="tabular grid gap-1 text-base text-fg">{tenorLines(r.tenor_bands).map((l) => <li key={l}>{l}</li>)}</ul>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader title="Key dates" />
          <UpcomingList events={upcomingDates(cycle, r, today, 6)} today={today} />
        </Card>
      </div>
    </>
  );
}
