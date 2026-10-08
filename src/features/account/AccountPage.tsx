import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { ThemeChoice } from '@/app/ThemeChoice';
import { useSession } from '@/features/auth/SessionProvider';
import { useSignOut } from '@/features/auth/useSignOut';
import { useGroup } from '@/features/group/GroupContext';
import { friendlyError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Card, CardHeader, PageHeader, Skeleton, TextField, useToast } from '@/ui';
import { checkPassword } from './password';

const PROVIDER_LABEL: Record<string, string> = { email: 'Email', google: 'Google' };
const providerLabel = (p: string) => PROVIDER_LABEL[p] ?? p.charAt(0).toUpperCase() + p.slice(1);

type Field = 'password' | 'confirm' | 'code';
type FormError = { text: string; field?: Field };

function SignInMethodsCard() {
  const { session } = useSession();
  const methods = useQuery({
    queryKey: ['identities', session?.user.id],
    // Only the provider names are kept: the identity rows carry emails and profile data that don't belong in the offline cache.
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return data.identities.map((i) => i.provider);
    },
    staleTime: 0, // coming back from Google must show it linked, not a copy from a minute ago
  });

  const providers = methods.data;
  return (
    <Card>
      <CardHeader title="Ways to sign in" />
      {providers ? (
        <>
          <ul role="list" aria-label="Ways to sign in" className="grid gap-2">
            {providers.map((p) => (
              <li key={p} className="flex min-h-12 items-center justify-between gap-3">
                <span className="text-base text-fg">{providerLabel(p)}</span>
                <Badge tone="success">On</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">Sign in with Google using this email and it links automatically.</p>
        </>
      ) : methods.isError ? (
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void methods.refetch()}>Try again</Button>}>
          {friendlyError(methods.error)}
        </Alert>
      ) : (
        <div role="status" className="grid gap-2">
          <span className="sr-only">Loading sign-in methods…</span>
          <Skeleton className="h-12" />
        </div>
      )}
    </Card>
  );
}

function PasswordCard({ resetting, onSaved }: { resetting: boolean; onSaved: () => void }) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [error, setError] = useState<FormError | null>(null);
  const [busy, setBusy] = useState(false);

  // A field error sits on the field (aria-invalid / aria-describedby) and takes focus; each step puts focus on its first field.
  useEffect(() => {
    if (error?.field) formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [error]);
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return; // not on first render, and not twice under StrictMode
    shownStep.current = step;
    formRef.current?.querySelector('input')?.focus();
  }, [step]);

  const fail = (err: unknown, field?: Field) => setError({ text: friendlyError(err), field });
  // The server checks the code first, then the password rules: a refused password belongs on the password field, on either step.
  const refusedPassword = (err: { code?: string }) => err.code === 'weak_password' || err.code === 'same_password';
  const clear = (field: Field) => setError((e) => (e?.field === field ? null : e));

  const saved = () => {
    haptic();
    setPassword('');
    setConfirm('');
    setCode('');
    setStep('password');
    toast('Password saved', { tone: 'success' });
    onSaved();
  };

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    const problem = checkPassword(password, confirm);
    if (problem) return fail({ code: problem }, problem === 'password_mismatch' ? 'confirm' : 'password');
    void run(async () => {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (!err) return saved();
      // A sign-in older than a day needs a one-time code from the member's email before the password may change.
      if (err.code !== 'reauthentication_needed') return fail(err, refusedPassword(err) ? 'password' : undefined);
      const sent = await supabase.auth.reauthenticate();
      if (sent.error) return fail(sent.error);
      setStep('code');
    });
  };

  const confirmCode = (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return fail({ code: 'reauthentication_needed' }, 'code');
    void run(async () => {
      const { error: err } = await supabase.auth.updateUser({ password, nonce: code.trim() });
      if (!err) return saved();
      if (refusedPassword(err)) {
        setCode('');
        setStep('password');
        return fail(err, 'password');
      }
      fail(err, 'code');
    });
  };

  const text = (field: Field) => (error?.field === field ? error.text : undefined);

  return (
    <Card>
      <CardHeader title={resetting ? 'Set a new password' : 'Password'} subtitle="Optional. Lets you sign in without waiting for an email." />
      {step === 'password' ? (
        <form ref={formRef} className="grid gap-3" onSubmit={savePassword} noValidate>
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 12 characters, with letters and numbers."
            value={password}
            error={text('password')}
            onChange={(e) => {
              setPassword(e.target.value);
              clear('password');
            }}
          />
          <TextField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            error={text('confirm')}
            onChange={(e) => {
              setConfirm(e.target.value);
              clear('confirm');
            }}
          />
          {error && !error.field ? <Alert tone="danger">{error.text}</Alert> : null}
          <Button type="submit" isLoading={busy}>Save password</Button>
        </form>
      ) : (
        <form ref={formRef} className="grid gap-3" onSubmit={confirmCode} noValidate>
          <Alert tone="info">We sent a code to your email. Enter it to confirm.</Alert>
          <TextField
            label="Code from your email"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            error={text('code')}
            onChange={(e) => {
              setCode(e.target.value);
              clear('code');
            }}
          />
          {error && !error.field ? <Alert tone="danger">{error.text}</Alert> : null}
          <Button type="submit" isLoading={busy}>Confirm</Button>
          <Button variant="secondary" disabled={busy} onClick={() => { setError(null); setCode(''); setStep('password'); }}>Back</Button>
        </form>
      )}
    </Card>
  );
}

export function AccountPage() {
  const { session } = useSession();
  const { member, group } = useGroup();
  const { signOut, pending } = useSignOut();
  const [params, setParams] = useSearchParams();
  const resetting = params.get('reset') === '1';

  return (
    <>
      <PageHeader title="Account" subtitle={group.name} />
      {resetting ? <div className="mb-4"><Alert tone="info">Choose a new password below.</Alert></div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="You" />
          <dl className="grid gap-3">
            <div>
              <dt className="text-sm text-muted">Name</dt>
              <dd className="text-base font-semibold text-fg">{member?.full_name ?? 'Group owner'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Email address</dt>
              <dd className="break-all text-base text-fg">{session?.user.email}</dd>
            </div>
          </dl>
        </Card>

        <SignInMethodsCard />

        <PasswordCard
          resetting={resetting}
          onSaved={() => setParams((p) => { const next = new URLSearchParams(p); next.delete('reset'); return next; }, { replace: true })}
        />

        <Card>
          <CardHeader title="Appearance" />
          <ThemeChoice />
        </Card>
      </div>
      <Button className="mt-6" variant="secondary" fullWidth isLoading={pending} leftIcon={<LogOut className="size-5" />} onClick={() => void signOut()}>
        Sign out
      </Button>
    </>
  );
}
