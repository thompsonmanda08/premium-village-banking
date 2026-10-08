const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function fmt(value: number, decimals = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  const factor = 10 ** decimals;
  const rounded = Math.round(Math.abs(safe) * factor) / factor;
  const negative = safe < 0 && rounded !== 0;
  const body = rounded.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (negative ? '−' : '') + body;
}

export const zmw = (value: number, decimals = 2): string => `K ${fmt(value, decimals)}`;

/** Whole kwacha without decimals, anything else with two: K 3,000 and K 3,000.01. Rounds to cents first, so −0.001 reads K 0. */
export const money = (value: number): string => {
  const cents = Math.round(Math.abs(Number.isFinite(value) ? value : 0) * 100);
  return zmw(value, cents % 100 === 0 ? 0 : 2);
};

export const pct = (ratio: number, decimals = 1): string => `${(ratio * 100).toFixed(decimals)}%`;

/** A ratio shown exactly, to at most two decimals and without trailing zeros: 0.15 is 15%, 0.125 is 12.5%, 0.0725 is 7.25%. */
export const rate = (ratio: number): string => `${Number(((Number.isFinite(ratio) ? ratio : 0) * 100).toFixed(2))}%`;

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function localISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
