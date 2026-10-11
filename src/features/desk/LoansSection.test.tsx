import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { declaration, loan, renderLedger } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ loans: vi.fn(), check: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/features/ledger/useDebouncedValue', () => ({ useDebouncedValue: <T,>(v: T) => v }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useMonthLoans: () => hooks.loans(),
  useLoanCheck: () => hooks.check(),
}));
const { LoansSection } = await import('./LoansSection');

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
const WALLETS = [{ id: 'w1', name: 'Airtel' }];
const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });

const renderSection = (declarations = [declaration({ borrowing_request: 1000 })]) =>
  renderLedger(<LoansSection periodId="p9" declarations={declarations} members={MEMBERS} wallets={WALLETS} />, { isAdmin: true });

beforeEach(() => {
  hooks.loans.mockReturnValue(ok([]));
  hooks.check.mockReturnValue({ data: undefined, isError: false, error: null, isFetching: false });
});

test('a borrowing request shows its member and amount, with a Send loan button', () => {
  renderSection();
  const row = screen.getByRole('button', { name: 'Send loan to Eve' }).closest('li')!;
  expect(within(row).getByText('Eve')).toBeInTheDocument();
  expect(within(row).getByText('K 1,000')).toBeInTheDocument();
});

test('Send loan opens the sheet with the request filled in', async () => {
  renderSection();
  await userEvent.click(screen.getByRole('button', { name: 'Send loan to Eve' }));
  expect(screen.getByRole('dialog', { name: 'Send a loan' })).toBeInTheDocument();
  expect(screen.getByLabelText('Member')).toHaveValue('m1');
  expect(screen.getByLabelText('Amount')).toHaveValue('1000');
});

test('a request that has been served shows what was sent, not a button', () => {
  hooks.loans.mockReturnValue(ok([loan({ id: 'l1', member_id: 'm1', principal: 1000, interest: 150, term_months: 1, wallet_id: 'w1' })]));
  renderSection();
  expect(screen.queryByRole('button', { name: 'Send loan to Eve' })).toBeNull();
  expect(screen.getByText('Sent K 1,000')).toBeInTheDocument();
});

test('Send a loan opens an empty sheet for a loan nobody requested', async () => {
  renderSection([]);
  expect(screen.getByText('No borrowing requests this month.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Send a loan' }));
  expect(screen.getByLabelText('Member')).toHaveValue('');
  expect(screen.getByLabelText('Amount')).toHaveValue('');
});

test('loans sent this month are listed with their terms and any stored warning', () => {
  hooks.loans.mockReturnValue(
    ok([loan({ id: 'l1', member_id: 'm2', principal: 800, interest: 120, term_months: 1, wallet_id: 'w1', cap_warning: 'Over the cap: owes K0, new loan K800, cap K750', arrears_warning: null })]),
  );
  renderSection([]);
  const list = screen.getByRole('heading', { name: 'Loans sent this month (1)' }).closest('div')!;
  expect(within(list).getByText('Ann')).toBeInTheDocument();
  expect(within(list).getByText('K 800')).toBeInTheDocument();
  expect(within(list).getByText(/Interest K 120 · 1 month · Airtel/)).toBeInTheDocument();
  expect(within(list).getByText(/Over the cap: owes K0/)).toBeInTheDocument();
});

test('nothing sent yet says so', () => {
  renderSection([]);
  expect(screen.getByText('No loans sent yet this month.')).toBeInTheDocument();
});

test('loading and failure of the loans query', async () => {
  hooks.loans.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderSection();
  expect(screen.getByText('Loading loans')).toBeInTheDocument();
  unmount();
  const refetch = vi.fn();
  hooks.loans.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch });
  renderSection();
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
});
