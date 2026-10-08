import { zmw } from './format';

type Multiple = { from_month: number; to_month: number; multiple: number };
type Tenor = { max: number | null; months: number };

/** Whole kwacha without decimals, fractional amounts with two: K 3,000 and K 3,000.01. */
export const money = (v: number) => zmw(v, Number.isInteger(v) ? 0 : 2);
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
// One cent above a band's maximum, rounded so that 9999.99 + 0.01 is exactly 10000 and not 9999.999999999998.
const cent = (v: number) => Math.round((v + 0.01) * 100) / 100;

export function loanLimitLines(json: unknown): string[] {
  if (!isArray(json)) return [];
  return (json as Multiple[]).map(({ from_month, to_month, multiple }) => {
    const months = from_month === to_month ? `Month ${from_month}` : `Months ${from_month}–${to_month}`;
    return multiple > 0 ? `${months}: up to ${multiple}× your savings` : `${months}: no new loans`;
  });
}

// Each band starts one cent above the previous maximum, so no amount reads as belonging to two bands.
export function tenorLines(json: unknown): string[] {
  if (!isArray(json)) return [];
  let previous: number | null = null;
  return (json as Tenor[]).map(({ max, months }) => {
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
