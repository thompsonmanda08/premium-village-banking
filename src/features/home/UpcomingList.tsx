import { daysBetween, type DateEvent } from '@/lib/calendar';
import { formatDate } from '@/lib/format';

const when = (n: number) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`);

export function UpcomingList({ events, today }: { events: DateEvent[]; today: string }) {
  if (events.length === 0) return <p className="text-base text-muted">No more dates in this cycle.</p>;
  return (
    <ul role="list" className="grid gap-1">
      {events.map((e) => {
        const [day, month] = formatDate(e.date).split(' ');
        return (
          <li key={`${e.date}-${e.kind}`} className="flex items-center gap-3 rounded-xl py-2">
            <div aria-hidden className="grid size-12 shrink-0 place-content-center rounded-xl bg-surface-2 text-center leading-none">
              <span className="tabular text-lg font-semibold text-fg">{day}</span>
              <span className="mt-0.5 text-xs text-muted">{month}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base text-fg">{e.label}</p>
              <p className="text-sm text-muted">
                <span className="sr-only">{formatDate(e.date)}, </span>
                {when(daysBetween(today, e.date))}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
