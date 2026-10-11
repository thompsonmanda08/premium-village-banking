import { Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { friendlyError } from '@/lib/errors';
import { Alert, Button, EmptyState, PageHeader, Skeleton } from '@/ui';

type GateQuery = { data: unknown; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
type Props = { title: string; subtitle?: ReactNode; loadingLabel: string; queries: GateQuery[]; children: ReactNode };

/** The frame every member screen shares: unlinked message, error with retry, labelled skeleton, then the content. */
export function MemberScreen({ title, subtitle, loadingLabel, queries, children }: Props) {
  const { member } = useGroup();
  const header = <PageHeader title={title} subtitle={subtitle} />;

  if (!member) {
    return (
      <>
        {header}
        <EmptyState icon={<Users className="size-7" />} title="Your account isn’t linked to a member">
          Ask your treasurer to link this account to your name, then come back.
        </EmptyState>
      </>
    );
  }
  // Data wins over a failed background refetch: the error state is only for when there is nothing to show.
  const failed = queries.find((q) => q.isError && q.data === undefined);
  if (failed) {
    return (
      <>
        {header}
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => queries.forEach((q) => void q.refetch())}>Try again</Button>}>
          {friendlyError(failed.error)}
        </Alert>
      </>
    );
  }
  if (queries.some((q) => q.data === undefined)) {
    return (
      <>
        {header}
        <div role="status" className="grid gap-3">
          <span className="sr-only">{loadingLabel}</span>
          <Skeleton className="h-28" />
          <Skeleton className="h-56" />
        </div>
      </>
    );
  }
  return (
    <>
      {header}
      {children}
    </>
  );
}
