import { kindLabel, type EntryRow } from '@/features/ledger/memberViews';
import { sumKwacha } from '@/features/ledger/money';
import { formatDate, localISODate } from '@/lib/format';
import type { Workbook, Worksheet } from './loadExcel';

export type Cell = string | number | Date | null;
export type ColKind = 'text' | 'money' | 'int' | 'date' | 'percent';
export type Col = { header: string; kind: ColKind; width?: number };

export const MONEY_FORMAT = '"K" #,##0.00;-"K" #,##0.00';
const NUMBER_FORMAT: Record<ColKind, string | undefined> = { text: undefined, money: MONEY_FORMAT, int: '0', date: 'dd mmm yyyy', percent: '0.0%' };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECEF' } } as const;

const localDay = (iso: string): string => (iso.length > 10 ? localISODate(new Date(iso)) : iso);

/** A calendar day (a timestamp read in the treasurer's time zone, or a plain 'YYYY-MM-DD') held at UTC midnight, so Excel shows that day everywhere. */
export const dayCell = (iso: string): Date => new Date(`${localDay(iso)}T00:00:00Z`);

/** The same day as words: 7 Apr 2026. */
export const dayText = (iso: string): string => formatDate(localDay(iso));

export function newSheet(wb: Workbook, name: string): Worksheet {
  const ws = wb.addWorksheet(name.slice(0, 31));
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return ws;
}

/** Lines at the top of a sheet: the first is the title. Returns the row the next block starts on (one blank row after the lines). */
export function writeLines(ws: Worksheet, lines: string[]): number {
  lines.forEach((text, i) => {
    const cell = ws.getCell(i + 1, 1);
    cell.value = text;
    cell.font = i === 0 ? { bold: true, size: 14 } : { color: { argb: 'FF555B61' } };
  });
  return lines.length + 2;
}

/**
 * A header row at `start`, the data rows under it and an optional totals row. Values are written as given (a string stays a string),
 * a null is left blank. `freeze` freezes the header and the first `freezeCols` columns. `next` is the row two below the table.
 */
export function writeTable(
  ws: Worksheet,
  start: number,
  cols: Col[],
  rows: Cell[][],
  opts: { totals?: Cell[]; freeze?: boolean; freezeCols?: number } = {},
): { header: number; first: number; last: number; totals: number | null; next: number } {
  cols.forEach((c, i) => {
    const cell = ws.getCell(start, i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: c.kind === 'text' ? 'left' : 'right' };
    const col = ws.getColumn(i + 1);
    col.width = Math.max(col.width ?? 0, c.width ?? Math.min(26, Math.max(12, c.header.length + 2)));
  });
  const put = (r: number, cells: Cell[], bold: boolean) =>
    cells.forEach((value, i) => {
      const cell = ws.getCell(r, i + 1);
      if (value !== null) cell.value = value;
      const format = NUMBER_FORMAT[cols[i]?.kind ?? 'text'];
      if (format && value !== null && typeof value !== 'string') cell.numFmt = format;
      if (bold) {
        cell.font = { bold: true };
        cell.border = { top: { style: 'thin' } };
      }
    });
  rows.forEach((cells, i) => put(start + 1 + i, cells, false));
  const last = start + rows.length;
  const totals = opts.totals ? last + 1 : null;
  if (opts.totals && totals !== null) put(totals, opts.totals, true);
  if (opts.freeze) ws.views = [{ state: 'frozen', xSplit: opts.freezeCols ?? 0, ySplit: start }];
  return { header: start, first: start + 1, last, totals, next: (totals ?? last) + 2 };
}

export const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** The column's numbers added in whole ngwee; blanks and text count as 0. */
export const sumColumn = (rows: Cell[][], index: number): number => sumKwacha(...rows.map((r) => (typeof r[index] === 'number' ? (r[index] as number) : 0)));

/** A totals row: `label` in column `labelAt`, the sum of each column in `sumAt`, the rest blank. */
export function totalsRow(rows: Cell[][], width: number, label: string, sumAt: number[], labelAt = 0): Cell[] {
  const out: Cell[] = Array.from({ length: width }, () => null);
  out[labelAt] = label;
  for (const i of sumAt) out[i] = sumColumn(rows, i);
  return out;
}

/** An entry's amount as the engine counts it: waivers and adjustments reduce. */
export const signedAmount = (e: EntryRow): number => (e.kind === 'waiver' || e.kind === 'adjustment' ? -e.amount : e.amount);

const SOURCE: Record<string, string> = { import: 'Workbook', app: 'App', correction: 'Correction', close: 'Month close' };
export const sourceLabel = (source: string): string => SOURCE[source] ?? source;

export { kindLabel };

export async function toBytes(wb: Workbook): Promise<Uint8Array> {
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
