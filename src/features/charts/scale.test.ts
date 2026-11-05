import { expect, test } from 'vitest';
import { niceDomain, niceStep, scaleLinear } from './scale';

test('a step is the next round number: 1, 2, 2.5, 5 or 10 times a power of ten', () => {
  expect(niceStep(212.5)).toBe(250);
  expect(niceStep(2)).toBe(2);
  expect(niceStep(0.03)).toBe(0.05);
  expect(niceStep(7)).toBe(10);
});

test('a step for nothing sensible is 1, never NaN', () => {
  expect(niceStep(0)).toBe(1);
  expect(niceStep(-5)).toBe(1);
  expect(niceStep(Number.NaN)).toBe(1);
  expect(niceStep(Number.POSITIVE_INFINITY)).toBe(1);
});

test('the domain reaches a round number above the data and always includes zero', () => {
  expect(niceDomain(0, 850)).toEqual({ lo: 0, hi: 1000, step: 250, ticks: [0, 250, 500, 750, 1000] });
  const d = niceDomain(300, 850);
  expect(d.lo).toBe(0);
  expect(d.hi).toBe(1000);
});

test('negative data gets a domain below zero', () => {
  expect(niceDomain(-300, 500)).toMatchObject({ lo: -400, hi: 600, step: 200 });
  const all = niceDomain(-50, -10);
  expect(all.hi).toBe(0);
  expect(all.lo).toBeLessThanOrEqual(-50);
});

test('no data, or all zeros, still has a finite domain', () => {
  for (const d of [niceDomain(0, 0), niceDomain(Number.NaN, Number.NaN)]) {
    expect(d.hi).toBeGreaterThan(d.lo);
    expect(d.ticks.every(Number.isFinite)).toBe(true);
  }
});

test('ticks carry no floating-point dust', () => {
  expect(niceDomain(0, 0.7).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
});

test('a linear scale maps the domain onto the range, and a flat domain to the middle', () => {
  expect(scaleLinear([0, 1000], [200, 0])(250)).toBe(150);
  expect(scaleLinear([5, 5], [0, 100])(5)).toBe(50);
});
