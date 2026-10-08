import { expect, test } from 'vitest';
import { scan } from './check-tokens.mjs';

const rules = (text) => scan(text).map((h) => h.rule);
const matches = (text) => scan(text).map((h) => h.match);

test('flags raw palette colours', () => {
  // Both violations on one line are reported (was toHaveLength(1) when only the first match counted).
  expect(scan('<div className="bg-zinc-900 text-slate-500">')).toHaveLength(2);
  expect(matches('<div className="bg-zinc-900 text-slate-500">')).toEqual(['bg-zinc-900', 'text-slate-500']);
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
  expect(scan('bg-danger/15 border-danger/40 bg-scrim bg-canvas text-muted ring-accent border-t-line shadow-lg dark:shadow-none')).toEqual([]);
  expect(scan('text-[12px] text-[0.75rem] text-[1rem] text-[14px] w-[440px] max-h-[92dvh] pb-[env(safe-area-inset-bottom)] bg-[var(--surface)]')).toEqual([]);
});

test('flags Tailwind v4 gradients and gradient() strings', () => {
  for (const cls of ['bg-linear-to-r', 'bg-linear-45', 'bg-radial', 'bg-radial-[at_50%_50%]', 'bg-conic', 'bg-conic-180']) {
    expect(rules(`className="${cls}"`)).toEqual(['gradient']);
  }
  for (const fn of ['linear-gradient(', 'radial-gradient(', 'conic-gradient(', 'repeating-linear-gradient(']) {
    expect(rules(`style={{ background: '${fn}red, blue)' }}`)).toEqual(['gradient']);
  }
});

test('flags small arbitrary text in px and rem, including fractions', () => {
  for (const cls of ['text-[10px]', 'text-[11px]', 'text-[9px]', 'text-[10.5px]', 'text-[11.9px]', 'text-[0.7rem]', 'text-[.5rem]', 'text-[0.74rem]']) {
    expect(rules(cls)).toEqual(['text under 12px']);
  }
  expect(matches('md:text-[10.5px]')).toEqual(['text-[10.5px]']);
});

test('flags dark: anywhere in a variant chain before a colour utility', () => {
  for (const cls of ['dark:hover:bg-surface', 'hover:dark:text-fg', 'dark:fill-fg', 'md:dark:border-line', 'dark:[&>svg]:stroke-fg', 'dark:data-[state=open]:ring-accent']) {
    expect(rules(`className="${cls}"`)).toEqual(['dark: colour variant']);
  }
});

test('flags arbitrary colour values', () => {
  for (const cls of ['bg-[#fff]', 'text-[#123]', 'border-[#ffcc00]', 'border-t-[#fff]', 'fill-[rgb(1,2,3)]', 'ring-[hsl(0_0%_0%)]', 'bg-[oklch(0.5_0.2_30)]', 'shadow-[0_1px_2px_rgba(0,0,0,.2)]']) {
    expect(rules(`className="${cls}"`)).toEqual(['arbitrary colour value']);
  }
});

test('flags palette colours behind every colour prefix', () => {
  const classes = [
    'border-t-red-500', 'border-x-white', 'border-s-black', 'ring-offset-white', 'accent-pink-500', 'caret-blue-500',
    'outline-black', 'decoration-red-500', 'divide-gray-200', 'placeholder-gray-400', 'fill-white', 'stroke-black',
    'shadow-black/20', 'shadow-slate-900/10', 'from-red-500', 'via-white', 'to-sky-400', 'inset-ring-white',
  ];
  for (const cls of classes) {
    expect(rules(`className="${cls}"`)).toEqual(['raw palette colour']);
    expect(matches(`className="${cls}"`)).toEqual([cls]);
  }
});

test('reports every violation on a line, and the right line number', () => {
  const hits = scan('ok\n<div className="bg-white dark:hover:bg-surface text-[10px] bg-linear-to-r">');
  expect(hits.map((h) => h.line)).toEqual([2, 2, 2, 2]);
  expect(hits.map((h) => h.rule).sort()).toEqual(['dark: colour variant', 'gradient', 'raw palette colour', 'text under 12px']);
});
