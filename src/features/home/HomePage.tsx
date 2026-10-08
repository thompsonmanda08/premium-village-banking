import { CalendarClock } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { useCycles } from '@/features/cycles/useCycles';
import { pickCurrentCycle, upcomingDates } from '@/lib/calendar';
import { friendlyError } from '@/lib/errors';
import { formatDate, localISODate, money } from '@/lib/format';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton, type Tone } from '@/ui';
import { UpcomingList } from './UpcomingList';

const STATUS: Record<string, { tone: Tone; label: string }> = {
  planned: { tone: 'info', label: 'Starts soon' },
  active: { tone: 'success', label: 'Running' },
  closed: { tone: 'neutral', label: 'Closed' },
};

export function HomePage() {
  const { group, member } = useGroup();
  const cycles = useCycles(group.id);
  const today = localISODate(new Date());
  const { data } = cycles;
  const cycle = data ? pickCurrentCycle(data, today) : null;
  const status = cycle ? STATUS[cycle.status] ?? STATUS.planned! : null;
  const refetch = () => void cycles.refetch();

  return (
    <>
      <PageHeader title={member ? `Hello, ${member.short_name}` : group.name} subtitle={member ? group.name : undefined} />
      {data === undefined ? (
        // Data wins over a failed background refetch: the error state is only for when there is nothing to show.
        cycles.isError ? (
          <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={refetch}>Try again</Button>}>
            {friendlyError(cycles.error)}
          </Alert>
        ) : (
          <div role="status" className="grid gap-4 md:grid-cols-2">
            <span className="sr-only">Loading your cycle…</span>
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        )
      ) : !cycle || !status ? (
        <EmptyState
          icon={<CalendarClock className="size-7" />}
          title="No savings cycle yet"
          action={<Button size="sm" variant="secondary" onClick={refetch}>Check again</Button>}
        >
          Your treasurer sets up the cycle. It will appear here once they do.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader
              title={cycle.label}
              subtitle={<span className="tabular">{formatDate(cycle.starts_on)} – {formatDate(cycle.ends_on)}</span>}
              action={<Badge tone={status.tone}>{status.label}</Badge>}
            />
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted">Payout</dt>
                <dd className="tabular text-lg font-semibold text-fg">{formatDate(cycle.payout_on)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Minimum saving</dt>
                <dd className="tabular text-lg font-semibold text-fg">{cycle.rules ? `${money(cycle.rules.min_saving)} a month` : '—'}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Coming up" />
            {cycle.rules ? (
              <UpcomingList events={upcomingDates(cycle, cycle.rules, today, 5)} />
            ) : (
              <p className="text-base text-muted">Dates appear once your treasurer sets the cycle rules.</p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
