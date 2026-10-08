import { expect, test } from 'vitest';
import { loanLimitLines, tenorLines } from './rulesText';

test('loan limits read as sentences', () => {
  expect(loanLimitLines([
    { from_month: 1, to_month: 4, multiple: 3 },
    { from_month: 12, to_month: 12, multiple: 0 },
  ])).toEqual(['Months 1–4: up to 3× your savings', 'Month 12: no new loans']);
});

test('repayment periods read as sentences with no overlap at the boundaries', () => {
  expect(tenorLines([
    { max: 3000, months: 1 },
    { max: 5000, months: 2 },
    { max: 9999.99, months: 3 },
    { max: null, months: 4 },
  ])).toEqual([
    'Up to K 3,000: 1 month',
    'K 3,000.01 to K 5,000: 2 months',
    'K 5,000.01 to K 9,999.99: 3 months',
    'K 10,000 and above: 4 months',
  ]);
});

test('malformed JSON yields no lines instead of crashing', () => {
  expect(loanLimitLines(null)).toEqual([]);
  expect(tenorLines({ not: 'an array' })).toEqual([]);
});

test('malformed entries are skipped, not rendered or thrown on', () => {
  expect(loanLimitLines([null, {}, { from_month: 1, to_month: 4, multiple: 3 }, { from_month: '1', to_month: 2, multiple: 1 }, 'x'])).toEqual([
    'Months 1–4: up to 3× your savings',
  ]);
  expect(tenorLines([null, {}, { months: 2 }, { max: '5000', months: 2 }, { max: 3000 }, { max: 3000, months: 1 }, { max: null, months: 4 }])).toEqual([
    'Up to K 3,000: 1 month',
    'K 3,000.01 and above: 4 months',
  ]);
});

test('repayment bands are sorted by maximum, open-ended last', () => {
  expect(tenorLines([
    { max: null, months: 4 },
    { max: 5000, months: 2 },
    { max: 9999.99, months: 3 },
    { max: 3000, months: 1 },
  ])).toEqual([
    'Up to K 3,000: 1 month',
    'K 3,000.01 to K 5,000: 2 months',
    'K 5,000.01 to K 9,999.99: 3 months',
    'K 10,000 and above: 4 months',
  ]);
});
