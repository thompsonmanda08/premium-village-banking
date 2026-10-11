import { expect, test } from 'vitest';
import { appliedGrounds, groundLabel, loanRequests, openSuggestions, splitReason } from './deskMoney';
import { declaration, entry } from './testFixtures';

test('loanRequests lists live declarations that ask for a loan, newest first, with what was already sent to that member', () => {
  const rows = [
    declaration({ id: 'd3', member_id: 'm3', borrowing_request: 500 }),
    declaration({ id: 'd2', member_id: 'm2', borrowing_request: 0 }),
    declaration({ id: 'd1b', member_id: 'm1', borrowing_request: 2000, supersedes_id: 'd1' }),
    declaration({ id: 'd1', member_id: 'm1', borrowing_request: 100, status: 'returned' }),
    declaration({ id: 'd4', member_id: 'm4', borrowing_request: 300, status: 'returned' }),
  ];
  const r = loanRequests(rows, [{ member_id: 'm1', principal: 1000 }, { member_id: 'm1', principal: 0.5 }]);
  expect(r.map((x) => [x.memberId, x.amount, x.sent])).toEqual([['m3', 500, 0], ['m1', 2000, 1000.5]]);
});

test('groundLabel names the four grounds and shows an unknown one as itself', () => {
  expect(groundLabel('late_declaration')).toBe('Late declaration');
  expect(groundLabel('missed_minimum')).toBe('Missed minimum');
  expect(groundLabel('under_saving')).toBe('Saved under the minimum');
  expect(groundLabel('other')).toBe('Other');
  expect(groundLabel('new_ground')).toBe('new_ground');
});

test('splitReason separates the ground the engine stores from the written reason', () => {
  expect(splitReason('missed_minimum: Paid K0 of the K300 minimum')).toEqual({ ground: 'missed_minimum', text: 'Paid K0 of the K300 minimum' });
  expect(splitReason('other: a: b')).toEqual({ ground: 'other', text: 'a: b' });
  expect(splitReason('no ground here')).toEqual({ ground: '', text: 'no ground here' });
  expect(splitReason(null)).toEqual({ ground: '', text: '' });
});

test('suggestions already applied this month, or dismissed, are not offered again', () => {
  const applied = appliedGrounds([
    entry({ id: 'p1', kind: 'penalty', member_id: 'm1', source: 'app', reason: 'late_declaration: Declared 2 days late' }),
    entry({ id: 'p2', kind: 'penalty', member_id: 'm2', source: 'correction', corrects_entry_id: 'p1', reason: 'late_declaration: x' }),
    entry({ id: 'p3', kind: 'saving', member_id: 'm3', source: 'app', reason: null }),
  ]);
  expect([...applied]).toEqual(['m1:late_declaration']);
  const s = (member_id: string, ground: string) => ({ member_id, short_name: member_id, ground, amount: 50, detail: '' });
  const open = openSuggestions(
    [s('m1', 'late_declaration'), s('m1', 'missed_minimum'), s('m2', 'late_declaration'), s('m3', 'under_saving')],
    applied,
    new Set(['m3:under_saving']),
  );
  expect(open.map((x) => `${x.member_id}:${x.ground}`)).toEqual(['m1:missed_minimum', 'm2:late_declaration']);
});
