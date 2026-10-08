import { describe, expect, test } from 'vitest';
import { fmt, formatDate, localISODate, pct, zmw } from './format';

describe('fmt', () => {
  test('groups thousands and fixes decimals', () => {
    expect(fmt(1234.5, 2)).toBe('1,234.50');
    expect(fmt(1234567)).toBe('1,234,567');
  });
  test('uses a true minus sign for negatives', () => {
    expect(fmt(-5)).toBe('−5');
    expect(fmt(-1234.5, 2)).toBe('−1,234.50');
  });
  test('never shows negative zero after rounding', () => {
    expect(fmt(-0.001, 2)).toBe('0.00');
    expect(fmt(-0)).toBe('0');
  });
  test('treats non-finite input as zero', () => {
    expect(fmt(Number.NaN)).toBe('0');
    expect(fmt(Number.POSITIVE_INFINITY, 2)).toBe('0.00');
  });
});

test('zmw prefixes kwacha with a space and two decimals by default', () => {
  expect(zmw(0)).toBe('K 0.00');
  expect(zmw(250)).toBe('K 250.00');
  expect(zmw(1500, 0)).toBe('K 1,500');
  expect(zmw(-12.5)).toBe('K −12.50');
});

test('pct formats a ratio', () => {
  expect(pct(0.1234)).toBe('12.3%');
  expect(pct(0.15, 0)).toBe('15%');
});

test('formatDate is locale-independent', () => {
  expect(formatDate('2027-02-05')).toBe('5 Feb 2027');
  expect(formatDate('2028-12-31')).toBe('31 Dec 2028');
});

test('localISODate uses local calendar fields', () => {
  expect(localISODate(new Date(2027, 1, 5, 23, 30))).toBe('2027-02-05');
});
