import { ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { NotFound } from '@/features/shells/NotFound';
import { EmptyState, PageHeader } from '@/ui';

export function DeskPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader title="Treasurer desk" />
      <EmptyState
        icon={<ClipboardCheck className="size-7" />}
        title="The treasurer desk arrives with the ledger"
        action={
          <Link
            to="/desk/ledger-check"
            className="inline-flex h-12 items-center rounded-xl px-5 font-semibold text-accent underline transition duration-150 hover:bg-surface-2 active:scale-[.97]"
          >
            Open the ledger check
          </Link>
        }
      >
        Approvals, loans and month close appear here once the February 2027 cycle opens. Until then, the ledger check
        compares the imported 2026 months with the workbooks.
      </EmptyState>
    </>
  );
}
