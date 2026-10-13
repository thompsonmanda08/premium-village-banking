// @vitest-environment node
// The browser may load exceljs in exactly one place (src/features/exports/loadExcel.ts, a dynamic import) so it stays a lazy chunk.
import { expect, test } from 'vitest';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });
const rulesFor = async (code, filePath) => {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => m.ruleId);
};

test('a static import of exceljs anywhere in the app is an error', async () => {
  expect(await rulesFor("import ExcelJS from 'exceljs';\nexport const x = ExcelJS;\n", 'src/features/desk/probe.ts')).toContain('no-restricted-imports');
});

test('so is a dynamic import outside loadExcel.ts', async () => {
  expect(await rulesFor("export const load = () => import('exceljs');\n", 'src/features/desk/probe.ts')).toContain('no-restricted-syntax');
});

test('loadExcel.ts itself may import it lazily', async () => {
  const rules = await rulesFor("export const load = () => import('exceljs');\n", 'src/features/exports/loadExcel.ts');
  expect(rules).not.toContain('no-restricted-syntax');
  expect(rules).not.toContain('no-restricted-imports');
});

test('the local ledger scripts are untouched by the rule', async () => {
  const rules = await rulesFor("import ExcelJS from 'exceljs';\nexport const x = ExcelJS;\n", 'scripts/probe.mjs');
  expect(rules).not.toContain('no-restricted-imports');
  expect(rules).not.toContain('no-restricted-syntax');
});
