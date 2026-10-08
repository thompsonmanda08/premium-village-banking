import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { HINT_KEY, InstallHint } from './InstallHint';
import { clearInstallPrompt, getInstallPrompt } from './installPrompt';

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36';
const fireInstallPrompt = (prompt = vi.fn().mockResolvedValue(undefined)) => {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
};

beforeEach(() => {
  localStorage.clear();
  clearInstallPrompt();
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IOS_UA);
});
afterEach(() => vi.restoreAllMocks());

const hint = () => screen.queryByText('Add Premium VB to your home screen');

test('dismissing stores the flag and the hint stays gone on the next visit', async () => {
  const first = render(<InstallHint />);
  expect(hint()).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(localStorage.getItem(HINT_KEY)).toBe('1');
  expect(hint()).toBeNull();
  first.unmount();
  render(<InstallHint />);
  expect(hint()).toBeNull();
});

test('stays hidden when storage cannot be read', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  render(<InstallHint />);
  expect(hint()).toBeNull();
});

test('dismissing still hides the hint for this visit when storage cannot be written', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  render(<InstallHint />);
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(hint()).toBeNull();
});

test('Install runs the browser prompt, then remembers the dismissal and drops the used event', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID_UA);
  render(<InstallHint />);
  expect(hint()).toBeNull();
  const { prompt } = fireInstallPrompt();
  await userEvent.click(screen.getByRole('button', { name: 'Install' }));
  expect(prompt).toHaveBeenCalledOnce();
  expect(localStorage.getItem(HINT_KEY)).toBe('1');
  expect(hint()).toBeNull();
  expect(getInstallPrompt()).toBeNull();
});

test('an install prompt that fired before the hint mounted is still used', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID_UA);
  const { event } = fireInstallPrompt();
  expect(event.defaultPrevented).toBe(true);
  render(<InstallHint />);
  expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
});

test('the app being installed clears the stored prompt and hides the hint', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID_UA);
  fireInstallPrompt();
  render(<InstallHint />);
  expect(hint()).toBeInTheDocument();
  act(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });
  expect(getInstallPrompt()).toBeNull();
  expect(hint()).toBeNull();
});

test('a rejected install prompt still dismisses the hint without an unhandled rejection', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID_UA);
  const unhandled = vi.fn();
  process.on('unhandledRejection', unhandled);
  try {
    render(<InstallHint />);
    fireInstallPrompt(vi.fn().mockRejectedValue(new DOMException('already used', 'InvalidStateError')));
    await userEvent.click(screen.getByRole('button', { name: 'Install' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(hint()).toBeNull();
    expect(localStorage.getItem(HINT_KEY)).toBe('1');
    expect(unhandled).not.toHaveBeenCalled();
  } finally {
    process.off('unhandledRejection', unhandled);
  }
});

test('shows the iPad instructions when the browser poses as a Mac with a touch screen', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15');
  // jsdom has no maxTouchPoints, so define it for this test only.
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
  try {
    render(<InstallHint />);
    expect(hint()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
  } finally {
    delete (navigator as { maxTouchPoints?: number }).maxTouchPoints;
  }
});

test('hidden when already running as an installed app', () => {
  vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({ matches: q === '(display-mode: standalone)' }) as MediaQueryList);
  render(<InstallHint />);
  expect(hint()).toBeNull();
});
