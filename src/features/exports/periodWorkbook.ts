import { sumKwacha } from '@/features/ledger/money';
import { loadExcel, type Workbook } from './loadExcel';
import { standpointOf, type MonthRow } from './standpoint';
import { dayCell, dayText, newSheet, range, sumColumn, toBytes, totalsRow, writeLines, writeTable, type Cell, type Col } from './sheetKit';
import type { MemberMonth, MonthFigures, PeriodExport, Person } from './types';

const monthTitle = (m: MonthFigures): string => (m.preview ? `${m.period.label} (preview)` : m.period.label);

const STATEMENT_COLUMNS: Array<[keyof MemberMonth, string]> = [
  ['saving', 'Savings'], ['cum_savings', 'Cumm. Savings'], ['opening_owed', 'Owed at the start'], ['loan_principal_sent', 'Loan'],
  ['loan_interest_charged', 'Interest on loan'], ['excess_charged', 'Excess interest'], ['penalties_charged', 'Penalties'],
  ['paid_total', 'Amount received'], ['paid_to_penalties', 'Paid to penalties'], ['paid_to_excess', 'Paid to excess'],
  ['paid_to_interest', 'Paid to loan interest'], ['paid_to_principal', 'Paid to loan'], ['unpaid_minimum', 'Short of the minimum'],
  ['closing_owed', 'Owed at the end'], ['next_minimum', 'Minimum next month'], ['interest_earned', 'Interest earned'],
  ['interest_earned_to_date', 'Interest earned to date'],
];

/** Active members, and anyone who left but has figures, by name. */
function people(d: PeriodExport): Person[] {
  const seen = new Set(d.months.flatMap((m) => m.members.map((x) => x.member_id)));
  return d.people.filter((p) => p.status === 'active' || seen.has(p.id)).sort((a, b) => a.short_name.localeCompare(b.short_name));
}

const figureOf = (m: MonthFigures, id: string): MemberMonth | undefined => m.members.find((x) => x.member_id === id);

function history(d: PeriodExport, id: string): MonthRow[] {
  return d.months.flatMap((m) => {
    const row = figureOf(m, id);
    return row ? [{ period: m.period, preview: m.preview, row }] : [];
  });
}

function heading(d: PeriodExport, what: string, extra: string[] = []): string[] {
  const last = d.months.at(-1);
  const generated = `Generated ${dayText(d.generatedOn.toISOString())}.`;
  return [
    `${d.groupName}: ${d.cycleLabel}, ${what}`,
    last ? `Through ${last.period.label}${last.preview ? ' (preview: this month is still open, so its figures can change)' : ''}. ${generated}` : `Nothing to show yet. ${generated}`,
    ...(d.openLeftOut ? [`${d.openLeftOut.label} is not included: declarations are still waiting.`] : []),
    ...extra,
  ];
}

const SUMMARY_COLS: Col[] = [
  { header: 'Month', kind: 'text', width: 22 },
  { header: 'Closed on', kind: 'date', width: 16 },
  { header: 'Savings', kind: 'money' },
  { header: 'Received', kind: 'money' },
  { header: 'Loans sent', kind: 'money' },
  { header: 'Interest collected', kind: 'money' },
  { header: 'Fee pot in', kind: 'money' },
  { header: 'Fee pot out', kind: 'money' },
  { header: 'Fee pot balance', kind: 'money' },
  { header: 'Meeting pot in', kind: 'money' },
  { header: 'Meeting pot balance', kind: 'money' },
  { header: 'Cash left over', kind: 'money' },
  { header: 'Total savings', kind: 'money' },
  { header: 'Total owed', kind: 'money' },
];

function summarySheet(wb: Workbook, d: PeriodExport): void {
  const ws = newSheet(wb, 'Summary');
  const start = writeLines(ws, heading(d, 'summary'));
  const rows: Cell[][] = d.months.map((m) => [
    monthTitle(m), m.preview ? 'Open: preview' : m.closedOn ? dayCell(m.closedOn) : null,
    m.group.savings, m.group.received, m.group.loans_sent, m.group.interest_collected, m.group.fee_pot_in, m.group.fee_pot_out,
    m.group.fee_pot_balance, m.group.meeting_pot_in, m.group.meeting_pot_balance, m.group.idle_cash, m.group.total_savings, m.group.total_owed,
  ]);
  const preview = d.months.find((m) => m.preview);
  const label = preview ? `Total (includes the ${preview.period.label} preview)` : 'Total';
  // Flows add up across months; balances (pots, total savings, total owed) do not.
  writeTable(ws, start, SUMMARY_COLS, rows, { totals: totalsRow(rows, SUMMARY_COLS.length, label, [2, 3, 4, 5, 6, 7, 9]), freeze: true, freezeCols: 1 });
}

function matrixSheet(wb: Workbook, d: PeriodExport, name: string, what: string, pick: (m: MemberMonth) => number, withInterest: boolean): void {
  const ws = newSheet(wb, name);
  const start = writeLines(ws, heading(d, what, ['A negative figure is a credit.']));
  const who = people(d);
  const months = d.months.length;
  const cols: Col[] = [
    { header: 'Name', kind: 'text', width: 16 },
    ...d.months.map((m): Col => ({ header: monthTitle(m), kind: 'money' })),
    ...(withInterest ? [{ header: 'Interest earned', kind: 'money' } as Col, { header: 'Interest as % of savings', kind: 'percent' } as Col] : []),
  ];
  const latest = (id: string): MemberMonth | undefined => history(d, id).at(-1)?.row;
  const rows: Cell[][] = who.map((p) => {
    const cells: Cell[] = [p.short_name, ...d.months.map((m) => { const f = figureOf(m, p.id); return f ? pick(f) : null; })];
    if (withInterest) {
      const last = latest(p.id);
      const interest = last?.interest_earned_to_date ?? 0;
      const cum = last?.cum_savings ?? 0;
      cells.push(interest, cum > 0 ? interest / cum : 0);
    }
    return cells;
  });
  const totals = totalsRow(rows, cols.length, 'Total', range(1, months + (withInterest ? 1 : 0)));
  if (withInterest) {
    const cum = sumKwacha(...who.map((p) => latest(p.id)?.cum_savings ?? 0));
    totals[cols.length - 1] = cum > 0 ? sumColumn(rows, months + 1) / cum : 0;
  }
  writeTable(ws, start, cols, rows, { totals, freeze: true, freezeCols: 1 });
}

function membersSheet(wb: Workbook, d: PeriodExport): void {
  const ws = newSheet(wb, 'Members');
  const start = writeLines(ws, heading(d, 'where each member stands', ['A negative owed figure is a credit.']));
  const last = d.months.at(-1);
  const defaulted = new Set(d.statuses.filter((s) => s.defaulted).map((s) => s.member_id));
  const cols: Col[] = [
    { header: 'Name', kind: 'text', width: 16 },
    { header: 'Saved to date', kind: 'money' }, { header: 'Interest earned to date', kind: 'money' }, { header: 'Loans taken', kind: 'money' },
    { header: 'Loan interest charged', kind: 'money' }, { header: 'Penalties charged', kind: 'money' }, { header: 'Paid in', kind: 'money' },
    { header: 'Owed now', kind: 'money' }, { header: 'Next minimum', kind: 'money' }, { header: 'Months short of the minimum', kind: 'int' },
    { header: 'Standing', kind: 'text', width: 18 },
    { header: 'Savings', kind: 'money' }, { header: 'Interest', kind: 'money' }, { header: 'Owed', kind: 'money' },
    { header: 'Share of the pots', kind: 'money' }, { header: 'Payout', kind: 'money' },
  ];
  ws.getCell(start, 2).value = last ? `Through ${last.period.label}${last.preview ? ' (preview)' : ''}` : 'Through now';
  ws.getCell(start, 12).value = `If the cycle ended today${d.payoutAsAt ? ` (using ${d.payoutAsAt} figures)` : ''}`;
  ws.getCell(start, 2).font = { bold: true };
  ws.getCell(start, 12).font = { bold: true };
  const rows: Cell[][] = people(d).map((p) => {
    const s = standpointOf(history(d, p.id));
    const pay = d.payout.find((x) => x.member_id === p.id);
    return [
      p.short_name, s.savedToDate, s.interestToDate, s.loansTaken, s.loanInterest, s.penalties, s.paidIn, s.owedNow, s.nextMinimum, s.monthsShort,
      defaulted.has(p.id) ? 'Defaulted' : 'In good standing',
      pay?.savings ?? null, pay?.interest_earned ?? null, pay?.owed ?? null, pay?.pot_share ?? null, pay?.payout ?? null,
    ];
  });
  writeTable(ws, start + 1, cols, rows, { totals: totalsRow(rows, cols.length, 'Total', [...range(1, 8), ...range(11, 15)]), freeze: true, freezeCols: 1 });
}

function loansSheet(wb: Workbook, d: PeriodExport): void {
  const ws = newSheet(wb, 'Loans');
  const start = writeLines(ws, heading(d, 'loans'));
  const names = new Map(d.people.map((p) => [p.id, p.short_name]));
  const labels = new Map(d.periods.map((p) => [p.id, p.label]));
  const rows: Cell[][] = [...d.loans]
    .sort((a, b) => a.sent_at.localeCompare(b.sent_at) || a.id.localeCompare(b.id))
    .map((l) => [names.get(l.member_id) ?? 'Unknown member', labels.get(l.period_id) ?? '', l.principal, l.interest, l.term_months, l.status, dayCell(l.sent_at)]);
  writeTable(ws, start, [
    { header: 'Name', kind: 'text', width: 16 }, { header: 'Month', kind: 'text', width: 14 }, { header: 'Principal', kind: 'money' },
    { header: 'Interest', kind: 'money' }, { header: 'Term (months)', kind: 'int' }, { header: 'Status', kind: 'text' }, { header: 'Sent on', kind: 'date' },
  ], rows, { freeze: true });
}

function statementsSheet(wb: Workbook, d: PeriodExport): void {
  const ws = newSheet(wb, 'Statements');
  const start = writeLines(ws, heading(d, 'every member, every month'));
  const names = new Map(d.people.map((p) => [p.id, p.short_name]));
  const cols: Col[] = [
    { header: 'Month', kind: 'text', width: 14 }, { header: 'Preview', kind: 'text', width: 10 }, { header: 'Name', kind: 'text', width: 16 },
    ...STATEMENT_COLUMNS.map(([, header]): Col => ({ header, kind: 'money' })),
  ];
  const rows: Cell[][] = d.months.flatMap((m) =>
    m.members
      .map((x) => ({ x, name: names.get(x.member_id) ?? 'Unknown member' }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ x, name }): Cell[] => [m.period.label, m.preview ? 'Preview' : null, name, ...STATEMENT_COLUMNS.map(([key]) => x[key] as number)]),
  );
  writeTable(ws, start, cols, rows, { freeze: true, freezeCols: 3 });
}

/** The whole period: every closed month and the open month as a labelled preview, with cumulative figures and a row per member. */
export async function buildPeriodWorkbook(d: PeriodExport): Promise<Uint8Array> {
  const { Workbook } = await loadExcel();
  const wb = new Workbook();
  wb.creator = 'Premium Village Banking';
  wb.created = d.generatedOn;
  summarySheet(wb, d);
  matrixSheet(wb, d, 'Savings by month', 'savings by month', (m) => m.cum_savings, true);
  matrixSheet(wb, d, 'Owed by month', 'owed by month', (m) => m.closing_owed, false);
  membersSheet(wb, d);
  loansSheet(wb, d);
  statementsSheet(wb, d);
  return toBytes(wb);
}
