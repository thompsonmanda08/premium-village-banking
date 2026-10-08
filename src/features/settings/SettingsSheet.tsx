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
  // RLS is the real gate; this only keeps a member who types ?settings=open from seeing a drawer of refusals.
  const open = isAdmin && params.get('settings') === 'open';
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('settings');
    setParams(next, { replace: true });
  };
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
