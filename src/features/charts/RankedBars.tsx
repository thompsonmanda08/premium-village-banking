import { ChartTable } from './ChartTable';
import { niceDomain, scaleLinear } from './scale';
import { TONE } from './tone';

type Row = { label: string; value: number; highlight?: boolean };

const W = 640;
const LEFT = 150;
const RIGHT = 560;
const ROW = 26;
const f = (n: number): string => String(Math.round(n * 100) / 100);
const clip = (s: string): string => (s.length > 18 ? `${s.slice(0, 17)}…` : s);

/** Horizontal bars in the order given, around a zero line: gains to the right, losses to the left. */
export function RankedBars({ label, rows, format, nameLabel = 'Member', valueLabel = 'Value' }: { label: string; rows: Row[]; format: (n: number) => string; nameLabel?: string; valueLabel?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">No data yet</p>;
  const values = rows.map((r) => (Number.isFinite(r.value) ? r.value : 0));
  const D = niceDomain(Math.min(0, ...values), Math.max(0, ...values));
  const x = scaleLinear([D.lo, D.hi], [LEFT, RIGHT]);
  const zero = x(0);
  const height = rows.length * ROW + 28;

  return (
    <figure className="grid gap-2">
      <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${height}`} className="h-auto w-full">
        {D.ticks.map((t) => (
          <g key={t}>
            <line x1={f(x(t))} x2={f(x(t))} y1={4} y2={rows.length * ROW + 4} className="stroke-line" strokeWidth={1} />
            <text x={f(x(t))} y={height - 6} textAnchor="middle" className="fill-muted text-xs">{format(t)}</text>
          </g>
        ))}
        <line data-zero x1={f(zero)} x2={f(zero)} y1={4} y2={rows.length * ROW + 4} className="stroke-muted" strokeWidth={1.5} />
        {rows.map((r, i) => {
          const v = values[i]!;
          const top = 4 + i * ROW + 5;
          const tone = r.highlight ? 'warning' : v < 0 ? 'danger' : 'success';
          const w = Math.abs(x(v) - zero);
          return (
            <g key={`${r.label}-${i}`}>
              <text x={LEFT - 10} y={top + 12} textAnchor="end" className="fill-fg text-xs">{clip(r.label)}</text>
              <rect data-row={r.label} x={f(v < 0 ? x(v) : zero)} y={top} width={f(w)} height={16} rx={2} className={TONE[tone].fill}>
                <title>{`${r.label}: ${format(v)}`}</title>
              </rect>
              <text x={f(v < 0 ? x(v) - 4 : x(v) + 4)} y={top + 12} textAnchor={v < 0 ? 'end' : 'start'} className="fill-muted text-xs">{format(v)}</text>
            </g>
          );
        })}
      </svg>
      <ChartTable head={[nameLabel, valueLabel]} rows={rows.map((r, i) => [r.label, format(values[i]!)])} />
    </figure>
  );
}
