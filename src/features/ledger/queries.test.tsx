import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

const calls = vi.hoisted(() => ({ eq: [] as Array<[string, unknown]>, result: vi.fn() }));
vi.mock('@/lib/supabase', () => {
  // A chainable stand-in: every method returns the chain; awaiting it yields calls.result().
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit']) chain[m] = () => chain;
  chain.eq = (col: string, val: unknown) => {
    calls.eq.push([col, val]);
    return chain;
  };
  chain.maybeSingle = () => Promise.resolve(calls.result());
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(calls.result()).then(res, rej);
  return { supabase: { from: () => chain } };
});
const { useDeclarations, useMinimumPayable } = await import('./queries');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  calls.eq.length = 0;
  calls.result.mockReset();
});

test('useDeclarations filters by member when given one, so open-visibility groups never leak other members', async () => {
  calls.result.mockReturnValue({ data: [], error: null });
  const { result } = renderHook(() => useDeclarations('g1', 'p9', 'm1'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.eq).toEqual([['period_id', 'p9'], ['member_id', 'm1']]);
});

test('useDeclarations does not run without a period', () => {
  const { result } = renderHook(() => useDeclarations('g1', undefined), { wrapper });
  expect(result.current.fetchStatus).toBe('idle');
});

test('useMinimumPayable returns the statement figure, or null when the member has none', async () => {
  calls.result.mockReturnValueOnce({ data: { next_minimum: 300 }, error: null });
  const a = renderHook(() => useMinimumPayable('m1', 'p8'), { wrapper });
  await waitFor(() => expect(a.result.current.data).toBe(300));
  calls.result.mockReturnValueOnce({ data: null, error: null });
  const b = renderHook(() => useMinimumPayable('m2', 'p8'), { wrapper });
  await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
  expect(b.result.current.data).toBeNull();
});
