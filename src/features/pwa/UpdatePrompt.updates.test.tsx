import { render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { registration } from '@/test/pwaRegisterStub';
import { UpdatePrompt } from './UpdatePrompt';

const HOUR = 60 * 60 * 1000;
const setVisibility = (state: DocumentVisibilityState) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// One test on purpose: the watcher is registered once per registration for the life of the module, so a second test would see none.
test('asks for a new build hourly and when the page becomes visible, once per registration even after a remount, and handles being offline', () => {
  // Offline: every check rejects. Each rejection must get a handler instead of surfacing as an unhandled rejection.
  const offline = Promise.reject(new TypeError('Failed to fetch'));
  offline.catch(() => {});
  const handled = vi.spyOn(offline, 'catch');
  const update = vi.spyOn(registration, 'update').mockReturnValue(offline);

  const first = render(<UpdatePrompt />);
  first.unmount();
  render(<UpdatePrompt />);
  expect(update).not.toHaveBeenCalled();

  vi.advanceTimersByTime(HOUR);
  expect(update).toHaveBeenCalledTimes(1);

  setVisibility('hidden');
  expect(update).toHaveBeenCalledTimes(1);
  setVisibility('visible');
  expect(update).toHaveBeenCalledTimes(2);

  expect(handled).toHaveBeenCalledTimes(2);
});
