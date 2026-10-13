// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import { MONTHS, memberExport, monthExport, periodExport, PERIODS, readBack } from './exportFixtures';

const loaders = vi.hoisted(() => ({ loadMonthExport: vi.fn(), loadPeriodExport: vi.fn(), loadMemberExport: vi.fn() }));
vi.mock('./loaders', () => loaders);
const { exportMember, exportMonth, exportPeriod } = await import('./exportActions');

const ctx = { groupId: 'g1', groupName: 'Premium VB', cycle: { id: 'c1', label: 'Cycle 2026' }, periods: PERIODS };
beforeEach(() => vi.resetAllMocks());

test('a closed month is a workbook named after the group and the month', async () => {
  loaders.loadMonthExport.mockResolvedValue(monthExport(1));
  const r = await exportMonth(ctx, PERIODS[1]!);
  expect(r.fileName).toBe('Premium VB Mar 2026.xlsx');
  expect((await readBack(r.bytes)).worksheets.map((w) => w.name)).toEqual(['Members', 'Group', 'Entries']);
  expect(r.note).toBeUndefined();
});

test('the open month’s file is named as a preview', async () => {
  loaders.loadMonthExport.mockResolvedValue(monthExport(3));
  expect((await exportMonth(ctx, PERIODS[3]!)).fileName).toBe('Premium VB May 2026 (preview).xlsx');
});

test('the whole period is named after the cycle and the last month, and a left-out month is reported as a note', async () => {
  loaders.loadPeriodExport.mockResolvedValue(periodExport());
  expect((await exportPeriod(ctx)).fileName).toBe('Premium VB Cycle 2026 through May 2026 (preview).xlsx');
  loaders.loadPeriodExport.mockResolvedValue(periodExport({ months: MONTHS.slice(0, 3), openLeftOut: PERIODS[3]! }));
  const r = await exportPeriod(ctx);
  expect(r.fileName).toBe('Premium VB Cycle 2026 through Apr 2026.xlsx');
  expect(r.note).toBe('May 2026 is left out: declarations are still waiting.');
});

test('a period with nothing in it is refused rather than downloaded empty', async () => {
  loaders.loadPeriodExport.mockResolvedValue(periodExport({ months: [] }));
  await expect(exportPeriod(ctx)).rejects.toThrow('nothing_to_export');
});

test('a member’s report is named after the member', async () => {
  loaders.loadMemberExport.mockResolvedValue(memberExport());
  const r = await exportMember(ctx, 'm3');
  expect(r.fileName).toBe('Premium VB Bob Cycle 2026 through May 2026 (preview).xlsx');
  expect(loaders.loadMemberExport).toHaveBeenCalledWith(ctx, 'm3');
});

test('with no closed month and the open month’s declarations still waiting, the reason is declarations, not “nothing”', async () => {
  loaders.loadPeriodExport.mockResolvedValue(periodExport({ months: [], openLeftOut: PERIODS[3]! }));
  await expect(exportPeriod(ctx)).rejects.toThrow('declarations_pending');
});
