import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { useMinimumBreakdown } from '@/features/queries/queryHooks';
import { Alert, Skeleton } from '@/ui';

type Props = { memberId: string; periodId: string };

/** Why the next minimum is what it is: the three parts, from the database. Nothing for a member with no statement. */
export function BreakdownPanel({ memberId, periodId }: Props) {
  const q = useMinimumBreakdown(memberId, periodId);
  if (q.isError) return <Alert tone="danger">{friendlyError(q.error)}</Alert>;
  if (!q.data) return <div role="status"><span className="sr-only">Loading why this figure</span><Skeleton className="h-24" /></div>;
  const b = q.data;
  if ('none' in b) return null;
  if ('imported' in b) return <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">From the treasurer’s workbook; not itemised</p>;
  const parts = [
    { label: 'Instalments due', value: b.instalments },
    { label: 'Excess charged', value: b.excess },
    { label: 'Earlier shortfall', value: b.earlier_shortfall },
  ];
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3">
      <p className="text-sm font-semibold text-fg">Why this figure</p>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
        {parts.map((p) => (
          <div key={p.label} className="col-span-2 grid grid-cols-subgrid">
            <dt className="text-muted">{p.label}</dt>
            <dd className="tabular text-right text-fg">{money(p.value)}</dd>
          </div>
        ))}
        <div className="col-span-2 grid grid-cols-subgrid font-semibold">
          <dt className="text-fg">Next minimum</dt>
          <dd className="tabular text-right text-fg">{money(b.minimum)}</dd>
        </div>
      </dl>
      {b.capped_to_owed ? <p className="mt-2 text-sm text-muted">{b.minimum === 0 ? 'Nothing owed' : 'Capped to what you owe'}</p> : null}
    </div>
  );
}
