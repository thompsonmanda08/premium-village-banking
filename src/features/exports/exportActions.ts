import type { PeriodRow } from '@/features/ledger/model';
import { xlsxName } from './fileName';
import { loadMemberExport, loadMonthExport, loadPeriodExport, type ExportContext } from './loaders';
import { buildMemberWorkbook } from './memberWorkbook';
import { buildMonthWorkbook } from './monthWorkbook';
import { buildPeriodWorkbook } from './periodWorkbook';

export type { ExportContext } from './loaders';
export type ExportResult = { bytes: Uint8Array; fileName: string; note?: string };

const through = (last: { period: PeriodRow; preview: boolean } | undefined): string[] =>
  last ? ['through', last.period.label, last.preview ? '(preview)' : ''] : [];

/** One month: load, build, name. Throws what the loader throws (the page shows it through friendlyError). */
export async function exportMonth(ctx: ExportContext, period: PeriodRow): Promise<ExportResult> {
  const data = await loadMonthExport(ctx, period);
  const bytes = await buildMonthWorkbook(data);
  return { bytes, fileName: xlsxName(ctx.groupName, period.label, data.figures.preview ? '(preview)' : '') };
}

/** The whole period. A month left out because its preview was refused is reported as a note for the toast. */
export async function exportPeriod(ctx: ExportContext): Promise<ExportResult> {
  const data = await loadPeriodExport(ctx);
  if (data.months.length === 0) throw new Error('nothing_to_export');
  const bytes = await buildPeriodWorkbook(data);
  return {
    bytes,
    fileName: xlsxName(ctx.groupName, ctx.cycle.label, ...through(data.months.at(-1))),
    note: data.openLeftOut ? `${data.openLeftOut.label} is left out: declarations are still waiting.` : undefined,
  };
}

export async function exportMember(ctx: ExportContext, memberId: string): Promise<ExportResult> {
  const data = await loadMemberExport(ctx, memberId);
  const bytes = await buildMemberWorkbook(data);
  return {
    bytes,
    fileName: xlsxName(ctx.groupName, data.person.short_name, ctx.cycle.label, ...through(data.months.at(-1))),
    note: data.openLeftOut ? `${data.openLeftOut.label} is left out: declarations are still waiting.` : undefined,
  };
}
