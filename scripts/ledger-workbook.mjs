// Reads a treasurer's workbook (exceljs) into the bundle private.import_history takes. Cells only: every amount the
// ledger stores is worked out in SQL. Column letters move between months, so columns are found by header text
// (the layouts are described in data/private/workbook-model.md, which is git-ignored).
import ExcelJS from 'exceljs'

export const MONTHS = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']
const FULL = ['february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'january']

export const CYCLE_2026 = { label: 'Cycle 2026', starts_on: '2026-02-15', ends_on: '2027-02-15', payout_on: '2027-02-06' }
// Deadlines announced in the group chat (cycle month → date); every other month closes on the 7th.
export const DEADLINES_2026 = { 1: '2026-02-17', 4: '2026-05-08', 5: '2026-06-08', 6: '2026-07-10', 7: '2026-08-09' }

const COLUMNS = {
  name: /^name/i,
  saving: /^savings$/i,
  cum_savings: /^cumm?\.? ?savings$/i,
  txn_fee: /^transaction fee$/i,
  membership: /^membership/i,
  loan: /^loan$/i,
  interest: /^interest on loan$/i,
  excess: /^excess( interest)?$/i,
  fee_spent: /fee spent$/i,
  penalty: /^penalt/i,
  total: /^total amount payable$/i,
  repayment: /^loan repayment$/i,
  minimum: /^minimum/i,
  received: /^amount received/i,
}
const REQUIRED = ['name', 'saving', 'loan', 'interest', 'excess', 'minimum']
// The ledger refuses a negative here (private.import_history); only the workbook's own totals may be negative.
const UNSIGNED = ['saving', 'txn_fee', 'membership', 'interest', 'excess', 'penalty', 'fee_spent', 'received']
const GROUP = { opening_cash: /^opening/i, idle_cash: /^excess amount$/i, excess_billed: /^interest on excess$/i }

/** 'Oct', 'october', 'OCT' → 9: the cycle month, Feb 2026 being 1 and Jan 2027 being 12. */
export function monthIndex(name) {
  const s = String(name).trim().toLowerCase()
  const i = s === 'sept' ? 7 : FULL.findIndex((m) => s.length >= 3 && m.startsWith(s))
  if (i < 0) throw new Error(`Unknown month "${name}"`)
  return i + 1
}

/** The workbook for a month (by the month named in its file name); the latest one when no month is given. */
export function pickWorkbook(fileNames, through) {
  const books = fileNames
    .filter((f) => /\.xlsx$/i.test(f))
    .map((f) => ({ file: f, month: FULL.findIndex((m) => f.toLowerCase().includes(m)) + 1 }))
    .filter((b) => b.month > 0)
  const want = through === undefined ? Math.max(0, ...books.map((b) => b.month)) : monthIndex(through)
  const hits = books.filter((b) => b.month === want).sort((a, b) => a.file.localeCompare(b.file))
  const hit = hits[hits.length - 1]
  if (!hit) throw new Error(`No workbook for ${through ?? 'any month'} in the folder`)
  return { file: hit.file, through: want }
}

// A formula cell is {formula, result}; an error cell is {error}. Anything else is the value itself.
const raw = (v) => (v !== null && typeof v === 'object' && 'result' in v ? v.result : v)
const errorOf = (r) => (r !== null && typeof r === 'object' && typeof r.error === 'string' ? r.error : null)

/** A cell as a number: blank is 0; numeric text is its number; anything else throws (never a silent 0). */
export function num(v) {
  const r = raw(v)
  if (r === null || r === undefined || r === '') return 0
  const err = errorOf(r)
  if (err) throw new Error(`the cell holds the error ${err}`)
  if (typeof r === 'object' && 'formula' in r) throw new Error('the formula has no stored result (open and save the workbook in Excel)')
  const n = typeof r === 'string' && r.trim() !== '' ? Number(r) : r
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error(`a number was expected, found ${typeof r === 'string' ? `"${r.slice(0, 20)}"` : typeof r}`)
  }
  if (Math.abs(n) >= 1e10) throw new Error(`${n} is not a plausible amount`)
  return n
}

export function text(v) {
  const r = raw(v)
  if (r !== null && typeof r === 'object') {
    if (Array.isArray(r.richText)) return r.richText.map((t) => t.text).join('')
    return typeof r.text === 'string' ? r.text : ''
  }
  return r === null || r === undefined ? '' : String(r)
}

/** A loan cell typed as `=4100+900+2600` is three loans; any other cell is one loan of its value. */
export function loanParts(v) {
  if (v !== null && typeof v === 'object' && typeof v.formula === 'string' && /^\s*\d+(\.\d+)?(\s*\+\s*\d+(\.\d+)?)+\s*$/.test(v.formula)) {
    return v.formula.split('+').map(Number).filter((n) => n > 0)
  }
  const n = num(v)
  return n > 0 ? [n] : []
}

// ponytail: sums are rounded to the ngwee here so float noise never reaches the bundle; single cells go as typed (SQL rounds).
const ngwee = (n) => Math.round(n * 100) / 100

/** Run a cell reader and say where the cell is if it fails. */
function at(ws, r, c, label, read) {
  try {
    return read()
  } catch (e) {
    throw new Error(`${ws.name}, row ${r}, column ${ws.getColumn(c).letter}${label ? ` ("${label}")` : ''}: ${e.message}`, { cause: e })
  }
}

function header(ws) {
  for (let r = 1; r <= 4; r++) {
    const cols = new Map()
    ws.getRow(r).eachCell((cell, c) => {
      const t = text(cell.value).trim().replace(/\s+/g, ' ')
      if (t) cols.set(c, t)
    })
    if ([...cols.values()].some((t) => COLUMNS.saving.test(t))) return { row: r, cols }
  }
  throw new Error(`${ws.name}: no header row with a "Savings" column`)
}

/** One month's sheet: a row per member, and the group block under the totals row. */
export function readSheet(ws) {
  const h = header(ws)
  const col = {}
  for (const [key, re] of Object.entries(COLUMNS)) {
    for (const [c, t] of h.cols) {
      if (re.test(t)) {
        col[key] = c
        break
      }
    }
  }
  for (const key of REQUIRED) if (!col[key]) throw new Error(`${ws.name}: no "${key}" column`)
  if (!col.total && !col.repayment) throw new Error(`${ws.name}: no total payable column`)
  const cell = (r, key) => (col[key] ? ws.getRow(r).getCell(col[key]).value : null)
  const amount = (r, key) =>
    at(ws, r, col[key], h.cols.get(col[key]), () => {
      const n = num(cell(r, key))
      if (n < 0 && UNSIGNED.includes(key)) throw new Error(`${n} is negative`)
      return n
    })

  const rows = []
  for (let r = h.row + 1; r <= ws.rowCount; r++) {
    const name = text(cell(r, 'name')).trim()
    if (!name || /^total/i.test(name)) break
    rows.push({
      name,
      saving: amount(r, 'saving'),
      cum_savings: col.cum_savings ? amount(r, 'cum_savings') : null,
      txn_fee: amount(r, 'txn_fee'),
      membership: amount(r, 'membership'),
      loans: at(ws, r, col.loan, h.cols.get(col.loan), () => loanParts(cell(r, 'loan'))),
      interest: amount(r, 'interest'),
      excess: amount(r, 'excess'),
      penalty: amount(r, 'penalty'),
      fee_spent: amount(r, 'fee_spent'),
      total: amount(r, col.total ? 'total' : 'repayment'),
      minimum: amount(r, 'minimum'),
      received: col.received ? amount(r, 'received') : null,
    })
  }
  if (rows.length === 0) throw new Error(`${ws.name}: no member rows under the header`)

  const group = { opening_cash: null, idle_cash: null, excess_billed: null }
  const first = h.row + rows.length + 1
  for (let r = first; r <= Math.min(ws.rowCount, first + 12); r++) {
    const row = ws.getRow(r)
    for (let c = 1; c <= 3; c++) {
      const label = text(row.getCell(c).value).trim()
      const key = Object.keys(GROUP).find((k) => GROUP[k].test(label))
      if (!key) continue
      for (let v = c + 1; v <= c + 3; v++) {
        const value = raw(row.getCell(v).value)
        if (typeof value === 'number' && Number.isFinite(value)) {
          group[key] = value
          break
        }
      }
    }
  }
  return { rows, group }
}

/**
 * The Interest sheet lists every member's cumulative savings by month: the only independent copy of those figures, so
 * the only guard against a column that shifted. It must be there, with a Name column, a column for every month and the
 * same members as the statements; every month before the last must agree with that month's statement.
 */
function checkInterestSheet(wb, months, through) {
  const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === 'interest')
  if (!ws) throw new Error('No "Interest" sheet in the workbook; it is the only check that the columns have not shifted')

  let head = null
  for (let r = 1; r <= 4 && !head; r++) {
    let nameCol = null
    const monthCols = new Map()
    ws.getRow(r).eachCell((cell, c) => {
      const t = text(cell.value).trim()
      if (/^name/i.test(t)) nameCol = c
      else if (t) {
        try {
          monthCols.set(monthIndex(t), c)
        } catch {
          // a header that is not a month
        }
      }
    })
    if (nameCol) head = { row: r, nameCol, monthCols }
  }
  if (!head) throw new Error('Interest sheet: no "Name" header in rows 1 to 4')
  for (let t = 1; t <= through; t++) {
    if (!head.monthCols.has(t)) throw new Error(`Interest sheet: no column for ${MONTHS[t - 1]}`)
  }

  const listed = []
  for (let r = head.row + 1; r <= ws.rowCount; r++) {
    const name = text(ws.getRow(r).getCell(head.nameCol).value).trim().toLowerCase()
    if (!name || /^total/.test(name)) break
    listed.push({ row: r, name })
  }
  if (listed.length === 0) throw new Error('Interest sheet: no member rows under the header')

  const onStatements = new Set(months.flatMap((m) => m.rows.map((x) => x.name.toLowerCase())))
  const unknown = listed.find((x) => !onStatements.has(x.name))
  if (unknown) throw new Error(`Interest sheet: "${unknown.name}" is on no statement (row ${unknown.row}); check the names and columns`)
  const missing = months[through - 1].rows.find((x) => !listed.some((l) => l.name === x.name.toLowerCase()))
  if (missing) throw new Error(`Interest sheet: no row for "${missing.name.toLowerCase()}", who is on the ${MONTHS[through - 1]} statement`)

  // The latest month's column holds that month's savings, not the running total: compare earlier months only.
  for (let t = 1; t < through; t++) {
    const c = head.monthCols.get(t)
    for (const { row, name } of listed) {
      const expected = months[t - 1].rows.find((x) => x.name.toLowerCase() === name)?.cum_savings
      if (expected === undefined) continue
      const found = at(ws, row, c, MONTHS[t - 1], () => num(ws.getRow(row).getCell(c).value))
      if (Math.abs(found - expected) > 0.01) {
        throw new Error(`Interest sheet disagrees with the ${MONTHS[t - 1]} statement on cumulative savings (row ${row}); check the column layout`)
      }
    }
  }
}

/** Months 1..through from one workbook: each month from its reconciliation sheet when there is one, else its statement. */
export function parseWorkbook(wb, through) {
  if (!Number.isInteger(through) || through < 1 || through > 12) throw new Error('"through" must be a whole month from 1 to 12')
  const sheets = new Map()
  for (const ws of wb.worksheets) {
    const m = /^([a-z]{3})[a-z]*\s*([12])$/i.exec(ws.name.trim())
    if (!m) continue
    try {
      sheets.set(`${monthIndex(m[1])} ${m[2]}`, ws)
    } catch {
      // not a month sheet
    }
  }
  const months = []
  const running = new Map()
  for (let t = 1; t <= through; t++) {
    const label = MONTHS[t - 1]
    const statement = sheets.get(`${t} 1`)
    const reconciliation = sheets.get(`${t} 2`)
    if (!statement) throw new Error(`No "${label} 1" sheet in the workbook`)
    if (t < through && !reconciliation) throw new Error(`No "${label} 2" sheet: ${label}'s receipts would be lost`)
    const { rows, group } = readSheet(reconciliation ?? statement)
    months.push({
      month_index: t,
      fee_spent: ngwee(rows.reduce((sum, r) => sum + r.fee_spent, 0)),
      group,
      rows: rows.map((r) => {
        const key = r.name.toLowerCase()
        const cum = r.cum_savings ?? ngwee((running.get(key) ?? 0) + r.saving)
        running.set(key, cum)
        // Receipts against the last month arrive in the app's first month and are entered there.
        return { ...r, cum_savings: cum, received: t < through ? r.received : null }
      }),
    })
  }
  checkInterestSheet(wb, months, through)
  return { cycle: CYCLE_2026, through, deadlines: DEADLINES_2026, months }
}

export async function readBundle(path, through) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path)
  return parseWorkbook(wb, through)
}
