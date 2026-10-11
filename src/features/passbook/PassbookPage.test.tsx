import { screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger, statement, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ cycle: vi.fn(), statements: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useMyStatements: () => hooks.statements(),
}));
const { PassbookPage } = await import('./PassbookPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const cycle = (periods = year(8, 'open')) => ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods });

beforeEach(() => {
  hooks.cycle.mockReturnValue(cycle());
  hooks.statements.mockReturnValue(ok([]));
});

test('headline figures come from the latest statement and name its month', () => {
  hooks.statements.mockReturnValue(
    ok([
      statement({ id: 's7', period_id: 'p7', cum_savings: 1750, closing_owed: 100 }),
      statement({ id: 's8', period_id: 'p8', cum_savings: 2500, closing_owed: 700, next_minimum: 300, interest_earned_to_date: 41.5 }),
    ]),
  );
  renderLedger(<PassbookPage />);
  expect(screen.getByText('As at Sep 2026')).toBeInTheDocument();
  expect(screen.getByText('Total saved').parentElement).toHaveTextContent('K 2,500');
  expect(screen.getByText('You owe').parentElement).toHaveTextContent('K 700');
  expect(screen.getByText('Next minimum').parentElement).toHaveTextContent('K 300');
  expect(screen.getByText('Interest earned to date').parentElement).toHaveTextContent('K 41.50');
});

test('months are listed newest first, each with its breakdown, hiding lines that are zero', () => {
  hooks.statements.mockReturnValue(
    ok([
      statement({ id: 's7', period_id: 'p7', saving: 250, paid_total: 250 }),
      statement({ id: 's8', period_id: 'p8', saving: 300, loan_interest_charged: 45, paid_total: 345, paid_to_interest: 45, closing_owed: 0 }),
    ]),
  );
  renderLedger(<PassbookPage />);
  const cards = screen.getAllByRole('group');
  expect(within(cards[0]!).getByText('Sep 2026')).toBeInTheDocument();
  expect(within(cards[1]!).getByText('Aug 2026')).toBeInTheDocument();
  expect(within(cards[0]!).getByText('Loan interest charged')).toBeInTheDocument();
  expect(within(cards[0]!).queryByText('Penalties charged')).toBeNull();
  expect(within(cards[0]!).getByText('Closing owed').parentElement).toHaveTextContent('K 0');
});

test('a statement from outside the active cycle is neither listed nor used for the headline', () => {
  hooks.statements.mockReturnValue(
    ok([statement({ id: 'old', period_id: 'gone', cum_savings: 99999 }), statement({ id: 's8', period_id: 'p8', cum_savings: 2500 })]),
  );
  renderLedger(<PassbookPage />);
  expect(screen.getByText('Total saved').parentElement).toHaveTextContent('K 2,500');
  expect(screen.queryByText(/99,999/)).toBeNull();
  expect(screen.getAllByRole('group')).toHaveLength(1);
});

test('negative lines from corrections are shown, so the card explains its own closing balance', () => {
  hooks.statements.mockReturnValue(ok([statement({ id: 's8', period_id: 'p8', penalties_charged: -50, paid_to_principal: -100, closing_owed: 300 })]));
  renderLedger(<PassbookPage />);
  const card = screen.getByRole('group');
  expect(within(card).getByText('Penalties charged').parentElement).toHaveTextContent('−50');
  expect(within(card).getByText('Paid to loan principal').parentElement).toHaveTextContent('−100');
});

test('a credit is shown as a credit, not as owing a negative amount', () => {
  hooks.statements.mockReturnValue(ok([statement({ id: 's8', period_id: 'p8', closing_owed: -50 })]));
  renderLedger(<PassbookPage />);
  expect(screen.getByText('In credit').parentElement).toHaveTextContent('K 50');
  expect(screen.queryByText('You owe')).toBeNull();
});

test('the owed figure says which statement it is from, since later activity is in the Record', () => {
  hooks.statements.mockReturnValue(ok([statement({ id: 's8', period_id: 'p8', closing_owed: 700 })]));
  renderLedger(<PassbookPage />);
  expect(screen.getByText('You owe').parentElement).toHaveTextContent('At close of Sep 2026');
});

test('the open month is explained: its statement comes when the treasurer closes it', () => {
  hooks.statements.mockReturnValue(ok([statement()]));
  renderLedger(<PassbookPage />);
  expect(screen.getByText('Your Oct 2026 statement appears when the treasurer closes the month.')).toBeInTheDocument();
});

test('no statements yet: an empty state', () => {
  renderLedger(<PassbookPage />);
  expect(screen.getByText('No statements yet')).toBeInTheDocument();
});

test('a member without a profile is handled by the shared frame', () => {
  renderLedger(<PassbookPage />, { member: null });
  expect(screen.getByText('Your account isn’t linked to a member')).toBeInTheDocument();
});
