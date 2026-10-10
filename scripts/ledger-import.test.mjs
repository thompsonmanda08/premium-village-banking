// @vitest-environment node
// The workbook is synthetic (made-up members and amounts); postgres is mocked, so nothing here touches a database.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { afterAll, beforeEach, expect, test, vi } from 'vitest'

const calls = []
let reply
const query = vi.fn(async (strings, ...values) => {
  calls.push({ text: strings.join('?'), values })
  return reply()
})
query.end = vi.fn(async () => {})
const connect = vi.fn(() => query)
vi.mock('postgres', () => ({ default: connect }))

const { runImport } = await import('./ledger-import.mjs')

const GROUP = '11111111-1111-4111-8111-111111111111'
const URL = 'postgresql://postgres:s3cret@localhost:54322/postgres'
const dir = mkdtempSync(join(tmpdir(), 'ledger-import-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

// One month ("Feb 1") plus the Interest sheet the parser insists on.
async function workbook(file, { loan = 0, interest = 0 } = {}) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Feb 1')
  ;['S/N', 'Name', '', 'Savings', 'Loan', 'Interest on loan', 'Excess interest', 'Loan Repayment', 'Minimum amount payable'].forEach(
    (h, i) => { if (h) ws.getRow(2).getCell(i + 1).value = h },
  )
  const row = ws.getRow(3)
  Object.entries({ 1: 1, 2: 'Ann', 4: 3000, 5: loan, 6: interest, 7: 75, 8: 75, 9: 75 }).forEach(([c, v]) => { row.getCell(Number(c)).value = v })
  ws.getRow(4).getCell(2).value = 'Total'
  const sheet = wb.addWorksheet('Interest')
  sheet.getRow(2).getCell(2).value = 'Name'
  sheet.getRow(2).getCell(4).value = 'Feb'
  sheet.getRow(3).getCell(2).value = 'Ann'
  sheet.getRow(3).getCell(4).value = 3000
  const path = join(dir, file)
  await wb.xlsx.writeFile(path)
  return path
}

const summary = { cycle_id: 'c1', months: 1, members: 1, entries: 4, loans: 0, owed: 75, idle_cash: 3000 }
const pgError = (message, detail, code = 'P0001') => Object.assign(new Error(message), { code, detail })

beforeEach(() => {
  calls.length = 0
  reply = () => [{ summary }]
  connect.mockClear()
  query.end.mockClear()
  vi.stubEnv('SUPABASE_DB_URL', URL)
})

test('parses the workbook and hands the bundle to private.import_history', async () => {
  const path = await workbook('Premium VB February 2026.xlsx')
  expect(await runImport(GROUP, path)).toEqual(summary)
  expect(calls).toHaveLength(1)
  expect(calls[0].text).toContain('private.import_history')
  expect(calls[0].values[0]).toBe(GROUP)
  const bundle = JSON.parse(calls[0].values[1])
  expect(bundle.through).toBe(1)
  expect(bundle.months[0].rows[0]).toMatchObject({ name: 'Ann', saving: 3000, excess: 75 })
  expect(query.end).toHaveBeenCalled()
})

test('a folder: the workbook for the named month is picked, "Feb" or 1', async () => {
  const folder = join(dir, 'folder')
  mkdirSync(folder)
  await workbook('folder/Premium VB February 2026.xlsx')
  for (const through of ['Feb', 'february', '1', undefined]) {
    calls.length = 0
    expect(await runImport(GROUP, folder, through)).toEqual(summary)
    expect(JSON.parse(calls[0].values[1]).through).toBe(1)
  }
})

test.each([
  ['member_not_found', 'No single member matches: zoe', 'That member no longer exists.'],
  ['cycle_overlap', undefined, 'Another cycle already covers these dates. Check the dates, or close that cycle first.'],
  ['invalid_amount', 'Interest with no loan: Ann in month 1', 'Check the amount: kwacha and ngwee only, and not below zero.'],
])('%s from the database is reported as a code, a friendly message and its detail', async (code, detail, message) => {
  reply = () => { throw pgError(code, detail) }
  const path = await workbook('Premium VB February 2026.xlsx')
  expect(await runImport(GROUP, path)).toEqual({ error: code, message, ...(detail && { detail }) })
  expect(query.end).toHaveBeenCalled()
})

test('a workbook problem is reported without touching the database', async () => {
  const path = await workbook('Premium VB February 2026.xlsx')
  const out = await runImport(GROUP, path, 'Mar')
  expect(out).toMatchObject({ error: 'import_failed' })
  expect(out.message).toMatch(/Mar|workbook/)
  expect(connect).not.toHaveBeenCalled()
})

test('a connection failure is reported with the connection string scrubbed', async () => {
  reply = () => { throw new Error(`connect failed for ${URL}`) }
  const path = await workbook('Premium VB February 2026.xlsx')
  const out = await runImport(GROUP, path)
  expect(out.error).toBe('import_failed')
  expect(JSON.stringify(out)).not.toContain('s3cret')
})

test('bad arguments and a missing database URL are refused before anything is read or opened', async () => {
  const path = await workbook('Premium VB February 2026.xlsx')
  expect(await runImport('not-a-uuid', path)).toMatchObject({ error: 'usage' })
  expect(await runImport(GROUP, undefined)).toMatchObject({ error: 'usage' })
  vi.stubEnv('SUPABASE_DB_URL', '')
  expect(await runImport(GROUP, path)).toMatchObject({ error: 'usage' })
  expect(connect).not.toHaveBeenCalled()
})
