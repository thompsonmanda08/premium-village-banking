import { expect, test } from 'vitest';
import { toFormValues, validateRules, type RulesFormValues } from './rulesForm';

const valid: RulesFormValues = {
  label: 'Cycle 2027', starts_on: '2027-02-15', ends_on: '2028-02-15', payout_on: '2028-02-05',
  min_saving: '250', membership_fee: '50', penalty_per_day: '50', loan_rate_pct: '15', excess_rate_pct: '10',
  window_open_day: '5', window_close_day: '7',
};

test('accepts the constitution values', () => expect(validateRules(valid)).toEqual({}));
test('payout must fall inside the cycle: not after it ends, not before it starts', () => {
  expect(validateRules({ ...valid, payout_on: '2028-03-01' }).payout_on).toBeDefined();
  expect(validateRules({ ...valid, payout_on: '2027-02-14' }).payout_on).toBeDefined();
  expect(validateRules({ ...valid, payout_on: '2027-02-15' }).payout_on).toBeUndefined();
  expect(validateRules({ ...valid, payout_on: '2028-02-15' }).payout_on).toBeUndefined();
});
test('cycle must end after it starts', () => expect(validateRules({ ...valid, ends_on: '2027-02-01' }).ends_on).toBeDefined());
test('window must close on or after it opens', () => expect(validateRules({ ...valid, window_close_day: '4' }).window_close_day).toBeDefined());
test('amounts cannot be negative or blank', () => {
  expect(validateRules({ ...valid, min_saving: '-1' }).min_saving).toBeDefined();
  expect(validateRules({ ...valid, membership_fee: '' }).membership_fee).toBeDefined();
});
test('amounts must be finite and fit numeric(12,2)', () => {
  for (const bad of ['1e12', 'Infinity', '-Infinity', 'NaN', '10000000000', 'abc']) {
    expect(validateRules({ ...valid, min_saving: bad }).min_saving, bad).toBeDefined();
    expect(validateRules({ ...valid, penalty_per_day: bad }).penalty_per_day, bad).toBeDefined();
  }
  expect(validateRules({ ...valid, membership_fee: '9999999999.99' }).membership_fee).toBeUndefined();
  expect(validateRules({ ...valid, membership_fee: '0' }).membership_fee).toBeUndefined();
});
test('percentages reject non-numbers too', () => {
  for (const bad of ['Infinity', 'NaN', '', 'abc']) expect(validateRules({ ...valid, excess_rate_pct: bad }).excess_rate_pct, bad).toBeDefined();
});
test('percentages stay between 0 and 100', () => expect(validateRules({ ...valid, loan_rate_pct: '150' }).loan_rate_pct).toBeDefined());

test('toFormValues turns rates into clean percentages', () => {
  const v = toFormValues({
    label: 'Cycle 2027', starts_on: '2027-02-15', ends_on: '2028-02-15', payout_on: '2028-02-05',
    rules: { min_saving: 250, membership_fee: 50, penalty_per_day: 50, loan_rate: 0.15, excess_rate: 0.1, window_open_day: 5, window_close_day: 7 },
  });
  expect(v.loan_rate_pct).toBe('15');
  expect(v.excess_rate_pct).toBe('10');
});
