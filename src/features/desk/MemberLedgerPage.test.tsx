import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { entry, memberStatus, renderLedger, year } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const hooks = vi.hoisted(() => ({ members: vi.fn(), cycle: vi.fn(), entries: vi.fn(), statuses: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useParams: () => ({ memberId: 'm1' }) }));
vi.mock('@/features/group/GroupPage', () => ({ useGroupMembers: () => hooks.members() }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useMyEntries: () => hooks.entries(),
  useMemberStatuses: () => hooks.statuses(),
}));
const { MemberLedgerPage } = await import('./MemberLedgerPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const cycleOk = (periods = year(8, 'open')) => ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods });
const MEMBER_ROWS = [{ id: 'm1', full_name: 'Eve Example', short_name: 'Eve', status: 'active' }];

// The pgTAP scenario: a penalty of 100 in September, waived 30, raised 20, reduced 10 in October: 80 now.
const PENALTY = entry({ id: 'e1', kind: 'penalty', amount: 100, source: 'app', period_id: 'p8', reason: 'other: Missed the meeting', created_at: '2026-09-05T08:00:00Z' });
const CORRECTIONS = [
  entry({ id: 'c1', kind: 'waiver', amount: 30, source: 'correction', corrects_entry_id: 'e1', reason: 'Slip found', period_id: 'p9', created_at: '2026-10-08T08:00:00Z' }),
  entry({ id: 'c2', kind: 'penalty', amount: 20, source: 'correction', corrects_entry_id: 'e1', reason: 'Treasurer raised it', period_id: 'p9', created_at: '2026-10-08T08:01:00Z' }),
  entry({ id: 'c3', kind: 'adjustment', amount: 10, source: 'correction', corrects_entry_id: 'e1', reason: 'Settled on 80', period_id: 'p9', created_at: '2026-10-08T08:02:00Z' }),
];
const SAVING = entry({ id: 'e2', kind: 'saving', amount: 250, source: 'import', period_id: 'p8', created_at: '2026-09-05T09:00:00Z' });
const LOAN = entry({ id: 'e3', kind: 'loan_sent', amount: 1000, source: 'app', period_id: 'p8', created_at: '2026-09-02T09:00:00Z' });
const INTEREST_SHARE = entry({ id: 'e4', kind: 'interest_share', amount: 12, source: 'close', period_id: 'p8', created_at: '2026-09-30T09:00:00Z' });

const renderPage = (isAdmin = true) => renderLedger(<MemberLedgerPage />, { isAdmin });

beforeEach(() => {
  rpc.mockReset();
  hooks.members.mockReturnValue(ok(MEMBER_ROWS));
  hooks.cycle.mockReturnValue(cycleOk());
  hooks.entries.mockReturnValue(ok([PENALTY, ...CORRECTIONS, SAVING, LOAN, INTEREST_SHARE]));
  hooks.statuses.mockReturnValue(ok([]));
});

test('members get the admins-only screen and no ledger request is made', () => {
  renderPage(false);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(hooks.entries).not.toHaveBeenCalled();
});

test('a member who is not in the group says so', () => {
  hooks.members.mockReturnValue(ok([{ id: 'zz', full_name: 'Zed', short_name: 'Zed', status: 'active' }]));
  renderPage();
  expect(screen.getByText('That member isn’t in this group.')).toBeInTheDocument();
});

test('entries are grouped by month and corrections are nested under their original, not rows of their own', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: 'Eve Example' })).toBeInTheDocument();
  const sep = screen.getByRole('heading', { name: 'Sep 2026' }).closest('section')!;
  const penalty = within(sep).getByText('Penalty').closest('li')!;
  expect(within(penalty).getByText('K 100')).toBeInTheDocument();
  expect(within(penalty).getByText('Now K 80')).toBeInTheDocument();
  expect(within(penalty).getByText('−K 30 waived: Slip found')).toBeInTheDocument();
  expect(within(penalty).getByText('+K 20 added: Treasurer raised it')).toBeInTheDocument();
  expect(within(penalty).getByText('−K 10 reduced: Settled on 80')).toBeInTheDocument();
  // October only holds the three corrections, which are nested, so October has no month group of its own.
  expect(screen.queryByRole('heading', { name: 'Oct 2026' })).toBeNull();
});

test('Correct and Waive appear only where the engine allows them', () => {
  renderPage();
  expect(screen.getByRole('button', { name: 'Correct Penalty K 100 from Sep 2026' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Waive Penalty K 100 from Sep 2026' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Correct Savings K 250 from Sep 2026' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /Waive Savings/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Loan sent/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Interest earned/ })).toBeNull();
});

test('a charge with nothing left to waive offers no Waive', () => {
  const waiver = entry({ id: 'c9', kind: 'waiver', amount: 100, source: 'correction', corrects_entry_id: 'e1', reason: 'all', period_id: 'p9' });
  hooks.entries.mockReturnValue(ok([PENALTY, waiver]));
  renderPage();
  expect(screen.getByText('Now K 0')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Waive Penalty/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Correct Penalty K 100 from Sep 2026' })).toBeEnabled();
});

test('the note says where corrections land', () => {
  renderPage();
  expect(screen.getByText('Corrections land in Oct 2026; the original stays in its own month.')).toBeInTheDocument();
});

test('with no open month the posting buttons are disabled and the page says why', () => {
  hooks.cycle.mockReturnValue(cycleOk(year(9)));
  renderPage();
  expect(screen.getByText('Open the next month to post corrections or waivers.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Correct Penalty K 100 from Sep 2026' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Waive Penalty K 100 from Sep 2026' })).toBeDisabled();
});

test('Correct opens the sheet with what it is now, and Waive with how much is still charged', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Correct Penalty K 100 from Sep 2026' }));
  expect(screen.getByRole('dialog', { name: 'Correct an entry' })).toBeInTheDocument();
  expect(screen.getByText('Now').nextElementSibling).toHaveTextContent('K 80');
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  await userEvent.click(screen.getByRole('button', { name: 'Waive Penalty K 100 from Sep 2026' }));
  expect(screen.getByRole('dialog', { name: 'Waive a charge' })).toBeInTheDocument();
  expect(screen.getByText('Still charged').nextElementSibling).toHaveTextContent('K 80');
});

test('the default panel shows the member’s status for the cycle', () => {
  hooks.statuses.mockReturnValue(ok([memberStatus({ member_id: 'm1', defaulted: true }), memberStatus({ id: 'ms2', member_id: 'other', defaulted: false })]));
  renderPage();
  expect(screen.getByText('Defaulted')).toBeInTheDocument();
});

test('nothing recorded yet says so', () => {
  hooks.entries.mockReturnValue(ok([]));
  renderPage();
  expect(screen.getByText('Nothing recorded for this member yet.')).toBeInTheDocument();
});

test('loading and failure of the entries', async () => {
  hooks.entries.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderPage();
  expect(screen.getByText('Loading the member’s ledger')).toBeInTheDocument();
  unmount();
  const refetch = vi.fn();
  hooks.entries.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch });
  renderPage();
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
});
