import { Navigate, NavLink, useParams } from 'react-router';
import { useGroup } from '@/features/group/GroupContext';
import { cn, PageHeader } from '@/ui';
import { GroupDetailsSection } from './GroupDetailsSection';
import { PeopleSection } from './PeopleSection';
import { RulesSection } from './RulesSection';
import { VisibilitySection } from './VisibilitySection';

export const SETTINGS_TABS = [
  { slug: 'general', label: 'General', Panel: GroupDetailsSection },
  { slug: 'privacy', label: 'Privacy', Panel: VisibilitySection },
  { slug: 'members', label: 'Members', Panel: PeopleSection },
  { slug: 'rules', label: 'Rules', Panel: RulesSection },
] as const;

export function SettingsPage() {
  const { isAdmin, group } = useGroup();
  const { tab } = useParams();
  // RLS is the real gate; this only keeps a member who types the URL from seeing a page of refusals.
  if (!isAdmin) return <Navigate to="/" replace />;
  const current = SETTINGS_TABS.find((t) => t.slug === tab);
  if (!current) return <Navigate to="/settings/general" replace />;
  const { Panel } = current;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Group settings" subtitle={group.name} />
      <nav aria-label="Settings sections" className="mb-6">
        <ul className="grid grid-cols-4 gap-1 rounded-full border border-line bg-surface p-1 md:inline-grid">
          {SETTINGS_TABS.map((t) => (
            <li key={t.slug}>
              <NavLink
                to={`/settings/${t.slug}`}
                replace
                className={({ isActive }) =>
                  cn(
                    'flex h-11 items-center justify-center rounded-full px-2 text-sm font-medium md:h-10 transition duration-150 active:scale-[.97] md:px-5',
                    isActive ? 'bg-accent-solid text-on-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Panel />
    </div>
  );
}
