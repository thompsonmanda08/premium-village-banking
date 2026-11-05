import { useGroup } from '@/features/group/GroupContext';
import { memberAdvice } from '@/features/ledger/advice';
import { MyCharts } from '@/features/ledger/MyCharts';
import { myStats } from '@/features/ledger/myStats';
import type { PeriodRow } from '@/features/ledger/model';
import { useCycleRules, useLedgerCycle, useMyStatements } from '@/features/ledger/queries';
import { Badge, Panel } from '@/ui';

// The constitution's minimum saving, used only if the rules row cannot be read.
const FALLBACK_MIN_SAVING = 250;

/** How one member is doing, for the treasurer: talking points first, then the same charts the member sees. */
export function MemberProgress({ memberId, name, periods }: { memberId: string; name: string; periods: PeriodRow[] }) {
  const { group } = useGroup();
  const statements = useMyStatements(memberId);
  const cycle = useLedgerCycle(group.id);
  const rules = useCycleRules(cycle.data?.cycle?.id);
  if (!statements.data) return null;
  const minSaving = rules.data?.min_saving ?? FALLBACK_MIN_SAVING;
  const advice = memberAdvice(myStats(statements.data, periods, minSaving), minSaving);
  if (advice.length === 0) return null;

  return (
    <div className="grid gap-4 md:gap-5">
      <Panel title={`How ${name} is doing`} hint="Worked out from their closed statements. Use it as a starting point for a conversation.">
        <ul role="list" className="grid gap-2">
          {advice.map((a) => (
            <li key={a.text} className="flex items-start gap-3 rounded-xl bg-surface-2 p-3">
              <Badge tone={a.tone === 'good' ? 'success' : 'warning'}>{a.tone === 'good' ? 'On track' : 'Discuss'}</Badge>
              <span className="text-base text-fg">{a.text}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <MyCharts statements={statements.data} periods={periods} view="record" />
    </div>
  );
}
