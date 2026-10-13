import { correctionLine, correctionsOf, effectiveAmount } from '@/features/ledger/corrections';
import { owedFigure } from '@/features/ledger/memberViews';
import { loadExcel, type Workbook } from './loadExcel';
import { standpointOf } from './standpoint';
import { dayCell, dayText, kindLabel, newSheet, signedAmount, sourceLabel, toBytes, totalsRow, writeLines, writeTable, type Cell, type Col } from './sheetKit';
import type { MemberExport } from './types';

const PREVIEW_NOTE = ' (preview: this month is still open, so its figures can change)';
const monthTitle = (m: { period: { label: string }; preview: boolean }): string => (m.preview ? `${m.period.label} (preview)` : m.period.label);

function standpointSheet(wb: Workbook, d: MemberExport): void {
  const ws = newSheet(wb, 'Standpoint');
  const last = d.months.at(-1);
  const s = standpointOf(d.months);
  const owed = owedFigure(s.owedNow);
  const start = writeLines(ws, [
    `${d.groupName}: ${d.person.full_name}`,
    `Cycle ${d.cycleLabel}. ${last ? `As at ${last.period.label}${last.preview ? PREVIEW_NOTE : ''}.` : 'Nothing recorded yet.'}`,
    ...(d.openLeftOut ? [`${d.openLeftOut.label} is not included: declarations are still waiting.`] : []),
    `Generated ${dayText(d.generatedOn.toISOString())}.`,
  ]);
  const rows: Cell[][] = [
    ['Saved so far', s.savedToDate], ['Interest earned so far', s.interestToDate], [owed.label, owed.amount],
    ['Minimum due next month', s.nextMinimum], ['Loans taken', s.loansTaken], ['Loan interest charged', s.loanInterest],
    ['Penalties charged', s.penalties], ['Paid in', s.paidIn], ['Months short of the minimum', s.monthsShort],
    ['Standing', d.status?.defaulted ? 'Defaulted' : 'In good standing'],
  ];
  const t = writeTable(ws, start, [{ header: 'Where you stand', kind: 'text', width: 40 }, { header: 'Amount', kind: 'money', width: 20 }], rows);
  ws.getCell(t.first + 8, 2).numFmt = '0'; // a count of months, not kwacha
  const pay = d.payout;
  const payRows: Cell[][] = pay
    ? [
        ['Your savings', pay.savings], ['Interest earned', pay.interest_earned],
        [pay.owed < 0 ? 'Credit you hold' : 'Less what you owe', 0 - pay.owed], ['Your share of the pots', pay.pot_share], ['You would receive', pay.payout],
      ]
    : [['Not available yet.', null]];
  writeTable(ws, t.next, [{ header: `If the cycle ended today${d.payoutAsAt ? ` (using ${d.payoutAsAt} figures)` : ''}`, kind: 'text' }, { header: 'Amount', kind: 'money' }], payRows);
}

const MONTH_COLS: Col[] = [
  { header: 'Month', kind: 'text', width: 22 }, { header: 'Saved', kind: 'money' }, { header: 'Cumm. savings', kind: 'money' },
  { header: 'Loan sent', kind: 'money' }, { header: 'Loan interest', kind: 'money' }, { header: 'Excess', kind: 'money' },
  { header: 'Penalties', kind: 'money' }, { header: 'Paid in', kind: 'money' }, { header: 'Owed at the end', kind: 'money' },
  { header: 'Minimum next month', kind: 'money' }, { header: 'Interest earned', kind: 'money' }, { header: 'Interest earned to date', kind: 'money' },
];

function monthsSheet(wb: Workbook, d: MemberExport): void {
  const ws = newSheet(wb, 'Month by month');
  const start = writeLines(ws, [`${d.groupName}: ${d.person.full_name}, month by month`, 'A negative owed figure is a credit.']);
  const rows: Cell[][] = [...d.months]
    .sort((a, b) => a.period.month_index - b.period.month_index)
    .map((m) => [
      monthTitle(m), m.row.saving, m.row.cum_savings, m.row.loan_principal_sent, m.row.loan_interest_charged, m.row.excess_charged,
      m.row.penalties_charged, m.row.paid_total, m.row.closing_owed, m.row.next_minimum, m.row.interest_earned, m.row.interest_earned_to_date,
    ]);
  writeTable(ws, start, MONTH_COLS, rows, { totals: totalsRow(rows, MONTH_COLS.length, 'Total', [1, 3, 4, 5, 6, 7, 10]), freeze: true, freezeCols: 1 });
}

function loansSheet(wb: Workbook, d: MemberExport): void {
  const ws = newSheet(wb, 'Loans');
  const start = writeLines(ws, [`${d.groupName}: ${d.person.full_name}, loans`]);
  const labels = new Map(d.periods.map((p) => [p.id, p.label]));
  const rows: Cell[][] = [...d.loans]
    .sort((a, b) => a.sent_at.localeCompare(b.sent_at) || a.id.localeCompare(b.id))
    .map((l) => [labels.get(l.period_id) ?? '', l.principal, l.interest, l.term_months, l.status, dayCell(l.sent_at)]);
  writeTable(ws, start, [
    { header: 'Month', kind: 'text', width: 14 }, { header: 'Principal', kind: 'money' }, { header: 'Interest', kind: 'money' },
    { header: 'Term (months)', kind: 'int' }, { header: 'Status', kind: 'text' }, { header: 'Sent on', kind: 'date' },
  ], rows);
}

function ledgerSheet(wb: Workbook, d: MemberExport): void {
  const ws = newSheet(wb, 'Ledger');
  const start = writeLines(ws, [`${d.groupName}: ${d.person.full_name}, ledger`, 'Everything recorded for you, oldest first. A correction sits under the entry it fixes; “Now” is what the entry stands at after its corrections.']);
  const periods = new Map(d.periods.map((p) => [p.id, p]));
  const originals = d.entries
    .filter((e) => e.source !== 'correction')
    .sort((a, b) => (periods.get(a.period_id)?.month_index ?? 0) - (periods.get(b.period_id)?.month_index ?? 0) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const rows: Cell[][] = originals.flatMap((e) => {
    const fixes = correctionsOf(e.id, d.entries);
    return [
      [periods.get(e.period_id)?.label ?? '', e.source === 'import' ? null : dayCell(e.created_at), kindLabel(e.kind), e.amount, fixes.length > 0 ? effectiveAmount(e, d.entries) : null, e.reason ?? null, sourceLabel(e.source)],
      ...fixes.map((c): Cell[] => [null, dayCell(c.created_at), correctionLine(c), signedAmount(c), null, c.reason ?? null, sourceLabel(c.source)]),
    ];
  });
  const t = writeTable(ws, start, [
    { header: 'Month', kind: 'text', width: 14 }, { header: 'Date', kind: 'date' }, { header: 'What', kind: 'text', width: 26 },
    { header: 'Amount', kind: 'money' }, { header: 'Now', kind: 'money' }, { header: 'Reason', kind: 'text', width: 40 }, { header: 'Source', kind: 'text', width: 14 },
  ], rows, { freeze: true });
  // A correction sits indented under the entry it fixes (an indent, not leading spaces, so the text stays clean).
  rows.forEach((r, i) => {
    if (r[0] === null) ws.getCell(t.first + i, 3).alignment = { indent: 2 };
  });
}

/** One member's own report: their standpoint, month by month, loans and ledger. Nothing about anyone else. */
export async function buildMemberWorkbook(d: MemberExport): Promise<Uint8Array> {
  const { Workbook } = await loadExcel();
  const wb = new Workbook();
  wb.creator = 'Premium Village Banking';
  wb.created = d.generatedOn;
  standpointSheet(wb, d);
  monthsSheet(wb, d);
  loansSheet(wb, d);
  ledgerSheet(wb, d);
  return toBytes(wb);
}
