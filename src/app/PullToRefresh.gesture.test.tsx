import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PullToRefresh } from './PullToRefresh';

const touch = (clientY: number) => ({ touches: [{ clientY }] });
const setup = (onRefresh: () => Promise<unknown>) => {
  const { container } = render(<PullToRefresh onRefresh={onRefresh}><p>List</p></PullToRefresh>);
  return {
    root: screen.getByText('List').parentElement as HTMLElement,
    indicator: container.querySelector('[aria-hidden]') as HTMLElement,
    spinning: () => container.querySelector('.animate-spin') !== null,
  };
};

afterEach(() => vi.restoreAllMocks());

test('a deliberate pull and release refreshes once', async () => {
  const onRefresh = vi.fn().mockResolvedValue(undefined);
  const { root } = setup(onRefresh);
  fireEvent.touchStart(root, touch(0));
  fireEvent.touchMove(root, touch(200));
  fireEvent.touchEnd(root);
  await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
});

test('a cancelled touch (system gesture, call) resets the indicator and never refreshes', () => {
  const onRefresh = vi.fn().mockResolvedValue(undefined);
  const { root, indicator } = setup(onRefresh);
  fireEvent.touchStart(root, touch(0));
  fireEvent.touchMove(root, touch(200));
  expect(indicator.style.height).toBe('96px');
  fireEvent.touchCancel(root);
  expect(indicator.style.height).toBe('0px');
  fireEvent.touchMove(root, touch(300)); // no touchstart since the cancel: must not resume pulling
  expect(indicator.style.height).toBe('0px');
  expect(onRefresh).not.toHaveBeenCalled();
});

test('the indicator follows the finger without animating, and animates only on release', () => {
  const { root, indicator } = setup(vi.fn().mockResolvedValue(undefined));
  expect(indicator.className).toContain('transition-[height]');
  fireEvent.touchStart(root, touch(0));
  fireEvent.touchMove(root, touch(60));
  expect(indicator.className).not.toContain('transition-[height]');
  fireEvent.touchEnd(root);
  expect(indicator.className).toContain('transition-[height]');
});

test('a rejecting refresh is not an unhandled rejection and the indicator still resets', async () => {
  const unhandled = vi.fn();
  process.on('unhandledRejection', unhandled);
  try {
    let fail!: (e: Error) => void;
    const onRefresh = vi.fn(() => new Promise<never>((_, reject) => (fail = reject)));
    const { root, indicator, spinning } = setup(onRefresh);
    fireEvent.touchStart(root, touch(0));
    fireEvent.touchMove(root, touch(200));
    fireEvent.touchEnd(root);
    await waitFor(() => expect(spinning()).toBe(true));
    fail(new Error('offline'));
    await waitFor(() => expect(spinning()).toBe(false));
    expect(indicator.style.height).toBe('0px');
    await new Promise((r) => setTimeout(r, 20));
    expect(unhandled).not.toHaveBeenCalled();
  } finally {
    process.off('unhandledRejection', unhandled);
  }
});
