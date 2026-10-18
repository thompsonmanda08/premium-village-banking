/** An amount short enough for an axis: K 250, K 1.2k, K 3k, K 1.3m, -K 1.2k. */
export function compactKwacha(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs < 1000) return `${sign}K ${Math.round(abs)}`;
  if (abs < 1_000_000) return `${sign}K ${+(abs / 1000).toFixed(1)}k`;
  return `${sign}K ${+(abs / 1_000_000).toFixed(1)}m`;
}

/** A ratio as a percentage: 0.756 is 76%. */
export const percent = (ratio: number, decimals = 0): string => `${((Number.isFinite(ratio) ? ratio : 0) * 100).toFixed(decimals)}%`;
