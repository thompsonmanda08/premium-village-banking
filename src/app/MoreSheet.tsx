import { Link } from 'react-router';
import { ChevronRight, LogOut } from 'lucide-react';
import { useSignOut } from '@/features/auth/useSignOut';
import { Button, Sheet } from '@/ui';
import { moreItems } from './nav';
import { ThemeChoice } from './ThemeChoice';

export function MoreSheet({ open, onClose, isAdmin }: { open: boolean; onClose: () => void; isAdmin: boolean }) {
  const { signOut, pending } = useSignOut();
  return (
    <Sheet open={open} onClose={onClose} title="More">
      <ul className="mb-6 grid gap-1">
        {moreItems(isAdmin).map(({ key, label, to, icon: Icon }) => (
          <li key={key}>
            <Link to={to} viewTransition onClick={onClose} className="flex h-14 items-center gap-3 rounded-xl px-3 text-base font-medium text-fg transition hover:bg-surface-2 active:scale-[.98]">
              <Icon aria-hidden className="size-5 text-muted" />
              <span className="flex-1">{label}</span>
              <ChevronRight aria-hidden className="size-5 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <ThemeChoice />
      <Button className="mt-6" variant="secondary" fullWidth isLoading={pending} leftIcon={<LogOut className="size-5" />} onClick={() => void signOut()}>
        Sign out
      </Button>
    </Sheet>
  );
}
