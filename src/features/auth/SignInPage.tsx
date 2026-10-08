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
  if (loading) return <FullScreenLoader />;
  if (session) return <Navigate to={next} replace />;
  return (
    <AuthLayout title="Sign in" subtitle="Members join by invitation from the treasurer.">
      <SignInMethods next={next} />
    </AuthLayout>
  );
}
