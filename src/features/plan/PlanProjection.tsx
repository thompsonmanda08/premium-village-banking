import { useMemo, useState } from 'react';
import { compactKwacha } from '@/features/charts/format';
import { SeriesChart } from '@/features/charts/SeriesChart';
import { useGroup } from '@/features/group/GroupContext';
import { closedPeriods } from '@/features/ledger/groupStats';
import type { StatementRow } from '@/features/ledger/memberViews';
import type { PeriodRow } from '@/features/ledger/model';
import { parseKwacha } from '@/features/ledger/money';
import { project } from '@/features/ledger/projection';
import { useCycleRules, useGroupStatements } from '@/features/ledger/queries';
import { money } from '@/lib/format';
import { Button, Card, TextField } from '@/ui';

const COMPARE = [250, 500, 1000, 2000, 5000];
// Used only if the rules row cannot be read: the constitution's rates.
const FALLBACK = { loan_rate: 0.15, excess_rate: 0.1 };
// Share of what is owed that comes back each month. The ledger does not record this, so it is a stated guess: loans run about three months.
const REPAID_SHARE = 0.33;
const num = (s: string): number => parseKwacha(s) ?? 0;
const BAD = 'Type a number, such as 250 or 250.50, with no commas.';
const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** "Project my savings": what the member would receive at payout if they keep saving an amount, set against what the group is putting together. */
export function PlanProjection({ statements, periods }: { statements: StatementRow[]; periods: PeriodRow[] }) {
  const { group, member } = useGroup();
  const closed = closedPeriods(periods);
  const ids = closed.map((p) => p.id);
  const groupRows = useGroupStatements(ids);
  const rules = useCycleRules(periods[0]?.cycle_id);
  const mine = statements.filter((s) => ids.includes(s.period_id)).sort((a, b) => ids.indexOf(a.period_id) - ids.indexOf(b.period_id));
  const latest = mine[mine.length - 1];
  const groupLatest = groupRows.data?.slice().sort((a, b) => ids.indexOf(a.period_id) - ids.indexOf(b.period_id)).pop();
  const left = periods.filter((p) => p.status !== 'closed').sort((a, b) => a.month_index - b.month_index);
  const recent = (groupRows.data ?? []).slice().sort((a, b) => ids.indexOf(a.period_id) - ids.indexOf(b.period_id)).slice(-3);

  // What the others do is read from the last three months, less this member's own saving.
  const defaults = useMemo(() => ({
    monthly: String(Math.round(latest?.saving ?? 250)),
    months: String(left.length),
    groupSaves: String(Math.max(0, Math.round(avg(recent.map((g) => g.savings)) - (latest?.saving ?? 0)))),
    newLoans: String(Math.round(avg(recent.map((g) => g.loans_sent)))),
  }), [latest, left.length, recent.map((g) => g.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [edit, setEdit] = useState<Partial<typeof defaults>>({});
  const v = { ...defaults, ...edit };
  const set = (k: keyof typeof defaults) => (e: { target: { value: string } }) => setEdit((o) => ({ ...o, [k]: e.target.value }));

  const bad = { monthly: parseKwacha(v.monthly) === null, months: !/^\d+$/.test(v.months.trim()), groupSaves: parseKwacha(v.groupSaves) === null, newLoans: parseKwacha(v.newLoans) === null };
  const invalid = Object.values(bad).some(Boolean);

  if (!member || !latest || !groupLatest || left.length === 0) return null;

  const input = {
    months: Math.min(left.length, Math.max(0, Math.floor(num(v.months)))),
    monthly: num(v.monthly), balance: latest.cum_savings, earnedToDate: latest.interest_earned_to_date,
    groupSavings: groupLatest.total_savings, owed: groupLatest.total_owed, idle: groupLatest.idle_cash,
    groupSaves: num(v.groupSaves), newLoans: num(v.newLoans), repaidShare: REPAID_SHARE,
    loanRate: rules.data?.loan_rate ?? FALLBACK.loan_rate, excessRate: rules.data?.excess_rate ?? FALLBACK.excess_rate,
  };
  const plan = project(input);
  const stop = project({ ...input, monthly: 0 });
  const now = latest.cum_savings + latest.interest_earned_to_date;
  const gain = plan.payout - now;
  const names = ['Now', ...left.slice(0, input.months).map((p) => p.label.split(' ')[0] ?? p.label)];

  return (
    <Card>
      <section aria-labelledby="proj-heading" className="grid gap-4">
        <div>
          <h2 id="proj-heading" className="text-lg font-semibold text-fg">Project my savings</h2>
          <p className="mt-0.5 text-sm text-muted">Change the numbers to see what you would receive when the cycle pays out.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="I save each month (K)" error={bad.monthly ? BAD : undefined} inputMode="decimal" value={v.monthly} onChange={set('monthly')} />
          <TextField label="For this many months" error={bad.months ? BAD : undefined} inputMode="numeric" hint={`Up to ${left.length}`} value={v.months} onChange={set('months')} />
          <TextField label="Others save each month (K)" error={bad.groupSaves ? BAD : undefined} inputMode="decimal" value={v.groupSaves} onChange={set('groupSaves')} />
          <TextField label="New loans each month (K)" error={bad.newLoans ? BAD : undefined} inputMode="decimal" value={v.newLoans} onChange={set('newLoans')} />
        </div>
        <Button variant="secondary" size="sm" onClick={() => setEdit({})}>Reset to what the statements show</Button>

        {invalid ? (
          <p role="alert" className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">Fix the highlighted numbers to see your estimate.</p>
        ) : (<>
        <div role="status" className={`rounded-2xl p-4 ${gain >= 0 ? 'bg-success-soft' : 'bg-danger-soft'}`}>
          <p className="text-sm text-muted">Estimated payout</p>
          <p className="tabular mt-1 text-2xl font-semibold text-fg">{money(plan.payout)}</p>
          <p className="mt-1 text-sm text-fg">
            {gain >= 0 ? `That is ${money(gain)} more than your savings and interest today.` : `That is ${money(-gain)} less than your savings and interest today.`}
            {' '}If you stopped saving now, about {money(stop.payout)}.
          </p>
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Interest still to come</dt><dd className="tabular text-right text-fg">{money(plan.interestToCome)}</dd>
          <dt className="text-muted">Your share of excess interest</dt><dd className="tabular text-right text-fg">{money(plan.excessCost)}</dd>
          <dt className="font-semibold text-fg">Net gain from here</dt><dd className="tabular text-right font-semibold text-fg">{money(plan.netGain)}</dd>
        </dl>

        <SeriesChart
          label={`Projected growth. If you keep saving ${money(input.monthly)} a month you would receive about ${money(plan.payout)}; if you stop now, about ${money(stop.payout)}.`}
          categories={names} format={money} axisFormat={compactKwacha}
          series={[
            { key: 'plan', label: 'Keep saving', tone: 'accent', kind: 'line', area: true, values: [now, ...plan.months.map((m) => m.payout)] },
            { key: 'stop', label: 'Stop now', tone: 'muted', kind: 'line', dashed: true, values: [now, ...stop.months.map((m) => m.payout)] },
          ]}
        />

        <div>
          <h3 className="text-base font-semibold text-fg">Compare saving amounts</h3>
          <ul role="list" className="mt-2 divide-y divide-line text-sm">
            {COMPARE.map((k) => (
              <li key={k} className="flex items-center justify-between gap-3 py-2">
                <span className="text-fg">{money(k)} a month</span>
                <span className="tabular text-fg">{money(project({ ...input, monthly: k }).payout)}</span>
              </li>
            ))}
          </ul>
        </div>

        </>)}
        <p className="text-sm text-muted">
          An estimate, not a promise. It assumes the others keep saving and borrowing as set above, that about a third of what is owed comes back each month, and that
          interest billed is collected. It leaves out transfer and membership fees, and assumes you repay what you owe on schedule. Group: {group.name}.
        </p>
      </section>
    </Card>
  );
}
