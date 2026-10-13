// @vitest-environment node
import { expect, test } from 'vitest';
import { MONTHS, NEW_MEMBER, PEOPLE, PERIODS, mm, periodExport, readBack, rowsOf, tableOf } from './exportFixtures';
import { buildPeriodWorkbook } from './periodWorkbook';

const build = async (o = periodExport()) => readBack(await buildPeriodWorkbook(o));

test('the workbook has the six sheets, in reading order', async () => {
  expect((await build()).worksheets.map((w) => w.name)).toEqual(['Summary', 'Savings by month', 'Owed by month', 'Members', 'Loans', 'Statements']);
});

test('the Summary has a row per month, the open month last and marked as a preview, with totals that say so', async () => {
  const wb = await build();
  const lines = rowsOf(wb.getWorksheet('Summary')!);
  expect(lines[0]![0]).toBe('Test Group: Cycle 2026, summary');
  expect(String(lines[1]![0])).toContain('Through May 2026 (preview');
  const t = tableOf(wb.getWorksheet('Summary')!, 'Month');
  expect(t.body.map((r) => t.get(r, 'Month'))).toEqual(['Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026 (preview)', 'Total (includes the May 2026 preview)']);
  expect(t.get(t.body[3]!, 'Closed on')).toBe('Open: preview');
  expect((t.get(t.body[0]!, 'Closed on') as Date).toISOString().slice(0, 10)).toBe('2026-03-07');
  const total = t.body.at(-1)!;
  expect(t.get(total, 'Savings')).toBe(MONTHS.reduce((n, m) => n + m.group.savings, 0));
  expect(t.get(total, 'Loans sent')).toBe(1000);
  expect(t.get(total, 'Total owed')).toBeNull();
  expect(t.get(t.body[3]!, 'Total owed')).toBe(200);
});

test('when the open month had to be left out the file says so and the totals do not mention a preview', async () => {
  const wb = await build(periodExport({ months: MONTHS.slice(0, 3), openLeftOut: PERIODS[3]!, payoutAsAt: 'May 2026' }));
  const lines = rowsOf(wb.getWorksheet('Summary')!).map((r) => r[0]);
  expect(lines).toContain('May 2026 is not included: declarations are still waiting.');
  const t = tableOf(wb.getWorksheet('Summary')!, 'Month');
  expect(t.body.map((r) => t.get(r, 'Month'))).toEqual(['Feb 2026', 'Mar 2026', 'Apr 2026', 'Total']);
});

test('savings by month: cumulative savings per month, then interest earned and its share of savings', async () => {
  const t = tableOf((await build()).getWorksheet('Savings by month')!, 'Name');
  expect(t.header).toEqual(['Name', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026 (preview)', 'Interest earned', 'Interest as % of savings']);
  expect(t.body.map((r) => t.get(r, 'Name'))).toEqual(['Ann', 'Bob', 'Eve', 'Total']);
  const eve = t.body[2]!;
  expect([250, 500, 750, 1000].map((_, i) => eve[1 + i])).toEqual([250, 500, 750, 1000]);
  expect(t.get(eve, 'Interest earned')).toBe(10);
  expect(t.get(eve, 'Interest as % of savings')).toBeCloseTo(0.01, 10);
  const total = t.body.at(-1)!;
  expect(t.get(total, 'May 2026 (preview)')).toBe(1000 + 2000 + 400);
  expect(t.get(total, 'Interest earned')).toBe(10 + 20 + 6);
  expect(t.get(total, 'Interest as % of savings')).toBeCloseTo(36 / 3400, 10);
});

test('a member with no figures yet has blank months and a share of 0, never NaN', async () => {
  const t = tableOf((await build(periodExport({ people: [...PEOPLE, NEW_MEMBER] }))).getWorksheet('Savings by month')!, 'Name');
  const cy = t.body.find((r) => t.get(r, 'Name') === 'Cy')!;
  expect(cy.slice(1, 5)).toEqual([null, null, null, null]);
  expect(t.get(cy, 'Interest earned')).toBe(0);
  expect(t.get(cy, 'Interest as % of savings')).toBe(0);
});

test('owed by month keeps a credit negative', async () => {
  const months = MONTHS.map((m, i) => (i === 3 ? { ...m, members: [mm('m1', { closing_owed: -50 }), ...m.members.slice(1)] } : m));
  const t = tableOf((await build(periodExport({ months }))).getWorksheet('Owed by month')!, 'Name');
  const eve = t.body.find((r) => t.get(r, 'Name') === 'Eve')!;
  expect(t.get(eve, 'May 2026 (preview)')).toBe(-50);
  const bob = t.body.find((r) => t.get(r, 'Name') === 'Bob')!;
  expect([1, 2, 3, 4].map((i) => bob[i])).toEqual([1150, 900, 700, 200]);
});

test('the Members sheet gives each member’s standpoint, and what the cycle would pay if it ended today', async () => {
  const wb = await build();
  const lines = rowsOf(wb.getWorksheet('Members')!);
  expect(lines.flat()).toContain('Through May 2026 (preview)');
  expect(lines.flat()).toContain('If the cycle ended today (using May 2026 figures)');
  const t = tableOf(wb.getWorksheet('Members')!, 'Name');
  expect(t.body.map((r) => t.get(r, 'Name'))).toEqual(['Ann', 'Bob', 'Eve', 'Total']);
  const bob = t.body[1]!;
  expect(t.get(bob, 'Saved to date')).toBe(400);
  expect(t.get(bob, 'Interest earned to date')).toBe(6);
  expect(t.get(bob, 'Loans taken')).toBe(1000);
  expect(t.get(bob, 'Loan interest charged')).toBe(150);
  expect(t.get(bob, 'Penalties charged')).toBe(100);
  expect(t.get(bob, 'Paid in')).toBe(1200);
  expect(t.get(bob, 'Owed now')).toBe(200);
  expect(t.get(bob, 'Months short of the minimum')).toBe(1);
  expect(t.get(bob, 'Standing')).toBe('Defaulted');
  expect(t.get(t.body[0]!, 'Standing')).toBe('In good standing');
  const payoutAt = t.header.indexOf('Payout');
  expect(bob[payoutAt]).toBe(218.5);
  expect(bob[payoutAt - 1]).toBe(12.5);
  const total = t.body.at(-1)!;
  expect(total[payoutAt]).toBe(1022.5 + 2032.5 + 218.5);
});

test('the default’s reason is a treasurer’s note and appears nowhere', async () => {
  const wb = await build();
  const everything = wb.worksheets.flatMap((w) => rowsOf(w).flat()).map(String).join('\n');
  expect(everything).not.toContain('Missed three months');
});

test('a member who is not in the payout list has blank payout cells', async () => {
  const t = tableOf((await build(periodExport({ payout: [] }))).getWorksheet('Members')!, 'Name');
  expect(t.body[0]![t.header.indexOf('Payout')]).toBeNull();
});

test('loans list who borrowed in which month', async () => {
  const t = tableOf((await build()).getWorksheet('Loans')!, 'Name');
  expect(t.body).toHaveLength(1);
  expect(t.get(t.body[0]!, 'Name')).toBe('Bob');
  expect(t.get(t.body[0]!, 'Month')).toBe('Feb 2026');
  expect(t.get(t.body[0]!, 'Principal')).toBe(1000);
  expect(t.get(t.body[0]!, 'Term (months)')).toBe(3);
});

test('statements is the long form: a row per member per month, the preview flagged', async () => {
  const t = tableOf((await build()).getWorksheet('Statements')!, 'Month');
  expect(t.body).toHaveLength(12);
  expect(t.body.filter((r) => t.get(r, 'Preview') === 'Preview').map((r) => t.get(r, 'Month'))).toEqual(['May 2026', 'May 2026', 'May 2026']);
  const bobApr = t.body.find((r) => t.get(r, 'Name') === 'Bob' && t.get(r, 'Month') === 'Apr 2026')!;
  expect(t.get(bobApr, 'Short of the minimum')).toBe(100);
  expect(t.get(bobApr, 'Owed at the end')).toBe(700);
});

test('with no months at all the file is still valid and says there is nothing yet', async () => {
  const wb = await build(periodExport({ months: [], payout: [], loans: [], statuses: [] }));
  const lines = rowsOf(wb.getWorksheet('Summary')!);
  expect(String(lines[1]![0])).toContain('Nothing to show yet');
});

test('imported months show where they came from, not the day they were imported', async () => {
  const months = MONTHS.map((m, i) => (i === 0 ? { ...m, closedOn: null, imported: true } : m));
  const t = tableOf((await build(periodExport({ months }))).getWorksheet('Summary')!, 'Month');
  expect(t.get(t.body[0]!, 'Closed on')).toBe('From the workbook');
  expect((t.get(t.body[1]!, 'Closed on') as Date).toISOString().slice(0, 10)).toBe('2026-04-07');
});
