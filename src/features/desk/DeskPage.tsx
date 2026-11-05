import { ChevronRight, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { useGroupMembers } from '@/features/group/GroupPage';
import { activeMembers, currentPeriod } from '@/features/ledger/model';
import { useDeclarations, useLedgerCycle, useWallets } from '@/features/ledger/queries';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { Alert, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton } from '@/ui';
import { DeclarationInbox } from './DeclarationInbox';
import { LoansSection } from './LoansSection';
import { MonthPanel } from './MonthPanel';
import { PotsCard } from './PotsCard';
import { NotYetDeclared } from './NotYetDeclared';
import { PenaltiesSection } from './PenaltiesSection';

function DeskBody() {
  const { group } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const members = useGroupMembers(group.id);
  const wallets = useWallets(group.id);
  const open = cycle.data ? currentPeriod(cycle.data.periods) : null;
  const declarations = useDeclarations(group.id, open?.id);

  if (cycle.data === undefined) {
    return cycle.isError ? (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void cycle.refetch()}>Try again</Button>}>
        {friendlyError(cycle.error)}
      </Alert>
    ) : (
      <div role="status" className="grid gap-3">
        <span className="sr-only">Loading the desk</span>
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!cycle.data.cycle) {
    return <EmptyState icon={<ClipboardCheck className="size-7" />} title="No active cycle">The desk works on the group’s active cycle. Set one up in Settings first.</EmptyState>;
  }

  const ready = declarations.data && members.data && wallets.data;
  const failed = [declarations, members, wallets].find((q) => q.isError && !q.data);
  const readyMembers = ready ? activeMembers(members.data!) : [];
  const row = 'flex min-h-14 items-center justify-between gap-3 py-2 transition duration-150 hover:text-accent active:scale-[.99]';
  return (
    <div className="grid gap-4 md:gap-5">
      <MonthPanel cycleId={cycle.data.cycle.id} periods={cycle.data.periods} />
      {/* The month's work on the left, who still owes a declaration and the tools on the right. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="grid gap-5 md:gap-6">
          {open ? (
            failed ? (
              <Alert
                tone="danger"
                action={<Button size="sm" variant="secondary" onClick={() => { void declarations.refetch(); void members.refetch(); void wallets.refetch(); }}>Try again</Button>}
              >
                {friendlyError(failed.error)}
              </Alert>
            ) : ready ? (
              <>
                <DeclarationInbox periodId={open.id} deadline={open.deadline} declarations={declarations.data!} members={readyMembers} wallets={wallets.data!} />
                <LoansSection periodId={open.id} declarations={declarations.data!} members={readyMembers} wallets={wallets.data!} />
                <PenaltiesSection periodId={open.id} members={readyMembers} />
                <Card>
                  <CardHeader
                    title="Close the month"
                    subtitle="Closing writes everyone’s statement and locks the month. Check the list first."
                    action={
                      <Link to="/desk/close" className="inline-flex h-12 items-center rounded-xl px-5 font-semibold text-accent underline transition duration-150 hover:bg-surface-2 active:scale-[.97]">
                        Review the close
                      </Link>
                    }
                  />
                </Card>
              </>
            ) : (
              <div role="status"><span className="sr-only">Loading declarations</span><Skeleton className="h-40" /></div>
            )
          ) : (
            <EmptyState icon={<ClipboardCheck className="size-7" />} title="No month is open">Open the next month above to receive declarations.</EmptyState>
          )}
        </div>

        <aside aria-label="Members and tools" className="grid gap-5 md:gap-6">
          {open && ready ? <NotYetDeclared periodId={open.id} members={readyMembers} declarations={declarations.data!} wallets={wallets.data!} /> : null}
          <PotsCard cycleId={cycle.data.cycle.id} />
          <Card>
            <CardHeader title="Tools" />
            <ul role="list" className="divide-y divide-line">
              {[
                { to: '/desk/members', label: 'Open members', title: 'Members', body: 'Ledgers, corrections, waivers and defaults' },
                { to: '/desk/pool', label: 'Open the pool', title: 'Pool and members', body: 'Payout pool, savings, interest and net gain' },
                { to: '/desk/reports', label: 'Open reports', title: 'Reports', body: 'Month, period and member Excel files' },
              ].map((t) => (
                <li key={t.to}>
                  <Link to={t.to} aria-label={t.label} className={row}>
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-fg">{t.title}</span>
                      <span className="block text-sm text-muted">{t.body}</span>
                    </span>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export function DeskPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader
        title="Treasurer desk"
        actions={
          <Link
            to="/desk/ledger-check"
            className="inline-flex h-12 items-center rounded-xl px-5 font-semibold text-accent underline transition duration-150 hover:bg-surface-2 active:scale-[.97]"
          >
            Open the ledger check
          </Link>
        }
      />
      <DeskBody />
    </>
  );
}
