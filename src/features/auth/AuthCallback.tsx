import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AuthLayout } from '@/app/AuthLayout';
import { FullScreenLoader } from '@/app/FullScreenLoader';
import { Alert } from '@/ui';
import { useSession } from './SessionProvider';
import { safeNext } from './safeNext';

export function AuthCallback() {
  const { session } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [timedOut, setTimedOut] = useState(false);
  const hashError = new URLSearchParams(window.location.hash.slice(1)).get('error_description');

  useEffect(() => {
    if (session) navigate(next, { replace: true });
  }, [session, next, navigate]);

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 8000);
    return () => window.clearTimeout(t);
  }, []);

  if (hashError || timedOut) {
    return (
      <AuthLayout title="Sign-in link problem">
        <Alert
          tone="danger"
          action={<Link className="inline-flex min-h-12 items-center font-semibold underline" to="/sign-in">Back to sign in</Link>}
        >
          {hashError ? 'This sign-in link has expired or was already used. Request a new one.' : 'We couldn’t finish signing you in. Please try again.'}
        </Alert>
      </AuthLayout>
    );
  }
  return <FullScreenLoader label="Signing you in" />;
}
