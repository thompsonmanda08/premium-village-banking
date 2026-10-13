// @vitest-environment node
import { expect, test } from 'vitest';
import { FEB_FEE, FEB_MEMBERSHIP, MAR_ENTRIES, MONTHS, PEOPLE, gf, mm, monthExport, readBack, rowsOf, tableOf } from './exportFixtures';
import { loadExcel } from './loadExcel';
import { buildMonthWorkbook } from './monthWorkbook';

const march = () => monthExport(1, { entries: MAR_ENTRIES, originals: [FEB_FEE, FEB_MEMBERSHIP], minimumDue: { m3: 400 } });
const build = async (d = march()) => readBack(await buildMonthWorkbook(d));

test('a month has a Members, a Group and an Entries sheet', async () => {
  const wb = await build();
  expect(wb.worksheets.map((w) => w.name)).toEqual(['Members', 'Group', 'Entries']);
});

test('the Members sheet opens with the group, the month and when it closed', async () => {
  const lines = rowsOf((await build()).getWorksheet('Members')!);
  expect(lines[0]![0]).toBe('Test Group: Mar 2026');
  expect(lines[1]![0]).toBe('Closed on 7 Apr 2026');
  expect(String(lines[2]![0])).toContain('Deadline 7 Mar 2026');
});

test('members are listed by name with the engine’s figures, and the minimum due last month', async () => {
  const t = tableOf((await build()).getWorksheet('Members')!, 'S/N');
  expect(t.body.map((r) => t.get(r, 'Name'))).toEqual(['Ann', 'Bob', 'Eve', 'Total']);
  const bob = t.body[1]!;
  expect(t.get(bob, 'Savings')).toBe(100);
  expect(t.get(bob, 'Cumm. Savings')).toBe(200);
  expect(t.get(bob, 'Owed at the start')).toBe(1150);
  expect(t.get(bob, 'Minimum amount payable')).toBe(400);
  expect(t.get(bob, 'Amount received')).toBe(400);
  expect(t.get(bob, 'Paid to loan interest')).toBe(150);
  expect(t.get(bob, 'Paid to loan')).toBe(250);
  expect(t.get(bob, 'Owed at the end')).toBe(900);
  expect(t.get(bob, 'Minimum next month')).toBe(400);
  expect(t.get(bob, 'Interest earned to date')).toBe(2);
  expect(t.get(t.body[0]!, 'S/N')).toBe(1);
});

test('the totals row adds each column up, and the savings total is the group’s', async () => {
  const t = tableOf((await build()).getWorksheet('Members')!, 'S/N');
  const total = t.body.at(-1)!;
  expect(t.get(total, 'Savings')).toBe(850);
  expect(t.get(total, 'Cumm. Savings')).toBe(500 + 1000 + 200);
  expect(t.get(total, 'Owed at the end')).toBe(900);
  expect(t.get(total, 'Savings')).toBe(MONTHS[1]!.group.savings);
});

test('fees are the month’s, with corrections counted under the fee’s own kind: March shows -4 and +5', async () => {
  const t = tableOf((await build()).getWorksheet('Members')!, 'S/N');
  const eve = t.body[2]!;
  expect(t.get(eve, 'Name')).toBe('Eve');
  expect(t.get(eve, 'Transaction fee')).toBe(-4);
  expect(t.get(eve, 'Membership fee')).toBe(5);
  expect(t.get(t.body[0]!, 'Transaction fee')).toBe(0);
});

test('the first month has no minimum due', async () => {
  const t = tableOf((await build(monthExport(0))).getWorksheet('Members')!, 'S/N');
  expect(t.body.slice(0, 3).map((r) => t.get(r, 'Minimum amount payable'))).toEqual([0, 0, 0]);
});

test('the open month is a clearly labelled preview', async () => {
  const wb = await build(monthExport(3));
  const lines = rowsOf(wb.getWorksheet('Members')!);
  expect(lines[0]![0]).toBe('Test Group: May 2026 (preview)');
  expect(String(lines[1]![0])).toContain('PREVIEW: May 2026 is still open, so these figures can change until it is closed.');
});

test('a credit stays a negative number, and a member missing from the people list is not dropped', async () => {
  const d = monthExport(1, {
    figures: { ...MONTHS[1]!, members: [mm('m1', { closing_owed: -50 }), mm('m9', { saving: 10, cum_savings: 10 })] },
    people: PEOPLE,
  });
  const t = tableOf((await build(d)).getWorksheet('Members')!, 'S/N');
  const eve = t.body.find((r) => t.get(r, 'Name') === 'Eve')!;
  expect(t.get(eve, 'Owed at the end')).toBe(-50);
  expect(t.body.map((r) => t.get(r, 'Name'))).toContain('Unknown member');
});

test('the Group sheet lists the group’s cash and pots, and flags a short fee pot', async () => {
  const d = monthExport(1, { figures: { ...MONTHS[1]!, group: gf({ opening_cash: 1234.5, fee_pot_balance: -3.2, excess_rate: 0.1 }) } });
  const t = tableOf((await build(d)).getWorksheet('Group')!, 'Group figure');
  const row = (label: string) => t.body.find((r) => r[0] === label)!;
  expect(t.get(row('Opening cash'), 'Amount')).toBe(1234.5);
  expect(t.get(row('Excess rate'), 'Amount')).toBe(0.1);
  expect(t.get(row('Fee pot balance'), 'Amount')).toBe(-3.2);
  expect(String(t.get(row('Fee pot balance'), 'Note'))).toContain('short');
  expect(t.get(row('Total savings'), 'Note')).toBeNull();
});

test('the Entries sheet lists the month oldest first, with reductions negative and what each correction fixed', async () => {
  const t = tableOf((await build()).getWorksheet('Entries')!, 'Date');
  expect(t.body.map((r) => t.get(r, 'What'))).toEqual(['Adjustment', 'Membership', 'Payout fee', 'Savings']);
  const adjustment = t.body[0]!;
  expect(t.get(adjustment, 'Amount')).toBe(-4);
  expect(t.get(adjustment, 'Corrects')).toBe('Mobile-money fee from Feb 2026');
  expect(t.get(adjustment, 'Member')).toBe('Eve');
  expect(t.get(adjustment, 'Source')).toBe('Correction');
  expect((t.get(adjustment, 'Date') as Date).toISOString().slice(0, 10)).toBe('2026-03-10');
  expect(t.get(t.body[2]!, 'Member')).toBe('Group');
  expect(t.get(t.body[3]!, 'Date')).toBeNull();
  expect(t.get(t.body[3]!, 'Source')).toBe('Workbook');
});

test('a reason that looks like a formula is written as plain text', async () => {
  const wb = await build();
  const sheet = wb.getWorksheet('Entries')!;
  const t = tableOf(sheet, 'Date');
  const rowIndex = t.body.findIndex((r) => r[t.col('What')] === 'Membership');
  const cell = sheet.getCell(rowIndex + 5, t.col('Reason') + 1); // two title lines and a blank row, then the header on row 4: data starts on row 5
  const { ValueType } = await loadExcel();
  expect(cell.value).toBe('=HYPERLINK("http://example.test","click")');
  expect(cell.type).toBe(ValueType.String);
});
