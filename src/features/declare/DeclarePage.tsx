import { PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { DeclarationForm } from '@/features/ledger/DeclarationForm';
import { DeclarationSummary } from '@/features/ledger/DeclarationSummary';
import { useGroup } from '@/features/group/GroupContext';
import { currentPeriod, deadlineNote, lastClosed, liveDeclarations } from '@/features/ledger/model';
import { useDeclarations, useLedgerCycle, useMinimumPayable, useWallets } from '@/features/ledger/queries';
import { friendlyError } from '@/lib/errors';
import { formatDate, localISODate, money } from '@/lib/format';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton } from '@/ui';

export function DeclarePage() {
  const { group, member } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const periods = cycle.data?.periods ?? [];
  const period = currentPeriod(periods);
  const last = lastClosed(periods);
  const wallets = useWallets(group.id);
  const declarations = useDeclarations(group.id, period?.id, member?.id);
  const minimum = useMinimumPayable(member?.id, last?.id);
  const [editing, setEditing] = useState(false);

  if (!member) {
    return (
      <>
        <PageHeader title="Declare" />
        <EmptyState icon={<PlusCircle className="size-7" />} title="Your account isn’t linked to a member">
          Ask your treasurer to link this account to your name, then come back.
        </EmptyState>
      </>
    );
  }

  if (cycle.data === undefined) {
    return (
      <>
        <PageHeader title="Declare" />
        {cycle.isError ? (
          <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void cycle.refetch()}>Try again</Button>}>
            {friendlyError(cycle.error)}
          </Alert>
        ) : (
          <div role="status" className="grid gap-3">
            <span className="sr-only">Loading your declaration</span>
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        )}
      </>
    );
  }

  if (!period) {
    return (
      <>
        <PageHeader title="Declare" />
        <EmptyState icon={<PlusCircle className="size-7" />} title="Next month isn’t open yet">
          Your treasurer opens each month for declarations.{last ? ` The last closed month is ${last.label}.` : ''}
        </EmptyState>
      </>
    );
  }

  const live = liveDeclarations(declarations.data ?? []);
  const approved = live.filter((d) => d.status === 'approved');
  const waiting = live.find((d) => d.status !== 'approved') ?? null;
  const showForm = waiting ? waiting.status === 'returned' || editing : approved.length === 0 || editing;
  const walletName = (id: string | null) => wallets.data?.find((w) => w.id === id)?.name;
  const note = deadlineNote(localISODate(new Date()), period.deadline);

  return (
    <>
      <PageHeader title="Declare" subtitle={period.label} />
      <div className="grid gap-4 md:gap-5 lg:max-w-xl">
        <Card>
          <p className="flex flex-wrap items-center gap-2 text-base text-fg">
            Due <strong>{formatDate(period.deadline)}</strong>
            <Badge tone={note.tone}>{note.text}</Badge>
          </p>
          {minimum.data != null && minimum.data > 0 ? (
            <p className="mt-2 text-sm text-muted">
              Minimum payable this month: <span className="tabular font-semibold text-fg">{money(minimum.data)}</span>
            </p>
          ) : null}
        </Card>

        {declarations.isPending ? (
          <div role="status"><span className="sr-only">Loading your declaration</span><Skeleton className="h-40" /></div>
        ) : (
          <>
            {approved.map((d) => (
              <Card key={d.id}>
                <CardHeader title="Your declaration" action={<Badge tone="success">Approved</Badge>} />
                <DeclarationSummary d={d} walletName={walletName(d.wallet_id)} />
              </Card>
            ))}

            {waiting?.status === 'submitted' ? (
              <Card>
                <CardHeader title="Your declaration" action={<Badge tone="warning">Waiting for the treasurer</Badge>} />
                <DeclarationSummary d={waiting} walletName={walletName(waiting.wallet_id)} />
                {!editing ? (
                  <Button className="mt-4" size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
                ) : null}
              </Card>
            ) : null}

            {waiting?.status === 'returned' ? (
              <Alert tone="warning" title="Returned by the treasurer">{waiting.return_reason}</Alert>
            ) : null}

            {showForm ? (
              <Card>
                <CardHeader title={waiting ? 'Update your declaration' : 'What are you sending?'} />
                <DeclarationForm
                  key={waiting?.id ?? 'new'}
                  periodId={period.id}
                  memberId={member.id}
                  wallets={wallets.data ?? []}
                  initial={waiting}
                  onDone={() => setEditing(false)}
                />
              </Card>
            ) : !waiting ? (
              <Button variant="secondary" onClick={() => setEditing(true)}>Declare another payment</Button>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
