import type { PayoutRow } from '@/features/ledger/memberViews';
import { entry, loan, year } from '@/features/ledger/testFixtures';
import { loadExcel, type Worksheet } from './loadExcel';
import type { Cell } from './sheetKit';
import type { GroupFigures, MemberMonth, MonthExport, MonthFigures, Person } from './types';

// Feb, Mar and Apr are closed (p1..p3), May is open (p4). Synthetic people and amounts only.
export const PERIODS = year(3, 'open');
export const PEOPLE: Person[] = [
  { id: 'm1', short_name: 'Eve', full_name: 'Eve Example', status: 'active' },
  { id: 'm2', short_name: 'Ann', full_name: 'Ann Example', status: 'active' },
  { id: 'm3', short_name: 'Bob', full_name: 'Bob Example', status: 'active' },
];

export const mm = (member_id: string, o: Partial<MemberMonth> = {}): MemberMonth => ({
  member_id, saving: 0, cum_savings: 0, opening_owed: 0, loan_principal_sent: 0, loan_interest_charged: 0, excess_charged: 0,
  penalties_charged: 0, paid_total: 0, paid_to_penalties: 0, paid_to_excess: 0, paid_to_interest: 0, paid_to_principal: 0,
  closing_owed: 0, next_minimum: 0, unpaid_minimum: 0, interest_earned: 0, interest_earned_to_date: 0, ...o,
});

export const gf = (o: Partial<GroupFigures> = {}): GroupFigures => ({
  opening_cash: 5000, received: 900, savings: 850, loans_sent: 0, idle_cash: 5000, excess_rate: 0.1, excess_billed: 500, interest_collected: 0,
  fee_pot_in: 0, fee_pot_out: 0, fee_pot_balance: 10, meeting_pot_in: 0, meeting_pot_balance: 90, total_savings: 850, total_owed: 0, ...o,
});

const CLOSED_ON = ['2026-03-07T10:00:00Z', '2026-04-07T10:00:00Z', '2026-05-07T10:00:00Z'];
const figures = (i: number, members: MemberMonth[], group: Partial<GroupFigures>): MonthFigures => ({
  period: PERIODS[i]!, closedOn: CLOSED_ON[i] ?? null, preview: i === 3, group: gf(group), members,
});

// Eve m1, Ann m2, Bob m3. Bob borrows 1,000 (+150 interest) in February, is short by 100 in April and pays a penalty of 100.
export const MONTHS: MonthFigures[] = [
  figures(0, [
    mm('m1', { saving: 250, cum_savings: 250 }),
    mm('m2', { saving: 500, cum_savings: 500 }),
    mm('m3', { saving: 100, cum_savings: 100, loan_principal_sent: 1000, loan_interest_charged: 150, closing_owed: 1150, next_minimum: 400 }),
  ], { received: 900, loans_sent: 1000, fee_pot_in: 10, fee_pot_balance: 10, meeting_pot_in: 90, meeting_pot_balance: 90, total_savings: 850, total_owed: 1150 }),
  figures(1, [
    mm('m1', { saving: 250, cum_savings: 500, interest_earned: 5, interest_earned_to_date: 5 }),
    mm('m2', { saving: 500, cum_savings: 1000, interest_earned: 10, interest_earned_to_date: 10 }),
    mm('m3', { saving: 100, cum_savings: 200, opening_owed: 1150, paid_total: 400, paid_to_interest: 150, paid_to_principal: 250, closing_owed: 900, next_minimum: 400, interest_earned: 2, interest_earned_to_date: 2 }),
  ], { received: 1300, fee_pot_balance: 10, meeting_pot_balance: 90, total_savings: 1700, total_owed: 900 }),
  figures(2, [
    mm('m1', { saving: 250, cum_savings: 750, penalties_charged: 50, closing_owed: 50, next_minimum: 50, interest_earned: 5, interest_earned_to_date: 10 }),
    mm('m2', { saving: 500, cum_savings: 1500, interest_earned: 10, interest_earned_to_date: 20 }),
    mm('m3', { saving: 100, cum_savings: 300, opening_owed: 900, penalties_charged: 100, paid_total: 300, paid_to_penalties: 100, paid_to_principal: 200, closing_owed: 700, next_minimum: 500, unpaid_minimum: 100, interest_earned: 2, interest_earned_to_date: 4 }),
  ], { received: 1250, fee_pot_balance: 10, meeting_pot_balance: 90, total_savings: 2550, total_owed: 750 }),
  figures(3, [
    mm('m1', { saving: 250, cum_savings: 1000, opening_owed: 50, paid_total: 50, paid_to_penalties: 50, closing_owed: 0, interest_earned_to_date: 10 }),
    mm('m2', { saving: 500, cum_savings: 2000, interest_earned_to_date: 20 }),
    mm('m3', { saving: 100, cum_savings: 400, opening_owed: 700, paid_total: 500, paid_to_principal: 500, closing_owed: 200, next_minimum: 200, interest_earned: 2, interest_earned_to_date: 6 }),
  ], { received: 1350, fee_pot_balance: 10, meeting_pot_balance: 90, total_savings: 3400, total_owed: 200 }),
];

// What payout_preview says on May's figures: savings + interest - owed + an equal share of the pots (12.50 each).
export const PAYOUT: PayoutRow[] = [
  { member_id: 'm1', short_name: 'Eve', savings: 1000, interest_earned: 10, owed: 0, pot_share: 12.5, payout: 1022.5 },
  { member_id: 'm2', short_name: 'Ann', savings: 2000, interest_earned: 20, owed: 0, pot_share: 12.5, payout: 2032.5 },
  { member_id: 'm3', short_name: 'Bob', savings: 400, interest_earned: 6, owed: 200, pot_share: 12.5, payout: 218.5 },
];

export const LOAN = loan({ id: 'l1', member_id: 'm3', period_id: 'p1', principal: 1000, interest: 150, term_months: 3, status: 'open', sent_at: '2026-02-20T09:00:00Z' });

// Eve's February fees, and March's corrections of them (the scenario pinned by supabase/tests/database/20_export_fee_fold.sql).
export const FEB_FEE = entry({ id: 'f1', member_id: 'm1', kind: 'txn_fee', amount: 10, period_id: 'p1', source: 'app', created_at: '2026-02-05T08:00:00Z' });
export const FEB_MEMBERSHIP = entry({ id: 'f2', member_id: 'm1', kind: 'membership', amount: 30, period_id: 'p1', source: 'app', created_at: '2026-02-05T08:00:00Z' });
export const MAR_ENTRIES = [
  entry({ id: 's1', member_id: 'm1', kind: 'saving', amount: 250, period_id: 'p2', source: 'import', created_at: '2026-04-01T00:00:00Z' }),
  entry({ id: 'a1', member_id: 'm1', kind: 'adjustment', amount: 4, period_id: 'p2', source: 'correction', corrects_entry_id: 'f1', reason: 'Fee was 6', created_at: '2026-03-10T08:00:00Z' }),
  entry({ id: 'a2', member_id: 'm1', kind: 'membership', amount: 5, period_id: 'p2', source: 'correction', corrects_entry_id: 'f2', reason: '=HYPERLINK("http://example.test","click")', created_at: '2026-03-10T08:01:00Z' }),
  entry({ id: 'g1', member_id: null, kind: 'payout_fee', amount: 3, period_id: 'p2', source: 'import', created_at: '2026-04-01T00:00:00Z' }),
];

export const monthExport = (i: number, o: Partial<MonthExport> = {}): MonthExport => ({
  groupName: 'Test Group', cycleLabel: 'Cycle 2026', generatedOn: new Date('2026-10-13T08:00:00Z'),
  figures: MONTHS[i]!, minimumDue: {}, people: PEOPLE, periods: PERIODS, entries: [], originals: [], ...o,
});

/** Reads a generated file back the way Excel would. */
export async function readBack(bytes: Uint8Array) {
  const { Workbook } = await loadExcel();
  const wb = new Workbook();
  await wb.xlsx.load(bytes as unknown as Parameters<typeof wb.xlsx.load>[0]); // exceljs declares its own Buffer type
  return wb;
}

/** Every cell of a sheet, row by row (a blank cell is null). */
export function rowsOf(ws: Worksheet): Cell[][] {
  const out: Cell[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row: Cell[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = ws.getCell(r, c).value;
      row.push(v === undefined || v === null ? null : (v as Cell));
    }
    out.push(row);
  }
  return out;
}

/** The table whose header row starts with `firstHeader`: its header, its rows up to the first blank row (a totals row included), and column lookups. */
export function tableOf(ws: Worksheet, firstHeader: string) {
  const rows = rowsOf(ws);
  const at = rows.findIndex((r) => r[0] === firstHeader);
  if (at < 0) throw new Error(`no table starting with "${firstHeader}"`);
  const header = rows[at]!.map((c) => String(c ?? ''));
  const body: Cell[][] = [];
  for (const r of rows.slice(at + 1)) {
    if (r.every((c) => c === null)) break;
    body.push(r);
  }
  const col = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`no column "${name}" in ${header.join(' | ')}`);
    return i;
  };
  return { header, body, col, get: (row: Cell[], name: string): Cell => row[col(name)] ?? null };
}
