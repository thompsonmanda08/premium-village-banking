import { expect, test } from 'vitest';
import { safeFileName, xlsxName } from './fileName';

test('characters a file system rejects become spaces, and spaces collapse', () => {
  expect(safeFileName('Premium VB: Mar/Apr "2026"?')).toBe('Premium VB Mar Apr 2026');
  expect(safeFileName('  a\\b|c<d>e*f  ')).toBe('a b c d e f');
});

test('control characters are dropped too', () => {
  expect(safeFileName('a\u0000b\nc')).toBe('a b c');
});

test('xlsxName joins the parts, skips blanks and adds the extension', () => {
  expect(xlsxName('Premium VB', 'Mar 2026', '')).toBe('Premium VB Mar 2026.xlsx');
  expect(xlsxName('Premium VB', 'Oct 2026', '(preview)')).toBe('Premium VB Oct 2026 (preview).xlsx');
});

test('a name with nothing usable still gets a name', () => {
  expect(xlsxName('///')).toBe('Export.xlsx');
});

test('a very long name is cut', () => {
  expect(xlsxName('x'.repeat(300)).length).toBeLessThanOrEqual(125);
});
