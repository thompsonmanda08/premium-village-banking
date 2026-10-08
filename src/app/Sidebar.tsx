import { NavLink } from 'react-router';
import { Settings } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { Button, cn } from '@/ui';
import { BrandMark } from './BrandMark';
import { sidebarItems } from './nav';
import { ThemeChoice } from './ThemeChoice';

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { isAdmin, group } = useGroup();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface p-4 md:flex">
      <div className="flex items-center gap-3 px-2">
        <BrandMark size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{group.name}</p>
          <p className="text-xs text-muted">Premium Village Bank</p>
        </div>
      </div>
      <nav aria-label="Sections" className="flex-1">
        <ul className="grid gap-1">
          {sidebarItems(isAdmin).map(({ key, label, to, icon: Icon }) => (
            <li key={key}>
              <NavLink
                to={to}
                end={to === '/'}
                viewTransition
                className={({ isActive }) =>
                  cn('flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition', isActive ? 'bg-accent-soft text-accent' : 'text-fg hover:bg-surface-2')
                }
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {isAdmin ? (
        <Button variant="secondary" size="sm" leftIcon={<Settings className="size-4" />} onClick={onOpenSettings} aria-label="Group settings">
          Group settings
        </Button>
      ) : null}
      <ThemeChoice />
    </aside>
  );
}
