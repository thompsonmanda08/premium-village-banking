import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('the value follows only after it has been still for the delay', () => {
  const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'a' } });
  expect(result.current).toBe('a');
  rerender({ v: 'b' });
  act(() => void vi.advanceTimersByTime(299));
  expect(result.current).toBe('a');
  rerender({ v: 'c' });
  act(() => void vi.advanceTimersByTime(299));
  expect(result.current).toBe('a');
  act(() => void vi.advanceTimersByTime(1));
  expect(result.current).toBe('c');
});
