import { formatDate } from '@/lib/format';
import type { DateEvent } from '@/lib/calendar';

export function UpcomingList({ events }: { events: DateEvent[] }) {
  if (events.length === 0) return <p className="text-base text-muted">No more dates in this cycle.</p>;
  return (
    <ul role="list" className="divide-y divide-line">
      {events.map((e) => (
        <li key={`${e.date}-${e.kind}`} className="flex items-baseline justify-between gap-4 py-3">
          <span className="text-base text-fg">{e.label}</span>
          <span className="tabular shrink-0 text-sm font-semibold text-muted">{formatDate(e.date)}</span>
        </li>
      ))}
    </ul>
  );
}
