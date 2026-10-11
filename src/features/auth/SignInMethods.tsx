import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { Alert, Button, TextField } from '@/ui';
import { safeNext } from './safeNext';

const callback = (next: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

// Google's logo keeps its own brand colours (their brand rules), so these are the one place raw colour is allowed.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.3v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.1z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 9.9L5.8 14z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

type FormError = { text: string; field?: 'email' | 'password' };

export function SignInMethods({ next: rawNext, email: initialEmail = '' }: { next: string; email?: string }) {
  const next = safeNext(rawNext);
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const wasSent = useRef(false);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'link' | 'password'>('link');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  const [sent, setSent] = useState<'link' | 'reset' | null>(null);

  // A field error goes on the field (aria-invalid / aria-describedby) and takes focus; the confirmation takes focus
  // when it replaces the form, and the form takes it back when the person returns to fix the address.
  useEffect(() => {
    if (error?.field) formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [error]);
  useEffect(() => {
    if (sent) {
      wasSent.current = true;
      headingRef.current?.focus();
    } else if (wasSent.current) {
      wasSent.current = false;
      formRef.current?.querySelector('input')?.focus();
    }
  }, [sent]);

  async function run(key: string, action: () => Promise<{ error: unknown }>, onOk?: () => void) {
    setError(null);
    setBusy(key);
    try {
      const { error: err } = await action();
      if (err) setError({ text: friendlyError(err) });
      else onOk?.();
    } catch (err) {
      setError({ text: friendlyError(err) });
    } finally {
      setBusy(null);
    }
  }

  const invalid = (field: 'email' | 'password', code: string) => setError({ field, text: friendlyError({ code }) });
  const clearField = (field: 'email' | 'password') => setError((e) => (e?.field === field ? null : e));

  const needEmail = () => {
    if (email.trim()) return false;
    invalid('email', 'email_required');
    return true;
  };

  const google = () =>
    run('google', () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback(next) } }));

  const sendLink = (e?: FormEvent) => {
    e?.preventDefault();
    if (needEmail()) return;
    void run(
      'link',
      () => supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback(next) } }),
      () => setSent('link'),
    );
  };

  const signIn = (e: FormEvent) => {
    e.preventDefault();
    if (needEmail()) return;
    if (!password) return invalid('password', 'password_required');
    void run('password', () => supabase.auth.signInWithPassword({ email: email.trim(), password }), () => navigate(next, { replace: true }));
  };

  const reset = () => {
    if (needEmail()) return;
    void run(
      'reset',
      () => supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: callback('/account?reset=1') }),
      () => setSent('reset'),
    );
  };

  if (sent) {
    return (
      <div className="grid gap-4">
        <Alert tone="success">
          <h2 ref={headingRef} tabIndex={-1} className="font-semibold">Check your email</h2>
          <p>
            {sent === 'link' ? 'We’ve sent a sign-in link.' : 'If that email has an account, we’ve sent a password reset link.'} Check your
            inbox — and the address, if nothing arrives.
          </p>
        </Alert>
        <Button variant="secondary" fullWidth onClick={() => setSent(null)}>Use a different email</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Button variant="secondary" fullWidth leftIcon={<GoogleIcon />} isLoading={busy === 'google'} onClick={google}>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <form ref={formRef} className="grid gap-4" onSubmit={mode === 'link' ? sendLink : signIn} noValidate>
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          error={error?.field === 'email' ? error.text : undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            clearField('email');
          }}
        />
        {mode === 'password' ? (
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            error={error?.field === 'password' ? error.text : undefined}
            onChange={(e) => {
              setPassword(e.target.value);
              clearField('password');
            }}
          />
        ) : null}
        {error && !error.field ? <Alert tone="danger">{error.text}</Alert> : null}
        {mode === 'link' ? (
          <>
            <Button type="submit" fullWidth leftIcon={<Mail className="size-5" />} isLoading={busy === 'link'}>
              Email me a sign-in link
            </Button>
            <Button variant="ghost" fullWidth onClick={() => { setError(null); setMode('password'); }}>
              Use a password instead
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" fullWidth isLoading={busy === 'password'}>Sign in</Button>
            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setError(null); setMode('link'); }}>Email me a link instead</Button>
              <Button variant="ghost" size="sm" isLoading={busy === 'reset'} onClick={reset}>Forgot password?</Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
