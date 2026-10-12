import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { useGroupMembers } from '@/features/group/GroupPage';
import { correctionLine, correctionsOf, effectiveAmount, isCorrectable, isWaivable } from '@/features/ledger/corrections';
import { entryTone, groupEntriesByPeriod, kindLabel, toneLabel, type EntryRow, type KindTone } from '@/features/ledger/memberViews';
import { currentPeriod } from '@/features/ledger/model';
import { useActorNames, useLedgerCycle, useMemberStatuses, useMyEntries } from '@/features/ledger/queries';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { formatDate, money } from '@/lib/format';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Skeleton, type Tone } from '@/ui';
import { CorrectEntrySheet } from './CorrectEntrySheet';
import { DefaultPanel } from './DefaultPanel';
import { WaiveEntrySheet } from './WaiveEntrySheet';

const BADGE: Record<KindTone, Tone> = { in: 'success', charged: 'warning', earned: 'accent', correction: 'info', other: 'neutral' };
const link = 'font-semibold text-accent underline underline-offset-4';

function MemberLedgerBody() {
  const { memberId = '' } = useParams();
  const { group } = useGroup();
  const members = useGroupMembers(group.id);
  const cycle = useLedgerCycle(group.id);
  const entries = useMyEntries(memberId);
  const cycleId = cycle.data?.cycle?.id;
  const statuses = useMemberStatuses(group.id, cycleId);
  const actors = useActorNames(group.id);
  const [sheet, setSheet] = useState<{ kind: 'correct' | 'waive'; entry: EntryRow; month: string } | null>(null);

  const queries = [members, cycle, entries, ...(cycleId ? [statuses] : [])];
  const failed = queries.find((q) => q.isError && q.data === undefined);
  if (failed) {
    return (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => queries.forEach((q) => void q.refetch())}>Try again</Button>}>
        {friendlyError(failed.error)}
      </Alert>
    );
  }
  if (queries.some((q) => q.data === undefined)) {
    return (
      <div role="status" className="grid gap-3">
        <span className="sr-only">Loading the member’s ledger</span>
        <Skeleton className="h-28" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  const member = members.data!.find((m) => m.id === memberId);
  if (!member) {
    return (
      <EmptyState title="That member isn’t in this group.">
        <Link to="/desk/members" className={link}>Back to the members</Link>
      </EmptyState>
    );
  }

  const periods = cycle.data!.periods;
  const open = currentPeriod(periods);
  const all = entries.data!;
  const groups = groupEntriesByPeriod(all.filter((e) => e.source !== 'correction'), periods);
  const status = statuses.data?.find((s) => s.member_id === memberId);
  const name = member.short_name ?? member.full_name ?? 'this member';
  const changedBy = status ? actors.data?.find((a) => a.user_id === status.changed_by)?.short_name : undefined;

  return (
    <div className="grid gap-4 md:gap-5 lg:max-w-3xl">
      {cycleId ? <DefaultPanel memberId={memberId} memberName={name} cycleId={cycleId} status={status} changedBy={changedBy} /> : null}

      <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
        {open ? `Corrections land in ${open.label}; the original stays in its own month.` : 'Open the next month to post corrections or waivers.'}
      </p>

      <section aria-labelledby="entries-title" className="grid gap-3">
        <h2 id="entries-title" className="text-xl font-semibold text-fg">Entries</h2>
        {groups.length === 0 ? (
          <p className="text-sm text-muted">Nothing recorded for this member yet.</p>
        ) : (
          groups.map((g) => (
            <Card key={g.periodId}>
              <section aria-labelledby={`month-${g.periodId}`}>
                <h3 id={`month-${g.periodId}`} className="text-lg font-semibold text-fg">{g.period.label}</h3>
                <ul role="list" className="divide-y divide-line">
                  {g.entries.map((e) => {
                    const tone = entryTone(e);
                    const fixes = correctionsOf(e.id, all);
                    const current = effectiveAmount(e, all);
                    const when = e.source === 'import' ? 'From the workbook' : formatDate(e.created_at);
                    const label = `${kindLabel(e.kind)} ${money(e.amount)} from ${g.period.label}, ${when}`;
                    return (
                      <li key={e.id} className="grid gap-2 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-medium text-fg">{kindLabel(e.kind)}</span>
                          <span className="tabular font-semibold text-fg">{money(e.amount)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                          {toneLabel(tone) ? <Badge tone={BADGE[tone]}>{toneLabel(tone)}</Badge> : null}
                          <span>{when}</span>
                          {fixes.length > 0 ? <span className="tabular font-semibold text-fg">{`Now ${money(current)}`}</span> : null}
                        </div>
                        {e.reason ? <p className="text-sm text-muted">{`Reason: ${e.reason}`}</p> : null}
                        {fixes.length > 0 ? (
                          <ul role="list" className="grid gap-1 text-sm text-muted">
                            {fixes.map((c) => <li key={c.id}>{`${correctionLine(c)}: ${c.reason ?? ''}`}</li>)}
                          </ul>
                        ) : null}
                        {isCorrectable(e) || (isWaivable(e) && current > 0) ? (
                          <div className="flex gap-2">
                            {isCorrectable(e) ? (
                              <Button size="sm" variant="secondary" disabled={!open} aria-label={`Correct ${label}`} onClick={() => setSheet({ kind: 'correct', entry: e, month: g.period.label })}>Correct</Button>
                            ) : null}
                            {isWaivable(e) && current > 0 ? (
                              <Button size="sm" variant="secondary" disabled={!open} aria-label={`Waive ${label}`} onClick={() => setSheet({ kind: 'waive', entry: e, month: g.period.label })}>Waive</Button>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </Card>
          ))
        )}
      </section>

      {sheet?.kind === 'correct' ? <CorrectEntrySheet entry={sheet.entry} current={effectiveAmount(sheet.entry, all)} memberName={name} monthLabel={sheet.month} onClose={() => setSheet(null)} /> : null}
      {sheet?.kind === 'waive' ? <WaiveEntrySheet entry={sheet.entry} current={effectiveAmount(sheet.entry, all)} memberName={name} monthLabel={sheet.month} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}

// The heading needs the member's name; it reads the same cached query as the body.
function MemberLedgerHeader() {
  const { memberId = '' } = useParams();
  const { group } = useGroup();
  const members = useGroupMembers(group.id);
  const member = members.data?.find((m) => m.id === memberId);
  return (
    <>
      <PageHeader
        title={member?.full_name ?? member?.short_name ?? 'Member ledger'}
        subtitle="Entries, corrections and default status"
        actions={<Link to="/desk/members" className={link}>All members</Link>}
      />
      <MemberLedgerBody />
    </>
  );
}

export function MemberLedgerPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return <MemberLedgerHeader />;
}
