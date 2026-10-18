import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

const calls = vi.hoisted(() => ({ table: '', eq: [] as Array<[string, unknown]>, in: [] as Array<[string, unknown[]]>, range: [] as number[][], select: [] as string[], result: vi.fn() }));
vi.mock('@/lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  chain.select = (cols: string) => { calls.select.push(cols); return chain; };
  chain.order = () => chain;
  chain.eq = (col: string, val: unknown) => { calls.eq.push([col, val]); return chain; };
  chain.in = (col: string, vals: unknown[]) => { calls.in.push([col, vals]); return chain; };
  chain.range = (a: number, b: number) => { calls.range.push([a, b]); return chain; };
  chain.maybeSingle = () => chain;
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(calls.result()).then(res, rej);
  return { supabase: { from: (t: string) => { calls.table = t; return chain; } } };
});
const { useCycleRules, useCycleStatements, useGroupStatements, useRefreshLedger } = await import('./queries');

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrap = (client = makeClient()) => ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  calls.table = '';
  calls.eq.length = 0; calls.in.length = 0; calls.range.length = 0; calls.select.length = 0;
  calls.result.mockReset();
});

test('the group’s statements are asked for by the cycle’s months', async () => {
  calls.result.mockReturnValue({ data: [{ id: 'gs1' }], error: null });
  const { result } = renderHook(() => useGroupStatements(['p1', 'p2']), { wrapper: wrap() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.table).toBe('group_statements');
  expect(calls.in).toEqual([['period_id', ['p1', 'p2']]]);
  expect(result.current.data).toEqual([{ id: 'gs1' }]);
});

test('nothing is asked without months', () => {
  renderHook(() => useGroupStatements([]), { wrapper: wrap() });
  renderHook(() => useCycleStatements([], true), { wrapper: wrap() });
  expect(calls.table).toBe('');
});

test('every member’s statements are read page by page, and only when allowed', async () => {
  calls.result.mockReturnValueOnce({ data: [{ id: 's1' }, { id: 's2' }], error: null }).mockReturnValue({ data: [], error: null });
  const { result } = renderHook(() => useCycleStatements(['p1'], true), { wrapper: wrap() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.table).toBe('statements');
  expect(calls.in).toEqual([['period_id', ['p1']], ['period_id', ['p1']]]);
  expect(calls.range).toEqual([[0, 999], [2, 1001]]);
  expect(result.current.data).toEqual([{ id: 's1' }, { id: 's2' }]);

  calls.table = '';
  renderHook(() => useCycleStatements(['p1', 'p2'], false), { wrapper: wrap() });
  expect(calls.table).toBe('');
});

test('the cycle’s rules are asked for by cycle, and not without one', async () => {
  calls.result.mockReturnValue({ data: { min_saving: 250 }, error: null });
  const { result } = renderHook(() => useCycleRules('c1'), { wrapper: wrap() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.table).toBe('cycle_rules');
  expect(calls.eq).toEqual([['cycle_id', 'c1']]);
  expect(calls.select[0]).toContain('min_saving');
  calls.table = '';
  renderHook(() => useCycleRules(undefined), { wrapper: wrap() });
  expect(calls.table).toBe('');
});

test('a failed read is an error, not an empty list', async () => {
  calls.result.mockReturnValue({ data: null, error: { message: 'x', code: 'PGRST301' } });
  const { result } = renderHook(() => useGroupStatements(['p1']), { wrapper: wrap() });
  await waitFor(() => expect(result.current.isError).toBe(true));
});

test('closing or changing a month refreshes the group figures too', async () => {
  const client = makeClient();
  const spy = vi.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(() => useRefreshLedger('g1'), { wrapper: wrap(client) });
  await result.current();
  const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey[0]);
  expect(keys).toContain('group-statements');
  expect(keys).toContain('cycle-statements');
});
