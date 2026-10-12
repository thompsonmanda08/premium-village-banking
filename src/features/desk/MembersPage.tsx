import { Link } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { useGroupMembers } from '@/features/group/GroupPage';
import { activeMembers } from '@/features/ledger/model';
import { useLedgerCycle, useMemberStatuses } from '@/features/ledger/queries';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { Alert, Badge, Button, Card, PageHeader, Skeleton } from '@/ui';

function MembersBody() {
  const { group } = useGroup();
  const members = useGroupMembers(group.id);
  const cycle = useLedgerCycle(group.id);
  const statuses = useMemberStatuses(group.id, cycle.data?.cycle?.id);

  if (members.data === undefined) {
    return members.isError ? (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void members.refetch()}>Try again</Button>}>
        {friendlyError(members.error)}
      </Alert>
    ) : (
      <div role="status" className="grid gap-3">
        <span className="sr-only">Loading the members</span>
        <Skeleton className="h-56" />
      </div>
    );
  }

  const rows = activeMembers(members.data).sort((a, b) => a.short_name.localeCompare(b.short_name));
  const defaulted = new Set((statuses.data ?? []).filter((s) => s.defaulted).map((s) => s.member_id));

  return (
    <div className="grid gap-3 lg:max-w-2xl">
      {statuses.isError && !statuses.data ? <p className="text-sm text-muted">Default flags could not be loaded just now.</p> : null}
      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No active members.</p>
        ) : (
          <ul role="list" className="divide-y divide-line">
            {rows.map((m) => (
              <li key={m.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <Link to={`/desk/members/${m.id}`} className="font-semibold text-accent underline underline-offset-4">{m.short_name}</Link>
                {defaulted.has(m.id) ? <Badge tone="danger">Defaulted</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function MembersPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader title="Members" subtitle="Open a member to see their ledger" />
      <MembersBody />
    </>
  );
}
