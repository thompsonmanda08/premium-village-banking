// @vitest-environment node
import { expect, test } from 'vitest';
import { loadExcel } from './loadExcel';

test('loadExcel hands back a working ExcelJS: a workbook survives a write and a read', async () => {
  const { Workbook } = await loadExcel();
  const wb = new Workbook();
  wb.addWorksheet('Sheet').addRow(['a', 1]);
  const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
  const back = new Workbook();
  await back.xlsx.load(bytes as unknown as Parameters<typeof back.xlsx.load>[0]); // exceljs declares its own Buffer type
  expect(back.getWorksheet('Sheet')!.getRow(1).values).toEqual([undefined, 'a', 1]);
});
