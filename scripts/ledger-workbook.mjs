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
const REQUIRED = ['name', 'saving', 'txn_fee', 'membership', 'loan', 'interest', 'excess', 'fee_spent', 'minimum']
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

const lastSlash = (f) => f.slice(f.lastIndexOf('/') + 1)
// The calendar year of a cycle month: February to December fall in the cycle's first year, January in the next.
const cycleYear = (month) => Number(CYCLE_2026.starts_on.slice(0, 4)) + (month === 12 ? 1 : 0)

/**
 * The workbook for a month (the month and year named in its file name); the latest one when no month is given.
 * Lock files (~$...) and other years are ignored; two workbooks for one month are refused rather than guessed between.
 */
export function pickWorkbook(fileNames, through) {
  const seen = fileNames
    .map(lastSlash)
    .filter((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$'))
    .map((f) => {
      const months = new Set()
      for (const word of f.toLowerCase().match(/[a-z]+/g) ?? []) {
        try {
          months.add(monthIndex(word))
        } catch {
          // not a month word
        }
      }
      const year = /(?<!\d)(20\d\d)(?!\d)/.exec(f)?.[1]
      return { file: f, month: months.size === 1 ? [...months][0] : 0, year: year === undefined ? null : Number(year) }
    })
    .filter((b) => b.month > 0)
  const books = seen.filter((b) => b.year === cycleYear(b.month))
  const want = through === undefined ? Math.max(0, ...books.map((b) => b.month)) : typeof through === 'number' ? through : monthIndex(through)
  const hits = books.filter((b) => b.month === want)
  if (hits.length > 1) throw new Error(`More than one workbook for ${MONTHS[want - 1]}: ${hits.map((h) => h.file).join(', ')}`)
  if (hits.length === 0) {
    const other = seen.filter((b) => b.month === want).map((b) => b.file)
    throw new Error(`No workbook for ${want ? MONTHS[want - 1] : 'any month'} in the folder${other.length ? ` (other years or no year in the name: ${other.join(', ')})` : ''}`)
  }
  return { file: hits[0].file, through: want }
}

// exceljs hands back a formula cell as {formula, result?} and drops `result` when the cached result is 0 or '' (the
// cell's own .result still says 0), so formula cells are read through the cell, never from cell.value.
const isFormula = (v) => v !== null && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)
// exceljs also repeats a merged cell's value in every other cell of the merge; only the master cell holds it.
export const cellValue = (cell) => {
  if (cell.isMerged && cell.master !== cell) return null
  return cell.type === ExcelJS.ValueType.Formula ? { formula: cell.formula ?? cell.sharedFormula, result: cell.result } : cell.value
}
// A formula's cached result; a formula with no result stays an object, which num() refuses.
const raw = (v) => (isFormula(v) && v.result !== undefined ? v.result : v)
const errorOf = (r) => (r !== null && typeof r === 'object' && typeof r.error === 'string' ? r.error : null)
const DECIMAL = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/

/** A cell as a number: blank is 0; plain decimal text is its number; anything else throws (never a silent 0). */
export function num(v) {
  const r = raw(v)
  if (r === null || r === undefined || r === '') return 0
  const err = errorOf(r)
  if (err) throw new Error(`the cell holds the error ${err}`)
  if (isFormula(r)) throw new Error('the formula has no stored result (open and save the workbook in Excel)')
  const n = typeof r === 'string' ? (DECIMAL.test(r) ? Number(r) : NaN) : r
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

// ponytail: sums are rounded to the ngwee here so float noise never reaches the bundle; single cells go as typed (SQL rounds).
const ngwee = (n) => Math.round(n * 100) / 100

/**
 * A loan cell as a list of loans. Accepted, and nothing else:
 *  - a plain number or blank (one loan, or none for 0); a negative number throws;
 *  - a formula of two or more non-negative decimal numbers joined by `+` (=4100+900+2600): one loan per term, and the
 *    terms must add up to the cell's stored result;
 *  - a formula that uses cell references (=15%*H4, =SUM(H4:H6)): one loan of its stored result, unless it uses SUM(.
 * A formula of constants only that is not a plain `+` sum or a single number (=+4100+900, =4100+900-200, =SUM(1,2))
 * cannot be split safely and throws 'unsupported loan formula'.
 */
export function loanParts(v) {
  const value = num(v)
  // To the ngwee first, so float dust such as -1e-12 is no loan rather than a negative one.
  if (ngwee(value) < 0) throw new Error(`${value} is a negative loan`)
  const formula = isFormula(v) && typeof v.formula === 'string' ? v.formula : null
  if (formula !== null) {
    if (/^\s*\d+(\.\d+)?(\s*\+\s*\d+(\.\d+)?)+\s*$/.test(formula)) {
      const parts = formula.split('+').map(Number)
      if (Math.abs(parts.reduce((a, b) => a + b, 0) - value) > 0.005) {
        throw new Error(`the loan formula =${formula} adds up to ${parts.reduce((a, b) => a + b, 0)} but the cell shows ${value}`)
      }
      return parts.filter((n) => n > 0)
    }
    const constant = !/[A-Za-z]+\$?\d/.test(formula)
    if (/SUM\(/i.test(formula) || (constant && !/^\s*\d+(\.\d+)?\s*$/.test(formula))) {
      throw new Error(`unsupported loan formula =${formula}; type the loans as =a+b+c or enter plain amounts`)
    }
  }
  return ngwee(value) > 0 ? [value] : []
}

/** Run a cell reader and say where the cell is if it fails. */
function at(ws, r, c, label, read) {
  try {
    return read()
  } catch (e) {
    throw new Error(`${ws.name}, row ${r}, column ${ws.getColumn(c).letter}${label ? ` ("${label}")` : ''}: ${e.message}`, { cause: e })
  }
}

/** 'Mar 1' → {month: 2, part: 1}; null for any other sheet name. */
function sheetKind(name) {
  const m = /^([a-z]{3})[a-z]*\s*([12])$/i.exec(name.trim())
  if (!m) return null
  try {
    return { month: monthIndex(m[1]), part: Number(m[2]) }
  } catch {
    return null
  }
}

function header(ws) {
  for (let r = 1; r <= 4; r++) {
    const cols = new Map()
    ws.getRow(r).eachCell((cell, c) => {
      const t = text(cellValue(cell)).trim().replace(/\s+/g, ' ')
      if (t) cols.set(c, t)
    })
    if ([...cols.values()].some((t) => COLUMNS.saving.test(t))) return { row: r, cols }
  }
  throw new Error(`${ws.name}: no header row with a "Savings" column`)
}

const groupLabel = (row) => {
  for (let c = 1; c <= 3; c++) {
    const label = text(cellValue(row.getCell(c))).trim()
    const key = Object.keys(GROUP).find((k) => GROUP[k].test(label))
    if (key) return { key, c, label }
  }
  return null
}

/**
 * One month's sheet: a row per member, and the group block under the totals row. The sheet's name ('Mar 1', 'Feb 2')
 * says which columns it must have: the member's fees always, the total payable from April, penalties April to July,
 * and the receipts on every reconciliation ('... 2') sheet.
 */
export function readSheet(ws) {
  const kind = sheetKind(ws.name)
  const h = header(ws)
  const found = [...h.cols.values()].join(' | ')
  const col = {}
  for (const [key, re] of Object.entries(COLUMNS)) {
    const hits = [...h.cols].filter(([, t]) => re.test(t))
    if (hits.length > 1) throw new Error(`${ws.name}: more than one "${key}" column (${hits.map(([c, t]) => `${ws.getColumn(c).letter} "${t}"`).join(', ')})`)
    if (hits.length) col[key] = hits[0][0]
  }
  const need = [...REQUIRED]
  if (kind) {
    if (kind.month >= 3) need.push('total')
    else need.push('repayment')
    if (kind.month >= 3 && kind.month <= 6) need.push('penalty')
    if (kind.part === 2) need.push('received')
  }
  for (const key of need) if (!col[key]) throw new Error(`${ws.name}: no "${key}" column (headers found: ${found})`)
  if (!kind && !col.total && !col.repayment) throw new Error(`${ws.name}: no total payable column (headers found: ${found})`)
  const cell = (r, key) => (col[key] ? cellValue(ws.getRow(r).getCell(col[key])) : null)
  const amount = (r, key) =>
    at(ws, r, col[key], h.cols.get(col[key]), () => {
      const n = num(cell(r, key))
      // Rounded to the ngwee first, so float dust such as -1e-12 is zero, not a negative.
      const c = ngwee(n)
      if (c < 0 && UNSIGNED.includes(key)) throw new Error(`${n} is negative`)
      return c === 0 ? 0 : n
    })

  const rows = []
  let stop = h.row + 1
  for (; stop <= ws.rowCount; stop++) {
    const name = text(cell(stop, 'name')).trim()
    if (!name || /^total/i.test(name)) break
    const r = stop
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

  // A blank name must be the end of the members, not a gap: another member below it, before the group block, would be lost.
  if (!text(cell(stop, 'name')).trim() && stop <= ws.rowCount) {
    const data = ['saving', 'minimum', col.total ? 'total' : 'repayment']
    for (let r = stop + 1; r <= ws.rowCount; r++) {
      if (groupLabel(ws.getRow(r))) break
      const name = text(cell(r, 'name')).trim()
      if (name && !/^total/i.test(name) && data.some((k) => typeof raw(cell(r, k)) === 'number')) {
        throw new Error(`${ws.name}, row ${r}: "${name}" looks like a member but follows the blank name in row ${stop}; the members would be cut short`)
      }
    }
  }

  const group = { opening_cash: null, idle_cash: null, excess_billed: null }
  for (let r = stop; r <= Math.min(ws.rowCount, stop + 12); r++) {
    const row = ws.getRow(r)
    for (let c = 1; c <= 3; c++) {
      const label = text(cellValue(row.getCell(c))).trim()
      const key = Object.keys(GROUP).find((k) => GROUP[k].test(label))
      if (!key) continue
      // The value is the first non-blank cell to the right; text or an error there is a problem, not something to skip
      // (cells merged into the label read as blank, so a label merged across C:D is not mistaken for text).
      for (let v = c + 1; v <= c + 3; v++) {
        const value = cellValue(row.getCell(v))
        const r2 = raw(value)
        if (r2 === null || r2 === undefined || r2 === '') continue
        group[key] = at(ws, r, v, label, () => num(value))
        break
      }
    }
  }
  return { rows, group }
}

/**
 * The Interest sheet lists every member's cumulative savings by month: the only independent copy of those figures, so
 * the only guard against a column that shifted. It must be there, with a Name column, a column for every month and the
 * same members as the statements; every month before the last must agree with that month's statement. Everything
 * wrong is reported in one error.
 */
function checkInterestSheet(wb, months, through) {
  const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === 'interest')
  if (!ws) throw new Error('No "Interest" sheet in the workbook; it is the only check that the columns have not shifted')

  let head = null
  for (let r = 1; r <= 4 && !head; r++) {
    let nameCol = null
    const monthCols = new Map()
    const titles = []
    const dupes = []
    ws.getRow(r).eachCell((cell, c) => {
      const t = text(cellValue(cell)).trim()
      if (t) titles.push(t)
      if (/^name/i.test(t)) nameCol = c
      else if (t) {
        try {
          const m = monthIndex(t)
          if (monthCols.has(m)) dupes.push(MONTHS[m - 1])
          monthCols.set(m, c)
        } catch {
          // a header that is not a month
        }
      }
    })
    if (nameCol) head = { row: r, nameCol, monthCols, titles, dupes }
  }
  if (!head) throw new Error('Interest sheet: no "Name" header in rows 1 to 4')

  const listed = []
  for (let r = head.row + 1; r <= ws.rowCount; r++) {
    const name = text(cellValue(ws.getRow(r).getCell(head.nameCol))).trim().toLowerCase()
    if (!name || /^total/.test(name)) break
    listed.push({ row: r, name })
  }
  if (listed.length === 0) throw new Error('Interest sheet: no member rows under the header')

  const problems = head.dupes.map((m) => `Interest sheet: more than one column for ${m}`)
  for (let t = 1; t <= through; t++) {
    if (!head.monthCols.has(t)) problems.push(`Interest sheet: no column for ${MONTHS[t - 1]} (headers found: ${head.titles.join(' | ')})`)
  }
  const onStatements = new Set(months.flatMap((m) => m.rows.map((x) => x.name.toLowerCase())))
  const unknown = new Set()
  for (const { row, name } of listed) {
    if (!onStatements.has(name)) {
      unknown.add(name)
      problems.push(`Interest sheet: "${name}" is on no statement (row ${row}); check the names and columns`)
    }
  }
  for (const x of months[through - 1].rows) {
    if (!listed.some((l) => l.name === x.name.toLowerCase())) {
      problems.push(`Interest sheet: no row for "${x.name.toLowerCase()}", who is on the ${MONTHS[through - 1]} statement`)
    }
  }

  // Earlier months' columns hold cumulative savings and must agree with the statement. The latest month's column holds
  // that month's savings only, so it cannot be compared, but a member with savings there must be on that statement
  // (a blank name on the last statement would otherwise drop them without a word).
  for (let t = 1; t <= through; t++) {
    const c = head.monthCols.get(t)
    if (!c) continue
    for (const { row, name } of listed) {
      if (unknown.has(name)) continue
      const expected = months[t - 1].rows.find((x) => x.name.toLowerCase() === name)?.cum_savings
      if (expected !== undefined && t === through) continue
      let found
      try {
        found = at(ws, row, c, MONTHS[t - 1], () => num(cellValue(ws.getRow(row).getCell(c))))
      } catch (e) {
        problems.push(`Interest sheet: ${e.message.slice(ws.name.length + 2)}`)
        continue
      }
      if (expected === undefined) {
        if (Math.abs(found) > 0.005) problems.push(`Interest sheet: "${name}" holds ${found} for ${MONTHS[t - 1]} (row ${row}) but is not on the ${MONTHS[t - 1]} statement`)
      } else if (Math.abs(found - expected) > 0.01) {
        problems.push(`Interest sheet disagrees with the ${MONTHS[t - 1]} statement on cumulative savings (row ${row}, "${name}": ${found}, statement ${expected}); check the column layout`)
      }
    }
  }
  if (problems.length) throw new Error(problems.join('\n'))
}

/** Months 1..through (at most 10, as the ledger takes) from one workbook: each month from its reconciliation sheet when there is one, else its statement. */
export function parseWorkbook(wb, through) {
  if (!Number.isInteger(through) || through < 1 || through > 10) throw new Error('"through" must be a whole month from 1 to 10')
  const sheets = new Map()
  for (const ws of wb.worksheets) {
    const k = sheetKind(ws.name)
    if (k) sheets.set(`${k.month} ${k.part}`, ws)
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
        // The last month's receipts go through as they are: the import reports them, and the first app month enters them.
        return { ...r, cum_savings: cum }
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
