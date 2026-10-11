import { Fragment } from 'react';
import { money } from '@/lib/format';
import { AMOUNTS } from './declarationForm';
import type { DeclarationRow } from './model';
import { sumKwacha } from './money';

export function DeclarationSummary({ d, walletName }: { d: DeclarationRow; walletName?: string }) {
  const lines = AMOUNTS.filter((a) => d[a.key] > 0);
  const sent = sumKwacha(...AMOUNTS.filter((a) => a.key !== 'borrowing_request').map((a) => d[a.key]));
  return (
    <div className="grid gap-2 text-sm">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        {lines.map((a) => (
          <Fragment key={a.key}>
            <dt className="text-muted">{a.label}</dt>
            <dd className="tabular text-right text-fg">{money(d[a.key])}</dd>
          </Fragment>
        ))}
      </dl>
      {sent > 0 ? <p className="font-semibold text-fg">Sending {money(sent)}{walletName ? ` from ${walletName}` : ''}</p> : null}
      {d.note ? <p className="text-muted">“{d.note}”</p> : null}
    </div>
  );
}
