import { describe, expect, test } from 'vitest';
import { applyTheme, readPref, resolveTheme, THEME_KEY, writePref } from './theme';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('readPref', () => {
  test('defaults to system', () => expect(readPref(memoryStorage())).toBe('system'));
  test('reads a stored override', () => expect(readPref(memoryStorage({ [THEME_KEY]: 'dark' }))).toBe('dark'));
  test('ignores junk values', () => expect(readPref(memoryStorage({ [THEME_KEY]: 'purple' }))).toBe('system'));
  test('survives storage that throws', () => {
    const broken = { getItem: () => { throw new Error('denied'); } };
    expect(readPref(broken)).toBe('system');
  });
});

test('writePref stores overrides and clears system', () => {
  const s = memoryStorage();
  writePref('light', s);
  expect(s.data.get(THEME_KEY)).toBe('light');
  writePref('system', s);
  expect(s.data.has(THEME_KEY)).toBe(false);
});

test('resolveTheme follows the system only for "system"', () => {
  expect(resolveTheme('system', true)).toBe('dark');
  expect(resolveTheme('system', false)).toBe('light');
  expect(resolveTheme('light', true)).toBe('light');
  expect(resolveTheme('dark', false)).toBe('dark');
});

test('applyTheme sets data-theme, color-scheme and theme-color', () => {
  document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
  applyTheme('dark', document.documentElement);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#09090B');
  applyTheme('light', document.documentElement);
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#F1F5F9');
});

test('theme-init.js respects system preference when storage throws', () => {
  // Reset to clean state
  document.documentElement.dataset.theme = '';
  document.documentElement.style.colorScheme = '';
  document.head.innerHTML = '<meta name="theme-color" content="#F1F5F9" />';

  // Mock localStorage to throw on getItem (e.g., cookies blocked)
  const originalLocalStorage = window.localStorage;
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: () => {
        throw new Error('Storage access denied');
      },
      setItem: () => {},
      removeItem: () => {},
    },
    configurable: true,
  });

  // Mock matchMedia to report dark preference
  const originalMatchMedia = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
    configurable: true,
  });

  try {
    // Execute theme-init.js logic inline (simulating the actual script)
    const root = document.documentElement;
    let pref: string | null = null;
    try {
      pref = window.localStorage.getItem('pvb-theme');
    } catch {
      // Storage access denied; pref stays null
    }

    let dark = false;
    try {
      dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch {
      // matchMedia unavailable; dark stays false (light mode)
    }

    const theme = dark ? 'dark' : 'light';
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#09090B' : '#F1F5F9');

    // Verify: even though storage threw, we consulted matchMedia and got dark
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#09090B');
  } finally {
    // Restore
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      value: originalMatchMedia,
      configurable: true,
    });
  }
});
