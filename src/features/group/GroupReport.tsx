import { useMemo, type ReactNode } from 'react';
import { compactKwacha, percent } from '@/features/charts/format';
import { RankedBars } from '@/features/charts/RankedBars';
import { SeriesChart } from '@/features/charts/SeriesChart';
import { useGroup } from '@/features/group/GroupContext';
import { atRiskIds, closedPeriods, followUp, healthIndicators, memberStats, monthStats, type Person, type Status } from '@/features/ledger/groupStats';
import { useCycleRules, useCycleStatements, useGroupStatements, useLedgerCycle } from '@/features/ledger/queries';
import { friendlyError } from '@/lib/errors';
import { money } from '@/lib/format';
import { Alert, Badge, Button, Card, EmptyState, Skeleton, type Tone } from '@/ui';

const BADGE: Record<Status, { tone: Tone; text: string }> = { good: { tone: 'success', text: 'On track' }, watch: { tone: 'warning', text: 'Watch' }, bad: { tone: 'danger', text: 'Act' } };
const SOFT: Record<Status, string> = { good: 'bg-success-soft', watch: 'bg-warning-soft', bad: 'bg-danger-soft' };
const short = (label: string): string => label.split(' ')[0] ?? label;
const whole = (n: number): string => `${Math.round(n)}%`;
// A cycle always has rules; 250 is the constitution's minimum saving, used only if the row cannot be read.
const FALLBACK_MIN_SAVING = 250;

function Panel({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <section aria-labelledby={id} className="grid gap-3">
        <div>
          <h2 id={id} className="text-lg font-semibold text-fg">{title}</h2>
          {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
        </div>
        {children}
      </section>
    </Card>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold text-fg">{value}</p>
      {note ? <p className="mt-0.5 text-sm text-muted">{note}</p> : null}
    </div>
  );
}

const th = 'px-2 py-1.5 font-medium text-muted';
const td = 'tabular px-2 py-1.5 text-fg';

/**
 * The group's own report: totals every member may see, and per-member health signs, charts and a follow-up list for the treasurer (and for
 * members of a group that keeps figures open). A private group's member never asks for other members' statements.
 */
export function GroupReport({ people }: { people: Person[] }) {
  const { group, member, isAdmin } = useGroup();
  const canMembers = isAdmin || group.figures_visibility === 'open';
  const cycle = useLedgerCycle(group.id);
  const periods = useMemo(() => cycle.data?.periods ?? [], [cycle.data]);
  const closed = useMemo(() => closedPeriods(periods), [periods]);
  const ids = closed.map((p) => p.id);
  const groupRows = useGroupStatements(ids);
  const rules = useCycleRules(cycle.data?.cycle?.id);
  const statements = useCycleStatements(ids, canMembers);
  const minSaving = rules.data?.min_saving ?? FALLBACK_MIN_SAVING;

  const memberRows = canMembers ? statements.data : undefined;
  const memberFailed = canMembers && statements.isError && statements.data === undefined;
  const view = useMemo(() => {
    if (!groupRows.data) return null;
    const months = monthStats(periods, groupRows.data, memberRows ?? null, minSaving);
    if (!memberRows) return { months, members: null, health: null, follow: [] as ReturnType<typeof followUp> };
    const members = memberStats(periods, memberRows, people);
    const risky = new Set(atRiskIds(periods, memberRows));
    return {
      months,
      members,
      health: healthIndicators({ months, members, atRisk: members.filter((m) => risky.has(m.id)), minSaving }),
      follow: followUp({ periods, statements: memberRows, people, minSaving }),
    };
  }, [groupRows.data, memberRows, minSaving, people, periods]);

  const retry = () => {
    void cycle.refetch();
    void groupRows.refetch();
    void statements.refetch();
  };
  const firstError = [cycle, groupRows].find((q) => q.isError && q.data === undefined);
  if (firstError) {
    return <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={retry}>Try again</Button>}>{friendlyError(firstError.error)}</Alert>;
  }
  if (cycle.data === undefined) return <Loading />;
  if (closed.length === 0) {
    return (
      <EmptyState title="No months closed yet">The group report appears after the first month is closed.</EmptyState>
    );
  }
  const waitingForMembers = canMembers && !memberFailed && statements.data === undefined;
  if (groupRows.data === undefined || rules.isPending || waitingForMembers || !view) return <Loading />;

  const { months, members, health, follow } = view;
  const last = months.at(-1);
  if (!last) {
    return <EmptyState title="No months closed yet">The group report appears after the first month is closed.</EmptyState>;
  }
  const prev = months.at(-2);
  const names = months.map((m) => short(m.label));
  const lend = months.reduce((s, m) => s + m.loans, 0);
  const change = prev ? last.cum - prev.cum : null;

  return (
    <div className="grid gap-4 md:gap-5">
      <section aria-labelledby="gr-figures" className="grid gap-3">
        <h2 id="gr-figures" className="text-xl font-semibold text-fg">Where the group stands</h2>
        <p className="-mt-1 text-sm text-muted">From the {last.label} statement.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Figure
            label="Total savings"
            value={money(last.cum)}
            note={change === null || prev === undefined ? undefined : change >= 0 ? `Up ${money(change)} since ${prev.label}` : `Down ${money(-change)} since ${prev.label}`}
          />
          <Figure label="Interest collected" value={money(last.interestCollected)} note={`In ${last.label}`} />
          <Figure label="Loans issued" value={money(lend)} note="Since the cycle began" />
          <Figure label="Idle cash" value={money(last.idle)} note={last.owed + last.idle > 0 ? `${percent(1 - last.use)} of the pool not lent out` : undefined} />
          <Figure label="Owed to the pool" value={money(last.owed)} note="Loans, interest and excess" />
        </div>
      </section>

      {health ? (
        <section aria-labelledby="gr-health" className="grid gap-3">
          <h2 id="gr-health" className="text-xl font-semibold text-fg">Group health check</h2>
          <p className={`rounded-xl px-4 py-3 text-sm text-fg ${SOFT[health.verdict.status]}`}>
            <b>{health.verdict.title}</b>. {health.verdict.say}
          </p>
          <ul role="list" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {health.indicators.map((i) => (
              <li key={i.key} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-fg">{i.label}</h3>
                  <Badge tone={BADGE[i.status].tone}>{BADGE[i.status].text}</Badge>
                </div>
                <p className="tabular mt-1 text-2xl font-semibold text-fg">{percent(i.value)}</p>
                <p className="text-sm text-muted">Target: {i.target}</p>
                <p className="mt-2 text-sm text-fg">{i.say}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
          {memberFailed ? 'Member figures could not be loaded just now.' : 'Per-member figures are shown to the treasurer in groups that keep figures private.'}
        </p>
      )}

      <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
        <Panel id="gr-save" title="Savings growth" hint="What members saved each month, and the pool’s running total.">
          <SeriesChart
            label={`Savings growth. The pool stands at ${money(last.cum)} after ${months.length} ${months.length === 1 ? 'month' : 'months'}; ${money(last.saved)} was saved in ${last.label}.`}
            categories={names}
            format={money}
            axisFormat={compactKwacha}
            rightFormat={compactKwacha}
            series={[
              { key: 'saved', label: 'Saved that month', tone: 'accent', kind: 'bar', values: months.map((m) => m.saved) },
              { key: 'pool', label: 'Pool total', tone: 'warning', kind: 'line', axis: 'right', values: months.map((m) => m.cum) },
            ]}
          />
        </Panel>
        <Panel id="gr-use" title="How much of the pool is working" hint="Money owed back to the pool, against idle cash. Idle cash is charged excess interest to all members.">
          <SeriesChart
            label={`How much of the pool is working. In ${last.label}, ${money(last.owed)} was owed back and ${money(last.idle)} sat idle: ${percent(last.use)} working.`}
            categories={names}
            format={money}
            axisFormat={compactKwacha}
            stacked
            series={[
              { key: 'owed', label: 'Owed back to the pool', tone: 'accent', kind: 'bar', values: months.map((m) => m.owed) },
              { key: 'idle', label: 'Idle cash', tone: 'warning', kind: 'bar', values: months.map((m) => m.idle) },
            ]}
          />
        </Panel>
        {members ? (
          <>
            <Panel id="gr-disc" title="Discipline" hint={`Share of members who paid at least their statement minimum, and who saved at least ${money(minSaving)}.`}>
              <SeriesChart
                label={`Discipline. In ${last.label}, ${last.savers ?? 0} of ${last.count ?? 0} members saved at least ${money(minSaving)}${last.metPct === null ? '' : ` and ${last.minMet} of ${last.minDue} paid their minimum`}.`}
                categories={names}
                format={whole}
                series={[
                  { key: 'met', label: 'Paid at least the minimum', tone: 'accent', kind: 'line', values: months.map((m) => (m.metPct === null ? null : m.metPct * 100)) },
                  { key: 'saved', label: `Saved ${money(minSaving)} or more`, tone: 'warning', kind: 'line', values: months.map((m) => (m.savers === null || !m.count ? null : (m.savers / m.count) * 100)) },
                ]}
              />
            </Panel>
            <Panel id="gr-ahead" title="Who is ahead" hint="Each member’s interest earned minus the loan interest, excess interest and penalties charged, so far.">
              <RankedBars
                label={`Who is ahead. ${[...members].sort((a, b) => b.net - a.net)[0]?.name ?? 'Nobody'} leads with ${money([...members].sort((a, b) => b.net - a.net)[0]?.net ?? 0)}.`}
                format={money}
                valueLabel="Net position"
                rows={[...members].sort((a, b) => b.net - a.net || a.name.localeCompare(b.name)).map((m) => ({ label: m.name, value: m.net, highlight: member?.id === m.id }))}
              />
            </Panel>
          </>
        ) : null}
      </div>

      <section aria-labelledby="gr-report" className="grid gap-3">
        <h2 id="gr-report" className="text-xl font-semibold text-fg">Monthly group report</h2>
        <p className="-mt-1 text-sm text-muted">Totals for the whole group from each month’s statement.</p>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-max text-left text-sm">
            <thead>
              <tr>
                {['Month', 'Saved', 'Savings total', 'New loans', 'Owed to the pool', 'Idle cash', 'Pool working', 'Excess billed', 'Interest collected'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
                {members ? <><th scope="col" className={th}>{`Saved ${money(minSaving)}+`}</th><th scope="col" className={th}>Paid minimum</th></> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {months.map((m) => (
                <tr key={m.period.id}>
                  <th scope="row" className="px-2 py-1.5 font-medium text-fg">{m.label}</th>
                  <td className={td}>{money(m.saved)}</td>
                  <td className={td}>{money(m.cum)}</td>
                  <td className={td}>{money(m.loans)}</td>
                  <td className={td}>{money(m.owed)}</td>
                  <td className={td}>{money(m.idle)}</td>
                  <td className={td}>{percent(m.use)}</td>
                  <td className={td}>{money(m.excessBilled)}</td>
                  <td className={td}>{money(m.interestCollected)}</td>
                  {members ? (
                    <>
                      <td className={td}>{m.savers === null ? '—' : `${m.savers} of ${m.count}`}</td>
                      <td className={td}>{m.minDue ? `${m.minMet} of ${m.minDue}` : '—'}</td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-semibold">
                <th scope="row" className="px-2 py-1.5 text-fg">Total</th>
                <td className={td}>{money(months.reduce((s, m) => s + m.saved, 0))}</td>
                <td className={td}>{money(last.cum)}</td>
                <td className={td}>{money(lend)}</td>
                <td className={td} />
                <td className={td} />
                <td className={td} />
                <td className={td}>{money(months.reduce((s, m) => s + m.excessBilled, 0))}</td>
                <td className={td}>{money(months.reduce((s, m) => s + m.interestCollected, 0))}</td>
                {members ? <><td className={td} /><td className={td} /></> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {isAdmin && members ? (
        <section aria-labelledby="gr-follow" className="grid gap-3">
          <h2 id="gr-follow" className="text-xl font-semibold text-fg">Follow-up list</h2>
          <p className="-mt-1 text-sm text-muted">Members the committee may want to check in with. Based on the statements, not on anything said in the chat.</p>
          {follow.length === 0 ? (
            <p className="text-sm text-muted">Nobody needs follow-up right now.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-max text-left text-sm">
                <thead>
                  <tr>{['Member', 'Reason', 'Amount'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {follow.map((f) => (
                    <tr key={f.id}>
                      <th scope="row" className="px-2 py-1.5 font-medium text-fg">{f.name}</th>
                      <td className="px-2 py-1.5 text-fg">{f.why}</td>
                      <td className={td}>{f.kind === 'owes' ? `Owes ${money(f.amount)}` : `Saved ${money(f.amount)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Loading() {
  return (
    <div role="status" className="grid gap-3">
      <span className="sr-only">Loading the group report</span>
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}
