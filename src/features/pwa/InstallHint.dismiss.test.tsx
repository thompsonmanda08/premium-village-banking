import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { HINT_KEY, InstallHint } from './InstallHint';

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';

beforeEach(() => {
  localStorage.clear();
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

test('Install runs the browser prompt, then remembers the dismissal', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36');
  render(<InstallHint />);
  expect(hint()).toBeNull();
  const prompt = vi.fn().mockResolvedValue(undefined);
  act(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt }));
  });
  await userEvent.click(screen.getByRole('button', { name: 'Install' }));
  expect(prompt).toHaveBeenCalledOnce();
  expect(localStorage.getItem(HINT_KEY)).toBe('1');
  expect(hint()).toBeNull();
});

test('hidden when already running as an installed app', () => {
  vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({ matches: q === '(display-mode: standalone)' }) as MediaQueryList);
  render(<InstallHint />);
  expect(hint()).toBeNull();
});
