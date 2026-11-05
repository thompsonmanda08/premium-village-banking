// @vitest-environment node
// Synthetic figures only; postgres and the workbook reader are mocked, so nothing here reads data/ or a database.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, test, vi } from 'vitest'
import { figuresBundle, main, summaryLines } from './ledger-figures.mjs'

const db = vi.hoisted(() => {
  const state = { calls: [], respond: () => [] }
  const sql = async (strings, ...values) => {
    state.calls.push({ text: strings.join('?'), values })
    return state.respond(strings.join('?'))
  }
  sql.unsafe = async (text) => {
    state.calls.push({ text, values: [] })
    return []
  }
  sql.json = (x) => x
  sql.end = async () => {}
  return { state, connect: vi.fn(() => sql) }
})
vi.mock('postgres', () => ({ default: db.connect }))
vi.mock('./ledger-workbook.mjs', async (orig) => ({
  ...(await orig()),
  readBundle: async (_path, through) => ({
    through,
    months: [
      { month_index: 1, group: { opening_cash: null, idle_cash: 1, excess_billed: 1 }, rows: [{ name: 'Old', cum_savings: 1, excess: 1, total: 1, minimum: 1, saving: 1 }] },
      {
        month_index: 2,
        group: { opening_cash: 100, idle_cash: 90, excess_billed: 9 },
        rows: [{ name: 'Ann', cum_savings: 500, excess: 4.5, total: 1204.5, minimum: 400, saving: 250, loans: [1000], received: null }],
      },
    ],
  }),
}))

const LOCAL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const GROUP = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  db.state.calls = []
  vi.stubEnv('SUPABASE_DB_URL', LOCAL)
})

test('the bundle is the last month only, with the four member figures and the group block', () => {
  const b = figuresBundle({ months: [{ month_index: 1, group: {}, rows: [] }, { month_index: 2, group: { idle_cash: 9 }, rows: [{ name: 'Ann', cum_savings: 5, excess: 1, total: 2, minimum: 3, saving: 99, loans: [4] }] }] })
  expect(b).toEqual({ month_index: 2, group: { idle_cash: 9 }, rows: [{ name: 'Ann', cum_savings: 5, excess: 1, total: 2, minimum: 3 }] })
})

test('the summary prints counts only', () => {
  const s = { label: 'Oct 2026', status: 'open', members: 18, member_figures: 72, group_figures: 3 }
  expect(summaryLines(s, false)).toEqual(['DRY RUN (nothing written): workbook figures for Oct 2026 (open)', '  18 members, 72 member figures, 3 group figures'])
  expect(summaryLines(s, true)[0]).toBe('LOADED: workbook figures for Oct 2026 (open)')
})

const respond = (text) => (text.includes('from groups') ? [{ id: GROUP }] : [{ summary: { label: 'Oct 2026', status: 'open', members: 1, member_figures: 4, group_figures: 3 } }])

const dir = mkdtempSync(join(tmpdir(), 'ledger-figures-'))
writeFileSync(join(dir, 'Premium VB February 2026.xlsx'), '')   // only the name is read; the reader is mocked
afterAll(() => rmSync(dir, { recursive: true, force: true }))

test('a dry run rolls back, --write commits', async () => {
  db.state.respond = respond
  const dry = await main(['--target', 'local', '--dir', dir])
  expect(dry[1]).toMatch(/^DRY RUN/)
  expect(db.state.calls.map((c) => c.text)).toContain('rollback')
  expect(db.state.calls.map((c) => c.text)).not.toContain('commit')
  db.state.calls = []
  const wrote = await main(['--target', 'local', '--write', '--dir', dir])
  expect(wrote[1]).toMatch(/^LOADED/)
  expect(db.state.calls.map((c) => c.text)).toContain('commit')
})
