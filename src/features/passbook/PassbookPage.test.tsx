import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger, statement, year } from '@/features/ledger/testFixtures';

vi.mock('@/features/ledger/MyCharts', () => ({ MyCharts: () => null }));
vi.mock('./BreakdownPanel', () => ({ BreakdownPanel: ({ memberId, periodId }: { memberId: string; periodId: string }) => <p>Breakdown for {memberId} in {periodId}</p> }));
vi.mock('@/features/queries/QueryFigureSheet', () => ({
  QueryFigureSheet: ({ periodId, field }: { periodId: string; field: string }) => <p>Question sheet: {field} in {periodId}</p>,
}));
const hooks = vi.hoisted(() => ({ cycle: vi.fn(), statements: vi.fn(), queries: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useMyStatements: () => hooks.statements(),
}));
vi.mock('@/features/queries/queryHooks', async (orig) => ({
  ...(await orig<typeof import('@/features/queries/queryHooks')>()),
  useMyQueries: () => hooks.queries(),
}));
const { PassbookPage } = await import('./PassbookPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const cycle = (periods = year(8, 'open')) => ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods });

beforeEach(() => {
  hooks.cycle.mockReturnValue(cycle());
  hooks.statements.mockReturnValue(ok([]));
  hooks.queries.mockReturnValue(ok([]));
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

test('the breakdown and a question button for each figure appear for the latest statement', async () => {
  hooks.statements.mockReturnValue(ok([statement({ id: 's8', period_id: 'p8' })]));
  renderLedger(<PassbookPage />);
  expect(screen.getByText('Breakdown for m1 in p8')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Question / })).toHaveLength(6);
  expect(screen.queryByText(/^Question sheet/)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Question Closing balance' }));
  expect(screen.getByText('Question sheet: closing_owed in p8')).toBeInTheDocument();
});

const fq = (o = {}) => ({ id: 'q1', created_at: '2026-09-10T08:00:00Z', group_id: 'g1', period_id: 'p7', member_id: 'm1', field: 'next_minimum', note: 'Looks high', status: 'answered', reply: 'Checked, it is right', answered_by: 'u1', answered_at: '2026-09-11T08:00:00Z', ...o });

test('your questions: every month, newest first, with the reply or a wait, even for an older month', () => {
  hooks.statements.mockReturnValue(ok([statement({ id: 's8', period_id: 'p8' })]));
  hooks.queries.mockReturnValue(ok([fq({ id: 'q2', period_id: 'p8', field: 'closing_owed', note: 'Not what I paid', status: 'open', reply: null }), fq()]));
  renderLedger(<PassbookPage />);
  const section = screen.getByRole('region', { name: 'Your questions' });
  const rows = within(section).getAllByRole('listitem');
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent('Sep 2026');
  expect(rows[0]).toHaveTextContent('Closing balance');
  expect(rows[0]).toHaveTextContent('Your question: Not what I paid');
  expect(rows[0]).toHaveTextContent('Waiting for a reply');
  expect(rows[1]).toHaveTextContent('Aug 2026');
  expect(rows[1]).toHaveTextContent('Next minimum');
  expect(rows[1]).toHaveTextContent('Reply: Checked, it is right');
});

test('your questions: an empty state, and an error state', () => {
  const { unmount } = renderLedger(<PassbookPage />);
  expect(screen.getByText('You haven’t asked any questions.')).toBeInTheDocument();
  unmount();
  hooks.queries.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('x'), refetch: vi.fn() });
  renderLedger(<PassbookPage />);
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
