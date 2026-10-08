import { expect, test } from 'vitest';
import { expectRows } from './mutate';

test('returns rows when the write matched', () => {
  expect(expectRows({ data: [{ id: 'a' }], error: null })).toEqual([{ id: 'a' }]);
});

test('throws when RLS silently matched nothing', () => {
  expect(() => expectRows({ data: [], error: null })).toThrow('not_admin');
  expect(() => expectRows({ data: [], error: null }, 'rules_locked')).toThrow('rules_locked');
  expect(() => expectRows({ data: null, error: null })).toThrow('not_admin');
});

test('rethrows the original error', () => {
  const err = { code: '42501', message: 'denied' };
  expect(() => expectRows({ data: null, error: err })).toThrow();
  try {
    expectRows({ data: null, error: err });
  } catch (e) {
    expect(e).toBe(err);
  }
});
