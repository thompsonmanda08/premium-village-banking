import { ClipboardCheck } from 'lucide-react';
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
  return (
    <div className="grid gap-4 md:gap-5 lg:max-w-2xl">
      <MonthPanel cycleId={cycle.data.cycle.id} periods={cycle.data.periods} />
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
            <DeclarationInbox periodId={open.id} deadline={open.deadline} declarations={declarations.data!} members={activeMembers(members.data!)} wallets={wallets.data!} />
            <LoansSection periodId={open.id} declarations={declarations.data!} members={activeMembers(members.data!)} wallets={wallets.data!} />
            <PenaltiesSection periodId={open.id} members={activeMembers(members.data!)} />
            <NotYetDeclared periodId={open.id} members={activeMembers(members.data!)} declarations={declarations.data!} wallets={wallets.data!} />
            <Card>
              <CardHeader
                title="Close the month"
                subtitle="Closing writes everyone’s statement and locks the month. Check the list first."
                action={
                  <Link
                    to="/desk/close"
                    className="inline-flex h-12 items-center rounded-xl px-5 font-semibold text-accent underline transition duration-150 hover:bg-surface-2 active:scale-[.97]"
                  >
                    Review the close
                  </Link>
                }
              />
            </Card>
          </>
        ) : (
          <div role="status"><span className="sr-only">Loading declarations</span><Skeleton className="h-40" /></div>
        )
      ) : null}
      <Card>
        <CardHeader
          title="Members"
          subtitle="See a member’s ledger, correct an entry, waive a charge or mark a default."
          action={
            <Link
              to="/desk/members"
              className="inline-flex h-12 items-center rounded-xl px-5 font-semibold text-accent underline transition duration-150 hover:bg-surface-2 active:scale-[.97]"
            >
              Open members
            </Link>
          }
        />
      </Card>
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
