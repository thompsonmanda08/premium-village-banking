import { expect, test, vi } from 'vitest';
import { chunk, fetchAllRows } from './paging';

const source = (total: number, cap = 1000) => {
  const all = Array.from({ length: total }, (_, i) => i);
  const calls: Array<[number, number]> = [];
  const page = vi.fn(async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: all.slice(from, Math.min(to + 1, from + cap)), error: null };
  });
  return { all, calls, page };
};

test('reads page after page until one comes back empty, so 2,500 rows are all returned', async () => {
  const s = source(2500);
  expect(await fetchAllRows(s.page)).toEqual(s.all);
  expect(s.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999], [2500, 3499]]);
});

test('a server that returns fewer rows than asked for (a row cap) loses nothing', async () => {
  const s = source(1200, 500);
  expect(await fetchAllRows(s.page)).toEqual(s.all);
});

test('an empty source is one request', async () => {
  const s = source(0);
  expect(await fetchAllRows(s.page)).toEqual([]);
  expect(s.calls).toEqual([[0, 999]]);
});

test('an error is thrown, not swallowed', async () => {
  await expect(fetchAllRows(async () => ({ data: null, error: new Error('boom') }))).rejects.toThrow('boom');
});

test('chunk splits a list into pieces of at most the size', () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(chunk([], 3)).toEqual([]);
});
