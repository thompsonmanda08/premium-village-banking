import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

const calls = vi.hoisted(() => ({ eq: [] as Array<[string, unknown]>, result: vi.fn() }));
vi.mock('@/lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'order']) chain[m] = () => chain;
  chain.eq = (col: string, val: unknown) => {
    calls.eq.push([col, val]);
    return chain;
  };
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(calls.result()).then(res, rej);
  return { supabase: { from: () => chain } };
});
const { useMemberStatuses } = await import('./queries');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  calls.eq.length = 0;
  calls.result.mockReset();
});

test('the cycle’s default flags are asked for by cycle', async () => {
  calls.result.mockReturnValue({ data: [], error: null });
  const { result } = renderHook(() => useMemberStatuses('g1', 'c1'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.eq).toEqual([['cycle_id', 'c1']]);
});

test('nothing is asked without a cycle', () => {
  const { result } = renderHook(() => useMemberStatuses('g1', undefined), { wrapper });
  expect(result.current.fetchStatus).toBe('idle');
});
