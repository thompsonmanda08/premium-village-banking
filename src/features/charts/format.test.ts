import { expect, test } from 'vitest';
import { compactKwacha, percent } from './format';

test('axis amounts are short', () => {
  expect(compactKwacha(0)).toBe('K 0');
  expect(compactKwacha(250)).toBe('K 250');
  expect(compactKwacha(1200)).toBe('K 1.2k');
  expect(compactKwacha(3000)).toBe('K 3k');
  expect(compactKwacha(-1200)).toBe('-K 1.2k');
  expect(compactKwacha(1_250_000)).toBe('K 1.3m');
});

test('percentages are rounded to the asked decimals', () => {
  expect(percent(0.756)).toBe('76%');
  expect(percent(0.756, 1)).toBe('75.6%');
  expect(percent(0)).toBe('0%');
  expect(percent(Number.NaN)).toBe('0%');
});
