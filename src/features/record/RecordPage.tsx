import { ScrollText } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { MemberScreen } from '@/features/ledger/MemberScreen';
import { entryTone, groupEntriesByPeriod, kindLabel, toneLabel, type KindTone } from '@/features/ledger/memberViews';
import { useLedgerCycle, useMyEntries } from '@/features/ledger/queries';
import { formatDate, money } from '@/lib/format';
import { Badge, EmptyState, type Tone } from '@/ui';

const BADGE: Record<KindTone, Tone> = { in: 'success', charged: 'warning', earned: 'accent', correction: 'info', other: 'neutral' };

export function RecordPage() {
  const { group, member } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const entries = useMyEntries(member?.id);
  const groups = groupEntriesByPeriod(entries.data ?? [], cycle.data?.periods ?? []);

  return (
    <MemberScreen title="Record" subtitle="Everything recorded against you" loadingLabel="Loading your record" queries={[cycle, entries]}>
      {groups.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-7" />} title="Nothing recorded yet">
          Your savings, payments and charges appear here as the treasurer records them.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:gap-5 lg:max-w-3xl">
          {groups.map((g) => (
            <div key={g.periodId} className="rounded-2xl border border-line bg-surface shadow-sm dark:shadow-none">
              <section aria-labelledby={`month-${g.periodId}`}>
                <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 md:px-5">
                  <h2 id={`month-${g.periodId}`} className="text-lg font-semibold text-fg">{g.period.label}</h2>
                  {g.paidIn > 0 ? <p className="tabular text-sm text-muted">Paid in {money(g.paidIn)}</p> : null}
                </header>
                <ul role="list" className="divide-y divide-line px-4 md:px-5">
                  {g.entries.map((e) => {
                    const tone = entryTone(e);
                    return (
                      <li key={e.id} className="grid gap-1 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-fg">{kindLabel(e.kind)}</span>
                          <span className="tabular font-semibold text-fg">{money(e.amount)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                          {toneLabel(tone) ? <Badge tone={BADGE[tone]}>{toneLabel(tone)}</Badge> : null}
                          <span>{e.source === 'import' ? 'From the workbook' : formatDate(e.created_at)}</span>
                        </div>
                        {e.reason ? <p className="text-sm text-muted">Reason: {e.reason}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          ))}
        </div>
      )}
    </MemberScreen>
  );
}
