import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { AuthLayout } from '@/app/AuthLayout';
import { FullScreenLoader } from '@/app/FullScreenLoader';
import { SignInMethods } from './SignInMethods';
import { useSession } from './SessionProvider';
import { safeNext } from './safeNext';

export function SignInPage() {
  const { session, loading } = useSession();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  // Back from the app can restore this page frozen from the browser's back/forward cache, with the old form still on screen.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && window.location.reload();
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);
  if (loading) return <FullScreenLoader />;
  if (session) return <Navigate to={next} replace />;
  return (
    <AuthLayout title="Sign in" subtitle="Sign in to your group, or start a new one.">
      <SignInMethods next={next} />
    </AuthLayout>
  );
}
