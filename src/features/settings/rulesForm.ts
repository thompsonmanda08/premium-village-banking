export type RulesFormValues = {
  label: string;
  starts_on: string;
  ends_on: string;
  payout_on: string;
  min_saving: string;
  membership_fee: string;
  penalty_per_day: string;
  loan_rate_pct: string;
  excess_rate_pct: string;
  window_open_day: string;
  window_close_day: string;
};

type CycleInput = {
  label: string;
  starts_on: string;
  ends_on: string;
  payout_on: string;
  rules: { min_saving: number; membership_fee: number; penalty_per_day: number; loan_rate: number; excess_rate: number; window_open_day: number; window_close_day: number };
};

const asPct = (rate: number) => String(Math.round(rate * 10000) / 100);

export function toFormValues(c: CycleInput): RulesFormValues {
  return {
    label: c.label,
    starts_on: c.starts_on,
    ends_on: c.ends_on,
    payout_on: c.payout_on,
    min_saving: String(c.rules.min_saving),
    membership_fee: String(c.rules.membership_fee),
    penalty_per_day: String(c.rules.penalty_per_day),
    loan_rate_pct: asPct(c.rules.loan_rate),
    excess_rate_pct: asPct(c.rules.excess_rate),
    window_open_day: String(c.rules.window_open_day),
    window_close_day: String(c.rules.window_close_day),
  };
}

const num = (v: string) => (v.trim() === '' ? Number.NaN : Number(v));

export function validateRules(f: RulesFormValues): Partial<Record<keyof RulesFormValues, string>> {
  const e: Partial<Record<keyof RulesFormValues, string>> = {};
  if (!f.label.trim()) e.label = 'Enter a name for the cycle.';
  if (!f.starts_on) e.starts_on = 'Choose a start date.';
  if (!f.ends_on || f.ends_on <= f.starts_on) e.ends_on = 'The cycle must end after it starts.';
  if (!f.payout_on || f.payout_on > f.ends_on) e.payout_on = 'Payout must be on or before the end date.';
  for (const k of ['min_saving', 'membership_fee', 'penalty_per_day'] as const) {
    if (!(num(f[k]) >= 0)) e[k] = 'Enter an amount of 0 or more.';
  }
  for (const k of ['loan_rate_pct', 'excess_rate_pct'] as const) {
    const v = num(f[k]);
    if (!(v >= 0 && v <= 100)) e[k] = 'Enter a percentage between 0 and 100.';
  }
  const open = num(f.window_open_day);
  const close = num(f.window_close_day);
  if (!(Number.isInteger(open) && open >= 1 && open <= 28)) e.window_open_day = 'Use a day between 1 and 28.';
  if (!(Number.isInteger(close) && close >= 1 && close <= 28)) e.window_close_day = 'Use a day between 1 and 28.';
  else if (close < open) e.window_close_day = 'The window must close on or after it opens.';
  return e;
}
