export type Excel = typeof import('exceljs');
export type Workbook = import('exceljs').Workbook;
export type Worksheet = import('exceljs').Worksheet;

/**
 * ExcelJS is about 1 MB, so it is fetched only when a download is pressed (its own chunk, left out of the service-worker precache)
 * and this is the only place that imports it.
 *
 * The chunk has a hashed name. An admin still on the shell of an earlier deploy asks for a name that no longer exists; the failure reads
 * like a network error, so with a connection it is reported as "reload for the new version" instead of "you seem to be offline".
 */
export async function loadExcel(): Promise<Excel> {
  let mod: Excel & { default?: Excel };
  try {
    mod = (await import('exceljs')) as Excel & { default?: Excel };
  } catch (err) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw err;
    throw new Error('app_update_needed');
  }
  return mod.default ?? mod;
}
