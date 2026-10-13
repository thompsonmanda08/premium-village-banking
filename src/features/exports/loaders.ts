import type { EntryRow, LoanRow, PayoutRow, StatementRow } from '@/features/ledger/memberViews';
import { currentPeriod, type PeriodRow } from '@/features/ledger/model';
import type { ClosePreview, MemberStatusRow } from '@/features/ledger/queries';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { groupFigures, memberMonth } from './normalise';
import { chunk, fetchAllRows } from './paging';
import type { MemberExport, MemberMonthEntry, MonthExport, MonthFigures, PeriodExport, Person } from './types';

export type ExportContext = { groupId: string; groupName: string; cycle: { id: string; label: string }; periods: PeriodRow[] };

const PEOPLE_COLUMNS = 'id, short_name, full_name, status';
const byMonth = (a: PeriodRow, b: PeriodRow) => a.month_index - b.month_index;

// ----- reads ------------------------------------------------------------------------------------------------------------

const readPeople = (groupId: string): Promise<Person[]> =>
  fetchAllRows<Person>((a, b) => supabase.from('members').select(PEOPLE_COLUMNS).eq('group_id', groupId).order('short_name').order('id').range(a, b));

function readStatements(periodIds: string[], memberId?: string): Promise<StatementRow[]> {
  if (periodIds.length === 0) return Promise.resolve([]);
  return fetchAllRows<StatementRow>((a, b) => {
    let q = supabase.from('statements').select('*').in('period_id', periodIds);
    if (memberId) q = q.eq('member_id', memberId);
    return q.order('created_at').order('id').range(a, b);
  });
}

function readGroupStatements(periodIds: string[]): Promise<Tables<'group_statements'>[]> {
  if (periodIds.length === 0) return Promise.resolve([]);
  return fetchAllRows((a, b) => supabase.from('group_statements').select('*').in('period_id', periodIds).order('created_at').order('id').range(a, b));
}

async function readClosedAt(periodIds: string[]): Promise<Map<string, string | null>> {
  if (periodIds.length === 0) return new Map();
  const rows = await fetchAllRows<{ id: string; closed_at: string | null }>((a, b) => supabase.from('periods').select('id, closed_at').in('id', periodIds).order('id').range(a, b));
  return new Map(rows.map((r) => [r.id, r.closed_at]));
}

const readPeriodEntries = (periodId: string): Promise<EntryRow[]> =>
  fetchAllRows<EntryRow>((a, b) => supabase.from('entries').select('*').eq('period_id', periodId).order('created_at').order('id').range(a, b));

const readMemberEntries = (memberId: string): Promise<EntryRow[]> =>
  fetchAllRows<EntryRow>((a, b) => supabase.from('entries').select('*').eq('member_id', memberId).order('created_at').order('id').range(a, b));

/** The entries a month's corrections point at that are not in the month itself, a hundred ids a request so the URL stays short. */
async function readOriginals(entries: EntryRow[]): Promise<EntryRow[]> {
  const have = new Set(entries.map((e) => e.id));
  const missing = [...new Set(entries.flatMap((e) => (e.corrects_entry_id && !have.has(e.corrects_entry_id) ? [e.corrects_entry_id] : [])))];
  const found: EntryRow[] = [];
  for (const ids of chunk(missing, 100)) {
    const { data, error } = await supabase.from('entries').select('*').in('id', ids);
    if (error) throw error;
    found.push(...data);
  }
  return found;
}

const readLoans = (periodIds: string[], memberId?: string): Promise<LoanRow[]> =>
  fetchAllRows<LoanRow>((a, b) => {
    let q = supabase.from('loans').select('*').in('period_id', periodIds);
    if (memberId) q = q.eq('member_id', memberId);
    return q.order('sent_at').order('id').range(a, b);
  });

const readStatuses = (cycleId: string): Promise<MemberStatusRow[]> =>
  fetchAllRows<MemberStatusRow>((a, b) => supabase.from('member_status').select('*').eq('cycle_id', cycleId).order('id').range(a, b));

async function readPayout(cycleId: string): Promise<PayoutRow[]> {
  const { data, error } = await supabase.rpc('payout_preview', { p_cycle: cycleId });
  if (error) throw error;
  return data;
}

// ----- the open month's preview ------------------------------------------------------------------------------------------

/** The engine refuses a preview only for waiting declarations when this is the message (the code is the message, as friendlyError relies on). */
export const isDeclarationsPending = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { message?: unknown }).message === 'declarations_pending';

async function readPreview(period: PeriodRow): Promise<ClosePreview> {
  const { data, error } = await supabase.rpc('close_month', { p_period: period.id, p_commit: false });
  if (error) throw error;
  return data as unknown as ClosePreview;
}

/** The open month's preview, or the month named as left out when the engine refuses only because declarations are waiting. Any other failure is thrown. */
async function previewOrLeftOut(open: PeriodRow | null): Promise<{ preview: ClosePreview | null; leftOut: PeriodRow | null }> {
  if (!open) return { preview: null, leftOut: null };
  try {
    return { preview: await readPreview(open), leftOut: null };
  } catch (err) {
    if (isDeclarationsPending(err)) return { preview: null, leftOut: open };
    throw err;
  }
}

const previewFigures = (open: PeriodRow, p: ClosePreview): MonthFigures => ({
  period: open, closedOn: null, imported: false, preview: true, group: groupFigures(p.group), members: p.members.map((m) => memberMonth(m)),
});

/** The label of the month the payout preview is worked from: the open month, else the last closed one. */
const payoutLabel = (periods: PeriodRow[]): string | null => (currentPeriod(periods) ?? periods.filter((p) => p.status === 'closed').sort(byMonth).at(-1))?.label ?? null;

// ----- the three loaders -------------------------------------------------------------------------------------------------

async function closedMonth(period: PeriodRow): Promise<MonthFigures> {
  const [statements, groups, closedAt] = await Promise.all([readStatements([period.id]), readGroupStatements([period.id]), readClosedAt([period.id])]);
  const g = groups[0];
  if (!g) throw new Error('no_group_statement');
  const imported = g.source === 'import';
  return { period, closedOn: imported ? null : (closedAt.get(period.id) ?? null), imported, preview: false, group: groupFigures(g), members: statements.map((s) => memberMonth(s)) };
}

export async function loadMonthExport(ctx: ExportContext, period: PeriodRow): Promise<MonthExport> {
  if (period.status !== 'closed' && period.status !== 'open') throw new Error('not_exportable');
  const previous = ctx.periods.find((p) => p.month_index === period.month_index - 1 && p.status === 'closed');
  const [figures, prior, entries, people] = await Promise.all([
    period.status === 'open' ? readPreview(period).then((p) => previewFigures(period, p)) : closedMonth(period),
    previous ? readStatements([previous.id]) : Promise.resolve([] as StatementRow[]),
    readPeriodEntries(period.id),
    readPeople(ctx.groupId),
  ]);
  const originals = await readOriginals(entries);
  return {
    groupName: ctx.groupName, cycleLabel: ctx.cycle.label, generatedOn: new Date(), figures,
    minimumDue: Object.fromEntries(prior.map((s) => [s.member_id, Number(s.next_minimum)])),
    people, periods: ctx.periods, entries, originals,
  };
}

export async function loadPeriodExport(ctx: ExportContext): Promise<PeriodExport> {
  const closed = ctx.periods.filter((p) => p.status === 'closed').sort(byMonth);
  const open = currentPeriod(ctx.periods);
  const closedIds = closed.map((p) => p.id);
  const [statements, groups, closedAt, people, loans, statuses, payout, pv] = await Promise.all([
    readStatements(closedIds), readGroupStatements(closedIds), readClosedAt(closedIds), readPeople(ctx.groupId),
    readLoans(ctx.periods.map((p) => p.id)), readStatuses(ctx.cycle.id), readPayout(ctx.cycle.id), previewOrLeftOut(open),
  ]);
  const months: MonthFigures[] = closed.map((period) => {
    const g = groups.find((x) => x.period_id === period.id);
    if (!g) throw new Error('no_group_statement');
    const imported = g.source === 'import';
    return {
      period, closedOn: imported ? null : (closedAt.get(period.id) ?? null), imported, preview: false, group: groupFigures(g),
      members: statements.filter((s) => s.period_id === period.id).map((s) => memberMonth(s)),
    };
  });
  if (open && pv.preview) months.push(previewFigures(open, pv.preview));
  return {
    groupName: ctx.groupName, cycleLabel: ctx.cycle.label, generatedOn: new Date(), months, openLeftOut: pv.leftOut,
    payoutAsAt: payoutLabel(ctx.periods), people, periods: ctx.periods, loans, statuses, payout,
  };
}

/** One member's data only: every read is filtered to the member, and the preview and payout lists are cut down to their row before anything is returned. */
export async function loadMemberExport(ctx: ExportContext, memberId: string): Promise<MemberExport> {
  const closed = ctx.periods.filter((p) => p.status === 'closed').sort(byMonth);
  const open = currentPeriod(ctx.periods);
  const cyclePeriodIds = new Set(ctx.periods.map((p) => p.id));
  const [person, statements, closedAt, entries, loans, status, payout, pv] = await Promise.all([
    supabase.from('members').select(PEOPLE_COLUMNS).eq('id', memberId).eq('group_id', ctx.groupId).single(),
    readStatements(closed.map((p) => p.id), memberId),
    readClosedAt(closed.map((p) => p.id)),
    readMemberEntries(memberId),
    readLoans(ctx.periods.map((p) => p.id), memberId),
    supabase.from('member_status').select('*').eq('cycle_id', ctx.cycle.id).eq('member_id', memberId).maybeSingle(),
    readPayout(ctx.cycle.id),
    previewOrLeftOut(open),
  ]);
  if (person.error) throw person.error;
  if (status.error) throw status.error;
  const months: MemberMonthEntry[] = closed.flatMap((period) => {
    const s = statements.find((x) => x.period_id === period.id);
    return s ? [{ period, closedOn: closedAt.get(period.id) ?? null, preview: false, row: memberMonth(s) }] : [];
  });
  const mine = pv.preview?.members.find((m) => m.member_id === memberId);
  if (open && mine) months.push({ period: open, closedOn: null, preview: true, row: memberMonth(mine) });
  return {
    groupName: ctx.groupName, cycleLabel: ctx.cycle.label, generatedOn: new Date(), person: person.data, months, openLeftOut: pv.leftOut,
    payoutAsAt: payoutLabel(ctx.periods), periods: ctx.periods, loans,
    status: status.data, payout: payout.find((p) => p.member_id === memberId) ?? null,
    entries: entries.filter((e) => cyclePeriodIds.has(e.period_id)),
  };
}
