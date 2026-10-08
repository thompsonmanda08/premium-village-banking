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
