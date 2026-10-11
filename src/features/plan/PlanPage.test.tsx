import { screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { instalment, loan, renderLedger, statement, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ cycle: vi.fn(), loans: vi.fn(), statements: vi.fn(), payout: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useMyLoans: () => hooks.loans(),
  useMyStatements: () => hooks.statements(),
  usePayoutPreview: () => hooks.payout(),
}));
const { PlanPage } = await import('./PlanPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const PAYOUT = { member_id: 'm1', short_name: 'Eve', savings: 2500, interest_earned: 40, owed: 700, pot_share: 12.5, payout: 1852.5 };

beforeEach(() => {
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8, 'open') }));
  hooks.loans.mockReturnValue(ok([]));
  hooks.statements.mockReturnValue(ok([statement({ closing_owed: 700, next_minimum: 300 })]));
  hooks.payout.mockReturnValue(ok(PAYOUT));
});

test('shows what you owe and the next minimum from the latest statement', () => {
  renderLedger(<PlanPage />);
  expect(screen.getByText('As at Sep 2026')).toBeInTheDocument();
  expect(screen.getByText('You owe').parentElement).toHaveTextContent('K 700');
  expect(screen.getByText('Next minimum').parentElement).toHaveTextContent('K 300');
});

test('open loans list their remaining instalments and total; closed months are left out', () => {
  hooks.loans.mockReturnValue(
    ok([
      {
        ...loan({ id: 'l1', principal: 1000, interest: 150, term_months: 3, sent_at: '2026-09-02T09:00:00Z' }),
        instalments: [
          instalment({ id: 'i8', period_id: 'p8', amount_due: 383.33 }),
          instalment({ id: 'i9', period_id: 'p9', amount_due: 383.33 }),
          instalment({ id: 'i10', period_id: 'p10', amount_due: 383.34 }),
        ],
      },
    ]),
  );
  renderLedger(<PlanPage />);
  const card = screen.getByRole('heading', { name: 'Loan of K 1,000' }).closest('section')!;
  expect(within(card).getByText(/Interest K 150/)).toBeInTheDocument();
  expect(within(card).getByText(/3 months/)).toBeInTheDocument();
  expect(within(card).getByText('Oct 2026')).toBeInTheDocument();
  expect(within(card).getByText('Nov 2026')).toBeInTheDocument();
  expect(within(card).queryByText('Sep 2026')).toBeNull();
  expect(within(card).getByText('Still to pay in instalments K 766.67')).toBeInTheDocument();
});

test('a loan whose instalments are all in closed months says none are left', () => {
  hooks.loans.mockReturnValue(ok([{ ...loan(), instalments: [instalment({ period_id: 'p8' })] }]));
  renderLedger(<PlanPage />);
  expect(screen.getByText('No instalments left in the schedule.')).toBeInTheDocument();
  expect(screen.getByText('Still to pay in instalments K 0')).toBeInTheDocument();
});

test('no open loans: says so', () => {
  renderLedger(<PlanPage />);
  expect(screen.getByText('You have no open loans.')).toBeInTheDocument();
});

test('the payout projection shows the member’s own figures and is labelled a projection', () => {
  renderLedger(<PlanPage />);
  const block = screen.getByRole('heading', { name: 'If the cycle paid out today' }).closest('section')!;
  expect(within(block).getByText('Savings').nextElementSibling).toHaveTextContent('K 2,500');
  expect(within(block).getByText('Interest earned').nextElementSibling).toHaveTextContent('K 40');
  expect(within(block).getByText('Less what you owe').nextElementSibling).toHaveTextContent('K 700');
  expect(within(block).getByText('Share of the pots').nextElementSibling).toHaveTextContent('K 12.50');
  expect(within(block).getByText('You would receive').nextElementSibling).toHaveTextContent('K 1,852.50');
  expect(within(block).getByText(/projection from today’s figures, not a promise/)).toBeInTheDocument();
});

test('with no preview row the payout block is left out', () => {
  hooks.payout.mockReturnValue(ok(null));
  renderLedger(<PlanPage />);
  expect(screen.queryByRole('heading', { name: 'If the cycle paid out today' })).toBeNull();
});

test('a failed payout preview does not hide the rest of the plan', () => {
  hooks.payout.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch: vi.fn() });
  renderLedger(<PlanPage />);
  expect(screen.getByText('You owe').parentElement).toHaveTextContent('K 700');
  expect(screen.getByText('The payout projection couldn’t be loaded just now.')).toBeInTheDocument();
});

test('no statement yet: the figures say so instead of showing zeros', () => {
  hooks.statements.mockReturnValue(ok([]));
  renderLedger(<PlanPage />);
  expect(screen.getByText('Your first statement appears when the treasurer closes a month.')).toBeInTheDocument();
});
