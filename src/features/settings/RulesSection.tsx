import { useState } from 'react';
import { useGroup } from '@/features/group/GroupContext';
import { useCycles, type CycleWithRules } from '@/features/cycles/useCycles';
import { pickCurrentCycle } from '@/lib/calendar';
import { friendlyError } from '@/lib/errors';
import { localISODate } from '@/lib/format';
import { expectRows } from '@/lib/mutate';
import { loanLimitLines, tenorLines } from '@/lib/rulesText';
import { supabase } from '@/lib/supabase';
import { Alert, Button, Skeleton, TextField } from '@/ui';
import { toFormValues, validateRules, type RulesFormValues } from './rulesForm';
import { Section } from './Section';
import { useAction } from './useAction';

type Field = { key: keyof RulesFormValues; label: string; type?: string; inputMode?: 'decimal' | 'numeric'; maxLength?: number };
const FIELDS: Field[] = [
  { key: 'label', label: 'Cycle name', maxLength: 60 },
  { key: 'starts_on', label: 'Starts on', type: 'date' },
  { key: 'ends_on', label: 'Ends on', type: 'date' },
  { key: 'payout_on', label: 'Payout day', type: 'date' },
  { key: 'min_saving', label: 'Minimum saving (K)', inputMode: 'decimal' },
  { key: 'membership_fee', label: 'Membership fee per quarter (K)', inputMode: 'decimal' },
  { key: 'penalty_per_day', label: 'Late penalty per day (K)', inputMode: 'decimal' },
  { key: 'loan_rate_pct', label: 'Loan interest (%)', inputMode: 'decimal' },
  { key: 'excess_rate_pct', label: 'Excess interest per month (%)', inputMode: 'decimal' },
  { key: 'window_open_day', label: 'Declarations open on day', inputMode: 'numeric' },
  { key: 'window_close_day', label: 'Declarations close on day', inputMode: 'numeric' },
];

export function RulesForm({ cycle, locked }: { cycle: CycleWithRules & { rules: NonNullable<CycleWithRules['rules']> }; locked: boolean }) {
  const [values, setValues] = useState(() => toFormValues(cycle));
  const [showErrors, setShowErrors] = useState(false);
  const errors = validateRules(values);
  // Both writes go through expectRows: RLS answers a write on a started cycle with success and zero rows, which must not read as "saved".
  const save = useAction(async () => {
    expectRows(
      await supabase.from('cycles').update({ label: values.label.trim(), starts_on: values.starts_on, ends_on: values.ends_on, payout_on: values.payout_on }).eq('id', cycle.id).select('id'),
      'rules_locked',
    );
    expectRows(
      await supabase
        .from('cycle_rules')
        .update({
          min_saving: Number(values.min_saving),
          membership_fee: Number(values.membership_fee),
          penalty_per_day: Number(values.penalty_per_day),
          loan_rate: Number(values.loan_rate_pct) / 100,
          excess_rate: Number(values.excess_rate_pct) / 100,
          window_open_day: Number(values.window_open_day),
          window_close_day: Number(values.window_close_day),
        })
        .eq('cycle_id', cycle.id)
        .select('cycle_id'),
      'rules_locked',
    );
  }, 'Cycle and rules saved');

  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setShowErrors(true);
        if (Object.keys(errors).length === 0) save.mutate(undefined);
      }}
    >
      <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            type={f.type ?? 'text'}
            inputMode={f.inputMode}
            maxLength={f.maxLength}
            className={f.key === 'label' ? 'sm:col-span-2' : undefined}
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            error={showErrors ? errors[f.key] : undefined}
          />
        ))}
      </fieldset>
      <div className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
        <p className="mb-1 font-semibold text-fg">Loan limits and repayment periods (from the constitution)</p>
        <ul role="list" className="grid gap-0.5">
          {[...loanLimitLines(cycle.rules.loan_multiples), ...tenorLines(cycle.rules.tenor_bands)].map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>
      {!locked ? (
        <Button type="submit" isLoading={save.isPending}>Save cycle and rules</Button>
      ) : null}
    </form>
  );
}

export function RulesSection() {
  const { group } = useGroup();
  const cycles = useCycles(group.id);
  if (cycles.isPending) return <Skeleton className="h-64" />;
  if (cycles.isError) return <Alert tone="danger">{friendlyError(cycles.error)}</Alert>;
  const planned = cycles.data.find((c) => c.status === 'planned');
  const shown = planned ?? pickCurrentCycle(cycles.data, localISODate(new Date()));
  if (!shown?.rules) return <Alert tone="info">No cycle has been set up yet.</Alert>;
  const locked = shown.status !== 'planned';
  return (
    <Section title="Cycle and rules" description="Editable until the cycle starts. After that the rules are locked for everyone.">
      {locked ? <Alert tone="info">{shown.label} has started, so its rules are locked.</Alert> : null}
      <RulesForm key={shown.id} cycle={shown as CycleWithRules & { rules: NonNullable<CycleWithRules['rules']> }} locked={locked} />
    </Section>
  );
}
