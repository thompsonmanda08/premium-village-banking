import { percent } from './format';
import { ChartTable } from './ChartTable';
import { TONE, type Tone } from './tone';

type Slice = { label: string; value: number; tone: Tone };

const R = 70;
const C = 2 * Math.PI * R;
const num = (n: number): string => String(Math.round(n * 1000) / 1000);

/** A ring split into shares, with a headline in the middle and a table of the shares. */
export function DonutChart({ label, slices, centre, format }: { label: string; slices: Slice[]; centre: { big: string; small: string }; format: (n: number) => string }) {
  const total = slices.reduce((sum, s) => sum + (Number.isFinite(s.value) && s.value > 0 ? s.value : 0), 0);
  let start = 0;
  const arcs = total > 0
    ? slices.flatMap((s) => {
        if (!(s.value > 0)) return [];
        const len = (s.value / total) * C;
        const arc = (
          <circle
            key={s.label}
            data-slice={s.label}
            cx={100}
            cy={100}
            r={R}
            fill="none"
            strokeWidth={26}
            strokeDasharray={`${num(len)} ${num(C - len)}`}
            strokeDashoffset={num(-start)}
            transform="rotate(-90 100 100)"
            className={TONE[s.tone].stroke}
          >
            <title>{`${s.label}: ${format(s.value)}`}</title>
          </circle>
        );
        start += len;
        return [arc];
      })
    : [];
  const rows = slices.map((s) => [s.label, format(s.value), percent(total > 0 && s.value > 0 ? s.value / total : 0, 1)]);

  return (
    <figure className="grid justify-items-center gap-2">
      <svg role="img" aria-label={label} viewBox="0 0 200 200" className="h-auto w-full max-w-60">
        <circle cx={100} cy={100} r={R} fill="none" strokeWidth={26} className="stroke-line" />
        {arcs}
        {total > 0 ? (
          <>
            <text x={100} y={102} textAnchor="middle" className="fill-fg text-xl font-semibold">{centre.big}</text>
            <text x={100} y={122} textAnchor="middle" className="fill-muted text-xs">{centre.small}</text>
          </>
        ) : (
          <text x={100} y={105} textAnchor="middle" className="fill-muted text-xs">No data yet</text>
        )}
      </svg>
      <ul role="list" className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span aria-hidden className={`inline-block size-3 rounded-sm ${TONE[s.tone].swatch}`} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="w-full"><ChartTable head={['Share', 'Amount', 'Of the total']} rows={rows} /></div>
    </figure>
  );
}
