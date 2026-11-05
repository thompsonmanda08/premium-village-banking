import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { DonutChart } from '@/features/charts/DonutChart';
import { percent } from '@/features/charts/format';
import { RankedBars } from '@/features/charts/RankedBars';
import { useGroup } from '@/features/group/GroupContext';
import { useGroupMembers } from '@/features/group/GroupPage';
import { closedPeriods, memberStats } from '@/features/ledger/groupStats';
import { activeMembers, currentPeriod } from '@/features/ledger/model';
import { sumKwacha } from '@/features/ledger/money';
import { memberRows, poolLines, sortRows, type PoolRow, type SortKey } from '@/features/ledger/poolStats';
import { useCycleStatements, useGroupPayout, useLedgerCycle, useMemberStatuses } from '@/features/ledger/queries';
import { NotFound } from '@/features/shells/NotFound';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, SelectField, Skeleton } from '@/ui';

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'savings', label: 'Savings' }, { key: 'share', label: 'Pool share' }, { key: 'loans', label: 'Loans taken' },
  { key: 'interestCharged', label: 'Interest charged' }, { key: 'earned', label: 'Interest earned' }, { key: 'net', label: 'Net gain' },
  { key: 'roi', label: 'Net return' }, { key: 'due', label: 'Owed' }, { key: 'payout', label: 'Payout today' },
];
const signed = (n: number): string => (n < 0 ? `−${money(-n)}` : money(n));
const cell = (r: PoolRow, k: SortKey): string => {
  if (k === 'share') return percent(r.share, 1);
  if (k === 'roi') return `${r.roi < 0 ? '−' : ''}${percent(Math.abs(r.roi), 1)}`;
  if (k === 'net') return signed(r.net);
  if (k === 'payout') return r.payout === null ? '—' : money(r.payout);
  return money(r[k as 'savings']);
};
const th = 'whitespace-nowrap px-2 py-1.5 text-right font-medium text-muted';
const td = 'tabular whitespace-nowrap px-2 py-2 text-right text-fg';

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <>
      <dt className={strong ? 'font-semibold text-fg' : 'text-muted'}>{label}</dt>
      <dd className={`tabular text-right ${strong ? 'font-semibold' : ''} text-fg`}>{money(value)}</dd>
    </>
  );
}

function PoolBody() {
  const { group } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const periods = useMemo(() => cycle.data?.periods ?? [], [cycle.data]);
  const closed = closedPeriods(periods);
  const ids = closed.map((p) => p.id);
  const cycleId = cycle.data?.cycle?.id;
  const statements = useCycleStatements(ids, true);
  const payout = useGroupPayout(cycleId, true);
  const statuses = useMemberStatuses(group.id, cycleId);
  const members = useGroupMembers(group.id);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'savings', dir: 'desc' });
  const [picked, setPicked] = useState('');

  const people = useMemo(() => activeMembers(members.data ?? []), [members.data]);
  const stats = useMemo(() => memberStats(periods, statements.data ?? [], people), [periods, statements.data, people]);
  const rows = useMemo(
    () => memberRows(stats, payout.data ?? [], new Set((statuses.data ?? []).filter((s) => s.defaulted).map((s) => s.member_id))),
    [stats, payout.data, statuses.data],
  );
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort]);

  const queries = [cycle, payout, members, statements];
  const failed = queries.find((q) => q.isError && q.data === undefined);
  if (failed) {
    return (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => queries.forEach((q) => void q.refetch())}>Try again</Button>}>
        {friendlyError(failed.error)}
      </Alert>
    );
  }
  if (cycle.data === undefined || members.data === undefined || (closed.length > 0 && statements.data === undefined) || payout.data === undefined) {
    return (
      <div role="status" className="grid gap-3">
        <span className="sr-only">Loading the pool</span>
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (rows.length === 0 && payout.data.length === 0) {
    return <EmptyState title="Nothing to show yet">The pool appears here once the first month is closed.</EmptyState>;
  }

  const lines = poolLines(payout.data);
  const open = currentPeriod(periods);
  const basis = open ? `Worked from ${open.label} so far` : closed.length > 0 ? `Worked from ${closed[closed.length - 1]!.label}` : 'No month yet';
  const sum = (k: 'savings' | 'loans' | 'interestCharged' | 'earned' | 'net' | 'due') => sumKwacha(...rows.map((r) => r[k]));
  const payoutTotal = sumKwacha(...rows.map((r) => r.payout ?? 0));
  const focus = rows.find((r) => r.id === picked) ?? rows[0];
  const pressed = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc' }));
  const aria = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '');

  return (
    <div className="grid gap-4 md:gap-5">
      <Card>
        <section aria-labelledby="pool-heading" className="grid gap-3">
          <h2 id="pool-heading" className="text-lg font-semibold text-fg">Payout pool today</h2>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <Line label="Members’ savings" value={lines.savings} />
            <Line label="+ Interest collected so far" value={lines.interest} />
            <Line label="= What the records owe members today" value={lines.entitled} strong />
            <Line label="− Owed back to the pool" value={lines.owed} />
            <Line label="+ Fee and meeting pots shared equally" value={lines.pots} />
            <Line label="= Estimated payout pool" value={lines.estimated} strong />
          </dl>
          <p className="text-sm text-muted">{basis}. An estimate until the cycle is paid out; transfer fees are not counted.</p>
        </section>
      </Card>

      <section aria-labelledby="members-heading" className="grid gap-2">
        <h2 id="members-heading" className="text-lg font-semibold text-fg">All members</h2>
        {/* Phones: a card per member with the figures that matter, sorted by the chosen column. */}
        <div className="grid gap-2 md:hidden">
          <SelectField label="Sort by" value={sort.key} onChange={(e) => setSort({ key: e.target.value as SortKey, dir: e.target.value === 'name' ? 'asc' : 'desc' })}>
            <option value="name">Name</option>
            {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </SelectField>
          <ul role="list" className="grid gap-2">
            {sorted.map((r) => (
              <li key={r.id} className="rounded-2xl border border-line bg-surface p-4">
                <p className="font-semibold text-fg">
                  <Link to={`/desk/members/${r.id}`} className="underline">{r.name}</Link>
                  {r.defaulted ? <Badge tone="danger" className="ml-2">Defaulted</Badge> : null}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {(['savings', 'share', 'net', 'roi', 'due', 'payout'] as const).map((k) => (
                    <div key={k} className="flex justify-between gap-2"><dt className="text-muted">{COLUMNS.find((c) => c.key === k)!.label}</dt><dd className="tabular text-fg">{cell(r, k)}</dd></div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr>
                <th scope="col" aria-sort={aria('name')} className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left font-medium text-muted">
                  <button type="button" className="min-h-11" onClick={() => pressed('name')}>Member{arrow('name')}</button>
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" aria-sort={aria(c.key)} className={th}>
                    <button type="button" className="min-h-11" onClick={() => pressed(c.key)}>{c.label}{arrow(c.key)}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-surface px-2 py-2 text-left font-medium text-fg">
                    <Link to={`/desk/members/${r.id}`} className="underline">{r.name}</Link>
                    {r.defaulted ? <Badge tone="danger" className="ml-2">Defaulted</Badge> : null}
                  </th>
                  {COLUMNS.map((c) => <td key={c.key} className={td}>{cell(r, c.key)}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-semibold">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-2 py-2 text-left text-fg">Total</th>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={td}>
                    {c.key === 'savings' || c.key === 'loans' || c.key === 'interestCharged' || c.key === 'earned' || c.key === 'due' ? money(sum(c.key)) : c.key === 'net' ? signed(sum('net')) : c.key === 'payout' ? money(payoutTotal) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <Link to="/desk/reports" className="inline-flex min-h-12 items-center text-accent underline">Download the whole-period workbook</Link>
      </section>

      {focus ? (
        <Card>
          <section aria-labelledby="share-heading" className="grid gap-3">
            <h2 id="share-heading" className="text-lg font-semibold text-fg">Share of the pool</h2>
            <SelectField label="Member" value={focus.id} onChange={(e) => setPicked(e.target.value)}>
              {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </SelectField>
            <DonutChart
              label={`${focus.name} holds ${percent(focus.share, 1)} of all savings.`}
              slices={[
                { label: focus.name, value: focus.savings, tone: 'accent' },
                { label: 'Everyone else', value: Math.max(0, sumKwacha(...rows.map((r) => r.savings)) - focus.savings), tone: 'muted' },
              ]}
              centre={{ big: percent(focus.share, 1), small: 'of all savings' }}
              format={money}
            />
          </section>
        </Card>
      ) : null}

      {rows.length > 0 ? (
        <Card>
          <section aria-labelledby="return-heading" className="grid gap-3">
            <h2 id="return-heading" className="text-lg font-semibold text-fg">Net return, all members</h2>
            <RankedBars
              label="Net return of every member: interest earned minus interest and penalties charged, as a share of their savings."
              rows={[...rows].sort((a, b) => b.roi - a.roi).map((r) => ({ label: r.name, value: r.roi * 100, highlight: r.id === focus?.id }))}
              format={(n) => `${n.toFixed(1)}%`}
              valueLabel="Net return"
            />
          </section>
        </Card>
      ) : null}
    </div>
  );
}

export function PoolPage() {
  const { isAdmin } = useGroup();
  if (!isAdmin) return <NotFound title="This page is for admins" body="Ask your treasurer if you think you should have access." />;
  return (
    <>
      <PageHeader title="Pool and members" />
      <PoolBody />
    </>
  );
}
