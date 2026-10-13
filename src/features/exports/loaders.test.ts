import { beforeEach, expect, test, vi } from 'vitest';
import { closeMember, entry, loan, memberStatus, statement, year } from '@/features/ledger/testFixtures';
import { PAYOUT } from './exportFixtures';
import { db, resetDb } from './testSupabase';

vi.mock('@/lib/supabase', async () => ({ supabase: (await import('./testSupabase')).fakeClient }));
const { isDeclarationsPending, loadMemberExport, loadMonthExport, loadPeriodExport } = await import('./loaders');

const periods = year(3, 'open'); // Feb, Mar, Apr closed (p1..p3); May open (p4)
const ctx = { groupId: 'g1', groupName: 'Test Group', cycle: { id: 'c1', label: 'Cycle 2026' }, periods };
const PEOPLE_ROWS = [
  { id: 'm1', short_name: 'Eve', full_name: 'Eve Example', status: 'active', email: 'eve@example.test', phone: '0000', user_id: 'u1', group_id: 'g1' },
  { id: 'm2', short_name: 'Ann', full_name: 'Ann Example', status: 'active', email: 'ann@example.test', phone: '0001', user_id: 'u2', group_id: 'g1' },
  { id: 'm9', short_name: 'Zed', full_name: 'Zed Sentinel', status: 'active', email: 'zed@example.test', phone: '0009', user_id: 'u9', group_id: 'g1' },
];
const groupStatement = (period_id: string, o: Record<string, unknown> = {}) => ({
  id: `gs-${period_id}`, group_id: 'g1', period_id, source: 'close', created_at: 'x', opening_cash: 5000, received: 900, savings: 850, loans_sent: 0,
  idle_cash: 5000, excess_rate: 0.1, excess_billed: 500, interest_collected: 0, fee_pot_in: 0, fee_pot_out: 0, fee_pot_balance: 10,
  meeting_pot_in: 0, meeting_pot_balance: 90, total_savings: 850, total_owed: 0, ...o,
});
const previewJson = {
  period_id: 'p4', label: 'May 2026', month_index: 4, committed: false,
  group: groupStatement('p4'),
  members: [closeMember({ member_id: 'm1', short_name: 'Eve', cum_savings: 1000 }), closeMember({ member_id: 'm9', short_name: 'Zed', cum_savings: 777777.77 })],
  diff: [], unexplained: 0,
};

beforeEach(() => {
  resetDb(
    {
      members: PEOPLE_ROWS,
      periods: [{ id: 'p1', closed_at: '2026-03-07T10:00:00Z' }, { id: 'p2', closed_at: '2026-04-07T10:00:00Z' }, { id: 'p3', closed_at: '2026-05-07T10:00:00Z' }],
      statements: [
        statement({ id: 's1', period_id: 'p1', member_id: 'm1', next_minimum: 300 }), statement({ id: 's2', period_id: 'p2', member_id: 'm1' }),
        statement({ id: 's3', period_id: 'p1', member_id: 'm9', saving: 777777.77 }), statement({ id: 's4', period_id: 'p2', member_id: 'm9' }),
        statement({ id: 's5', period_id: 'p3', member_id: 'm1' }), statement({ id: 's6', period_id: 'p3', member_id: 'm9', saving: 777777.77 }),
      ],
      group_statements: [groupStatement('p1'), groupStatement('p2'), groupStatement('p3')],
      entries: [],
      loans: [loan({ id: 'l1', member_id: 'm1', period_id: 'p1' }), loan({ id: 'l9', member_id: 'm9', period_id: 'p1', principal: 777777.77 })],
      member_status: [memberStatus({ member_id: 'm1', cycle_id: 'c1', defaulted: false }), memberStatus({ id: 'ms9', member_id: 'm9', cycle_id: 'c1', defaulted: true, reason: 'Zed’s secret reason' })],
    },
    {
      close_month: () => ({ data: previewJson }),
      payout_preview: () => ({ data: [...PAYOUT.filter((p) => p.member_id === 'm1'), { member_id: 'm9', short_name: 'Zed', savings: 777777.77, interest_earned: 0, owed: 0, pot_share: 0, payout: 777777.77 }] }),
    },
  );
});

const callsTo = (table: string) => db.calls.filter((c) => c.table === table);

// ----- the month ------------------------------------------------------------------------------------------------------

test('a closed month is read from its statements and never previewed', async () => {
  const d = await loadMonthExport(ctx, periods[1]!);
  expect(d.figures.preview).toBe(false);
  expect(d.figures.closedOn).toBe('2026-04-07T10:00:00Z');
  expect(d.figures.members.map((m) => m.member_id).sort()).toEqual(['m1', 'm9']);
  expect(db.rpcCalls.map((c) => c.name)).not.toContain('close_month');
  expect(d.minimumDue).toEqual({ m1: 300, m9: 0 });
});

test('the open month is the engine’s preview, asked for without committing', async () => {
  const d = await loadMonthExport(ctx, periods[3]!);
  expect(d.figures.preview).toBe(true);
  expect(d.figures.closedOn).toBeNull();
  expect(db.rpcCalls.find((c) => c.name === 'close_month')!.args).toEqual({ p_period: 'p4', p_commit: false });
  expect(d.figures.members.find((m) => m.member_id === 'm1')!.cum_savings).toBe(1000);
  expect(d.figures.members[0]).not.toHaveProperty('short_name');
});

test('people are read with the four columns the files need and nothing else', async () => {
  const d = await loadMonthExport(ctx, periods[1]!);
  expect(new Set(callsTo('members').map((c) => c.select))).toEqual(new Set(['id, short_name, full_name, status']));
  expect(JSON.stringify(d)).not.toContain('example.test');
  expect(JSON.stringify(d)).not.toContain('"user_id"');
});

test('a month with 2,500 entries returns every one of them', async () => {
  db.tables.entries = Array.from({ length: 2500 }, (_, i) => entry({ id: `e${String(i).padStart(4, '0')}`, period_id: 'p2', member_id: 'm1' }));
  const d = await loadMonthExport(ctx, periods[1]!);
  expect(d.entries).toHaveLength(2500);
  expect(callsTo('entries').map((c) => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999], [2500, 3499]]);
});

test('the earlier entries a month’s corrections point at are fetched in chunks of 100', async () => {
  db.tables.entries = [
    ...Array.from({ length: 250 }, (_, i) => entry({ id: `o${i}`, period_id: 'p1', member_id: 'm1', kind: 'txn_fee' })),
    ...Array.from({ length: 250 }, (_, i) => entry({ id: `c${i}`, period_id: 'p2', member_id: 'm1', kind: 'adjustment', source: 'correction', corrects_entry_id: `o${i}`, reason: 'x' })),
  ];
  const d = await loadMonthExport(ctx, periods[1]!);
  expect(d.entries).toHaveLength(250);
  expect(d.originals).toHaveLength(250);
  const byId = callsTo('entries').filter((c) => c.in.length > 0);
  expect(byId.map((c) => c.in[0]![1].length)).toEqual([100, 100, 50]);
});

test('a failed read is thrown, not turned into an empty file', async () => {
  db.failTable = 'statements';
  await expect(loadMonthExport(ctx, periods[1]!)).rejects.toMatchObject({ message: 'boom' });
});

// ----- the whole period -----------------------------------------------------------------------------------------------

test('the whole period is the closed months, then the open month as a preview', async () => {
  const d = await loadPeriodExport(ctx);
  expect(d.months.map((m) => [m.period.label, m.preview])).toEqual([['Feb 2026', false], ['Mar 2026', false], ['Apr 2026', false], ['May 2026', true]]);
  expect(d.openLeftOut).toBeNull();
  expect(d.payoutAsAt).toBe('May 2026');
  expect(d.statuses).toHaveLength(2);
  expect(d.loans).toHaveLength(2);
  expect(db.rpcCalls.filter((c) => c.name === 'close_month')).toHaveLength(1);
});

test('when the preview is refused only because declarations are waiting, the closed months still export and the month is named', async () => {
  db.rpcs.close_month = () => ({ error: { message: 'declarations_pending', code: 'P0001' } });
  const d = await loadPeriodExport(ctx);
  expect(d.months.map((m) => m.preview)).toEqual([false, false, false]);
  expect(d.openLeftOut?.label).toBe('May 2026');
});

test('any other preview failure stops the export', async () => {
  db.rpcs.close_month = () => ({ error: { message: 'JWT expired', code: 'PGRST301' } });
  await expect(loadPeriodExport(ctx)).rejects.toMatchObject({ code: 'PGRST301' });
});

test('with no open month there is no preview call', async () => {
  const closedOnly = { ...ctx, periods: year(8) };
  db.tables.periods = closedOnly.periods.map((p) => ({ id: p.id, closed_at: '2026-10-01T00:00:00Z' }));
  db.tables.group_statements = closedOnly.periods.filter((p) => p.status === 'closed').map((p) => groupStatement(p.id));
  const d = await loadPeriodExport(closedOnly);
  expect(db.rpcCalls.map((c) => c.name)).not.toContain('close_month');
  expect(d.months).toHaveLength(8);
  expect(d.payoutAsAt).toBe('Sep 2026');
});

test('isDeclarationsPending recognises only that refusal', () => {
  expect(isDeclarationsPending({ message: 'declarations_pending' })).toBe(true);
  expect(isDeclarationsPending({ message: 'period_not_open' })).toBe(false);
  expect(isDeclarationsPending(null)).toBe(false);
  expect(isDeclarationsPending('declarations_pending')).toBe(false);
});

// ----- one member -----------------------------------------------------------------------------------------------------

test('a member’s export holds that member alone: no other row, name, amount or reason is in what the loader returns', async () => {
  db.tables.entries = [entry({ id: 'e1', member_id: 'm1', period_id: 'p1' }), entry({ id: 'e9', member_id: 'm9', period_id: 'p1', amount: 777777.77 })];
  const d = await loadMemberExport(ctx, 'm1');
  const json = JSON.stringify(d);
  for (const leak of ['m9', 'Zed', '777777', 'secret reason', 'example.test']) expect(json).not.toContain(leak);
  expect(d.person).toEqual({ id: 'm1', short_name: 'Eve', full_name: 'Eve Example', status: 'active' });
  expect(d.months.map((m) => [m.period.label, m.preview])).toEqual([['Feb 2026', false], ['Mar 2026', false], ['Apr 2026', false], ['May 2026', true]]);
  expect(d.months.at(-1)!.row.cum_savings).toBe(1000);
  expect(d.payout?.member_id).toBe('m1');
  expect(d.status?.member_id).toBe('m1');
  expect(d.loans.map((l) => l.id)).toEqual(['l1']);
  expect(d.entries.map((e) => e.id)).toEqual(['e1']);
});

test('a member’s export leaves out the open month when its preview is refused, and says which', async () => {
  db.rpcs.close_month = () => ({ error: { message: 'declarations_pending' } });
  const d = await loadMemberExport(ctx, 'm1');
  expect(d.months.map((m) => m.preview)).toEqual([false, false, false]);
  expect(d.openLeftOut?.label).toBe('May 2026');
});

test('entries of another cycle are not in a member’s export', async () => {
  db.tables.entries = [entry({ id: 'in', member_id: 'm1', period_id: 'p2' }), entry({ id: 'out', member_id: 'm1', period_id: 'other-cycle-period' })];
  expect((await loadMemberExport(ctx, 'm1')).entries.map((e) => e.id)).toEqual(['in']);
});

test('a member who is not in the group is an error, not an empty report', async () => {
  await expect(loadMemberExport(ctx, 'nobody')).rejects.toMatchObject({ code: 'PGRST116' });
});

test('a month imported from the workbook is marked as imported and carries no close date; a closed one keeps its date', async () => {
  db.tables.group_statements = [groupStatement('p1', { source: 'import' }), groupStatement('p2'), groupStatement('p3')];
  const d = await loadPeriodExport(ctx);
  expect(d.months.slice(0, 3).map((m) => [m.imported, m.closedOn])).toEqual([[true, null], [false, '2026-04-07T10:00:00Z'], [false, '2026-05-07T10:00:00Z']]);
  expect(d.months[3]!.imported).toBe(false);
  const one = await loadMonthExport(ctx, periods[0]!);
  expect(one.figures).toMatchObject({ imported: true, closedOn: null });
});

test('no read asks for every column: account ids, a default’s reason and a loan’s warnings are never loaded', async () => {
  db.tables.entries = [entry({ id: 'e1', member_id: 'm1', period_id: 'p2', created_by: 'user-secret', reason: 'a note' })];
  db.tables.loans = [loan({ id: 'l1', member_id: 'm1', period_id: 'p1', arrears_warning: 'warn-secret', approved_reason: 'why-secret' })];
  const month = await loadMonthExport(ctx, periods[1]!);
  const whole = await loadPeriodExport(ctx);
  const mine = await loadMemberExport(ctx, 'm1');
  expect(db.calls.filter((c) => c.select === '*' || c.select === '')).toEqual([]);
  const loaded = JSON.stringify([month, whole, mine]);
  for (const secret of ['user-secret', 'warn-secret', 'why-secret', 'secret reason', 'changed_by', 'created_by', 'wallet_id']) expect(loaded).not.toContain(secret);
  expect(whole.statuses.every((s) => Object.keys(s).sort().join() === 'defaulted,member_id')).toBe(true);
  expect(month.entries[0]).toMatchObject({ id: 'e1', reason: 'a note' }); // what the files do need is still there
});
