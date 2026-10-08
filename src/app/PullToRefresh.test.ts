import { expect, test } from 'vitest';
import { PULL_TRIGGER, pullDistance } from './PullToRefresh';

test('ignores upward drags', () => expect(pullDistance(-40)).toBe(0));
test('resists the pull', () => expect(pullDistance(100)).toBe(50));
test('caps the indicator', () => expect(pullDistance(1000)).toBe(96));
test('trigger needs a deliberate pull', () => {
  expect(pullDistance(120) >= PULL_TRIGGER).toBe(false);
  expect(pullDistance(128) >= PULL_TRIGGER).toBe(true);
});
