import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useConfirmTap } from './useConfirmTap';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('first tap arms, second tap confirms', () => {
  const onConfirm = vi.fn();
  const { result } = renderHook(() => useConfirmTap(onConfirm));
  act(() => result.current.tap());
  expect(result.current.armed).toBe(true);
  expect(onConfirm).not.toHaveBeenCalled();
  act(() => result.current.tap());
  expect(onConfirm).toHaveBeenCalledOnce();
  expect(result.current.armed).toBe(false);
});

test('disarms after the timeout', () => {
  const onConfirm = vi.fn();
  const { result } = renderHook(() => useConfirmTap(onConfirm, 4000));
  act(() => result.current.tap());
  act(() => vi.advanceTimersByTime(4001));
  expect(result.current.armed).toBe(false);
  act(() => result.current.tap());
  expect(onConfirm).not.toHaveBeenCalled();
});
