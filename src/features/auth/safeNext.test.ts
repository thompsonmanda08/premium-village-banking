import { expect, test } from 'vitest';
import { safeNext } from './safeNext';

test('keeps in-app paths', () => {
  expect(safeNext('/passbook')).toBe('/passbook');
  expect(safeNext('/group?settings=open')).toBe('/group?settings=open');
  expect(safeNext('/group?x=1#y')).toBe('/group?x=1#y');
  expect(safeNext('/invite/abc')).toBe('/invite/abc');
});

test('refuses anything that could leave the app', () => {
  const bad = [
    '//evil.example',
    ' //evil.example',
    '//evil.example ',
    '\t//evil.example',
    'https://evil.example',
    '/\\evil.example',
    '\\/evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    'javascript:alert(1)',
    '%2F%2Fevil.example',
    'evil',
    '',
    null,
    undefined,
  ];
  for (const raw of bad) expect(safeNext(raw), String(raw)).toBe('/');
});

test('avoids sign-in loops', () => {
  expect(safeNext('/sign-in?next=/x')).toBe('/');
  expect(safeNext('/auth/callback')).toBe('/');
});
