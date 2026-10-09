import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { beforeEach, expect, test, vi } from 'vitest';

type Listener = (event: string, session: Session | null) => void;
let listener: Listener = () => {};
let initial: Session | null = null;
const wipe = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: initial } }),
      onAuthStateChange: (cb: Listener) => {
        listener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  },
}));
vi.mock('@/lib/queryClient', () => ({ wipeLocalData: (...a: unknown[]) => wipe(...a) }));

const { SessionProvider, useSession } = await import('./SessionProvider');

const as = (id: string, token = 't1') => ({ access_token: token, user: { id, email: `${id}@x.test` } }) as unknown as Session;

function Who() {
  const { session, loading } = useSession();
  return <p>{loading ? 'loading' : (session?.user.id ?? 'nobody')}</p>;
}
const renderProvider = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SessionProvider>
        <Who />
      </SessionProvider>
    </QueryClientProvider>,
  );
const emit = (event: string, session: Session | null) => act(async () => listener(event, session));

beforeEach(() => {
  wipe.mockReset().mockResolvedValue(undefined);
  initial = null;
});

test('a different member signing in over an open session wipes local data before the new member renders', async () => {
  initial = as('u1');
  renderProvider();
  expect(await screen.findByText('u1')).toBeInTheDocument();

  let release!: () => void;
  wipe.mockReturnValue(new Promise<void>((r) => (release = r)));
  await emit('SIGNED_IN', as('u2'));
  expect(wipe).toHaveBeenCalledTimes(1);
  expect(screen.getByText('u1')).toBeInTheDocument(); // the new member is not shown while the old cache is still there
  await act(async () => release());
  expect(screen.getByText('u2')).toBeInTheDocument();
});

test('a refresh of the same session, a first sign-in and the initial event wipe nothing', async () => {
  renderProvider();
  expect(await screen.findByText('nobody')).toBeInTheDocument();
  await emit('INITIAL_SESSION', null);
  await emit('SIGNED_IN', as('u1'));
  expect(screen.getByText('u1')).toBeInTheDocument();
  await emit('TOKEN_REFRESHED', as('u1', 't2'));
  await emit('USER_UPDATED', as('u1', 't3'));
  expect(screen.getByText('u1')).toBeInTheDocument();
  expect(wipe).not.toHaveBeenCalled();
});

test('signing out still wipes, once', async () => {
  initial = as('u1');
  renderProvider();
  expect(await screen.findByText('u1')).toBeInTheDocument();
  await emit('SIGNED_OUT', null);
  expect(screen.getByText('nobody')).toBeInTheDocument();
  expect(wipe).toHaveBeenCalledTimes(1);
});

test('a failed wipe still lets the new member in, with the newest session if one arrived meanwhile', async () => {
  initial = as('u1');
  renderProvider();
  expect(await screen.findByText('u1')).toBeInTheDocument();
  let fail!: () => void;
  wipe.mockReturnValue(new Promise<void>((_, reject) => (fail = () => reject(new Error('idb blocked')))));
  await emit('SIGNED_IN', as('u2'));
  await emit('TOKEN_REFRESHED', as('u2', 't2'));
  await act(async () => fail());
  expect(screen.getByText('u2')).toBeInTheDocument();
  expect(wipe).toHaveBeenCalledTimes(1);
});

test('a sign-out that lands during the wipe is not undone by it', async () => {
  initial = as('u1');
  renderProvider();
  expect(await screen.findByText('u1')).toBeInTheDocument();
  let release!: () => void;
  wipe.mockReturnValueOnce(new Promise<void>((r) => (release = r))).mockResolvedValue(undefined);
  await emit('SIGNED_IN', as('u2'));
  await emit('SIGNED_OUT', null);
  await act(async () => release());
  expect(screen.getByText('nobody')).toBeInTheDocument();
});
