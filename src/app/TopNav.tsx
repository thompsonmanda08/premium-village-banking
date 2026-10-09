import { Link, NavLink } from 'react-router';
import { Settings } from 'lucide-react';
import { useGroup } from '@/features/group/GroupContext';
import { Avatar, cn } from '@/ui';
import { BrandMark } from './BrandMark';
import { topNavItems } from './nav';

const round = 'grid size-12 place-items-center rounded-full border transition duration-150 active:scale-[.97]';

/** Desktop and tablet header. Below xl the pills show icons only and the current page keeps its label. */
export function TopNav() {
  const { isAdmin, member, group } = useGroup();
  return (
    <header className="sticky top-0 z-30 hidden bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur md:block">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center gap-4 px-8">
        <Link to="/" viewTransition aria-label="Premium Village Bank, home" className="flex h-12 shrink-0 items-center gap-2.5 rounded-full border border-line bg-surface p-1 transition duration-150 hover:bg-surface-2 xl:pr-5">
          <BrandMark size={38} />
          <span className="hidden text-base font-semibold tracking-tight text-fg xl:block">Premium Village Bank</span>
        </Link>
        <nav aria-label="Sections" className="flex min-w-0 flex-1 justify-center">
          <ul className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
            {topNavItems(isAdmin).map(({ key, label, to, icon: Icon }) => (
              <li key={key}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  viewTransition
                  title={label}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-medium transition duration-150 active:scale-[.97] xl:px-4',
                      isActive ? 'bg-accent-solid text-on-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon aria-hidden className="size-5 xl:hidden" />
                      <span className={cn(isActive ? 'pr-1 xl:pr-0' : 'sr-only xl:not-sr-only')}>{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {isAdmin ? (
            <NavLink
              to="/settings"
              viewTransition
              aria-label="Group settings"
              title="Group settings"
              className={({ isActive }) => cn(round, isActive ? 'border-transparent bg-accent-solid text-on-accent' : 'border-line bg-surface text-muted hover:text-fg')}
            >
              <Settings aria-hidden className="size-5" />
            </NavLink>
          ) : null}
          <NavLink
            to="/account"
            viewTransition
            aria-label="Account"
            title="Account"
            className={({ isActive }) => cn(round, 'bg-surface', isActive ? 'border-accent' : 'border-line hover:bg-surface-2')}
          >
            <Avatar name={member?.full_name ?? group.name} size="sm" />
          </NavLink>
        </div>
      </div>
    </header>
  );
}
