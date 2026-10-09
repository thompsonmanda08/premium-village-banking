export type DateEvent = { date: string; label: string; kind: 'start' | 'window' | 'loans' | 'payout' | 'end' };
type CycleDates = { starts_on: string; ends_on: string; payout_on: string };
type WindowRules = { window_open_day: number; window_close_day: number };

const ORDER: Record<DateEvent['kind'], number> = { start: 0, window: 1, loans: 2, payout: 3, end: 4 };
// A day past the end of the month (a close day of 28 plus one in a non-leap February) falls on the last day of that month.
const iso = (y: number, m: number, d: number) => {
  const day = Math.min(d, new Date(Date.UTC(y, m, 0)).getUTCDate());
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

export function upcomingDates(cycle: CycleDates, rules: WindowRules, today: string, limit = 6): DateEvent[] {
  const events: DateEvent[] = [
    { date: cycle.starts_on, label: 'Cycle starts', kind: 'start' },
    { date: cycle.payout_on, label: 'Payout day', kind: 'payout' },
    { date: cycle.ends_on, label: 'Cycle ends', kind: 'end' },
  ];
  const [sy, sm] = cycle.starts_on.split('-').map(Number) as [number, number];
  const [ey, em] = cycle.ends_on.split('-').map(Number) as [number, number];
  const windowLabel = `Declarations open (${ordinal(rules.window_open_day)}–${ordinal(rules.window_close_day)})`;
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    events.push({ date: iso(y, m, rules.window_open_day), label: windowLabel, kind: 'window' });
    events.push({ date: iso(y, m, rules.window_close_day + 1), label: 'Loans sent out', kind: 'loans' });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return events
    .filter((e) => e.date >= today && e.date >= cycle.starts_on && e.date <= cycle.ends_on)
    .sort((a, b) => a.date.localeCompare(b.date) || ORDER[a.kind] - ORDER[b.kind])
    .slice(0, limit);
}

export function pickCurrentCycle<T extends { status: string; starts_on: string; ends_on: string }>(cycles: T[], today: string): T | null {
  const byStart = [...cycles].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  return (
    byStart.find((c) => c.status === 'active') ??
    byStart.find((c) => c.status === 'planned' && c.ends_on >= today) ??
    byStart[byStart.length - 1] ??
    null
  );
}

const utc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};

/** Whole days from one ISO date to another; negative when `to` is earlier. */
export const daysBetween = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / 86_400_000);

export type CycleMonth = { start: string; label: string; state: 'past' | 'current' | 'future'; fill: number };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** The cycle as monthly periods that begin on the cycle's start day; `fill` is how much of each period has gone by. */
export function cycleMonths(cycle: { starts_on: string; ends_on: string }, today: string): CycleMonth[] {
  const [sy, sm, sd] = cycle.starts_on.split('-').map(Number) as [number, number, number];
  const starts: string[] = [];
  for (let i = 0; ; i++) {
    const y = sy + Math.floor((sm - 1 + i) / 12);
    const m = ((sm - 1 + i) % 12) + 1;
    const start = iso(y, m, sd);
    if (start >= cycle.ends_on) break;
    starts.push(start);
  }
  return starts.map((start, i) => {
    const end = starts[i + 1] ?? cycle.ends_on;
    const fill = Math.min(1, Math.max(0, daysBetween(start, today) / daysBetween(start, end)));
    const state = today >= end ? 'past' : today >= start ? 'current' : 'future';
    return { start, label: MONTH_NAMES[Number(start.slice(5, 7)) - 1]!, state, fill: state === 'past' ? 1 : fill };
  });
}
