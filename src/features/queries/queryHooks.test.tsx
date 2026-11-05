import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

const from = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { from } }));
const { useOpenQueries } = await import('./queryHooks');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

test('open questions are not fetched unless enabled', () => {
  const { result } = renderHook(() => useOpenQueries('g1', false), { wrapper });
  expect(result.current.fetchStatus).toBe('idle');
  expect(from).not.toHaveBeenCalled();
});
