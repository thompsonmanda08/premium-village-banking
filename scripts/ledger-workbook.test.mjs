// @vitest-environment node
// The workbook here is synthetic: made-up members and amounts in the treasurer's layouts. Real workbooks never
// enter the repo (*.xlsx and data/ are git-ignored).
import ExcelJS from 'exceljs'
import { expect, test } from 'vitest'
import { loanParts, monthIndex, num, parseWorkbook, pickWorkbook, readSheet } from './ledger-workbook.mjs'

// February: statement and reconciliation (layout A). March: statement only (layout B).
const FEB = {
  A: 'S/N', B: 'Name', D: 'Savings', E: 'Transaction fee', F: 'Membership fee', G: 'Total sent', H: 'Loan',
  I: 'Interest on loan', J: 'Excess interest', K: 'Transaction fee spent', L: 'Loan Repayment',
  M: 'Interest Earned Cumulative', N: 'Minimum amount payable',
}
const FEB2 = { ...FEB, O: 'Amount received', P: 'Variance' }
const MAR = {
  A: 'S/N', B: 'Name', D: 'Savings', E: 'Cumm. Savings', F: 'Transaction fee', G: 'Total sent', H: 'Loan C/F', I: 'Loan',
  J: 'Interest on loan', K: 'Excess', L: 'fee spent', M: 'Loan Repayment', O: 'Minimum amount payable',
}
const febRows = [
  { A: 1, B: 'Ann', D: 3000, E: 10, F: 50, I: 0, J: 75, L: 75, N: 75 },
  { A: 2, B: 'ben', D: 500, F: 50, H: { formula: '1000+2000', result: 3000 }, I: { formula: '15%*H4', result: 450 }, J: 12.5, K: 20,
    L: 3462.5, N: 3462.5 },
  { A: 3, B: ' Cid Gamma ', D: 500, J: 12.5, L: 12.5, N: 12.5 },
]
const received = [75, 2000, 0]
const marRows = [
  { A: 1, B: 'Ann', D: 0, E: 3000, K: { formula: 'E3/E6*D11', result: 203.0526315789 }, M: 203.0526315789, O: 203.05 },
  { A: 2, B: 'ben', D: 500, E: 1000, H: 1462.5, K: 67.6842105263, M: 1530.1842105263, O: 800 },
  { A: 3, B: ' Cid Gamma ', D: 250, E: 750, H: 12.5, I: 600, J: 90, K: 50.7631578947, L: 10, M: 753.2631578947, O: 753.26 },
]

function addSheet(wb, name, headers, rows, group) {
  const ws = wb.addWorksheet(name)
  ws.getCell('A1').value = `Premium VB ${name}`
  for (const [col, label] of Object.entries(headers)) ws.getCell(`${col}2`).value = label
  rows.forEach((row, i) => {
    for (const [col, v] of Object.entries(row)) ws.getCell(`${col}${i + 3}`).value = v
  })
  const totals = rows.length + 3
  ws.getCell(`D${totals}`).value = { formula: `SUM(D3:D${totals - 1})`, result: 0 }
  group.forEach(([label, value], i) => {
    ws.getCell(`C${totals + 2 + i}`).value = label
    ws.getCell(`D${totals + 2 + i}`).value = { formula: `D${totals}`, result: value }
  })
}

async function build(tweak = () => {}) {
  const wb = new ExcelJS.Workbook()
  const febGroup = [['Excess Amount', 1000], ['Interest on excess', 100]]
  addSheet(wb, 'Feb 1', FEB, febRows, febGroup)
  addSheet(wb, 'Feb 2', FEB2, febRows.map((r, i) => ({ ...r, O: received[i] })), febGroup)
  addSheet(wb, 'Mar 1', MAR, marRows,
    [['Opening balance', 3075], ['Total funds', 3825], ['Excess Amount', 3215], ['Interest on excess', 321.5]])
  const interest = wb.addWorksheet('Interest ')
  interest.getCell('B2').value = 'Name'
  interest.getCell('D2').value = 'Feb'
  interest.getCell('E2').value = 'Mar'
  ;[['Ann', 3000, 3000], ['ben', 500, 1000], [' Cid Gamma ', 500, 750]].forEach(([name, feb, mar], i) => {
    interest.getCell(`B${i + 3}`).value = name
    interest.getCell(`D${i + 3}`).value = feb
    interest.getCell(`E${i + 3}`).value = mar
  })
  tweak(wb)
  // Round-trip through a real .xlsx buffer, so formula cells come back the way exceljs reads a treasurer's file.
  const back = new ExcelJS.Workbook()
  await back.xlsx.load(await wb.xlsx.writeBuffer())
  return back
}

test('reads statements, receipts and the group block into the import bundle', async () => {
  const bundle = parseWorkbook(await build(), 2)
  expect(bundle.through).toBe(2)
  expect(bundle.cycle).toEqual({ label: 'Cycle 2026', starts_on: '2026-02-15', ends_on: '2027-02-15', payout_on: '2027-02-06' })
  expect(bundle.deadlines['1']).toBe('2026-02-17')
  const [feb, mar] = bundle.months
  expect(feb.month_index).toBe(1)
  expect(feb.fee_spent).toBe(20)
  expect(feb.group).toEqual({ opening_cash: null, idle_cash: 1000, excess_billed: 100 })
  expect(feb.rows.map((r) => r.name)).toEqual(['Ann', 'ben', 'Cid Gamma'])
  expect(feb.rows[1]).toEqual({
    name: 'ben', saving: 500, cum_savings: 500, txn_fee: 0, membership: 50, loans: [1000, 2000], interest: 450, excess: 12.5,
    penalty: 0, fee_spent: 20, total: 3462.5, minimum: 3462.5, received: 2000,
  })
  expect(feb.rows[2].received).toBe(0)
  expect(mar.month_index).toBe(2)
  expect(mar.fee_spent).toBe(10)
  expect(mar.group).toEqual({ opening_cash: 3075, idle_cash: 3215, excess_billed: 321.5 })
  expect(mar.rows[0].excess).toBeCloseTo(203.0526315789, 9)
  expect(mar.rows[2]).toMatchObject({ cum_savings: 750, loans: [600], interest: 90, total: 753.2631578947, minimum: 753.26, received: null })
})

test('the bundle is JSON that private.import_history accepts: finite numbers, a list of rows per month', async () => {
  const bundle = JSON.parse(JSON.stringify(parseWorkbook(await build(), 2)))
  for (const m of bundle.months) {
    expect(Array.isArray(m.rows)).toBe(true)
    expect(m.rows.length).toBeGreaterThan(0)
    for (const r of m.rows) {
      for (const k of ['saving', 'txn_fee', 'membership', 'interest', 'excess', 'penalty', 'fee_spent', 'total', 'minimum']) {
        expect(typeof r[k]).toBe('number')
      }
      expect(Array.isArray(r.loans)).toBe(true)
    }
  }
})

test('the reconciliation sheet is required for every month but the last', async () => {
  const wb = await build((w) => w.removeWorksheet(w.getWorksheet('Feb 2').id))
  expect(() => parseWorkbook(wb, 2)).toThrow(/No "Feb 2" sheet/)
})

test('a column the month needs must be there', async () => {
  const wb = await build((w) => {
    w.getWorksheet('Mar 1').getCell('O2').value = 'Notes'
  })
  expect(() => parseWorkbook(wb, 2)).toThrow(/Mar 1: no "minimum" column/)
})

test('the Interest sheet cross-checks cumulative savings, so a shifted column is caught', async () => {
  const wb = await build((w) => {
    w.getWorksheet('Interest ').getCell('D3').value = 2999
  })
  expect(() => parseWorkbook(wb, 2)).toThrow(/Interest sheet disagrees with the Feb statement/)
})

// The Interest sheet is the only guard against shifted columns, so a missing or unrecognisable one stops the import.
test.each([
  ['the sheet is missing', (w) => w.removeWorksheet(w.getWorksheet('Interest ').id), /No "Interest" sheet/],
  ['the Name header is missing', (w) => { w.getWorksheet('Interest ').getCell('B2').value = 'Who' }, /Interest sheet: no "Name" header/],
  ['no month columns', (w) => {
    w.getWorksheet('Interest ').getCell('D2').value = 'a'
    w.getWorksheet('Interest ').getCell('E2').value = 'b'
  }, /Interest sheet: no column for Feb/],
  ['the latest month has no column', (w) => { w.getWorksheet('Interest ').getCell('E2').value = 'Total' }, /Interest sheet: no column for Mar/],
  ['a name on the sheet is on no statement', (w) => { w.getWorksheet('Interest ').getCell('B4').value = 'zed' },
    /Interest sheet: "zed" is on no statement/],
  ['a member is missing from the sheet', (w) => { w.getWorksheet('Interest ').getCell('B5').value = null },
    /Interest sheet: no row for "cid gamma"/],
  ['the sheet has no members', (w) => {
    for (const r of [3, 4, 5]) w.getWorksheet('Interest ').getCell(`B${r}`).value = null
  }, /Interest sheet: no member rows/],
])('the Interest sheet fails loudly when %s', async (_why, tweak, message) => {
  await expect(build(tweak).then((wb) => parseWorkbook(wb, 2))).rejects.toThrow(message)
})

test('the Interest sheet is found by its trimmed name in any case', async () => {
  const wb = await build((w) => { w.getWorksheet('Interest ').name = 'INTEREST' })
  expect(parseWorkbook(wb, 2).months).toHaveLength(2)
})

test('later layouts: the total payable column wins over the repayment subtotal, and penalties are read', async () => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Apr 2')
  const headers = {
    B: 'Name', D: 'Savings', E: 'Cumm. Savings', F: 'Transaction fee', I: 'Loan', J: 'Interest on loan', K: 'Excess', L: 'fee spent',
    M: 'Loan Repayment', N: 'Penalties', O: 'Total amount payable', P: 'Minimum amount payable', Q: 'Amount received (2)',
  }
  for (const [col, label] of Object.entries(headers)) ws.getCell(`${col}2`).value = label
  Object.entries({ B: 'Dee', D: 0, E: 250, K: 5, M: 105, N: 1350, O: 1455, P: 105, Q: 0 })
    .forEach(([col, v]) => { ws.getCell(`${col}3`).value = v })
  const { rows } = readSheet(ws)
  expect(rows[0]).toMatchObject({ name: 'Dee', penalty: 1350, total: 1455, minimum: 105, received: 0 })
})

test('loan cells typed as sums are several loans', () => {
  expect(loanParts({ formula: '4100+900+2600', result: 7600 })).toEqual([4100, 900, 2600])
  expect(loanParts({ formula: 'H4*2', result: 600 })).toEqual([600])
  expect(loanParts({ formula: '.+5', result: 5 })).toEqual([5])
  expect(loanParts(2500)).toEqual([2500])
  expect(loanParts(null)).toEqual([])
})

test('months and workbook names', () => {
  expect(monthIndex('Feb')).toBe(1)
  expect(monthIndex('october')).toBe(9)
  expect(monthIndex('Jan')).toBe(12)
  expect(monthIndex('Sept')).toBe(8)
  expect(() => monthIndex('Total')).toThrow(/Unknown month/)
  expect(() => monthIndex('Marginal')).toThrow(/Unknown month/)
  const files = ['Premium VB September 2026.xlsx', 'Premium VB may 2026.xlsx', 'Premium VB June 2026(2).xlsx', 'notes.txt']
  expect(pickWorkbook(files)).toEqual({ file: 'Premium VB September 2026.xlsx', through: 8 })
  expect(pickWorkbook(files, 'May')).toEqual({ file: 'Premium VB may 2026.xlsx', through: 4 })
  expect(() => pickWorkbook(files, 'Oct')).toThrow(/No workbook for Oct/)
})

// A cell that is not a usable number stops the import and says where it is; it is never read as 0.
test('cell readers: numeric text is a number, anything else that is not a finite number throws', () => {
  expect(num(' 1500.5 ')).toBe(1500.5)
  expect(num({ formula: 'A1', result: '20' })).toBe(20)
  expect(num(null)).toBe(0)
  expect(num('')).toBe(0)
  for (const bad of ['abc', '1,200', 'K1500', NaN, Infinity, true, new Date(), { formula: 'A1' }, { error: '#REF!' },
    { formula: 'A1', result: { error: '#DIV/0!' } }, 1e10]) {
    expect(() => num(bad)).toThrow()
  }
})

function sheetWith(tweak) {
  const ws = new ExcelJS.Workbook().addWorksheet('Mar 1')
  for (const [col, label] of Object.entries(MAR)) ws.getCell(`${col}2`).value = label
  Object.entries({ B: 'Ann', D: 100, E: 100, K: 5, M: 105, O: 105 }).forEach(([col, v]) => { ws.getCell(`${col}3`).value = v })
  tweak(ws)
  return ws
}

test.each([
  ['text in a number column', (ws) => { ws.getCell('D3').value = 'abc' }, /Mar 1, row 3, column D \("Savings"\)/],
  ['a formula with no cached result', (ws) => { ws.getCell('M3').value = { formula: 'D3+1' } }, /Mar 1, row 3, column M \("Loan Repayment"\)/],
  ['an error value', (ws) => { ws.getCell('K3').value = { error: '#REF!' } }, /Mar 1, row 3, column K \("Excess"\).*#REF!/],
  ['a loan that is text', (ws) => { ws.getCell('I3').value = 'n/a' }, /Mar 1, row 3, column I \("Loan"\)/],
  ['a negative saving', (ws) => { ws.getCell('D3').value = -5 }, /Mar 1, row 3, column D \("Savings"\).*negative/],
])('a bad cell names its sheet, row and column: %s', (_why, tweak, message) => {
  expect(() => readSheet(sheetWith(tweak))).toThrow(message)
})

test('numeric text in a cell is read as the number', () => {
  const { rows } = readSheet(sheetWith((ws) => { ws.getCell('D3').value = '250' }))
  expect(rows[0].saving).toBe(250)
})

test('a statement with no member rows is refused', () => {
  expect(() => readSheet(sheetWith((ws) => { ws.getCell('B3').value = null }))).toThrow(/Mar 1: no member rows/)
})

test('"through" must be a whole month from 1 to 12', async () => {
  const wb = await build()
  for (const bad of [0, 13, 1.5, 'Mar', undefined]) expect(() => parseWorkbook(wb, bad)).toThrow(/through/)
})
