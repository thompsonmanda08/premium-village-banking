import { useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { AuthLayout } from '@/app/AuthLayout';
import { SignInMethods } from '@/features/auth/SignInMethods';
import { useSession } from '@/features/auth/SessionProvider';
import { useSignOut } from '@/features/auth/useSignOut';
import { friendlyError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { Alert, Button, Skeleton, useToast } from '@/ui';

type Preview = { status: 'valid' | 'expired' | 'revoked' | 'used' | 'not_found'; group_name?: string; member_name?: string; email_hint?: string };

const linkClass = 'inline-flex min-h-12 items-center font-semibold text-fg underline underline-offset-4';

export function InvitePage() {
  const { token = '' } = useParams();
  const here = `/invite/${encodeURIComponent(token)}`;
  const { session, loading } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  // Signing out reloads back to this invite, signed out, so the person can open it again with the invited email.
  const { signOut, pending: signingOut } = useSignOut(here);
  const attempted = useRef('');

  const preview = useQuery({
    queryKey: ['invite-preview', token],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('invite_preview', { p_token: token });
      if (error) throw error;
      return data as unknown as Preview;
    },
  });

  const accept = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
      if (error) throw error;
      return data as { short_name: string };
    },
    onSuccess: async (member) => {
      haptic();
      await qc.invalidateQueries({ queryKey: ['membership'] });
      toast(`Welcome, ${member.short_name}`, { tone: 'success' });
      navigate('/', { replace: true });
    },
  });

  // Once per token and account. StrictMode's second effect run, re-renders and token-refresh session events must not link twice.
  const { mutate } = accept;
  const userId = session?.user.id;
  const valid = preview.data?.status === 'valid';
  useEffect(() => {
    const key = `${token}:${userId}`;
    if (!userId || !valid || attempted.current === key) return;
    attempted.current = key;
    mutate();
  }, [token, userId, valid, mutate]);

  const p = preview.data;
  const heading = p?.member_name ? `You’re invited to ${p.group_name} as ${p.member_name}` : 'Your invitation';

  return (
    <AuthLayout title="Join your group">
      {preview.isPending || loading ? (
        <div role="status">
          <span className="sr-only">Loading your invitation…</span>
          <Skeleton className="h-40" />
        </div>
      ) : preview.isError ? (
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void preview.refetch()}>Try again</Button>}>
          {friendlyError(preview.error)}
        </Alert>
      ) : p && p.status !== 'valid' ? (
        <Alert
          tone="warning"
          action={
            <Link to={session ? '/' : '/sign-in'} className={linkClass}>
              {session ? 'Go home' : 'Go to sign in'}
            </Link>
          }
        >
          {friendlyError({ message: `invite_${p.status}` })}
        </Alert>
      ) : session ? (
        accept.isError ? (
          <Alert
            tone="danger"
            title="We couldn’t link your account"
            action={
              <Button size="sm" variant="secondary" isLoading={signingOut} onClick={() => void signOut()}>
                Sign out and use the invited email
              </Button>
            }
          >
            {friendlyError(accept.error)} You’re signed in as <strong>{session.user.email}</strong>.
          </Alert>
        ) : (
          <p role="status" className="flex items-center gap-3 text-base text-muted">
            <Loader2 aria-hidden className="size-5 animate-spin text-accent" /> Linking your account…
          </p>
        )
      ) : (
        <div className="grid gap-6">
          <div>
            <h2 className="text-xl font-semibold text-fg">{heading}</h2>
            <p className="mt-1 text-base text-muted">
              Sign in with the email this invite was sent to ({p?.email_hint}). If you’re new, the emailed link signs you in.
            </p>
          </div>
          <SignInMethods next={here} />
        </div>
      )}
    </AuthLayout>
  );
}
