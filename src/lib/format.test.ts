import { describe, expect, test } from 'vitest';
import { fmt, formatDate, localISODate, money, pct, rate, zmw } from './format';

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

test('rate shows a ratio exactly, up to two decimals and no trailing zeros', () => {
  expect(rate(0.15)).toBe('15%');
  expect(rate(0.125)).toBe('12.5%');
  expect(rate(0.0725)).toBe('7.25%');
  expect(rate(0.07)).toBe('7%'); // 0.07 * 100 is 7.000000000000001
  expect(rate(0)).toBe('0%');
  expect(rate(1)).toBe('100%');
  expect(rate(Number.NaN)).toBe('0%');
});

test('money drops the decimals for whole kwacha and keeps two otherwise', () => {
  expect(money(3000)).toBe('K 3,000');
  expect(money(3000.01)).toBe('K 3,000.01');
  expect(money(9999.99)).toBe('K 9,999.99');
  expect(money(2.5)).toBe('K 2.50');
  expect(money(10000.000000001)).toBe('K 10,000');
  expect(money(0)).toBe('K 0');
});

test('money uses a true minus sign and never shows negative zero or garbage', () => {
  expect(money(-12.5)).toBe('K −12.50');
  expect(money(-5)).toBe('K −5');
  expect(money(-0.001)).toBe('K 0');
  expect(money(-0)).toBe('K 0');
  expect(money(Number.NaN)).toBe('K 0');
});

test('formatDate is locale-independent', () => {
  expect(formatDate('2027-02-05')).toBe('5 Feb 2027');
  expect(formatDate('2028-12-31')).toBe('31 Dec 2028');
});

test('localISODate uses local calendar fields', () => {
  expect(localISODate(new Date(2027, 1, 5, 23, 30))).toBe('2027-02-05');
  expect(localISODate(new Date(2027, 1, 5, 0, 30))).toBe('2027-02-05');
});
