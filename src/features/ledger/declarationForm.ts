import { parseKwacha, sumKwacha } from './money';
import type { DeclarationRow } from './model';

export const AMOUNTS = [
  { key: 'saving', label: 'Savings' },
  { key: 'loan_repayment', label: 'Loan repayment' },
  { key: 'excess', label: 'Excess charge' },
  { key: 'membership', label: 'Membership' },
  { key: 'penalty', label: 'Penalty' },
  { key: 'txn_fee', label: 'Mobile-money fee' },
  { key: 'borrowing_request', label: 'Borrowing request' },
] as const;

export type AmountKey = (typeof AMOUNTS)[number]['key'];
export type FormValues = Record<AmountKey, string> & { wallet: string; note: string };
export type FormErrors = Partial<Record<AmountKey | 'wallet' | 'note' | 'form', string>>;
export type DeclarationArgs = Record<AmountKey, number> & { wallet: string | undefined; note: string | undefined };

export const EMPTY_FORM: FormValues = {
  saving: '', loan_repayment: '', excess: '', membership: '', penalty: '', txn_fee: '', borrowing_request: '', wallet: '', note: '',
};

const text = (n: number) => (n === 0 ? '' : String(n));

export const fromDeclaration = (d: DeclarationRow): FormValues => ({
  saving: text(d.saving), loan_repayment: text(d.loan_repayment), excess: text(d.excess), membership: text(d.membership),
  penalty: text(d.penalty), txn_fee: text(d.txn_fee), borrowing_request: text(d.borrowing_request),
  wallet: d.wallet_id ?? '', note: d.note ?? '',
});

/** Money maths stays in the database; this only checks shape so a typo never reaches it. */
export function validateDeclaration(v: FormValues): { args: DeclarationArgs } | { errors: FormErrors } {
  const errors: FormErrors = {};
  const nums: Partial<Record<AmountKey, number>> = {};
  for (const { key } of AMOUNTS) {
    const n = parseKwacha(v[key]);
    if (n === null) errors[key] = 'Use kwacha and ngwee, like 250 or 250.50.';
    else nums[key] = n;
  }
  const note = v.note.trim();
  if (note.length > 500) errors.note = 'Keep the note to 500 characters or fewer.';
  if (Object.keys(errors).length === 0) {
    const n = nums as Record<AmountKey, number>;
    // The borrowing request is a request, not money sent, so it needs no wallet.
    const sent = sumKwacha(n.saving, n.loan_repayment, n.excess, n.membership, n.penalty, n.txn_fee);
    if (sent === 0 && n.borrowing_request === 0) errors.form = 'Enter at least one amount.';
    else if (sent > 0 && !v.wallet) errors.wallet = 'Choose the wallet you paid from.';
  }
  if (Object.keys(errors).length > 0) return { errors };
  return { args: { ...(nums as Record<AmountKey, number>), wallet: v.wallet || undefined, note: note || undefined } };
}
