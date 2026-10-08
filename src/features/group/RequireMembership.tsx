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
  const state: MembershipState = query.isPending ? 'loading' : query.isError ? 'error' : query.data ? 'found' : 'none';
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
