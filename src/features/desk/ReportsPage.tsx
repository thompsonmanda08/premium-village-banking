import { useState } from 'react';
import { exportMember, exportMonth, exportPeriod, type ExportContext } from '@/features/exports/exportActions';
import { useExportRunner } from '@/features/exports/useExportRunner';
import { useGroup } from '@/features/group/GroupContext';
import { useGroupMembers } from '@/features/group/GroupPage';
import { activeMembers, currentPeriod, lastClosed, type PeriodRow } from '@/features/ledger/model';
import { useLedgerCycle } from '@/features/ledger/queries';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { Alert, Button, Card, EmptyState, PageHeader, SelectField, Skeleton } from '@/ui';

const labelOf = (p: PeriodRow): string => (p.status === 'open' ? `${p.label} (preview)` : p.label);

function ReportsBody() {
  const { group } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const members = useGroupMembers(group.id);
  const { busy, run } = useExportRunner();
  const [monthId, setMonthId] = useState('');
  const [memberId, setMemberId] = useState('');

  const failed = [cycle, members].find((q) => q.isError && q.data === undefined);
  if (failed) {
    return (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => { void cycle.refetch(); void members.refetch(); }}>Try again</Button>}>
        {friendlyError(failed.error)}
      </Alert>
    );
  }
  if (cycle.data === undefined || members.data === undefined) {
    return (
      <div role="status" className="grid gap-3">
        <span className="sr-only">Loading the reports</span>
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (!cycle.data.cycle) {
    return <EmptyState title="No active cycle">Reports work on the group’s active cycle. Set one up in Settings first.</EmptyState>;
  }

  const { periods } = cycle.data;
  const ctx: ExportContext = { groupId: group.id, groupName: group.name, cycle: cycle.data.cycle, periods };
  const exportable = periods.filter((p) => p.status === 'closed' || p.status === 'open').sort((a, b) => b.month_index - a.month_index);
  const closed = lastClosed(periods);
  const open = currentPeriod(periods);
  const chosen = exportable.find((p) => p.id === monthId) ?? closed ?? open ?? null;
  if (!chosen) return <EmptyState title="Nothing to export yet.">Open a month on the Desk first.</EmptyState>;

  const roster = activeMembers(members.data).sort((a, b) => a.short_name.localeCompare(b.short_name));
  const who = roster.find((m) => m.id === memberId) ?? roster[0] ?? null;
  const covers = [closed ? `closed months through ${closed.label}` : null, open ? `${open.label} as a preview` : null].filter(Boolean).join(', plus ');
  const idle = busy === null;

  return (
    <div className="grid gap-4 md:gap-5 lg:max-w-2xl">
      <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">These files contain members’ figures. Send a member only their own report.</p>

      <Card>
        <section aria-labelledby="reports-month" className="grid gap-3">
          <h2 id="reports-month" className="text-lg font-semibold text-fg">One month</h2>
          <p className="text-sm text-muted">Like the monthly workbooks: every member, the group’s cash and pots, and everything recorded that month.</p>
          <SelectField label="Month" value={chosen.id} onChange={(e) => setMonthId(e.target.value)} disabled={!idle}>
            {exportable.map((p) => <option key={p.id} value={p.id}>{labelOf(p)}</option>)}
          </SelectField>
          <Button isLoading={busy === 'month'} disabled={!idle} onClick={() => void run('month', () => exportMonth(ctx, chosen))}>
            {busy === 'month' ? 'Preparing…' : `Download ${labelOf(chosen)} workbook`}
          </Button>
        </section>
      </Card>

      <Card>
        <section aria-labelledby="reports-period" className="grid gap-3">
          <h2 id="reports-period" className="text-lg font-semibold text-fg">The whole period</h2>
          <p className="text-sm text-muted">{`Covers ${covers}.`}</p>
          <p className="text-sm text-muted">Cumulative savings, interest, what is owed, loans, and one row for each member showing where they stand.</p>
          <Button isLoading={busy === 'period'} disabled={!idle} onClick={() => void run('period', () => exportPeriod(ctx))}>
            {busy === 'period' ? 'Preparing…' : 'Download the whole-period workbook'}
          </Button>
        </section>
      </Card>

      <Card>
        <section aria-labelledby="reports-member" className="grid gap-3">
          <h2 id="reports-member" className="text-lg font-semibold text-fg">One member</h2>
          <p className="text-sm text-muted">A report with only that member’s own figures, safe to send to them.</p>
          {who ? (
            <>
              <SelectField label="Member" value={who.id} onChange={(e) => setMemberId(e.target.value)} disabled={!idle}>
                {roster.map((m) => <option key={m.id} value={m.id}>{m.short_name}</option>)}
              </SelectField>
              <Button isLoading={busy === 'member'} disabled={!idle} onClick={() => void run('member', () => exportMember(ctx, who.id))}>
                {busy === 'member' ? 'Preparing…' : `Download ${who.short_name}’s report`}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted">No active members.</p>
          )}
        </section>
      </Card>
    </div>
  );
}

export function ReportsPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader title="Reports" subtitle="Download the books as Excel files" />
      <ReportsBody />
    </>
  );
}
