import { expect, test } from 'vitest';
import { closeChecklist } from './closeChecklist';
import { declaration, entry } from './testFixtures';

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }, { id: 'm3', short_name: 'Bob' }];
const base = { members: MEMBERS, suggestions: [], appliedEntries: [], loans: [], deadline: '2026-10-07', today: '2026-10-05' };

test('only live submitted declarations are waiting, and only they block the close', () => {
  const r = closeChecklist({
    ...base,
    declarations: [
      declaration({ id: 'd1', member_id: 'm1', status: 'returned' }),
      declaration({ id: 'd1b', member_id: 'm1', status: 'submitted', supersedes_id: 'd1' }),
      declaration({ id: 'd2', member_id: 'm2', status: 'approved' }),
    ],
  });
  expect(r.waiting).toBe(1);
  expect(r.blocked).toBe(true);
  expect(closeChecklist({ ...base, declarations: [declaration({ id: 'd2', member_id: 'm2', status: 'approved' })] }).blocked).toBe(false);
});

test('a member with any live declaration has declared; the rest are listed', () => {
  const r = closeChecklist({
    ...base,
    declarations: [declaration({ member_id: 'm1', status: 'returned' }), declaration({ id: 'd2', member_id: 'm2', status: 'approved' })],
  });
  expect(r.notDeclared.map((m) => m.short_name)).toEqual(['Bob']);
});

test('suggested penalties already applied are not pending', () => {
  const s = (member_id: string, ground: string) => ({ member_id, short_name: member_id, ground, amount: 50, detail: '' });
  const r = closeChecklist({
    ...base,
    declarations: [],
    suggestions: [s('m1', 'late_declaration'), s('m2', 'late_declaration')],
    appliedEntries: [entry({ kind: 'penalty', member_id: 'm1', source: 'app', reason: 'late_declaration: x' })],
  });
  expect(r.penaltiesPending).toBe(1);
});

test('borrowing requests not yet answered with a loan are counted; returned ones are not requests', () => {
  const r = closeChecklist({
    ...base,
    declarations: [
      declaration({ id: 'd1', member_id: 'm1', borrowing_request: 1000, status: 'approved' }),
      declaration({ id: 'd2', member_id: 'm2', borrowing_request: 500, status: 'approved' }),
      declaration({ id: 'd3', member_id: 'm3', borrowing_request: 300, status: 'returned' }),
    ],
    loans: [{ member_id: 'm2', principal: 500 }],
  });
  expect(r.requestsUnsent).toBe(1);
});

test('the deadline note says how long is left or that it has passed', () => {
  expect(closeChecklist({ ...base, declarations: [] }).deadline).toEqual({ text: '2 days left', tone: 'warning' });
  expect(closeChecklist({ ...base, declarations: [], today: '2026-10-09' }).deadline).toEqual({ text: 'Past the deadline', tone: 'danger' });
});
