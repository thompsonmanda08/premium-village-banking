import { ChartTable } from './ChartTable';
import { niceDomain, scaleLinear } from './scale';
import { useWidth } from './useWidth';
import { AREA, TONE, type Tone } from './tone';

export type SeriesDef = {
  key: string;
  label: string;
  tone: Tone;
  values: Array<number | null>;
  kind: 'bar' | 'line';
  dashed?: boolean;
  /** Lines only: bars are always on the left axis. */
  axis?: 'left' | 'right';
  /** Bars only: a tone for each bar. */
  tones?: Tone[];
  /** Lines only: fill under the line. */
  area?: boolean;
};

type Props = {
  label: string;
  categories: string[];
  series: SeriesDef[];
  /** Left axis, tooltips and the table. */
  format: (n: number) => string;
  axisFormat?: (n: number) => string;
  rightFormat?: (n: number) => string;
  stacked?: boolean;
  reference?: { label: string; value: number; tone?: Tone };
  categoryLabel?: string;
  height?: number;
};

const MARGIN = { l: 56, t: 12, b: 32 };
const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const f = (n: number): string => String(Math.round(n * 100) / 100);

/** Bars and lines on shared categories, with an optional right axis, a reference line and a table of the numbers. */
export function SeriesChart({ label, categories, series, format, axisFormat, rightFormat, stacked = false, reference, categoryLabel = 'Month', height = 260 }: Props) {
  const [ref, W] = useWidth();
  const hasData = series.some((s) => s.values.some(finite));
  if (categories.length === 0 || !hasData) return <p className="text-sm text-muted">No data yet</p>;

  const right = series.filter((s) => s.kind === 'line' && s.axis === 'right');
  const bars = series.filter((s) => s.kind === 'bar');
  const lines = series.filter((s) => s.kind === 'line');
  const mr = right.length > 0 ? 56 : 16;
  const x0 = MARGIN.l;
  const x1 = W - mr;
  const yTop = MARGIN.t;
  const yBottom = height - MARGIN.b;
  const n = categories.length;
  const band = (x1 - x0) / n;
  const cx = (i: number) => x0 + (i + 0.5) * band;

  // Left domain: grouped bars and lines value by value, stacked bars by their running sums.
  const leftValues: number[] = [];
  for (const s of series) if (s.kind === 'line' ? s.axis !== 'right' : !stacked) leftValues.push(...s.values.filter(finite));
  if (stacked) {
    for (let i = 0; i < n; i++) {
      let pos = 0;
      let neg = 0;
      for (const s of bars) {
        const v = s.values[i];
        if (!finite(v)) continue;
        if (v >= 0) pos += v;
        else neg += v;
      }
      leftValues.push(pos, neg);
    }
  }
  if (reference) leftValues.push(reference.value);
  const L = niceDomain(Math.min(0, ...leftValues), Math.max(0, ...leftValues));
  const yL = scaleLinear([L.lo, L.hi], [yBottom, yTop]);
  const rightValues = right.flatMap((s) => s.values.filter(finite));
  const R = niceDomain(Math.min(0, ...rightValues), Math.max(0, ...rightValues));
  const yR = scaleLinear([R.lo, R.hi], [yBottom, yTop]);

  const g = stacked ? 1 : Math.max(1, bars.length);
  const groupWidth = band * 0.7;
  const barW = groupWidth / g;
  const yFor = (s: SeriesDef) => (s.axis === 'right' ? yR : yL);
  const every = Math.max(1, Math.ceil(26 / band)); // draw every k-th label when the months would run together

  const barMarks = bars.flatMap((s, j) =>
    s.values.flatMap((v, i) => {
      if (!finite(v)) return [];
      const x = x0 + i * band + (band - groupWidth) / 2 + (stacked ? 0 : j * barW);
      let y: number;
      let h: number;
      if (stacked) {
        const before = bars.slice(0, j).reduce((sum, b) => {
          const bv = b.values[i];
          return finite(bv) && bv >= 0 === v >= 0 ? sum + bv : sum;
        }, 0);
        const from = yL(before);
        const to = yL(before + v);
        y = Math.min(from, to);
        h = Math.abs(from - to);
      } else {
        y = Math.min(yL(v), yL(0));
        h = Math.abs(yL(v) - yL(0));
      }
      const tone = s.tones?.[i] ?? s.tone;
      return [
        <rect key={`${s.key}-${i}`} data-series={s.key} x={f(x)} y={f(y)} width={f(barW)} height={f(h)} rx={2} className={TONE[tone].fill}>
          <title>{`${categories[i]} — ${s.label}: ${format(v)}`}</title>
        </rect>,
      ];
    }),
  );

  const lineMarks = lines.map((s, k) => {
    const y = yFor(s);
    const runs: Array<Array<{ x: number; y: number }>> = [];
    let run: Array<{ x: number; y: number }> = [];
    s.values.forEach((v, i) => {
      if (finite(v)) run.push({ x: cx(i), y: y(v) });
      else if (run.length > 0) {
        runs.push(run);
        run = [];
      }
    });
    if (run.length > 0) runs.push(run);
    const d = (pts: typeof run) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)} ${f(p.y)}`).join(' ');
    return (
      <g key={s.key}>
        {s.area && k === 0
          ? runs.map((pts, r) => (
              <path key={`a${r}`} data-area={s.key} d={`${d(pts)} L${f(pts[pts.length - 1]!.x)} ${f(y(0))} L${f(pts[0]!.x)} ${f(y(0))} Z`} className={AREA} />
            ))
          : null}
        {runs.map((pts, r) => (
          <path key={`l${r}`} data-line={s.key} d={d(pts)} fill="none" strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} className={TONE[s.tone].stroke} />
        ))}
        {s.values.map((v, i) =>
          finite(v) ? (
            <circle key={`p${i}`} data-series={s.key} cx={f(cx(i))} cy={f(y(v))} r={3} className={TONE[s.tone].fill}>
              <title>{`${categories[i]} — ${s.label}: ${format(v)}`}</title>
            </circle>
          ) : null,
        )}
      </g>
    );
  });

  const axisL = axisFormat ?? format;
  const axisR = rightFormat ?? format;
  const table = {
    head: [categoryLabel, ...series.map((s) => s.label)],
    rows: categories.map((c, i) => [
      c,
      ...series.map((s) => {
        const v = s.values[i];
        return finite(v) ? format(v) : '—';
      }),
    ]),
  };

  return (
    <figure ref={ref} className="grid gap-2">
      <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${height}`} className="h-auto w-full">
        {L.ticks.map((t) => (
          <g key={`t${t}`}>
            <line x1={x0} x2={x1} y1={f(yL(t))} y2={f(yL(t))} className="stroke-line" strokeWidth={1} />
            <text x={x0 - 8} y={f(yL(t) + 4)} textAnchor="end" className="fill-muted text-xs">{axisL(t)}</text>
          </g>
        ))}
        {right.length > 0
          ? R.ticks.map((t) => (
              <text key={`r${t}`} x={x1 + 8} y={f(yR(t) + 4)} className="fill-muted text-xs">{axisR(t)}</text>
            ))
          : null}
        {L.lo < 0 ? <line data-zero x1={x0} x2={x1} y1={f(yL(0))} y2={f(yL(0))} className="stroke-muted" strokeWidth={1.5} /> : null}
        {barMarks}
        {lineMarks}
        {reference ? (
          <g>
            <line data-reference x1={x0} x2={x1} y1={f(yL(reference.value))} y2={f(yL(reference.value))} strokeWidth={1.5} strokeDasharray="4 4" className={TONE[reference.tone ?? 'danger'].stroke} />
            <text x={x1} y={f(yL(reference.value) - 5)} textAnchor="end" className="fill-muted text-xs">{reference.label}</text>
          </g>
        ) : null}
        {categories.map((c, i) => i % every === 0 && (
          <text key={`c${i}`} x={f(cx(i))} y={height - 10} textAnchor="middle" className="fill-muted text-xs">{c}</text>
        ))}
      </svg>
      <ul data-legend role="list" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {[...series.map((s) => ({ label: s.label, tone: s.tone })), ...(reference ? [{ label: reference.label, tone: reference.tone ?? 'danger' }] : [])].map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span aria-hidden className={`inline-block size-3 rounded-sm ${TONE[s.tone as Tone].swatch}`} />
            {s.label}
          </li>
        ))}
      </ul>
      <ChartTable {...table} />
    </figure>
  );
}
