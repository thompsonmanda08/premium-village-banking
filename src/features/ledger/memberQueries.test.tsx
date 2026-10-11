import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

const calls = vi.hoisted(() => ({
  eq: [] as Array<[string, unknown]>,
  in: [] as Array<[string, unknown]>,
  rpc: [] as unknown[][],
  result: vi.fn(),
  rpcResult: vi.fn(),
}));
vi.mock('@/lib/supabase', () => {
  // A chainable stand-in: every method returns the chain; awaiting it yields calls.result().
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit']) chain[m] = () => chain;
  chain.eq = (col: string, val: unknown) => {
    calls.eq.push([col, val]);
    return chain;
  };
  chain.in = (col: string, val: unknown) => {
    calls.in.push([col, val]);
    return chain;
  };
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(calls.result()).then(res, rej);
  return {
    supabase: {
      from: () => chain,
      rpc: (...args: unknown[]) => {
        calls.rpc.push(args);
        return Promise.resolve(calls.rpcResult());
      },
    },
  };
});
const { useMyEntries, useMyLoans, useMyStatements, usePayoutPreview } = await import('./queries');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  calls.eq.length = 0;
  calls.in.length = 0;
  calls.rpc.length = 0;
  calls.result.mockReset();
  calls.rpcResult.mockReset();
});

test('statements and entries are asked for by the member’s own id only', async () => {
  calls.result.mockReturnValue({ data: [], error: null });
  const s = renderHook(() => useMyStatements('m1'), { wrapper });
  await waitFor(() => expect(s.result.current.isSuccess).toBe(true));
  const e = renderHook(() => useMyEntries('m1'), { wrapper });
  await waitFor(() => expect(e.result.current.isSuccess).toBe(true));
  expect(calls.eq).toEqual([['member_id', 'm1'], ['member_id', 'm1']]);
});

test('nothing is asked without a member', () => {
  const s = renderHook(() => useMyStatements(undefined), { wrapper });
  const e = renderHook(() => useMyEntries(undefined), { wrapper });
  const l = renderHook(() => useMyLoans(undefined), { wrapper });
  const p = renderHook(() => usePayoutPreview('c1', undefined), { wrapper });
  for (const q of [s, e, l, p]) expect(q.result.current.fetchStatus).toBe('idle');
});

test('open loans come with their instalments', async () => {
  calls.result
    .mockReturnValueOnce({ data: [{ id: 'l1' }, { id: 'l2' }], error: null })
    .mockReturnValueOnce({ data: [{ id: 'i1', loan_id: 'l1' }, { id: 'i2', loan_id: 'l1' }, { id: 'i3', loan_id: 'l2' }], error: null });
  const { result } = renderHook(() => useMyLoans('m1'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.eq).toEqual([['member_id', 'm1'], ['status', 'open']]);
  expect(calls.in).toEqual([['loan_id', ['l1', 'l2']]]);
  expect(result.current.data!.map((l) => [l.id, l.instalments.length])).toEqual([['l1', 2], ['l2', 1]]);
});

test('no open loans means no second request', async () => {
  calls.result.mockReturnValueOnce({ data: [], error: null });
  const { result } = renderHook(() => useMyLoans('m1'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual([]);
  expect(calls.result).toHaveBeenCalledTimes(1);
});

test('the payout preview keeps only the member’s own row, or null', async () => {
  const rows = [
    { member_id: 'm2', short_name: 'Ann', savings: 1, interest_earned: 0, owed: 0, pot_share: 0, payout: 1 },
    { member_id: 'm1', short_name: 'Eve', savings: 2000, interest_earned: 40, owed: 300, pot_share: 12, payout: 1752 },
  ];
  calls.rpcResult.mockReturnValueOnce({ data: rows, error: null });
  const a = renderHook(() => usePayoutPreview('c1', 'm1'), { wrapper });
  await waitFor(() => expect(a.result.current.data?.payout).toBe(1752));
  expect(calls.rpc[0]).toEqual(['payout_preview', { p_cycle: 'c1' }]);
  calls.rpcResult.mockReturnValueOnce({ data: [rows[0]], error: null });
  const b = renderHook(() => usePayoutPreview('c1', 'm1'), { wrapper });
  await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
  expect(b.result.current.data).toBeNull();
});
