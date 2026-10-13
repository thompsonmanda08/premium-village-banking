import { formatDate } from '@/lib/format';
import { feeFold } from './fees';
import { loadExcel, type Workbook } from './loadExcel';
import { dayCell, dayText, kindLabel, newSheet, range, signedAmount, sourceLabel, toBytes, totalsRow, writeLines, writeTable, type Cell, type Col } from './sheetKit';
import type { MonthExport } from './types';

const MEMBER_COLS: Col[] = [
  { header: 'S/N', kind: 'int', width: 6 },
  { header: 'Name', kind: 'text', width: 16 },
  { header: 'Savings', kind: 'money' },
  { header: 'Cumm. Savings', kind: 'money' },
  { header: 'Transaction fee', kind: 'money' },
  { header: 'Membership fee', kind: 'money' },
  { header: 'Owed at the start', kind: 'money' },
  { header: 'Loan', kind: 'money' },
  { header: 'Interest on loan', kind: 'money' },
  { header: 'Excess interest', kind: 'money' },
  { header: 'Penalties', kind: 'money' },
  { header: 'Minimum amount payable', kind: 'money' },
  { header: 'Amount received', kind: 'money' },
  { header: 'Paid to penalties', kind: 'money' },
  { header: 'Paid to excess', kind: 'money' },
  { header: 'Paid to loan interest', kind: 'money' },
  { header: 'Paid to loan', kind: 'money' },
  { header: 'Short of the minimum', kind: 'money' },
  { header: 'Owed at the end', kind: 'money' },
  { header: 'Minimum next month', kind: 'money' },
  { header: 'Interest earned', kind: 'money' },
  { header: 'Interest earned to date', kind: 'money' },
];

const ENTRY_COLS: Col[] = [
  { header: 'Date', kind: 'date' },
  { header: 'Member', kind: 'text', width: 16 },
  { header: 'What', kind: 'text', width: 20 },
  { header: 'Amount', kind: 'money' },
  { header: 'Reason', kind: 'text', width: 40 },
  { header: 'Corrects', kind: 'text', width: 32 },
  { header: 'Source', kind: 'text', width: 14 },
];

const title = (d: MonthExport): string => `${d.groupName}: ${d.figures.period.label}${d.figures.preview ? ' (preview)' : ''}`;

function membersSheet(wb: Workbook, d: MonthExport): void {
  const { period, closedOn, imported, preview, members } = d.figures;
  const ws = newSheet(wb, 'Members');
  const status = preview
    ? `PREVIEW: ${period.label} is still open, so these figures can change until it is closed.`
    : imported
      ? 'Imported from the treasurer’s workbook'
      : closedOn
        ? `Closed on ${dayText(closedOn)}`
        : 'Closed';
  const start = writeLines(ws, [title(d), status, `Cycle ${d.cycleLabel}. Deadline ${formatDate(period.deadline)}. Generated ${dayText(d.generatedOn.toISOString())}. A negative figure is a credit.`]);
  const names = new Map(d.people.map((p) => [p.id, p.short_name]));
  const fees = feeFold(d.entries, d.originals);
  const rows: Cell[][] = members
    .map((m) => ({ m, name: names.get(m.member_id) ?? 'Unknown member' }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ m, name }, i) => {
      const fee = fees.get(m.member_id);
      return [
        i + 1, name, m.saving, m.cum_savings, fee?.txn_fee ?? 0, fee?.membership ?? 0, m.opening_owed, m.loan_principal_sent,
        m.loan_interest_charged, m.excess_charged, m.penalties_charged, d.minimumDue[m.member_id] ?? 0, m.paid_total, m.paid_to_penalties,
        m.paid_to_excess, m.paid_to_interest, m.paid_to_principal, m.unpaid_minimum, m.closing_owed, m.next_minimum, m.interest_earned,
        m.interest_earned_to_date,
      ];
    });
  writeTable(ws, start, MEMBER_COLS, rows, { totals: totalsRow(rows, MEMBER_COLS.length, 'Total', range(2, 21), 1), freeze: true, freezeCols: 2 });
}

function groupSheet(wb: Workbook, d: MonthExport): void {
  const g = d.figures.group;
  const ws = newSheet(wb, 'Group');
  const start = writeLines(ws, [title(d), `The group’s cash and pots for the month. Generated ${dayText(d.generatedOn.toISOString())}.`]);
  const lines: Array<[string, number]> = [
    ['Opening cash', g.opening_cash], ['Received this month', g.received], ['Savings', g.savings], ['Loans sent', g.loans_sent],
    ['Cash left over', g.idle_cash], ['Excess rate', g.excess_rate], ['Excess billed', g.excess_billed], ['Interest collected', g.interest_collected],
    ['Fee pot in', g.fee_pot_in], ['Fee pot out', g.fee_pot_out], ['Fee pot balance', g.fee_pot_balance],
    ['Meeting pot in', g.meeting_pot_in], ['Meeting pot balance', g.meeting_pot_balance], ['Total savings', g.total_savings], ['Total owed', g.total_owed],
  ];
  const rows: Cell[][] = lines.map(([label, value]) => [
    label, value, label === 'Fee pot balance' && value < 0 ? 'The fee pot is short: loan transfer fees exceed what members declared.' : null,
  ]);
  const t = writeTable(ws, start, [{ header: 'Group figure', kind: 'text', width: 28 }, { header: 'Amount', kind: 'money', width: 18 }, { header: 'Note', kind: 'text', width: 60 }], rows);
  ws.getCell(t.first + lines.findIndex(([label]) => label === 'Excess rate'), 2).numFmt = '0.0%';
}

function entriesSheet(wb: Workbook, d: MonthExport): void {
  const ws = newSheet(wb, 'Entries');
  const start = writeLines(ws, [title(d), 'Everything recorded in the month, oldest first. Waivers and reductions are negative.']);
  const names = new Map(d.people.map((p) => [p.id, p.short_name]));
  const labels = new Map(d.periods.map((p) => [p.id, p.label]));
  const known = new Map([...d.originals, ...d.entries].map((e) => [e.id, e]));
  const rows: Cell[][] = [...d.entries]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((e) => {
      const original = e.corrects_entry_id ? known.get(e.corrects_entry_id) : undefined;
      return [
        e.source === 'import' ? null : dayCell(e.created_at),
        e.member_id ? (names.get(e.member_id) ?? 'Unknown member') : 'Group',
        kindLabel(e.kind),
        signedAmount(e),
        e.reason ?? null,
        original ? `${kindLabel(original.kind)} from ${labels.get(original.period_id) ?? 'an earlier month'}` : null,
        sourceLabel(e.source),
      ];
    });
  writeTable(ws, start, ENTRY_COLS, rows, { freeze: true });
}

/** One month as a workbook: the members, the group's cash and pots, and everything recorded. The open month is a labelled preview. */
export async function buildMonthWorkbook(d: MonthExport): Promise<Uint8Array> {
  const { Workbook } = await loadExcel();
  const wb = new Workbook();
  wb.creator = 'Premium Village Banking';
  wb.created = d.generatedOn;
  membersSheet(wb, d);
  groupSheet(wb, d);
  entriesSheet(wb, d);
  return toBytes(wb);
}
