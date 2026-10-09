import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/ui';

const rpc = vi.fn();
const signOut = vi.fn();
const signInWithOAuth = vi.fn();
const replace = vi.fn();
let session: { user: { id: string; email: string } } | null = null;

vi.mock('@/lib/supabase', () => ({
  AUTH_STORAGE_KEY: 'pvb-auth',
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    auth: { signOut: (...a: unknown[]) => signOut(...a), signInWithOAuth: (...a: unknown[]) => signInWithOAuth(...a), signInWithOtp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn() },
  },
}));
// A fresh session object on every render, as after a token-refresh event, so a missing guard shows up as a second RPC.
vi.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ session: session && { ...session, user: { ...session.user } }, loading: false }) }));
const { InvitePage } = await import('./InvitePage');

const preview = (status: string) => ({ data: { status, group_name: 'Premium Village Banking', member_name: 'Tafara', email_hint: 't•••@gmail.com' }, error: null });
const accepts = () => rpc.mock.calls.filter(([name]) => name === 'accept_invite');
const previews = () => rpc.mock.calls.filter(([name]) => name === 'invite_preview');
const NEVER = new Promise<never>(() => {});

// Stands in for RequireMembership at "/": it owns the membership query, and shows a cached "no group" as soon as it mounts.
const fetchMembership = vi.fn();
const seen: string[] = [];
function Guard() {
  const q = useQuery({ queryKey: ['membership', 'u1'], queryFn: () => fetchMembership() as Promise<unknown> });
  const state = q.isPending ? 'loading' : q.data === null ? 'no group' : 'Home';
  seen.push(state);
  return <p>{state}</p>;
}

/** invite_preview answers `previewResult`; each accept_invite takes the next of `acceptResults` (then hangs). */
function serve(acceptResults: unknown[], previewResult: unknown = preview('valid')) {
  const queue = [...acceptResults];
  rpc.mockImplementation(async (name: string) => (name === 'invite_preview' ? previewResult : queue.length ? queue.shift() : NEVER));
}

function renderAt(path: string, { strict = false, setup }: { strict?: boolean; setup?: (qc: QueryClient) => void } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setup?.(qc);
  const app = (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="/" element={<Guard />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
  render(strict ? <StrictMode>{app}</StrictMode> : app);
  return qc;
}

// Braces matter: vitest runs a function returned from beforeEach as teardown, and mockReset() returns the mock.
beforeEach(() => {
  rpc.mockReset();
  signOut.mockReset().mockResolvedValue({ error: null });
  signInWithOAuth.mockReset().mockResolvedValue({ error: null });
  replace.mockReset();
  fetchMembership.mockReset().mockResolvedValue({ group: 'Premium' });
  seen.length = 0;
  session = null;
  vi.stubGlobal('location', { ...window.location, replace });
});
afterEach(() => vi.unstubAllGlobals());

const SIGN_OUT = 'Sign out and use the invited email';
const signedIn = (id = 'u1', email = 'tafara@gmail.com') => (session = { user: { id, email } });

test('signed out: names the group and member and offers sign-in', async () => {
  rpc.mockResolvedValueOnce(preview('valid'));
  renderAt('/invite/tok');
  expect(await screen.findByText(/as Tafara/)).toBeInTheDocument();
  expect(screen.getByText(/t•••@gmail\.com/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  expect(accepts()).toHaveLength(0);
});

test.each([
  ['hash', '/invite/tok#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'],
  ['query', '/invite/tok?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'],
  ['hash, another error', '/invite/tok#error=server_error&error_code=unexpected_failure&error_description=Database+exploded'],
])('signed out, opened from a failed email link (%s): says so, tells them to ask for a new invite, keeps sign-in', async (_where, path) => {
  rpc.mockResolvedValueOnce(preview('valid'));
  renderAt(path);
  const note = await screen.findByText(/This sign-in link has expired or was already used\. Request a new one\. Ask your treasurer to send a new invite\./);
  expect(note).toBeInTheDocument();
  expect(screen.queryByText(/invalid or has expired|exploded|unexpected_failure|otp_expired/i)).toBeNull(); // never the provider's text or codes
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  expect(screen.getByText(/as Tafara/)).toBeInTheDocument();
  expect(accepts()).toHaveLength(0);
});

test('signed out, no failure in the URL: no link-expired note', async () => {
  rpc.mockResolvedValueOnce(preview('valid'));
  renderAt('/invite/tok#access_token_missing=1');
  expect(await screen.findByText(/as Tafara/)).toBeInTheDocument();
  expect(screen.queryByText(/Ask your treasurer to send a new invite/)).toBeNull();
});

test('signed out: Google sign-in comes back to this invite', async () => {
  rpc.mockResolvedValueOnce(preview('valid'));
  renderAt('/invite/tok');
  await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));
  expect(signInWithOAuth).toHaveBeenCalledTimes(1);
  const { provider, options } = signInWithOAuth.mock.calls[0]![0] as { provider: string; options: { redirectTo: string } };
  expect(provider).toBe('google');
  expect(options.redirectTo).toContain('/auth/callback?next=%2Finvite%2Ftok');
});

test('expired invite explains what to do', async () => {
  rpc.mockResolvedValueOnce(preview('expired'));
  renderAt('/invite/tok');
  expect(await screen.findByText('This invite has expired. Ask your treasurer to send a new one.')).toBeInTheDocument();
});

test.each([
  ['revoked', 'This invite was cancelled. Ask your treasurer for a new one.'],
  ['used', 'This invite has already been used. Sign in instead.'],
  ['not_found', 'This invite link isn’t valid. Ask your treasurer for a new one.'],
])('a %s invite says so and is not a dead end', async (status, sentence) => {
  rpc.mockResolvedValueOnce({ data: { status }, error: null });
  renderAt('/invite/tok');
  expect(await screen.findByText(sentence)).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'Go to sign in' });
  expect(link).toHaveAttribute('href', '/sign-in');
  expect(link).toHaveClass('min-h-12');
  expect(accepts()).toHaveLength(0);
});

test('a signed-in person opening a used invite is offered home, not sign-in', async () => {
  signedIn();
  rpc.mockResolvedValueOnce({ data: { status: 'used' }, error: null });
  renderAt('/invite/tok');
  expect(await screen.findByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  expect(screen.queryByRole('link', { name: 'Go to sign in' })).toBeNull();
  expect(accepts()).toHaveLength(0);
});

test('a failed preview shows a friendly message and can be retried', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch secret-detail' } });
  renderAt('/invite/tok');
  expect(await screen.findByText('You seem to be offline. Check your connection and try again.')).toBeInTheDocument();
  expect(screen.queryByText(/secret-detail/)).toBeNull();
  rpc.mockResolvedValueOnce(preview('valid'));
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(/as Tafara/)).toBeInTheDocument();
});

test('a failed background refresh keeps the invite on screen when the preview is already loaded', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
  renderAt('/invite/tok', { setup: (qc) => qc.setQueryData(['invite-preview', 'tok'], preview('valid').data) });
  await waitFor(() => expect(previews()).toHaveLength(1)); // the stale copy is refetched on mount and fails
  expect(await screen.findByText(/as Tafara/)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('signed in with the right email: links once, welcomes by name, forgets the preview and goes home', async () => {
  signedIn();
  serve([{ data: { short_name: 'Tafara' }, error: null }]);
  let remove!: ReturnType<typeof vi.spyOn>;
  const qc = renderAt('/invite/tok', { strict: true, setup: (c) => (remove = vi.spyOn(c, 'removeQueries')) });
  expect(await screen.findByText('Home')).toBeInTheDocument();
  expect(await screen.findByText('Welcome, Tafara')).toBeInTheDocument();
  expect(rpc).toHaveBeenCalledWith('accept_invite', { p_token: 'tok' });
  expect(accepts()).toHaveLength(1);
  expect(remove).toHaveBeenCalledWith({ queryKey: ['invite-preview', 'tok'] });
  expect(previews()).toHaveLength(1); // not asked again, which would now answer "used"
  await waitFor(() => expect(qc.getQueryCache().find({ queryKey: ['invite-preview', 'tok'] })).toBeUndefined());
});

test('a cached membership is dropped before going home, so the guard loads fresh instead of showing a cached "no group"', async () => {
  signedIn();
  serve([{ data: { short_name: 'Tafara' }, error: null }]);
  let remove!: ReturnType<typeof vi.spyOn>;
  // As hydrated from IndexedDB on a fresh page load: a cached null with no query function and nothing mounted to observe it.
  const qc = renderAt('/invite/tok', {
    setup: (c) => {
      remove = vi.spyOn(c, 'removeQueries');
      c.setQueryData(['membership', 'u1'], null);
    },
  });
  expect(await screen.findByText('Home')).toBeInTheDocument();
  expect(remove).toHaveBeenCalledWith({ queryKey: ['membership'] });
  expect(seen[0]).toBe('loading'); // not the cached null
  expect(seen).not.toContain('no group');
  expect(fetchMembership).toHaveBeenCalledTimes(1);
  expect(qc.getQueryData(['membership', 'u1'])).toEqual({ group: 'Premium' });
});

test('going home does not wait on the membership request', async () => {
  signedIn();
  serve([{ data: { short_name: 'Tafara' }, error: null }]);
  fetchMembership.mockReturnValue(NEVER); // a stalled request must not leave "Linking your account…" up
  renderAt('/invite/tok', { setup: (c) => c.setQueryData(['membership', 'u1'], null) });
  expect(await screen.findByText('loading')).toBeInTheDocument();
  expect(await screen.findByText('Welcome, Tafara')).toBeInTheDocument();
  expect(screen.queryByText('Linking your account…')).toBeNull();
});

test('accept_invite is called once even when StrictMode runs the effect twice on a page that already has the preview', async () => {
  signedIn();
  rpc.mockReturnValue(NEVER); // accept never settles; the background preview refetch hangs too
  renderAt('/invite/tok', { strict: true, setup: (qc) => qc.setQueryData(['invite-preview', 'tok'], preview('valid').data) });
  expect(await screen.findByText('Linking your account…')).toBeInTheDocument();
  expect(accepts()).toHaveLength(1);
});

test('accept_invite is called exactly once however often the page re-renders with a fresh session', async () => {
  signedIn();
  serve([NEVER]);
  renderAt('/invite/tok', { strict: true });
  expect(await screen.findByText('Linking your account…')).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 50));
  expect(accepts()).toHaveLength(1);
});

test('signed in with another account: nothing is linked; explains and offers sign out back to the invite, not a retry', async () => {
  signedIn('u2', 'treasurer@gmail.com');
  serve([{ data: null, error: { message: 'email_mismatch', code: 'P0001' } }]);
  renderAt('/invite/tok');
  expect(await screen.findByText(/sent to a different email address/)).toBeInTheDocument();
  expect(screen.getByText(/treasurer@gmail\.com/)).toBeInTheDocument();
  expect(screen.queryByText('Home')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: SIGN_OUT }));
  expect(signOut).toHaveBeenCalled();
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/invite/tok'));
  expect(replace).not.toHaveBeenCalledWith('/sign-in');
});

test('any other failure to link says why and offers Try again, which re-attempts exactly once; sign-out is not offered', async () => {
  signedIn();
  serve([{ data: null, error: { message: 'Failed to fetch secret-detail' } }, { data: { short_name: 'Tafara' }, error: null }]);
  renderAt('/invite/tok');
  expect(await screen.findByText(/You seem to be offline/)).toBeInTheDocument();
  expect(screen.queryByText(/secret-detail/)).toBeNull();
  expect(screen.queryByRole('button', { name: SIGN_OUT })).toBeNull();
  expect(accepts()).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Home')).toBeInTheDocument();
  expect(accepts()).toHaveLength(2);
});
