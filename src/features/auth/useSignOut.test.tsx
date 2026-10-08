import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ThemeProvider } from '@/app/ThemeProvider';
import { ToastProvider } from '@/ui';

const signOutEverywhere = vi.fn();
vi.mock('./signOut', () => ({ signOutEverywhere: (...a: unknown[]) => signOutEverywhere(...a) }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {} } }));
const { NoGroupScreen } = await import('@/features/group/NoGroupScreen');
const { MoreSheet } = await import('@/app/MoreSheet');

const replace = vi.fn();
const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

// Braces matter: vitest runs a function returned from beforeEach as teardown, and mockReset() returns the mock.
beforeEach(() => {
  signOutEverywhere.mockReset();
  replace.mockReset();
  vi.stubGlobal('location', { ...window.location, replace });
});
afterEach(() => vi.unstubAllGlobals());

test('signs out, then leaves with a full reload so no in-memory session or timer survives; button is disabled meanwhile', async () => {
  let finish!: () => void;
  signOutEverywhere.mockReturnValue(new Promise<void>((r) => (finish = r)));
  render(wrap(<NoGroupScreen email="a@b.co" />));
  const button = screen.getByRole('button', { name: 'Sign out' });
  await userEvent.click(button);
  expect(signOutEverywhere).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  await userEvent.click(button);
  expect(signOutEverywhere).toHaveBeenCalledTimes(1);
  expect(replace).not.toHaveBeenCalled();
  finish();
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'));
});

test('when the local wipe fails it says so and does not navigate, so the person can retry', async () => {
  signOutEverywhere.mockRejectedValue(new Error('IDBDatabase blew up: secret-detail'));
  render(wrap(<NoGroupScreen />));
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  expect(screen.queryByText(/secret-detail/)).toBeNull();
  expect(replace).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
});

test('the More sheet signs out the same way', async () => {
  signOutEverywhere.mockResolvedValue(undefined);
  render(wrap(<MoreSheet open onClose={() => {}} isAdmin={false} />));
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'));
});

test('leaves for the destination it was given, e.g. back to an invite link signed out', async () => {
  signOutEverywhere.mockResolvedValue(undefined);
  const { useSignOut } = await import('./useSignOut');
  function Probe() {
    const { signOut } = useSignOut('/invite/tok');
    return <button onClick={() => void signOut()}>Leave</button>;
  }
  render(wrap(<Probe />));
  await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/invite/tok'));
  expect(replace).not.toHaveBeenCalledWith('/sign-in');
});
