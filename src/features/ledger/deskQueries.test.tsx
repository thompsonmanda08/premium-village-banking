import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

const calls = vi.hoisted(() => ({
  eq: [] as Array<[string, unknown]>,
  or: [] as string[],
  rpc: [] as unknown[][],
  result: vi.fn(),
  rpcResult: vi.fn(),
}));
vi.mock('@/lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit', 'in']) chain[m] = () => chain;
  chain.eq = (col: string, val: unknown) => {
    calls.eq.push([col, val]);
    return chain;
  };
  chain.or = (filter: string) => {
    calls.or.push(filter);
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
const { useLoanCheck, useMonthLoans, useMonthPenalties, useSuggestedPenalties } = await import('./queries');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  calls.eq.length = 0;
  calls.or.length = 0;
  calls.rpc.length = 0;
  calls.result.mockReset();
  calls.rpcResult.mockReset();
});

test('loan_check is asked with the member alone, or with the amount too', async () => {
  calls.rpcResult.mockReturnValue({ data: { lending_cash: 100 }, error: null });
  const a = renderHook(() => useLoanCheck('m1', null), { wrapper });
  await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
  const b = renderHook(() => useLoanCheck('m1', 500), { wrapper });
  await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
  expect(calls.rpc).toEqual([['loan_check', { p_member: 'm1' }], ['loan_check', { p_member: 'm1', p_principal: 500 }]]);
});

test('nothing is asked without a member', () => {
  const { result } = renderHook(() => useLoanCheck(undefined, 500), { wrapper });
  expect(result.current.fetchStatus).toBe('idle');
});

test('a refusal from loan_check surfaces as the query error', async () => {
  calls.rpcResult.mockReturnValue({ data: null, error: { message: 'period_not_open', code: 'P0001' } });
  const { result } = renderHook(() => useLoanCheck('m1', null), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
});

test('the month’s loans and penalty entries are asked for by the open month', async () => {
  calls.result.mockReturnValue({ data: [], error: null });
  const loans = renderHook(() => useMonthLoans('g1', 'p9'), { wrapper });
  await waitFor(() => expect(loans.result.current.isSuccess).toBe(true));
  const pens = renderHook(() => useMonthPenalties('g1', 'p9'), { wrapper });
  await waitFor(() => expect(pens.result.current.isSuccess).toBe(true));
  expect(calls.eq).toEqual([['period_id', 'p9'], ['period_id', 'p9']]);
});

test('penalty entries include the corrections of them: a waiver or a reduction is not stored as kind penalty', async () => {
  calls.result.mockReturnValue({ data: [], error: null });
  const { result } = renderHook(() => useMonthPenalties('g1', 'p9'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.or).toEqual(['kind.eq.penalty,source.eq.correction']);
});

test('another member’s answer is never shown while a member’s own is loading; the same member keeps the last answer while a new amount loads', async () => {
  calls.rpcResult.mockReturnValueOnce({ data: { lending_cash: 111 }, error: null });
  const { result, rerender } = renderHook(({ m, p }) => useLoanCheck(m, p), { wrapper, initialProps: { m: 'm1', p: null as number | null } });
  await waitFor(() => expect(result.current.data?.lending_cash).toBe(111));
  calls.rpcResult.mockReturnValueOnce(new Promise(() => {}));
  rerender({ m: 'm1', p: 500 });
  await waitFor(() => expect(result.current.isFetching).toBe(true));
  expect(result.current.data?.lending_cash).toBe(111);
  expect(result.current.isPlaceholderData).toBe(true);
  calls.rpcResult.mockReturnValueOnce(new Promise(() => {}));
  rerender({ m: 'm2', p: 500 });
  await waitFor(() => expect(result.current.isFetching).toBe(true));
  expect(result.current.data).toBeUndefined();
});

test('suggested penalties come from the engine for the open month, and are idle without one', async () => {
  const idle = renderHook(() => useSuggestedPenalties('g1', undefined), { wrapper });
  expect(idle.result.current.fetchStatus).toBe('idle');
  calls.rpcResult.mockReturnValue({ data: [{ member_id: 'm1', short_name: 'Eve', ground: 'late_declaration', amount: 100, detail: 'x' }], error: null });
  const { result } = renderHook(() => useSuggestedPenalties('g1', 'p9'), { wrapper });
  await waitFor(() => expect(result.current.data).toHaveLength(1));
  expect(calls.rpc[0]).toEqual(['suggest_penalties', { p_period: 'p9' }]);
});
