import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { expect, test, vi } from 'vitest';
import { ToastProvider } from '@/ui';

vi.mock('@/lib/supabase', () => ({ supabase: { auth: {} } }));
const { RouteError } = await import('./RouteError');
const { router } = await import('./router');
const { AppShell } = await import('./AppShell');

function Boom(): never {
  throw new Error('kaboom internal detail');
}

test('a render error shows a friendly screen, never the raw message or the router default', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const memory = createMemoryRouter([{ path: '/', element: <Boom />, errorElement: <RouteError /> }]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <RouterProvider router={memory} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  expect(screen.queryByText(/kaboom/)).toBeNull();
  expect(screen.queryByText(/Unexpected Application Error/)).toBeNull();
  vi.restoreAllMocks();
});

test('the real router has an errorElement at the root and on the shell route', () => {
  const walk = (routes: RouteObject[]): RouteObject[] => routes.flatMap((r) => [r, ...walk(r.children ?? [])]);
  const all = walk(router.routes as RouteObject[]);
  expect(router.routes.every((r) => r.errorElement)).toBe(true);
  const shell = all.find((r) => (r.element as { type?: unknown } | undefined)?.type === AppShell);
  expect(shell?.errorElement).toBeTruthy();
});
