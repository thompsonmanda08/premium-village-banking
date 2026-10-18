const STEPS = [1, 2, 2.5, 5, 10];
const clean = (n: number): number => Math.round(n * 1e10) / 1e10;

/** The smallest round step (1, 2, 2.5, 5 or 10 times a power of ten) that is at least `raw`; 1 when `raw` is no usable size. */
export function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const unit = STEPS.find((s) => s >= raw / magnitude - 1e-9) ?? 10;
  return clean(unit * magnitude);
}

/** A domain with round ends that always includes 0, and its tick values. Empty or non-finite data gets 0 to 1. */
export function niceDomain(min: number, max: number, count = 4): { lo: number; hi: number; step: number; ticks: number[] } {
  const low = Number.isFinite(min) ? Math.min(0, min) : 0;
  const high = Number.isFinite(max) ? Math.max(0, max) : 0;
  if (low === high) return { lo: 0, hi: 1, step: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const step = niceStep((high - low) / count);
  const lo = clean(Math.floor(low / step) * step);
  const hi = clean(Math.ceil(high / step) * step);
  const ticks: number[] = [];
  for (let i = 0; lo + i * step <= hi + step / 1e6; i++) ticks.push(clean(lo + i * step));
  return { lo, hi, step, ticks };
}

/** Maps a value in `domain` to a position in `range`; a flat domain maps everything to the middle of the range. */
export function scaleLinear(domain: [number, number], range: [number, number]): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d0 === d1) return () => (r0 + r1) / 2;
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}
