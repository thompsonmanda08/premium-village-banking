import { Outlet } from 'react-router';
import { FullScreenLoader } from '@/app/FullScreenLoader';
import { ErrorScreen } from '@/app/ErrorScreen';
import { decideAccess, type MembershipState } from '@/features/auth/access';
import { useSession } from '@/features/auth/SessionProvider';
import { friendlyError } from '@/lib/errors';
import { GroupProvider } from './GroupContext';
import { NoGroupScreen } from './NoGroupScreen';
import { useMembership } from './useMembership';

export function RequireMembership() {
  const { session } = useSession();
  const query = useMembership(session?.user.id);
  // Data wins over status: a failed background refetch keeps the last known membership (TanStack keeps `data` on error).
  const state: MembershipState = query.isPending ? 'loading' : query.data !== undefined ? (query.data ? 'found' : 'none') : 'error';
  const access = decideAccess(false, Boolean(session), state);

  if (access === 'wait') return <FullScreenLoader />;
  if (access === 'error') return <ErrorScreen message={friendlyError(query.error)} onRetry={() => void query.refetch()} />;
  if (access !== 'ok' || !query.data) return <NoGroupScreen email={session?.user.email ?? undefined} />;
  return (
    <GroupProvider value={query.data}>
      <Outlet />
    </GroupProvider>
  );
}
