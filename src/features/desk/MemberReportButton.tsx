import { exportMember } from '@/features/exports/exportActions';
import { useExportRunner } from '@/features/exports/useExportRunner';
import { useGroup } from '@/features/group/GroupContext';
import { useLedgerCycle } from '@/features/ledger/queries';
import { Button } from '@/ui';

/** Downloads one member's own report as an Excel file (only their figures, safe to send to them). */
export function MemberReportButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const { group } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const { busy, run } = useExportRunner();
  const data = cycle.data;
  if (!data?.cycle) return null;
  const ctx = { groupId: group.id, groupName: group.name, cycle: data.cycle, periods: data.periods };
  return (
    <Button
      size="sm"
      variant="secondary"
      aria-label={`Download ${memberName}’s report`}
      isLoading={busy !== null}
      disabled={busy !== null}
      onClick={() => void run('member', () => exportMember(ctx, memberId))}
    >
      {busy !== null ? 'Preparing…' : 'Download report'}
    </Button>
  );
}
