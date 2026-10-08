import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Users } from 'lucide-react';
import { PullToRefresh } from '@/app/PullToRefresh';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { Alert, Avatar, Badge, Button, Card, EmptyState, IconButton, PageHeader, Skeleton } from '@/ui';
import { useGroup } from './GroupContext';

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from('group_members').select('*').eq('group_id', groupId).order('full_name');
      if (error) throw error;
      return data;
    },
  });
}

export function GroupPage() {
  const { group } = useGroup();
  const members = useGroupMembers(group.id);
  const { data } = members;
  const active = data?.filter((m) => m.status === 'active') ?? [];
  const refetch = () => void members.refetch();

  return (
    <PullToRefresh onRefresh={() => members.refetch()}>
      <PageHeader
        title="Group"
        subtitle={
          data ? (
            <>
              <span className="tabular">{active.length}</span> active member{active.length === 1 ? '' : 's'}
            </>
          ) : (
            group.name
          )
        }
        actions={<IconButton label="Refresh" icon={<RefreshCw className="size-5" />} onClick={refetch} />}
      />
      <p className="mb-4 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
        {group.figures_visibility === 'open'
          ? 'Everyone in the group can see each member’s figures.'
          : 'Members see only their own figures. Group totals are shared with everyone.'}
      </p>
      {data === undefined ? (
        // Data wins over a failed background refetch: the error state is only for when there is nothing to show.
        members.isError ? (
          <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={refetch}>Try again</Button>}>
            {friendlyError(members.error)}
          </Alert>
        ) : (
          <div role="status" className="grid gap-2">
            <span className="sr-only">Loading members…</span>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        )
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Users className="size-7" />}
          title="No members yet"
          action={<Button size="sm" variant="secondary" onClick={refetch}>Check again</Button>}
        >
          Members appear here once your treasurer adds them.
        </EmptyState>
      ) : (
        <Card className="p-0 md:p-0">
          <ul className="divide-y divide-line">
            {data.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.full_name ?? ''} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-fg">{m.full_name}</p>
                  {m.full_name !== m.short_name ? <p className="text-sm text-muted">{m.short_name}</p> : null}
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {m.role === 'admin' ? <Badge tone="accent">Admin</Badge> : null}
                  {m.status === 'left' ? <Badge>Left</Badge> : !m.linked ? <Badge tone="warning">Not joined</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PullToRefresh>
  );
}
