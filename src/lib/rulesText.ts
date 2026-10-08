import { money } from './format';

type Multiple = { from_month: number; to_month: number; multiple: number };
type Tenor = { max: number | null; months: number };

const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
// One cent above a band's maximum, rounded so that 9999.99 + 0.01 is exactly 10000 and not 9999.999999999998.
const cent = (v: number) => Math.round((v + 0.01) * 100) / 100;

// The JSON comes from the database and may be edited by hand: keep what is well formed and drop the rest.
const multiples = (json: unknown): Multiple[] =>
  isArray(json) ? json.filter((e): e is Multiple => isRecord(e) && isNumber(e.from_month) && isNumber(e.to_month) && isNumber(e.multiple)) : [];

// Open-ended band (max null) last, the rest by maximum.
const byMax = (a: Tenor, b: Tenor) => Number(a.max === null) - Number(b.max === null) || (a.max ?? 0) - (b.max ?? 0);
const tenors = (json: unknown): Tenor[] =>
  isArray(json)
    ? json.filter((e): e is Tenor => isRecord(e) && isNumber(e.months) && (e.max === null || isNumber(e.max))).sort(byMax)
    : [];

export function loanLimitLines(json: unknown): string[] {
  return multiples(json).map(({ from_month, to_month, multiple }) => {
    const months = from_month === to_month ? `Month ${from_month}` : `Months ${from_month}–${to_month}`;
    return multiple > 0 ? `${months}: up to ${multiple}× your savings` : `${months}: no new loans`;
  });
}

// Each band starts one cent above the previous maximum, so no amount reads as belonging to two bands.
export function tenorLines(json: unknown): string[] {
  let previous: number | null = null;
  return tenors(json).map(({ max, months }) => {
    const period = `${months} month${months === 1 ? '' : 's'}`;
    const from = previous === null ? null : cent(previous);
    const range =
      max === null
        ? from === null ? 'Any amount' : `${money(from)} and above`
        : from === null ? `Up to ${money(max)}` : `${money(from)} to ${money(max)}`;
    previous = max ?? previous;
    return `${range}: ${period}`;
  });
}
