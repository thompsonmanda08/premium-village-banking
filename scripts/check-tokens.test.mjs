import { expect, test } from 'vitest';
import { scan } from './check-tokens.mjs';

test('flags raw palette colours', () => {
  expect(scan('<div className="bg-zinc-900 text-slate-500">')).toHaveLength(1);
  expect(scan('<div className="bg-white">')[0]?.rule).toBe('raw palette colour');
  expect(scan('<p className="text-indigo-600/80">')[0]?.match).toBe('text-indigo-600/80');
});

test('flags tiny text, theme ternaries, dark colour variants and gradients', () => {
  expect(scan('text-[10px]')[0]?.rule).toBe('text under 12px');
  expect(scan('const c = isLight ? a : b')[0]?.rule).toBe('theme ternary');
  expect(scan('dark:bg-surface')[0]?.rule).toBe('dark: colour variant');
  expect(scan('bg-gradient-to-r')[0]?.rule).toBe('gradient');
});

test('allows semantic tokens', () => {
  expect(scan('bg-surface text-fg border-line bg-accent-solid text-on-accent bg-success-soft text-xs')).toEqual([]);
});
