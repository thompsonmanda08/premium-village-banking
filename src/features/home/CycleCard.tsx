import { cycleMonths, daysBetween } from '@/lib/calendar';
import { formatDate } from '@/lib/format';
import { Badge, Card, CardHeader, cn, type Tone } from '@/ui';
import type { CycleWithRules } from '@/features/cycles/useCycles';

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

export function CycleCard({ cycle, status, today }: { cycle: CycleWithRules; status: { tone: Tone; label: string }; today: string }) {
  const months = cycleMonths(cycle, today);
  const current = months.findIndex((m) => m.state === 'current');
  const passed = Math.round(Math.min(1, Math.max(0, daysBetween(cycle.starts_on, today) / daysBetween(cycle.starts_on, cycle.ends_on))) * 100);
  const [headline, detail] =
    today < cycle.starts_on
      ? [`Starts in ${days(daysBetween(today, cycle.starts_on))}`, `${months.length} months, ${formatDate(cycle.starts_on)} to ${formatDate(cycle.ends_on)}`]
      : today >= cycle.ends_on
        ? ['Cycle complete', `Ended ${formatDate(cycle.ends_on)}`]
        : [`Month ${current + 1} of ${months.length}`, `${days(daysBetween(today, cycle.ends_on))} to go`];

  return (
    <Card className="md:p-6">
      <CardHeader
        title={cycle.label}
        subtitle={<span className="tabular">{formatDate(cycle.starts_on)} to {formatDate(cycle.ends_on)}</span>}
        action={<Badge tone={status.tone}>{status.label}</Badge>}
      />
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight text-fg md:text-3xl">{headline}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
      <div role="img" aria-label={`${headline}. ${passed}% of the cycle has passed.`} className="mt-6 grid auto-cols-fr grid-flow-col gap-1.5 md:gap-2">
        {months.map((m, i) => (
          <div key={m.start} className="grid gap-2 text-center">
            <div className={cn('relative h-24 overflow-hidden rounded-lg bg-surface-2 md:h-36', m.state === 'current' && 'outline-2 outline-offset-2 outline-meter')}>
              {m.fill > 0 ? (
                <div className="bar-rise absolute inset-x-0 bottom-0 rounded-lg bg-meter" style={{ height: `${m.fill * 100}%`, ['--i' as string]: i }} />
              ) : null}
            </div>
            <span className={cn('text-xs', m.state === 'current' ? 'font-semibold text-fg' : 'text-muted')}>
              <span className="md:hidden">{m.label[0]}</span>
              <span className="hidden md:inline">{m.label}</span>
            </span>
          </div>
        ))}
      </div>
      <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-4">
        {[
          ['Starts', cycle.starts_on],
          ['Payout', cycle.payout_on],
          ['Ends', cycle.ends_on],
        ].map(([label, date]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="tabular text-base font-semibold text-fg">{formatDate(date!)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
