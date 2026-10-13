// @vitest-environment node
import { expect, test } from 'vitest';
import { entry } from '@/features/ledger/testFixtures';
import { BOB_STATUS, MONTHS, PAYOUT, SENTINEL, memberExport, readBack, rowsOf, tableOf } from './exportFixtures';
import { buildMemberWorkbook } from './memberWorkbook';

const build = async (o = memberExport()) => readBack(await buildMemberWorkbook(o));

test('a member’s report has Standpoint, Month by month, Loans and Ledger sheets', async () => {
  expect((await build()).worksheets.map((w) => w.name)).toEqual(['Standpoint', 'Month by month', 'Loans', 'Ledger']);
});

test('the standpoint says where the member stands, as at the latest month', async () => {
  const wb = await build();
  const lines = rowsOf(wb.getWorksheet('Standpoint')!);
  expect(lines[0]![0]).toBe('Test Group: Bob Example');
  expect(String(lines[1]![0])).toContain('As at May 2026 (preview: this month is still open, so its figures can change)');
  const t = tableOf(wb.getWorksheet('Standpoint')!, 'Where you stand');
  const value = (label: string) => t.body.find((r) => r[0] === label)![1];
  expect(value('Saved so far')).toBe(400);
  expect(value('Interest earned so far')).toBe(6);
  expect(value('You owe')).toBe(200);
  expect(value('Minimum due next month')).toBe(200);
  expect(value('Loans taken')).toBe(1000);
  expect(value('Loan interest charged')).toBe(150);
  expect(value('Penalties charged')).toBe(100);
  expect(value('Paid in')).toBe(1200);
  expect(value('Months short of the minimum')).toBe(1);
  expect(value('Standing')).toBe('Defaulted');
});

test('what the cycle would pay if it ended today adds up to the engine’s payout', async () => {
  const t = tableOf((await build()).getWorksheet('Standpoint')!, 'If the cycle ended today (using May 2026 figures)');
  const value = (label: string) => t.body.find((r) => r[0] === label)![1] as number;
  expect(value('Your savings')).toBe(400);
  expect(value('Interest earned')).toBe(6);
  expect(value('Less what you owe')).toBe(-200);
  expect(value('Your share of the pots')).toBe(12.5);
  expect(value('You would receive')).toBe(218.5);
  expect(value('Your savings') + value('Interest earned') + value('Less what you owe') + value('Your share of the pots')).toBe(value('You would receive'));
});

test('a credit reads as a credit, not as a debt with a minus sign', async () => {
  const months = memberExport().months.map((m, i, all) => (i === all.length - 1 ? { ...m, row: { ...m.row, closing_owed: -50 } } : m));
  const payout = { ...PAYOUT[2]!, owed: -50, payout: 468.5 };
  const wb = await build(memberExport({ months, payout }));
  const t = tableOf(wb.getWorksheet('Standpoint')!, 'Where you stand');
  expect(t.body.find((r) => r[0] === 'In credit')![1]).toBe(50);
  expect(t.body.find((r) => r[0] === 'You owe')).toBeUndefined();
  const p = tableOf(wb.getWorksheet('Standpoint')!, 'If the cycle ended today (using May 2026 figures)');
  expect(p.body.find((r) => r[0] === 'Credit you hold')![1]).toBe(50);
});

test('good standing, and no payout yet, are said plainly', async () => {
  const wb = await build(memberExport({ status: null, payout: null }));
  const t = tableOf(wb.getWorksheet('Standpoint')!, 'Where you stand');
  expect(t.body.find((r) => r[0] === 'Standing')![1]).toBe('In good standing');
  const p = tableOf(wb.getWorksheet('Standpoint')!, 'If the cycle ended today (using May 2026 figures)');
  expect(p.body[0]![0]).toBe('Not available yet.');
});

test('month by month lists each month, the open one marked, with totals of the flows', async () => {
  const t = tableOf((await build()).getWorksheet('Month by month')!, 'Month');
  expect(t.body.map((r) => t.get(r, 'Month'))).toEqual(['Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026 (preview)', 'Total']);
  const apr = t.body[2]!;
  expect(t.get(apr, 'Saved')).toBe(100);
  expect(t.get(apr, 'Cumm. savings')).toBe(300);
  expect(t.get(apr, 'Owed at the end')).toBe(700);
  const total = t.body.at(-1)!;
  expect(t.get(total, 'Saved')).toBe(400);
  expect(t.get(total, 'Paid in')).toBe(1200);
  expect(t.get(total, 'Cumm. savings')).toBeNull();
});

test('the loans sheet lists the member’s loans', async () => {
  const t = tableOf((await build()).getWorksheet('Loans')!, 'Month');
  expect(t.body).toHaveLength(1);
  expect(t.get(t.body[0]!, 'Principal')).toBe(1000);
  expect(t.get(t.body[0]!, 'Status')).toBe('Open');
});

test('the ledger shows an entry’s current amount and each correction under it: 100 now 80', async () => {
  const t = tableOf((await build()).getWorksheet('Ledger')!, 'Month');
  expect(t.body.map((r) => t.get(r, 'What'))).toEqual(['Savings', 'Penalty', '−K 30 waived', '+K 20 added', '−K 10 reduced']);
  const penalty = t.body[1]!;
  expect(t.get(penalty, 'Month')).toBe('Apr 2026');
  expect(t.get(penalty, 'Amount')).toBe(100);
  expect(t.get(penalty, 'Now')).toBe(80);
  expect(t.get(penalty, 'Reason')).toBe('other: Missed the meeting');
  expect(t.body.slice(2).map((r) => t.get(r, 'Amount'))).toEqual([-30, 20, -10]);
  expect(t.get(t.body[2]!, 'Reason')).toBe('Slip found');
  expect(t.get(t.body[0]!, 'Now')).toBeNull();
  expect(t.get(t.body[0]!, 'Date')).toBeNull();
});

test('a member with nothing recorded still gets a valid, empty report', async () => {
  const wb = await build(memberExport({ months: [], loans: [], entries: [], status: null, payout: null }));
  const lines = rowsOf(wb.getWorksheet('Standpoint')!);
  expect(String(lines[1]![0])).toContain('Nothing recorded yet.');
  const t = tableOf(wb.getWorksheet('Standpoint')!, 'Where you stand');
  expect(t.body.find((r) => r[0] === 'Saved so far')![1]).toBe(0);
});

test('a report made without the open month says so', async () => {
  const closedOnly = memberExport().months.filter((m) => !m.preview);
  const wb = await build(memberExport({ months: closedOnly, openLeftOut: MONTHS[3]!.period }));
  const lines = rowsOf(wb.getWorksheet('Standpoint')!).map((r) => r[0]);
  expect(lines).toContain('May 2026 is not included: declarations are still waiting.');
  expect(String(lines[1])).toContain('As at Apr 2026.');
});

// The builder is handed only this member's data, so this checks what it writes from it (names, the default's reason). The guards that stop other
// members' data arriving are the loader test and exportMember.privacy.test.ts, which put another member in every table.
test('nothing of anyone else is in the file: not a name, not a sentinel amount, not the default’s reason', async () => {
  const wb = await build();
  const everything = wb.worksheets.flatMap((w) => rowsOf(w).flat()).map(String).join('\n');
  for (const name of ['Eve', 'Ann', SENTINEL.short_name]) expect(everything).not.toMatch(new RegExp(`\\b${name}\\b`)); // whole words: "Everything" is fine
  for (const other of [SENTINEL.full_name, BOB_STATUS.reason ?? 'unreachable']) expect(everything).not.toContain(other);
  expect(everything).toContain('Bob Example');
});

test('the ledger lists entries recorded in the same instant (an import) in a readable order, not by id', async () => {
  const at = '2026-04-01T00:00:00Z';
  const entries = [
    entry({ id: 'z1', member_id: 'm3', kind: 'penalty', amount: 5, period_id: 'p2', source: 'import', created_at: at }),
    entry({ id: 'a1', member_id: 'm3', kind: 'txn_fee', amount: 6, period_id: 'p2', source: 'import', created_at: at }),
    entry({ id: 'm1', member_id: 'm3', kind: 'saving', amount: 100, period_id: 'p2', source: 'import', created_at: at }),
    entry({ id: 'k1', member_id: 'm3', kind: 'membership', amount: 30, period_id: 'p2', source: 'import', created_at: at }),
  ];
  const t = tableOf((await build(memberExport({ entries }))).getWorksheet('Ledger')!, 'Month');
  expect(t.body.map((r) => t.get(r, 'What'))).toEqual(['Savings', 'Membership', 'Mobile-money fee', 'Penalty']);
});
