import { compactKwacha, percent } from '@/features/charts/format';
import { SeriesChart } from '@/features/charts/SeriesChart';
import { useGroup } from '@/features/group/GroupContext';
import { money } from '@/lib/format';
import { Panel } from '@/ui';
import { Figure } from './Figure';
import type { StatementRow } from './memberViews';
import type { PeriodRow } from './model';
import { myStats } from './myStats';
import { useCycleRules, useLedgerCycle } from './queries';

// The constitution's minimum saving, used only if the rules row cannot be read.
const FALLBACK_MIN_SAVING = 250;
const short = (label: string): string => label.split(' ')[0] ?? label;

/** Am I making a profit or a loss? Said in words first, then the numbers. */
export function Verdict({ net, roi }: { net: number; roi: number }) {
  const ahead = net >= 0;
  return (
    <div className={`rounded-2xl p-4 md:p-5 ${ahead ? 'bg-success-soft' : 'bg-danger-soft'}`}>
      <p className="text-sm text-muted">Interest earned minus interest and penalties charged</p>
      <p className="tabular mt-1 text-2xl font-semibold text-fg">{ahead ? 'Ahead by ' : 'Behind by '}{money(Math.abs(net))}</p>
      <p className="mt-1 text-sm text-fg">
        {ahead ? 'The group has paid you more in interest than it has charged you.' : 'You have been charged more than you have earned so far. Saving more earns a bigger share of the interest.'}
        {roi !== 0 ? ` That is ${percent(Math.abs(roi), 1)} of your savings.` : ''}
      </p>
    </div>
  );
}

/** Charts and the monthly table from the member's own closed statements. `view` picks the set for the Passbook or for My record. */
export function MyCharts({ statements, periods, view }: { statements: StatementRow[]; periods: PeriodRow[]; view: 'passbook' | 'record' }) {
  const { group } = useGroup();
  const cycle = useLedgerCycle(group.id);
  const rules = useCycleRules(cycle.data?.cycle?.id);
  const minSaving = rules.data?.min_saving ?? FALLBACK_MIN_SAVING;
  const s = myStats(statements, periods, minSaving);
  if (s.months.length === 0) return null;
  const names = s.months.map((m) => short(m.label));
  const last = s.months[s.months.length - 1]!;
  const col = (k: 'saving' | 'balance' | 'loan' | 'loanInterest' | 'excess' | 'earned' | 'charges' | 'net') => s.months.map((m) => m[k]);

  if (view === 'record') {
    return (
      <div className="grid gap-4 md:gap-5 lg:grid-cols-2 lg:items-start">
        <div className="lg:col-span-2"><Verdict net={s.net} roi={s.roi} /></div>
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:col-span-2">
          <Figure label="Months at the minimum" value={`${s.monthsAtMinimum} of ${s.months.length}`} />
          <Figure label="Charged so far" value={money(s.interestCharged + s.penalties)} />
        </div>
        <Panel title="Are you ahead?" hint="Running totals: what you earned, what you were charged, and the difference.">
          <SeriesChart
            label={`Are you ahead? After ${last.label} you have earned ${money(last.earned)} and been charged ${money(last.charges)}: ${last.net >= 0 ? 'ahead' : 'behind'} by ${money(Math.abs(last.net))}.`}
            categories={names} format={money} axisFormat={compactKwacha}
            series={[
              { key: 'earned', label: 'Interest earned', tone: 'success', kind: 'line', values: col('earned') },
              { key: 'charges', label: 'Charged', tone: 'danger', kind: 'line', values: col('charges') },
              { key: 'net', label: 'Net position', tone: 'accent', kind: 'line', dashed: true, values: col('net') },
            ]}
          />
        </Panel>
        <Panel title="Your saving each month" hint={`The line is the group minimum, ${money(minSaving)}.`}>
          <SeriesChart
            label={`Your saving each month. You saved at least ${money(minSaving)} in ${s.monthsAtMinimum} of ${s.months.length} months.`}
            categories={names} format={money} axisFormat={compactKwacha} reference={{ label: 'Minimum', value: minSaving }}
            series={[{ key: 'saving', label: 'You saved', tone: 'accent', kind: 'bar', values: col('saving') }]}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:gap-5 lg:grid-cols-2 lg:items-start">
      <div className="lg:col-span-2"><Verdict net={s.net} roi={s.roi} /></div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:col-span-2 lg:grid-cols-4">
        <Figure label="Loans taken" value={money(s.loans)} />
        <Figure label="Interest charged" value={money(s.interestCharged)} />
        <Figure label="Penalties" value={money(s.penalties)} />
        <Figure label="Interest earned" value={money(s.earned)} />
      </div>
      <div className="lg:col-span-2">
      <Panel title="Savings and interest growth" hint="Your savings balance, with interest earned and interest charged building up beside it.">
        <SeriesChart
          label={`Savings and interest growth. Your savings stand at ${money(s.savings)}; you have earned ${money(last.earned)} and been charged ${money(last.charges)}.`}
          categories={names} format={money} axisFormat={compactKwacha}
          series={[
            { key: 'balance', label: 'Savings', tone: 'accent', kind: 'line', area: true, values: col('balance') },
            { key: 'earned', label: 'Interest earned', tone: 'success', kind: 'line', values: col('earned') },
            { key: 'charges', label: 'Charged', tone: 'danger', kind: 'line', values: col('charges') },
          ]}
        />
      </Panel>
      </div>
      <Panel title="Monthly contributions">
        <SeriesChart
          label={`Monthly contributions. You saved ${money(last.saving)} in ${last.label}.`}
          categories={names} format={money} axisFormat={compactKwacha}
          series={[{ key: 'saving', label: 'Saved that month', tone: 'accent', kind: 'bar', values: col('saving') }]}
        />
      </Panel>
      <Panel title="Loans and interest charged">
        <SeriesChart
          label={`Loans and interest charged. Loans taken: ${money(s.loans)}; interest charged: ${money(s.interestCharged)}.`}
          categories={names} format={money} axisFormat={compactKwacha} stacked
          series={[
            { key: 'loan', label: 'Loan taken', tone: 'info', kind: 'bar', values: col('loan') },
            { key: 'li', label: 'Loan interest', tone: 'warning', kind: 'bar', values: col('loanInterest') },
            { key: 'ex', label: 'Excess interest', tone: 'danger', kind: 'bar', values: col('excess') },
          ]}
        />
      </Panel>
      <div className="lg:col-span-2">
      <Panel title="Month by month">
        {/* Phones get a card per month; the nine columns only fit from md. */}
        <ul role="list" className="grid gap-2 md:hidden">
          {[...s.months].reverse().map((m) => (
            <li key={m.label} className="rounded-xl bg-surface-2 p-3">
              <p className="font-semibold text-fg">{m.label}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {([['Saved', m.saving], ['Balance', m.balance], ['Loan', m.loan], ['Loan interest', m.loanInterest], ['Excess', m.excess], ['Penalty', m.penalty], ['Owed', m.owed], ['Paid', m.paid]] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2"><dt className="text-muted">{k}</dt><dd className="tabular text-fg">{money(v)}</dd></div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-max text-left text-sm">
            <thead>
              <tr className="text-muted">
                {['Month', 'Saved', 'Balance', 'Loan', 'Loan interest', 'Excess', 'Penalty', 'Owed', 'Paid'].map((h) => <th key={h} scope="col" className="px-2 py-1.5 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {s.months.map((m) => (
                <tr key={m.label} className="border-t border-line">
                  <th scope="row" className="px-2 py-1.5 font-medium text-fg">{m.label}</th>
                  {[m.saving, m.balance, m.loan, m.loanInterest, m.excess, m.penalty, m.owed, m.paid].map((v, i) => <td key={i} className="tabular px-2 py-1.5 text-fg">{money(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      </div>
    </div>
  );
}
