import { NavLink } from 'react-router';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/ui';
import { bottomNav } from './nav';

const item = 'flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium transition duration-150 active:scale-[.97]';
const pill = 'grid h-8 w-14 place-items-center rounded-full transition';

export function BottomNav({ isAdmin, onMore }: { isAdmin: boolean; onMore: () => void }) {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {bottomNav(isAdmin).map(({ key, label, to, icon: Icon }) => (
          <li key={key}>
            <NavLink to={to} end={to === '/'} viewTransition className={({ isActive }) => cn(item, isActive ? 'text-fg' : 'text-muted')}>
              {({ isActive }) => (
                <>
                  <span className={cn(pill, isActive && 'bg-accent-solid text-on-accent')}>
                    <Icon aria-hidden className="size-6" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <button type="button" aria-haspopup="dialog" onClick={onMore} className={cn(item, 'text-muted')}>
            <span className={pill}>
              <MoreHorizontal aria-hidden className="size-6" />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
