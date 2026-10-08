import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/ui';

const rpc = vi.fn();
const signOut = vi.fn().mockResolvedValue({ error: null });
const replace = vi.fn();
let session: { user: { id: string; email: string } } | null = null;

vi.mock('@/lib/supabase', () => ({
  AUTH_STORAGE_KEY: 'pvb-auth',
  supabase: { rpc: (...a: unknown[]) => rpc(...a), auth: { signOut: (...a: unknown[]) => signOut(...a), signInWithOAuth: vi.fn(), signInWithOtp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn() } },
}));
// A fresh session object on every render, as after a token-refresh event, so a missing guard shows up as a second RPC.
vi.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ session: session && { ...session, user: { ...session.user } }, loading: false }) }));
const { InvitePage } = await import('./InvitePage');

// The data router builds a Request with its own jsdom AbortSignal on every navigation, which Node's Request rejects.
// Dropping the signal only affects this harness; nothing here is fetched through a Request.
const NodeRequest = globalThis.Request;
class TestRequest extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init && { ...init, signal: undefined });
  }
}

function renderAt(path: string, { strict = false, cached = false } = {}) {
  const router = createMemoryRouter(
    [
      { path: '/invite/:token', element: <InvitePage /> },
      { path: '/', element: <p>Home</p> },
    ],
    { initialEntries: [path] },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (cached) qc.setQueryData(['invite-preview', 'tok'], preview('valid').data); // as restored from the persisted cache
  const app = (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
  render(strict ? <StrictMode>{app}</StrictMode> : app);
}

const preview = (status: string) => ({ data: { status, group_name: 'Premium Village Banking', member_name: 'Tafara', email_hint: 't•••@gmail.com' }, error: null });
const accepts = () => rpc.mock.calls.filter(([name]) => name === 'accept_invite');

// Braces matter: vitest runs a function returned from beforeEach as teardown, and mockReset() returns the mock.
beforeEach(() => {
  rpc.mockReset();
  signOut.mockClear();
  replace.mockReset();
  session = null;
  vi.stubGlobal('location', { ...window.location, replace });
  vi.stubGlobal('Request', TestRequest);
});
afterEach(() => vi.unstubAllGlobals());

test('signed out: names the group and member and offers sign-in', async () => {
  rpc.mockResolvedValueOnce(preview('valid'));
  renderAt('/invite/tok');
  expect(await screen.findByText(/as Tafara/)).toBeInTheDocument();
  expect(screen.getByText(/t•••@gmail\.com/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  expect(accepts()).toHaveLength(0);
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
  session = { user: { id: 'u1', email: 'tafara@gmail.com' } };
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

test('signed in with the right email: links once, welcomes by name and goes home', async () => {
  session = { user: { id: 'u1', email: 'tafara@gmail.com' } };
  rpc.mockResolvedValueOnce(preview('valid')).mockResolvedValueOnce({ data: { short_name: 'Tafara' }, error: null });
  renderAt('/invite/tok', { strict: true });
  expect(await screen.findByText('Home')).toBeInTheDocument();
  expect(await screen.findByText('Welcome, Tafara')).toBeInTheDocument();
  expect(rpc).toHaveBeenCalledWith('accept_invite', { p_token: 'tok' });
  expect(accepts()).toHaveLength(1);
});

test('accept_invite is called once even when StrictMode runs the effect twice on a page that already has the preview', async () => {
  session = { user: { id: 'u1', email: 'tafara@gmail.com' } };
  rpc.mockReturnValue(new Promise(() => {})); // accept never settles; the background preview refetch hangs too
  renderAt('/invite/tok', { strict: true, cached: true });
  expect(await screen.findByText('Linking your account…')).toBeInTheDocument();
  expect(accepts()).toHaveLength(1);
});

test('accept_invite is called exactly once however often the page re-renders with a fresh session', async () => {
  session = { user: { id: 'u1', email: 'tafara@gmail.com' } };
  rpc.mockResolvedValueOnce(preview('valid')).mockReturnValue(new Promise(() => {})); // accept never settles
  renderAt('/invite/tok', { strict: true });
  expect(await screen.findByText('Linking your account…')).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 50));
  expect(accepts()).toHaveLength(1);
});

test('signed in with another account: nothing is linked; explains and offers sign out back to the invite', async () => {
  session = { user: { id: 'u2', email: 'treasurer@gmail.com' } };
  rpc.mockResolvedValueOnce(preview('valid')).mockResolvedValueOnce({ data: null, error: { message: 'email_mismatch', code: 'P0001' } });
  renderAt('/invite/tok');
  expect(await screen.findByText(/sent to a different email address/)).toBeInTheDocument();
  expect(screen.getByText(/treasurer@gmail\.com/)).toBeInTheDocument();
  expect(screen.queryByText('Home')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Sign out and use the invited email' }));
  expect(signOut).toHaveBeenCalled();
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/invite/tok'));
  expect(replace).not.toHaveBeenCalledWith('/sign-in');
});
