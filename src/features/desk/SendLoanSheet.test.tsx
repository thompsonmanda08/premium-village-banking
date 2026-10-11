import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import type { LoanCheck } from '@/features/ledger/queries';
import { renderLedger } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const hooks = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/features/ledger/useDebouncedValue', () => ({ useDebouncedValue: <T,>(v: T) => v }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLoanCheck: (memberId: string | undefined, principal: number | null) => hooks.check(memberId, principal),
}));
const { SendLoanSheet } = await import('./SendLoanSheet');

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
const WALLETS = [{ id: 'w1', name: 'Airtel' }, { id: 'w2', name: 'MTN' }];
const onClose = vi.fn();

const base: LoanCheck = {
  period_id: 'p9', label: 'Oct 2026', month_index: 9, loans_open: true, lending_cash: 6000, multiple: 2, cum_savings: 2000,
  loans_owed: 500, cap: 4000, headroom: 3500, arrears: null,
};
/** What the database answers: the member facts, plus the amount facts once an amount is given. */
const answer = (principal: number | null, extra: Partial<LoanCheck> = {}): LoanCheck =>
  principal === null
    ? { ...base, ...extra }
    : { ...base, principal, interest: Math.round(principal * 15) / 100, term_months: 1, over_cap: false, insufficient_cash: false, ...extra };
const respond = (extra: Partial<LoanCheck> = {}) =>
  hooks.check.mockImplementation((memberId: string | undefined, principal: number | null) => ({
    data: memberId ? answer(principal, extra) : undefined, isError: false, error: null, isFetching: false,
  }));

const renderSheet = (props: Partial<React.ComponentProps<typeof SendLoanSheet>> = {}) =>
  renderLedger(<SendLoanSheet members={MEMBERS} wallets={WALLETS} onClose={onClose} {...props} />, { isAdmin: true });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
  onClose.mockReset();
  respond();
});

test('opened from a request it starts with the member and amount filled in, and shows cash, limit and interest', () => {
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  expect(screen.getByLabelText('Member')).toHaveValue('m1');
  expect(screen.getByLabelText('Amount')).toHaveValue('1000');
  expect(screen.getByText('Lending cash on hand').nextElementSibling).toHaveTextContent('K 6,000');
  expect(screen.getByText('Limit (2× savings of K 2,000)').nextElementSibling).toHaveTextContent('K 4,000');
  expect(screen.getByText('Owes on loans').nextElementSibling).toHaveTextContent('K 500');
  expect(screen.getByText('Room under the limit').nextElementSibling).toHaveTextContent('K 3,500');
  expect(screen.getByText('Interest').nextElementSibling).toHaveTextContent('K 150');
  expect(screen.getByText('Term').nextElementSibling).toHaveTextContent('1 month');
});

test('nothing is asked until a member is chosen', () => {
  renderSheet();
  expect(hooks.check).toHaveBeenCalledWith(undefined, null);
  expect(screen.queryByText('Lending cash on hand')).toBeNull();
});

test('malformed amounts are not asked about and cannot be sent', async () => {
  renderSheet({ initialMemberId: 'm1' });
  for (const bad of ['1,000', '250.555', '-5', '1e3']) {
    await userEvent.clear(screen.getByLabelText('Amount'));
    await userEvent.type(screen.getByLabelText('Amount'), bad);
    expect(screen.getByText('Use kwacha and ngwee, like 250 or 250.50.'), bad).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send loan' })).toBeDisabled();
    // Typing passes through valid prefixes (1 on the way to 1,000); what matters is that the malformed value itself is never asked about.
    expect(hooks.check).toHaveBeenLastCalledWith('m1', null);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test('short of cash it says how much is available and cannot be sent', async () => {
  respond({ insufficient_cash: true, lending_cash: 800 });
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(screen.getByText('Only K 800 is on hand, which is less than this loan.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeDisabled();
});

test('no new loans this month blocks sending', async () => {
  respond({ loans_open: false });
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(screen.getByText('No new loans can be sent this month.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeDisabled();
});

test('over the limit a reason is required before it can be sent', async () => {
  respond({ over_cap: true });
  renderSheet({ initialMemberId: 'm1', initialAmount: 5000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(screen.getByText(/over the member’s limit/)).toBeInTheDocument();
  expect(screen.getByLabelText('Reason (required over the limit)')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Reason (required over the limit)'), 'Group agreed on the call');
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeEnabled();
});

test('arrears are shown as a warning and do not block', async () => {
  respond({ arrears: 'K20.00 of last month’s minimum unpaid (K20.00 due, K0.00 paid so far); already owes K20.00 in all' });
  renderSheet({ initialMemberId: 'm1', initialAmount: 500 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(screen.getByText(/K20.00 of last month’s minimum unpaid/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeEnabled();
});

test('sending takes a second tap, sends the typed values once, and closes', async () => {
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w2');
  await userEvent.type(screen.getByLabelText('Transfer fee (optional)'), '10');
  await userEvent.click(screen.getByRole('button', { name: 'Send loan' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to send K 1,000 to Eve' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('send_loan', { p_member: 'm1', p_principal: 1000, p_wallet: 'w2', p_reason: undefined, p_fee: 10 });
  expect(await screen.findByText('Loan sent.')).toBeInTheDocument();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('a typed reason is sent even when the loan is inside the limit', async () => {
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  await userEvent.type(screen.getByLabelText('Reason (required over the limit)'), 'For school fees');
  await userEvent.click(screen.getByRole('button', { name: 'Send loan' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to send K 1,000 to Eve' }));
  expect(rpc).toHaveBeenCalledWith('send_loan', expect.objectContaining({ p_reason: 'For school fees', p_fee: 0 }));
});

test('tapping again while the request runs does not send a second loan', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  await userEvent.click(screen.getByRole('button', { name: 'Send loan' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to send K 1,000 to Eve' }));
  await userEvent.click(screen.getByRole('button', { name: /Send loan|Tap again/ }));
  expect(rpc).toHaveBeenCalledTimes(1);
});

test('a refusal shows the friendly sentence and keeps the sheet open', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'insufficient_cash', code: 'P0001' } });
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  await userEvent.click(screen.getByRole('button', { name: 'Send loan' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to send K 1,000 to Eve' }));
  expect(await screen.findByText('There isn’t enough lending cash for this loan right now.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

test('the preview failing is shown and blocks sending', async () => {
  hooks.check.mockReturnValue({ data: undefined, isError: true, error: { message: 'period_not_open', code: 'P0001' }, isFetching: false });
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(screen.getByText('That month isn’t open. Pick the current month, or open it first.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeDisabled();
});

test('a preview that is still loading for the typed amount keeps Send disabled', async () => {
  hooks.check.mockImplementation((memberId: string | undefined) => ({
    data: memberId ? answer(null) : undefined, isError: false, error: null, isFetching: true,
  }));
  renderSheet({ initialMemberId: 'm1', initialAmount: 1000 });
  await userEvent.selectOptions(screen.getByLabelText('Wallet'), 'w1');
  expect(screen.getByRole('button', { name: 'Send loan' })).toBeDisabled();
});
