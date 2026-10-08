import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { Sheet } from '@/ui';
import { GroupDetailsSection } from './GroupDetailsSection';
import { PeopleSection } from './PeopleSection';
import { RulesSection } from './RulesSection';
import { VisibilitySection } from './VisibilitySection';

export function SettingsSheet() {
  const { isAdmin, group } = useGroup();
  const [params, setParams] = useSearchParams();
  const requested = params.get('settings') === 'open';
  // RLS is the real gate; this only keeps a member who types ?settings=open from seeing a drawer of refusals.
  const open = isAdmin && requested;
  const close = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('settings');
      return next;
    }, { replace: true });
  }, [setParams]);
  // A non-admin's stray param is dropped, so it cannot open the drawer later if they are promoted.
  useEffect(() => {
    if (requested && !isAdmin) close();
  }, [requested, isAdmin, close]);
  return (
    <Sheet open={open} onClose={close} title="Group settings" description={group.name}>
      <div className="grid gap-8">
        <GroupDetailsSection />
        <VisibilitySection />
        <PeopleSection />
        <RulesSection />
      </div>
    </Sheet>
  );
}
