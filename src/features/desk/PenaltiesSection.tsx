import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { appliedGrounds, groundLabel, openSuggestions, splitReason, type PenaltySuggestion } from '@/features/ledger/deskMoney';
import type { ActiveMember } from '@/features/ledger/model';
import { useMonthPenalties, useSuggestedPenalties } from '@/features/ledger/queries';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { Alert, Badge, Button, Card, Skeleton } from '@/ui';
import { ApplyPenaltySheet } from './ApplyPenaltySheet';

type Props = { periodId: string; members: ActiveMember[] };

export function PenaltiesSection({ periodId, members }: Props) {
  const { group } = useGroup();
  const suggestions = useSuggestedPenalties(group.id, periodId);
  const applied = useMonthPenalties(group.id, periodId);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<{ suggestion?: PenaltySuggestion } | null>(null);
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.short_name ?? 'Former member';

  const failed = [suggestions, applied].find((q) => q.isError && !q.data);
  if (failed) {
    return (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => { void suggestions.refetch(); void applied.refetch(); }}>Try again</Button>}>
        {friendlyError(failed.error)}
      </Alert>
    );
  }
  if (suggestions.data === undefined || applied.data === undefined) {
    return <div role="status"><span className="sr-only">Loading penalties</span><Skeleton className="h-40" /></div>;
  }

  const open = openSuggestions(suggestions.data, appliedGrounds(applied.data), dismissed);
  const applications = applied.data.filter((e) => e.source === 'app');
  const corrected = new Set(applied.data.filter((e) => e.source === 'correction').map((e) => e.corrects_entry_id));
  const dismiss = (s: PenaltySuggestion) => setDismissed((d) => new Set(d).add(`${s.member_id}:${s.ground}`));

  return (
    <section aria-labelledby="penalties-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="penalties-title" className="text-xl font-semibold text-fg">Penalties</h2>
        <Button size="sm" variant="secondary" onClick={() => setSheet({})}>Add a penalty</Button>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-fg">Suggested</h3>
        <p className="mt-0.5 text-sm text-muted">Suggestions update until the month closes. “Not now” only hides one on this screen.</p>
        {open.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing to suggest right now.</p>
        ) : (
          <ul role="list" className="divide-y divide-line">
            {open.map((s) => (
              <li key={`${s.member_id}:${s.ground}`} className="grid gap-2 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-fg">{s.short_name}</span>
                  <span className="tabular font-semibold text-fg">{money(s.amount)}</span>
                </div>
                <p className="text-sm text-muted">{groundLabel(s.ground)}</p>
                <p className="text-sm text-muted">{s.detail}</p>
                <div className="flex gap-2">
                  <Button size="sm" aria-label={`Apply penalty to ${s.short_name}`} onClick={() => setSheet({ suggestion: s })}>Apply</Button>
                  <Button size="sm" variant="secondary" aria-label={`Not now for ${s.short_name}`} onClick={() => dismiss(s)}>Not now</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div>
          <h3 className="text-lg font-semibold text-fg">Applied this month ({applications.length})</h3>
          {applications.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No penalties applied yet this month.</p>
          ) : (
            <ul role="list" className="divide-y divide-line">
              {applications.map((e) => {
                const r = splitReason(e.reason);
                return (
                  <li key={e.id} className="grid gap-1 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-fg">{nameOf(e.member_id)}</span>
                      <span className="tabular font-semibold text-fg">{money(e.amount)}</span>
                    </div>
                    <p className="text-sm text-muted">{r.ground ? `${groundLabel(r.ground)}: ${r.text}` : r.text}</p>
                    {corrected.has(e.id) ? <div><Badge tone="info">Corrected</Badge></div> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {sheet ? <ApplyPenaltySheet periodId={periodId} members={members} suggestion={sheet.suggestion} onClose={() => setSheet(null)} /> : null}
    </section>
  );
}
