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
  J: 'Interest on loan', K: 'Excess', L: 'fee spent', M: 'Loan Repayment', O: 'Minimum amount payable', P: 'Membership fee',
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

// Dan has nothing but zero-result formulas (=B1*0): exceljs drops `result` from those when it reads a file back.
const zero = { formula: 'B1*0', result: 0 }
const danFeb = { A: 4, B: 'Dan', D: zero, I: zero, J: zero, L: zero, N: zero }
const danMar = { A: 4, B: 'Dan', D: zero, E: zero, M: zero, O: zero }

async function build(tweak = () => {}, { dan = false } = {}) {
  const wb = new ExcelJS.Workbook()
  const febGroup = [['Excess Amount', 1000], ['Interest on excess', 100]]
  const feb = dan ? [...febRows, danFeb] : febRows
  addSheet(wb, 'Feb 1', FEB, feb, febGroup)
  addSheet(wb, 'Feb 2', FEB2, feb.map((r, i) => ({ ...r, O: received[i] ?? zero })), febGroup)
  addSheet(wb, 'Mar 1', MAR, dan ? [...marRows, danMar] : marRows,
    [['Opening balance', 3075], ['Total funds', 3825], ['Excess Amount', 3215], ['Interest on excess', 321.5]])
  const interest = wb.addWorksheet('Interest ')
  interest.getCell('B2').value = 'Name'
  interest.getCell('D2').value = 'Feb'
  interest.getCell('E2').value = 'Mar'
  ;[['Ann', 3000, 3000], ['ben', 500, 1000], [' Cid Gamma ', 500, 750], ...(dan ? [['Dan', zero, zero]] : [])].forEach(([name, feb, mar], i) => {
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
    R: 'Membership fee',
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

test('"through" must be a whole month from 1 to 10, as the ledger takes', async () => {
  const wb = await build()
  for (const bad of [0, 11, 12, 1.5, 'Mar', undefined]) expect(() => parseWorkbook(wb, bad)).toThrow(/through/)
})

test('formulas that work out to 0 are read as 0 after a round trip (exceljs drops their result)', async () => {
  const wb = await build((w) => {
    // The group block's last value, on the Mar statement (4 members: totals row 7, labels in rows 9 to 12).
    w.getWorksheet('Mar 1').getCell('D12').value = { formula: 'D7*0', result: 0 }
  }, { dan: true })
  // Precondition: exceljs really does hand back the formula without a result.
  expect(wb.getWorksheet('Feb 1').getCell('I6').value).toEqual({ formula: 'B1*0' })
  const [feb, mar] = parseWorkbook(wb, 2).months
  expect(feb.rows[3]).toMatchObject({ name: 'Dan', saving: 0, cum_savings: 0, interest: 0, excess: 0, total: 0, minimum: 0, received: 0, loans: [] })
  expect(mar.rows[3]).toMatchObject({ name: 'Dan', cum_savings: 0, total: 0, minimum: 0 })
  expect(mar.group).toEqual({ opening_cash: 3075, idle_cash: 3215, excess_billed: 0 })
})

test('a formula with no stored result at all is still refused', () => {
  expect(() => num({ formula: 'A1*2', result: undefined })).toThrow(/no stored result/)
})

test('the reconciliation sheet of a month before the last must have the receipts column', async () => {
  const wb = await build((w) => { w.getWorksheet('Feb 2').getCell('O2').value = 'Variance 2' })
  expect(() => parseWorkbook(wb, 2)).toThrow(/Feb 2: no "received" column \(headers found: .*Variance 2/)
})

test.each([
  ['transaction fee', 'Feb 2', 'E2', 'txn_fee'],
  ['membership fee', 'Feb 2', 'F2', 'membership'],
  ['fee spent', 'Mar 1', 'L2', 'fee_spent'],
  ['loan repayment before April', 'Mar 1', 'M2', 'repayment'],
])('every statement needs its %s column', async (_what, sheet, cell, key) => {
  const wb = await build((w) => { w.getWorksheet(sheet).getCell(cell).value = 'Other' })
  expect(() => parseWorkbook(wb, 2)).toThrow(new RegExp(`${sheet}: no "${key}" column \\(headers found: `))
})

test('from April the total payable column is required (no fallback to the repayment subtotal), and penalties April to July', () => {
  const sheet = (name, drop) => {
    const ws = new ExcelJS.Workbook().addWorksheet(name)
    const headers = {
      B: 'Name', D: 'Savings', F: 'Transaction fee', G: 'Membership fee', I: 'Loan', J: 'Interest on loan', K: 'Excess', L: 'fee spent',
      M: 'Loan Repayment', N: 'Penalties', O: 'Total amount payable', P: 'Minimum amount payable',
    }
    delete headers[drop]
    for (const [col, label] of Object.entries(headers)) ws.getCell(`${col}2`).value = label
    ws.getCell('B3').value = 'Dee'
    return ws
  }
  expect(() => readSheet(sheet('Apr 1', 'O'))).toThrow(/Apr 1: no "total" column \(headers found: /)
  expect(() => readSheet(sheet('Jul 1', 'N'))).toThrow(/Jul 1: no "penalty" column/)
  expect(readSheet(sheet('Aug 1', 'N')).rows[0].penalty).toBe(0)
})

test('a blank name inside the members must not cut the rest off', async () => {
  const wb = await build((w) => { w.getWorksheet('Mar 1').getCell('B4').value = null })
  expect(() => parseWorkbook(wb, 2)).toThrow(/Mar 1, row 5: "Cid Gamma" looks like a member but follows the blank name in row 4/)
})

test('an Interest-sheet member with savings in a month but no row on that statement is an error', async () => {
  const wb = await build((w) => { w.getWorksheet('Feb 2').getCell('B4').value = 'bob' })
  expect(() => parseWorkbook(wb, 2)).toThrow(/"ben" holds 500 for Feb \(row 4\) but is not on the Feb statement/)
})

test('the Interest sheet reports everything wrong at once', async () => {
  const wb = await build((w) => {
    const ws = w.getWorksheet('Interest ')
    ws.getCell('D3').value = 1
    ws.getCell('B4').value = 'zed'
    ws.getCell('E2').value = 'Total'
  })
  const message = await Promise.resolve().then(() => { try { parseWorkbook(wb, 2) } catch (e) { return e.message } return '' })
  expect(message).toMatch(/no column for Mar \(headers found: Name \| Feb \| Total\)/)
  expect(message).toMatch(/"zed" is on no statement/)
  expect(message).toMatch(/no row for "ben"/)
  expect(message).toMatch(/disagrees with the Feb statement.*"ann": 1, statement 3000/)
})

test('a negative loan is refused; a zero loan is none', () => {
  expect(() => loanParts(-100)).toThrow(/negative loan/)
  expect(loanParts(0)).toEqual([])
  expect(() => readSheet(sheetWith((ws) => { ws.getCell('I3').value = -100 }))).toThrow(/Mar 1, row 3, column I \("Loan"\).*negative loan/)
})

test('loan formulas: terms must add up to the result; anything that cannot be split safely is refused', () => {
  expect(loanParts({ formula: '1000', result: 1000 })).toEqual([1000])
  expect(loanParts({ formula: 'H4*2', result: 600 })).toEqual([600])
  expect(loanParts({ formula: '1000.5+20', result: 1020.5 })).toEqual([1000.5, 20])
  expect(() => loanParts({ formula: '4100+900+2600', result: 7000 })).toThrow(/adds up to 7600 but the cell shows 7000/)
  for (const formula of ['.+5', '+4100+900', '4100+900-200', 'SUM(4100,900)', 'SUM(H4:H6)', '4100*2', '(4100+900)']) {
    expect(() => loanParts({ formula, result: 5000 })).toThrow(/unsupported loan formula/)
  }
})

test('two header cells for one column are refused', () => {
  const ws = sheetWith((w) => { w.getCell('Q2').value = 'Excess' })
  expect(() => readSheet(ws)).toThrow(/Mar 1: more than one "excess" column \(K "Excess", Q "Excess"\)/)
})

test('a group-block label with text or an error beside it is an error, not a skip', () => {
  const add = (value) => sheetWith((ws) => {
    ws.getCell('C6').value = 'Opening balance'
    ws.getCell('D6').value = value
  })
  expect(readSheet(add(3075)).group.opening_cash).toBe(3075)
  expect(() => readSheet(add('n/a'))).toThrow(/Mar 1, row 6, column D \("Opening balance"\).*"n\/a"/)
  expect(() => readSheet(add({ error: '#REF!' }))).toThrow(/#REF!/)
})

test('text numbers are plain decimals only; float dust below an ngwee is zero, not negative', () => {
  for (const bad of ['0x10', '1e3', '1,200', 'Infinity', '--1']) expect(() => num(bad)).toThrow()
  expect(num('.5')).toBe(0.5)
  expect(num('-3.25')).toBe(-3.25)
  const { rows } = readSheet(sheetWith((ws) => { ws.getCell('D3').value = -1e-12 }))
  expect(rows[0].saving).toBe(0)
  expect(() => readSheet(sheetWith((ws) => { ws.getCell('D3').value = -0.01 }))).toThrow(/negative/)
})

test('the last month receipts go through as typed: SQL reports them and the first app month enters them', async () => {
  const wb = await build((w) => {
    addSheet(w, 'Mar 2', { ...MAR, Q: 'Amount received' }, marRows.map((r, i) => ({ ...r, Q: [10, 0, 20][i] })),
      [['Opening balance', 3075], ['Total funds', 3825], ['Excess Amount', 3215], ['Interest on excess', 321.5]])
  })
  const { months } = parseWorkbook(wb, 2)
  expect(months[1].rows.map((r) => r.received)).toEqual([10, 0, 20])
  expect(months[0].rows.map((r) => r.received)).toEqual([75, 2000, 0])
})

// pickWorkbook: the cycle runs Feb 2026 to Jan 2027
test('pickWorkbook respects the year, skips lock files, and refuses ties', () => {
  const files = ['Premium VB March 2026.xlsx', 'Premium VB March 2025.xlsx', '~$Premium VB March 2026.xlsx', 'Premium VB Jan 2027.xlsx',
    'Premium VB Sept 2026.xlsx', 'Premium VB Mar 2026 copy.txt']
  expect(pickWorkbook(files, 'Mar')).toEqual({ file: 'Premium VB March 2026.xlsx', through: 2 })
  expect(pickWorkbook(files, 'Jan')).toEqual({ file: 'Premium VB Jan 2027.xlsx', through: 12 })
  expect(pickWorkbook(files, 'Sep')).toEqual({ file: 'Premium VB Sept 2026.xlsx', through: 8 })
  expect(pickWorkbook(files)).toEqual({ file: 'Premium VB Jan 2027.xlsx', through: 12 })
  expect(() => pickWorkbook(['Premium VB Jan 2026.xlsx'], 'Jan')).toThrow(/No workbook for Jan.*Premium VB Jan 2026.xlsx/)
  expect(() => pickWorkbook(['Premium VB March.xlsx'], 'Mar')).toThrow(/No workbook for Mar.*no year/)
  expect(() => pickWorkbook(['Premium VB Mar 2026.xlsx', 'Premium VB March 2026 (2).xlsx'], 'Mar'))
    .toThrow(/More than one workbook for Mar: Premium VB Mar 2026.xlsx, Premium VB March 2026 \(2\).xlsx/)
  // May is not Mar or March, and a name with two months in it is not guessed at
  expect(pickWorkbook(['Premium VB Mar 2026.xlsx', 'Premium VB May 2026.xlsx'], 'May').through).toBe(4)
  expect(() => pickWorkbook(['Premium VB March and May 2026.xlsx'], 'May')).toThrow(/No workbook for May/)
})

test('a member whose name is blank on the last statement is not dropped: their savings on the Interest sheet give them away', async () => {
  const wb = await build((w) => { w.getWorksheet('Mar 1').getCell('B5').value = null })
  expect(() => parseWorkbook(wb, 2)).toThrow(/"cid gamma" holds 750 for Mar \(row 5\) but is not on the Mar statement/)
})

test('a label merged across columns is not read as its own value; the number beside it is', () => {
  const merged = sheetWith((ws) => {
    ws.getCell('C6').value = 'Opening balance'
    ws.mergeCells('C6:D6')
    ws.getCell('E6').value = 3075
  })
  expect(readSheet(merged).group.opening_cash).toBe(3075)
  // Genuine text beside a label is still an error
  const text = sheetWith((ws) => {
    ws.getCell('C6').value = 'Opening balance'
    ws.mergeCells('C6:D6')
    ws.getCell('E6').value = 'see note'
  })
  expect(() => readSheet(text)).toThrow(/Mar 1, row 6, column E \("Opening balance"\).*"see note"/)
})

test('merged cells read the same after a round trip through a file', async () => {
  const src = sheetWith((ws) => {
    ws.getCell('C6').value = 'Opening balance'
    ws.mergeCells('C6:D6')
    ws.getCell('E6').value = { formula: 'D2*0', result: 0 }
  })
  const back = new ExcelJS.Workbook()
  await back.xlsx.load(await src.workbook.xlsx.writeBuffer())
  expect(readSheet(back.getWorksheet('Mar 1')).group.opening_cash).toBe(0)
})

test('float dust is no loan, not a negative one', () => {
  expect(loanParts(-1e-12)).toEqual([])
  expect(loanParts(1e-12)).toEqual([])
  expect(() => loanParts(-0.01)).toThrow(/negative loan/)
})

// Shared formulas: the clone cells of a shared formula carry no formula text of their own in the file.
async function sharedSheet(secondResult) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Mar 1')
  for (const [col, label] of Object.entries(MAR)) ws.getCell(`${col}2`).value = label
  ws.getCell('B3').value = 'Ann'
  ws.getCell('B4').value = 'Ben'
  ws.getCell('D3').value = 100
  ws.getCell('D4').value = 100
  ws.getCell('J3').value = { formula: 'D3*0', result: 0, shareType: 'shared', ref: 'J3:J4' }
  ws.getCell('J4').value = secondResult === undefined ? { sharedFormula: 'J3' } : { sharedFormula: 'J3', result: secondResult }
  const back = new ExcelJS.Workbook()
  await back.xlsx.load(await wb.xlsx.writeBuffer())
  return back.getWorksheet('Mar 1')
}

test('a shared-formula clone with a zero result reads as 0; one with no result is refused', async () => {
  const ok = readSheet(await sharedSheet(0))
  expect(ok.rows.map((r) => r.interest)).toEqual([0, 0])
  const bad = await sharedSheet(undefined)
  expect(() => readSheet(bad)).toThrow(/Mar 1, row 4, column J \("Interest on loan"\).*no stored result/)
})

test('unreadable Interest cells are reported with the other mismatches, not thrown alone', async () => {
  const wb = await build((w) => {
    const ws = w.getWorksheet('Interest ')
    ws.getCell('D3').value = 'abc'
    ws.getCell('D4').value = { error: '#REF!' }
    ws.getCell('D5').value = 1
  })
  const message = (() => { try { parseWorkbook(wb, 2) } catch (e) { return e.message } return '' })()
  expect(message).toMatch(/Interest sheet: row 3, column D \("Feb"\).*"abc"/)
  expect(message).toMatch(/Interest sheet: row 4, column D \("Feb"\).*#REF!/)
  expect(message).toMatch(/disagrees with the Feb statement.*"cid gamma": 1/)
})
