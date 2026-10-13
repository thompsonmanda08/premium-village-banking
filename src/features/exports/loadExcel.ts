export type Excel = typeof import('exceljs');
export type Workbook = import('exceljs').Workbook;
export type Worksheet = import('exceljs').Worksheet;

/**
 * ExcelJS is about 1 MB, so it is fetched only when a download is pressed (its own chunk, left out of the service-worker precache)
 * and this is the only place that imports it.
 */
export async function loadExcel(): Promise<Excel> {
  const mod = (await import('exceljs')) as Excel & { default?: Excel };
  return mod.default ?? mod;
}
