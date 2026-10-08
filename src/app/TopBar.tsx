import { Link, useMatches } from 'react-router';
import { Settings } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { Avatar, IconButton } from '@/ui';

export function TopBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { isAdmin, member, group } = useGroup();
  const matches = useMatches();
  const title = [...matches].reverse().map((m) => (m.handle as { title?: string } | undefined)?.title).find(Boolean) ?? group.name;
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <div className="flex h-14 items-center gap-1 px-4">
        <span className="flex-1 truncate text-lg font-semibold text-fg">{title}</span>
        {isAdmin ? <IconButton label="Group settings" icon={<Settings className="size-5" />} onClick={onOpenSettings} /> : null}
        <Link to="/account" aria-label="Account" className="grid size-12 place-items-center rounded-xl active:scale-[.97]">
          <Avatar name={member?.full_name ?? group.name} size="sm" />
        </Link>
      </div>
    </div>
  );
}
