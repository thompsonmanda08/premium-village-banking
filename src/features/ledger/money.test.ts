import { expect, test } from 'vitest';
import { parseKwacha, sumKwacha } from './money';

test('parseKwacha accepts whole kwacha and up to two decimals; blank is zero', () => {
  expect(parseKwacha('250')).toBe(250);
  expect(parseKwacha('250.5')).toBe(250.5);
  expect(parseKwacha('250.55')).toBe(250.55);
  expect(parseKwacha('')).toBe(0);
  expect(parseKwacha('  12 ')).toBe(12);
});

test('parseKwacha refuses anything else', () => {
  for (const bad of ['1,000', '250.555', '-5', '1e3', '.5', '5.', 'abc', '1 000', '+5']) expect(parseKwacha(bad), bad).toBeNull();
});

test('sumKwacha adds in ngwee so 0.1 + 0.2 is 0.3', () => {
  expect(sumKwacha(0.1, 0.2)).toBe(0.3);
  expect(sumKwacha()).toBe(0);
});
