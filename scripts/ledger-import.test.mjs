// @vitest-environment node
// Workbooks here are synthetic (made-up members and amounts, built with exceljs in a temp folder); postgres is mocked,
// so nothing here reads data/ or touches a database.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { main as check, reconcileLines, reportLines, summarise } from './ledger-check.mjs'
import { failure, main as runImport, parseArgs, summaryLines, throughMonth } from './ledger-import.mjs'

const db = vi.hoisted(() => {
  const state = { calls: [], respond: () => [], committed: undefined, ended: 0 }
  const sql = async (strings, ...values) => {
    const text = strings.join('?')
    state.calls.push({ text, values })
    return state.respond(text)
  }
  sql.unsafe = async (text, values = []) => {
    state.calls.push({ text, values })
    if (text === 'commit') state.committed = true
    if (text === 'rollback') state.committed = false
    return state.respond(text)
  }
  sql.json = (x) => x  // mock: just return the object as-is for test inspection
  sql.begin = async (fn) => {
    try {
      const out = await fn(sql)
      state.committed = true
      return out
    } catch (e) {
      state.committed = false
      throw e
    }
  }
  sql.end = async () => {
    state.ended++
  }
  return { state, connect: vi.fn(() => sql) }
})
vi.mock('postgres', () => ({ default: db.connect }))

test('arguments: dry run by default, flags with values, nothing unknown', () => {
  expect(parseArgs([])).toEqual({ target: undefined, through: undefined, write: false, dir: 'data/content' })
  expect(parseArgs(['--', '--target', 'abc', '--write', '--through', 'Oct'])).toEqual({
    target: 'abc', through: 'Oct', write: true, dir: 'data/content',
  })
  expect(() => parseArgs(['--target'])).toThrow(/--target needs a value/)
  expect(() => parseArgs(['--target', '--write'])).toThrow(/--target needs a value/)
  expect(() => parseArgs(['--force'])).toThrow(/Unknown option --force/)
})

test('arguments: a stray word or a --flag=value is refused, naming the valid options', () => {
  expect(() => parseArgs(['abc'])).toThrow('Unexpected argument abc. Valid options: --target, --through, --write, --dir')
  expect(() => parseArgs(['--write=true'])).toThrow(/Unknown option --write=true\. Valid options: --target, --through, --write, --dir/)
  expect(() => parseArgs(['--write', 'Sep'])).toThrow(/Unexpected argument Sep/)
  // ledger:check takes --target only.
  expect(parseArgs(['--target', 'local'], { target: undefined })).toEqual({ target: 'local' })
  expect(() => parseArgs(['--write'], { target: undefined })).toThrow('Unknown option --write. Valid options: --target')
})

test('arguments: duplicate value options are rejected', () => {
  expect(() => parseArgs(['--through', 'Sep', '--through', 'Oct'])).toThrow(/--through given twice/)
  expect(() => parseArgs(['--target', 'abc', '--target', 'xyz'])).toThrow(/--target given twice/)
  // flags (booleans) are idempotent — passing --write twice is not an error
  expect(parseArgs(['--write', '--write'])).toMatchObject({ write: true })
})

test('--through is a month from Feb to Nov, by name or number; anything else is an error, never "latest"', () => {
  expect(throughMonth(undefined)).toBeUndefined()
  for (const [v, n] of [['Feb', 1], ['Sep', 8], ['Sept', 8], ['september', 8], ['OCT', 9], ['Nov', 10], ['1', 1], ['10', 10]])
    expect(throughMonth(v), v).toBe(n)
  for (const v of ['Dec', 'Jan', '0', '11', '-1', '1.5', 'Se', 'Octo2', 'latest', ''])
    expect(() => throughMonth(v), v).toThrow(/--through takes a month from Feb to Nov/)
})

const SUMMARY = {
  cycle_id: 'c1', months: 9, members: 18, entries: 1234, loans: 56, open_loans: 12, savings: 123456.5, owed: 7890,
  idle_cash: 1000.25, fee_pot_balance: 250, meeting_pot_balance: 40.5, receipts_not_imported: { count: 15, total: 16250 },
}

test('the import summary prints counts and totals, nothing per member', () => {
  expect(summaryLines(SUMMARY, false)).toEqual([
    'DRY RUN (nothing written): Cycle 2026, Feb to Oct',
    '  members 18, entries 1234, loans 56 (12 still owed)',
    '  savings K 123,456.50, owed K 7,890.00, idle cash K 1,000.25',
    '  fee pot K 250.00, meeting pot K 40.50',
    '  15 receipts totalling K 16,250.00 left out: enter these in Nov',
  ])
  expect(summaryLines({ ...SUMMARY, months: 8 }, true)[0]).toBe('IMPORTED: Cycle 2026, Feb to Sep')
})

test('a negative pot gets a warning to reconcile with the real wallets', () => {
  const lines = summaryLines({ ...SUMMARY, months: 8, fee_pot_balance: -120, receipts_not_imported: { count: 1, total: 500 } }, true)
  expect(lines.slice(3)).toEqual([
    '  fee pot K -120.00, meeting pot K 40.50',
    '  1 receipt totalling K 500.00 left out: enter these in Oct',
    'WARNING: a pot is negative. Reconcile idle cash + fee pot + meeting pot with the real wallet balances before the first month opens.',
  ])
  expect(summaryLines({ ...SUMMARY, meeting_pot_balance: -0.01 }, false).at(-1)).toMatch(/^WARNING: a pot is negative/)
  expect(summaryLines(SUMMARY, false).join('\n')).not.toMatch(/WARNING/)
})

test('the check report counts reason codes per month', () => {
  const report = {
    periods: [
      { label: 'Feb 2026', checked: true, diff: [] },
      { label: 'Apr 2026', checked: true, diff: [
        { reason_code: 'fee_pot_vs_cash' }, { reason_code: 'workbook_rounded' }, { reason_code: 'fee_pot_vs_cash' },
        { reason_code: 'unexplained' }] },
      { label: 'Nov 2026', checked: false, diff: [] },
    ],
  }
  const rows = summarise(report)
  expect(rows.map((r) => r.unexplained)).toEqual([0, 1, 0])
  expect(reportLines(rows)).toEqual([
    'Feb 2026: 0 differences',
    'Apr 2026: 4 differences (fee_pot_vs_cash 2, unexplained 1, workbook_rounded 1)',
    'Nov 2026: no workbook figures',
  ])
})

test('errors: business codes keep their detail, permission problems say which connection to use, URLs never print', () => {
  const pg = (message, code, detail) => Object.assign(new Error(message), { code, detail })
  expect(failure('ledger:import', pg('member_not_found', 'P0001', 'No single member matches: zoe')))
    .toBe('ledger:import failed: member_not_found (No single member matches: zoe)')
  expect(failure('ledger:import', pg('not_admin', '42501', 'No such group')))
    .toBe('ledger:import failed: the group was not found in this database.')
  expect(failure('ledger:check', pg('permission denied for schema private', '42501'))).toBe(
    'ledger:check failed: permission denied for schema private. Use the owner connection: SUPABASE_DB_URL must be the database URL for the postgres role.',
  )
  vi.stubEnv('SUPABASE_DB_URL', 'postgresql://postgres.devref:s3cret@pooler.example.com:5432/postgres')
  const out = failure('ledger:import', new Error('connect failed for postgresql://postgres.devref:s3cret@pooler.example.com:5432/postgres'))
  expect(out).not.toMatch(/s3cret|devref|pooler/)
  vi.unstubAllEnvs()
})

// ---- the commands end to end, against the mocked database ----

const DEV = 'postgresql://postgres.devref:s3cret@aws-0-eu.pooler.supabase.com:5432/postgres'
const LOCAL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const GROUP = '11111111-1111-4111-8111-111111111111'
const dir = mkdtempSync(join(tmpdir(), 'ledger-import-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

// One month ("Feb 1") plus the Interest sheet the parser insists on.
beforeAll(async () => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Feb 1')
  ;['S/N', 'Name', '', 'Savings', 'Loan', 'Interest on loan', 'Excess interest', 'Loan Repayment', 'Minimum amount payable', 'Transaction fee', 'Membership fee', 'Transaction fee spent'].forEach(
    (h, i) => { if (h) ws.getRow(2).getCell(i + 1).value = h },
  )
  const row = ws.getRow(3)
  Object.entries({ 1: 1, 2: 'Ann', 4: 3000, 5: 0, 6: 0, 7: 75, 8: 75, 9: 75 }).forEach(([c, v]) => { row.getCell(Number(c)).value = v })
  ws.getRow(4).getCell(2).value = 'Total'
  const sheet = wb.addWorksheet('Interest')
  sheet.getRow(2).getCell(2).value = 'Name'
  sheet.getRow(2).getCell(4).value = 'Feb'
  sheet.getRow(3).getCell(2).value = 'Ann'
  sheet.getRow(3).getCell(4).value = 3000
  await wb.xlsx.writeFile(join(dir, 'Premium VB February 2026.xlsx'))
})

let groups
beforeEach(() => {
  groups = [{ id: GROUP }]
  Object.assign(db.state, { calls: [], committed: undefined, ended: 0 })
  db.state.respond = (text) => {
    if (text === 'begin' || text === 'commit' || text === 'rollback') return []
    if (text.includes('from groups')) return groups
    if (text.includes('private.import_history')) return [{ summary: { ...SUMMARY, months: 1 } }]
    throw new Error(`unexpected query: ${text}`)
  }
  db.connect.mockClear()
  vi.stubEnv('SUPABASE_DB_URL', DEV)
  vi.stubEnv('PROD_PROJECT_REF', 'prodref')
})

test('a dry run imports inside a transaction, rolls it back and says so', async () => {
  const lines = await runImport(['--', '--dir', dir])
  expect(lines[0]).toBe('DRY RUN (nothing written): Cycle 2026, Feb to Feb')
  expect(db.state.committed).toBe(false)
  const call = db.state.calls.find((c) => c.text.includes('private.import_history'))
  expect(call.values[0]).toBe(GROUP)
  const bundle = call.values[1]  // now the bundle object directly (via sql.json mock)
  expect(bundle.through).toBe(1)
  expect(bundle.months[0].rows[0]).toMatchObject({ name: 'Ann', saving: 3000, excess: 75 })
  expect(db.connect.mock.calls[0][1]).toMatchObject({ max: 1, prepare: false, ssl: 'require' })
  expect(db.state.ended).toBe(1)
})

test('--write with a matching --target commits', async () => {
  vi.stubEnv('SUPABASE_DB_URL', LOCAL)
  const lines = await runImport(['--target', 'local', '--write', '--through', 'Feb', '--dir', dir])
  expect(lines[0]).toBe('IMPORTED: Cycle 2026, Feb to Feb')
  expect(db.state.committed).toBe(true)
  expect(db.connect.mock.calls[0][1]).toMatchObject({ ssl: false })
})

test.each([
  [['--write', '--dir', dir], DEV, /--write needs --target/],
  [['--dir', dir], 'postgresql://postgres.prodref:x@aws-0-eu.pooler.supabase.com:5432/postgres', /production/],
  [['--target', 'otherref', '--dir', dir], DEV, /does not point at --target otherref/],
  [['--through', '11', '--dir', dir], DEV, /--through takes a month/],
  [['--through', 'Mar', '--dir', dir], DEV, /No workbook for Mar/],
  [[dir], DEV, /Unexpected argument/],
  [['--dir', dir], '', /SUPABASE_DB_URL is not set/],
])('refused before connecting: %j', async (argv, url, message) => {
  vi.stubEnv('SUPABASE_DB_URL', url)
  await expect(runImport(argv)).rejects.toThrow(message)
  expect(db.connect).not.toHaveBeenCalled()
})

test('the group is found by name, exactly once', async () => {
  groups = []
  await expect(runImport(['--dir', dir])).rejects.toThrow(/No "Premium Village Banking" group/)
  groups = [{ id: GROUP }, { id: 'other' }]
  await expect(runImport(['--dir', dir])).rejects.toThrow(/2 groups are named "Premium Village Banking"/)
  expect(db.state.calls.some((c) => c.text.includes('import_history'))).toBe(false)
  expect(db.state.ended).toBe(2)
})

test('ledger:check prints counts only, writes member detail to its file, and fails on anything unexplained', async () => {
  const report = {
    cycle_id: 'c1',
    periods: [{ label: 'Feb 2026', checked: true, diff: [{ short_name: 'Ann', field: 'savings', difference: 5, reason_code: 'unexplained' }] }],
  }
  db.state.respond = (text) => (text.includes('from groups') ? groups : text.includes('group_statements') ? [] : [{ report }])
  const out = join(dir, 'private', 'ledger-check.json')
  const { lines, code } = await check(['--target', 'devref'], out)
  expect(code).toBe(1)
  expect(lines).toEqual([
    'Feb 2026: 1 differences (unexplained 1)',
    `Member-level detail: ${out} (git-ignored; keep it on this machine)`,
    '1 unexplained difference(s).',
    'RECONCILIATION',
    '  No closed month yet: nothing to reconcile.',
  ])
  expect(lines.join('\n')).not.toMatch(/Ann/)
  expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual(report)
  expect(db.state.calls.find((c) => c.text.includes('check_cycle')).values).toContain(GROUP)
})

test('ledger:check takes --target only, and needs Cycle 2026 to exist', async () => {
  await expect(check(['--write'])).rejects.toThrow('Unknown option --write. Valid options: --target')
  await expect(check(['--through', 'Sep'])).rejects.toThrow(/Unknown option --through/)
  expect(db.connect).not.toHaveBeenCalled()
  db.state.respond = (text) => (text.includes('from groups') ? groups : [])
  const out = join(dir, 'none', 'ledger-check.json')
  await expect(check([], out)).rejects.toThrow(/No Cycle 2026/)
  expect(existsSync(out)).toBe(false)
})

const GS = { label: 'Sep 2026', idle_cash: '1000.25', fee_pot_balance: '250.00', meeting_pot_balance: '40.50', month_index: 8 }

test('reconcileLines: totals the wallets, and says whether the pots reconcile', () => {
  const ok = reconcileLines(GS, '290.50')
  expect(ok.mismatch).toBe(false)
  expect(ok.lines).toEqual([
    'RECONCILIATION (Sep 2026)',
    '  Money the group should be holding in its wallets (idle cash + fee pot + meeting pot): K 1,290.75',
    '  Compare with the real Airtel + MTN balances.',
    '  Pots reconcile with the group statement.',
  ])
  const bad = reconcileLines(GS, '300.00')
  expect(bad.mismatch).toBe(true)
  expect(bad.lines.at(-1)).toBe('  WARNING: pots differ by K 9.50 (entries minus group statement).')
  expect(reconcileLines(GS, 280).lines.at(-1)).toMatch(/pots differ by K -10\.50/)
  expect(reconcileLines(undefined, undefined).mismatch).toBe(false)
})

test('ledger:check reconciles read-only from the latest closed month, and exits 1 only when the pots differ', async () => {
  const report = { cycle_id: 'c1', periods: [{ label: 'Sep 2026', checked: true, diff: [] }] }
  const run = async (pots) => {
    db.state.calls.length = 0
    db.state.respond = (text) =>
      text.includes('from groups') ? groups : text.includes('from group_statements') ? [GS] : text.includes('private.ledger_lines') ? [{ pots }] : [{ report }]
    return check([], join(dir, 'private', 'rec.json'))
  }
  const ok = await run('290.50')
  expect(ok.code).toBe(0)
  expect(ok.lines).toContain('  Pots reconcile with the group statement.')
  expect(db.state.calls.map((c) => c.text).join('\n')).not.toMatch(/\b(insert|update|delete)\b/i)
  const bad = await run('0')
  expect(bad.code).toBe(1)
  expect(bad.lines.at(-1)).toMatch(/^ {2}WARNING: pots differ by K -290\.50/)
})
