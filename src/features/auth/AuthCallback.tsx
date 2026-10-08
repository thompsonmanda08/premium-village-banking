import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AuthLayout } from '@/app/AuthLayout';
import { FullScreenLoader } from '@/app/FullScreenLoader';
import { friendlyError } from '@/lib/errors';
import { Alert } from '@/ui';
import { useSession } from './SessionProvider';
import { safeNext } from './safeNext';

// Providers put the failure in the query string (PKCE) or the hash (implicit). Only these codes are echoed as their own
// sentence; the provider's error_description is never shown, and any other code gets the generic callback message.
const SHOWN_CODES = ['signup_disabled', 'access_denied', 'otp_expired'];

function callbackError(query: URLSearchParams): string | null {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const read = (key: string) => query.get(key) ?? hash.get(key);
  if (!read('error') && !read('error_code') && !read('error_description')) return null;
  const code = read('error_code') ?? read('error');
  return friendlyError({ code: code && SHOWN_CODES.includes(code) ? code : 'callback_failed' });
}

export function AuthCallback() {
  const { session } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [timedOut, setTimedOut] = useState(false);
  const failure = callbackError(params) ?? (timedOut ? friendlyError({ code: 'callback_failed' }) : null);

  useEffect(() => {
    if (session) navigate(next, { replace: true });
  }, [session, next, navigate]);

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 8000);
    return () => window.clearTimeout(t);
  }, []);

  if (failure) {
    return (
      <AuthLayout title="Sign-in link problem">
        <Alert
          tone="danger"
          action={<Link className="inline-flex min-h-12 items-center font-semibold underline" to="/sign-in">Back to sign in</Link>}
        >
          {failure}
        </Alert>
      </AuthLayout>
    );
  }
  return <FullScreenLoader label="Signing you in" />;
}
