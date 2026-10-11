import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { useGroupMembers } from '@/features/group/GroupPage';
import { useCycles } from '@/features/cycles/useCycles';
import { daysBetween, pickCurrentCycle, upcomingDates } from '@/lib/calendar';
import { friendlyError } from '@/lib/errors';
import { formatDate, localISODate, money, rate } from '@/lib/format';
import { Alert, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton, type Tone } from '@/ui';
import { CycleCard } from './CycleCard';
import { StatTile } from './StatTile';
import { UpcomingList } from './UpcomingList';

const STATUS: Record<string, { tone: Tone; label: string }> = {
  planned: { tone: 'info', label: 'Starts soon' },
  active: { tone: 'success', label: 'Running' },
  closed: { tone: 'neutral', label: 'Closed' },
};

function payoutNote(today: string, payout: string) {
  const n = daysBetween(today, payout);
  return n < 0 ? 'Paid out' : n === 0 ? 'Today' : `In ${n} day${n === 1 ? '' : 's'}`;
}

export function HomePage() {
  const { group, member, isAdmin } = useGroup();
  const cycles = useCycles(group.id);
  const members = useGroupMembers(group.id);
  const today = localISODate(new Date());
  const { data } = cycles;
  const cycle = data ? pickCurrentCycle(data, today) : null;
  const status = cycle ? STATUS[cycle.status] ?? STATUS.planned! : null;
  const refetch = () => void cycles.refetch();
  const active = members.data?.filter((m) => m.status === 'active');

  return (
    <>
      <PageHeader title={member ? `Hello, ${member.short_name}` : group.name} subtitle={member ? group.name : undefined} />
      {/* Onboarding nudge: shown when the group has only one active member (the owner, just after creation). */}
      {active && active.length === 1 && isAdmin ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm md:mb-5">
          <span className="text-fg">Your group is empty. Add members and send invites to get started.</span>
          <Link
            to="/settings/members"
            className="shrink-0 font-semibold text-accent underline-offset-4 hover:underline"
          >
            Add members
          </Link>
        </div>
      ) : null}
      {data === undefined ? (
        // Data wins over a failed background refetch: the error state is only for when there is nothing to show.
        cycles.isError ? (
          <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={refetch}>Try again</Button>}>
            {friendlyError(cycles.error)}
          </Alert>
        ) : (
          <div role="status" className="grid gap-4 md:gap-5">
            <span className="sr-only">Loading your cycle…</span>
            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl md:h-36" />)}
            </div>
            <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Skeleton className="h-80 rounded-2xl" />
              <Skeleton className="h-80 rounded-2xl" />
            </div>
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
        <div className="grid gap-4 md:gap-5">
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <StatTile label="Payout day" value={formatDate(cycle.payout_on)} note={payoutNote(today, cycle.payout_on)} to="/plan" linkLabel="Open your plan" />
            <StatTile
              label="Minimum saving"
              value={cycle.rules ? money(cycle.rules.min_saving) : '—'}
              note={cycle.rules ? 'a month' : 'Not set yet'}
              to="/declare"
              linkLabel="Open your declaration"
            />
            <StatTile
              label="Loan interest"
              value={cycle.rules ? rate(cycle.rules.loan_rate) : '—'}
              note={cycle.rules ? 'charged once' : 'Not set yet'}
              to="/rules"
              linkLabel="Open the group rules"
            />
            <StatTile
              label="Members"
              value={active ? active.length : '—'}
              note={active ? `${active.filter((m) => m.linked).length} joined the app` : members.isError ? 'Not available' : 'Loading'}
              to="/group"
              linkLabel="Open the group"
            />
          </div>
          <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <CycleCard cycle={cycle} status={status} today={today} />
            <Card className="md:p-6">
              <CardHeader title="Coming up" />
              {cycle.rules ? (
                <UpcomingList events={upcomingDates(cycle, cycle.rules, today, 5)} today={today} />
              ) : (
                <p className="text-base text-muted">Dates appear once your treasurer sets the cycle rules.</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
