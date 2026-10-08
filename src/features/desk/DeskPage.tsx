import { ClipboardCheck } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { NotFound } from '@/features/shells/NotFound';
import { EmptyState, PageHeader } from '@/ui';

export function DeskPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader title="Treasurer desk" />
      <EmptyState icon={<ClipboardCheck className="size-7" />} title="The treasurer desk arrives with the ledger">
        Approvals, loans and month close appear here once the February 2027 cycle opens.
      </EmptyState>
    </>
  );
}
