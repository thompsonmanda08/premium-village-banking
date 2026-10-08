import { Navigate, Outlet, useLocation } from 'react-router';
import { FullScreenLoader } from '@/app/FullScreenLoader';
import { decideAccess } from './access';
import { useSession } from './SessionProvider';

export function RequireAuth() {
  const { session, loading } = useSession();
  const location = useLocation();
  const access = decideAccess(loading, Boolean(session));
  if (access === 'wait') return <FullScreenLoader />;
  if (access === 'sign-in') {
    return <Navigate to={`/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <Outlet />;
}
