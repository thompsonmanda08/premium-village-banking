import { expect, test } from 'vitest';
import { EMPTY_FORM, fromDeclaration, validateDeclaration } from './declarationForm';
import { declaration } from './testFixtures';

const form = (o: Partial<typeof EMPTY_FORM>) => ({ ...EMPTY_FORM, ...o });

test('a valid form becomes numeric arguments, blanks become zero, a blank note is dropped', () => {
  const r = validateDeclaration(form({ saving: '250', loan_repayment: '100.5', wallet: 'w1', note: '  ' }));
  expect(r).toEqual({
    args: { saving: 250, loan_repayment: 100.5, excess: 0, membership: 0, penalty: 0, txn_fee: 0, borrowing_request: 0, wallet: 'w1', note: undefined },
  });
});

test('a bad amount names the field and sends nothing', () => {
  const r = validateDeclaration(form({ saving: '1,000', wallet: 'w1' }));
  expect(r).toEqual({ errors: { saving: 'Use kwacha and ngwee, like 250 or 250.50.' } });
});

test('all-zero is refused, but a borrowing request alone is a declaration', () => {
  expect(validateDeclaration(form({}))).toEqual({ errors: { form: 'Enter at least one amount.' } });
  expect('args' in validateDeclaration(form({ borrowing_request: '1000' }))).toBe(true);
});

test('sending money needs a wallet', () => {
  expect(validateDeclaration(form({ saving: '250' }))).toEqual({ errors: { wallet: 'Choose the wallet you paid from.' } });
});

test('a note over 500 characters is refused', () => {
  expect(validateDeclaration(form({ saving: '250', wallet: 'w1', note: 'x'.repeat(501) }))).toEqual({
    errors: { note: 'Keep the note to 500 characters or fewer.' },
  });
});

test('fromDeclaration shows zero amounts as blanks so the form is not cluttered', () => {
  expect(fromDeclaration(declaration({ saving: 250, loan_repayment: 100.5, note: 'hi' }))).toEqual({
    ...EMPTY_FORM, saving: '250', loan_repayment: '100.5', wallet: 'w1', note: 'hi',
  });
});
