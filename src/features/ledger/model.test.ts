import { expect, test } from 'vitest';
import { activeMembers, currentPeriod, deadlineNote, lastClosed, liveDeclarations, nextToOpen, undeclared } from './model';
import { declaration, year } from './testFixtures';

test('currentPeriod is the open month, or null', () => {
  expect(currentPeriod(year(8, 'open'))?.label).toBe('Oct 2026');
  expect(currentPeriod(year(8))).toBeNull();
});

test('lastClosed is the highest closed month', () => {
  expect(lastClosed(year(8))?.label).toBe('Sep 2026');
  expect(lastClosed(year(0))).toBeNull();
});

test('nextToOpen is the first planned month once the one before is closed and nothing is open or closing', () => {
  expect(nextToOpen(year(8))?.label).toBe('Oct 2026');
  expect(nextToOpen(year(0))?.label).toBe('Feb 2026');
  expect(nextToOpen(year(8, 'open'))).toBeNull();
  expect(nextToOpen(year(8, 'closing'))).toBeNull();
  expect(nextToOpen(year(12))).toBeNull();
});

test('liveDeclarations drops a declaration that a later one replaced, and keeps approved ones beside a new one', () => {
  const d1 = declaration({ id: 'd1', status: 'returned' });
  const d2 = declaration({ id: 'd2', status: 'submitted', supersedes_id: 'd1' });
  const d3 = declaration({ id: 'd3', status: 'approved' });
  expect(liveDeclarations([d2, d1, d3]).map((d) => d.id)).toEqual(['d2', 'd3']);
});

test('activeMembers keeps active rows that have an id and a short name', () => {
  const rows = [
    { id: 'a', short_name: 'Ann', status: 'active' },
    { id: 'b', short_name: 'Bob', status: 'left' },
    { id: null, short_name: 'X', status: 'active' },
    { id: 'c', short_name: null, status: 'active' },
  ];
  expect(activeMembers(rows)).toEqual([{ id: 'a', short_name: 'Ann' }]);
});

test('undeclared lists members with no live declaration', () => {
  const members = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
  expect(undeclared(members, [declaration({ member_id: 'm1' })])).toEqual([{ id: 'm2', short_name: 'Ann' }]);
});

test('deadlineNote counts days and flags a missed deadline', () => {
  expect(deadlineNote('2026-10-05', '2026-10-07')).toEqual({ text: '2 days left', tone: 'warning' });
  expect(deadlineNote('2026-10-06', '2026-10-07')).toEqual({ text: '1 day left', tone: 'warning' });
  expect(deadlineNote('2026-10-07', '2026-10-07')).toEqual({ text: 'Due today', tone: 'warning' });
  expect(deadlineNote('2026-10-08', '2026-10-07')).toEqual({ text: 'Past the deadline', tone: 'danger' });
  expect(deadlineNote('2026-10-01', '2026-10-07')).toEqual({ text: '6 days left', tone: 'neutral' });
});
