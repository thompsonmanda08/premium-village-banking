import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

const calls = vi.hoisted(() => ({ rpc: [] as unknown[][], rpcResult: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => {
      calls.rpc.push(args);
      return Promise.resolve(calls.rpcResult());
    },
  },
}));
const { useClosePreview, useRefreshLedger } = await import('./queries');

const makeWrapper = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

beforeEach(() => {
  calls.rpc.length = 0;
  calls.rpcResult.mockReset();
});

test('the preview is asked with p_commit false, never committing', async () => {
  calls.rpcResult.mockReturnValue({ data: { label: 'Oct 2026', members: [], diff: [], unexplained: 0 }, error: null });
  const { result } = renderHook(() => useClosePreview('p9'), { wrapper: makeWrapper(new QueryClient()) });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.rpc).toEqual([['close_month', { p_period: 'p9', p_commit: false }]]);
});

test('nothing is asked without a period', () => {
  const { result } = renderHook(() => useClosePreview(undefined), { wrapper: makeWrapper(new QueryClient()) });
  expect(result.current.fetchStatus).toBe('idle');
});

test('a refusal (declarations still waiting) is an error at once, not retried', async () => {
  calls.rpcResult.mockReturnValue({ data: null, error: { message: 'declarations_pending', code: 'P0001' } });
  const { result } = renderHook(() => useClosePreview('p9'), { wrapper: makeWrapper(new QueryClient()) });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(calls.rpc).toHaveLength(1);
});

test('a close rewrites what members see, so every ledger action refreshes those too', async () => {
  const client = new QueryClient();
  const spy = vi.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(() => useRefreshLedger('g1'), { wrapper: makeWrapper(client) });
  await result.current();
  const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey[0]);
  for (const k of ['close-preview', 'statements', 'entries', 'loans', 'payout-preview', 'minimum-payable', 'declarations', 'ledger-cycle']) {
    expect(keys, k).toContain(k);
  }
});
