import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/ui';

const signOutEverywhere = vi.fn();
vi.mock('@/features/auth/signOut', () => ({ signOutEverywhere: (...a: unknown[]) => signOutEverywhere(...a) }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {} } }));
const { ErrorScreen } = await import('./ErrorScreen');

const replace = vi.fn();
const renderIt = (onRetry = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <ErrorScreen message="You seem to be offline." onRetry={onRetry} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onRetry;
};

beforeEach(() => {
  signOutEverywhere.mockReset().mockResolvedValue(undefined);
  replace.mockReset();
  vi.stubGlobal('location', { ...window.location, replace });
});
afterEach(() => vi.unstubAllGlobals());

test('shows the message and retries', async () => {
  const onRetry = renderIt();
  expect(screen.getByRole('alert')).toHaveTextContent('You seem to be offline.');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalledOnce();
});

test('offers Sign out as the way out of a stuck session', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(signOutEverywhere).toHaveBeenCalledOnce();
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'));
});
