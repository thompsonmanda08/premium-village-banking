import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { closePreview, declaration, loan, renderLedger, year } from '@/features/ledger/testFixtures';

const rpc = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const hooks = vi.hoisted(() => ({
  cycle: vi.fn(), declarations: vi.fn(), members: vi.fn(), suggestions: vi.fn(), applied: vi.fn(), loans: vi.fn(), preview: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => navigate }));
vi.mock('@/features/group/GroupPage', () => ({ useGroupMembers: () => hooks.members() }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useDeclarations: () => hooks.declarations(),
  useSuggestedPenalties: () => hooks.suggestions(),
  useMonthPenalties: () => hooks.applied(),
  useMonthLoans: () => hooks.loans(),
  useClosePreview: () => hooks.preview(),
}));
const { ClosePage } = await import('./ClosePage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const previewOk = (p = closePreview(), extra: Record<string, unknown> = {}) => ({
  ...ok(p), isSuccess: true, isFetching: false, isPlaceholderData: false, ...extra,
});
const MEMBER_ROWS = [
  { id: 'm1', short_name: 'Eve', status: 'active' },
  { id: 'm2', short_name: 'Ann', status: 'active' },
  { id: 'm3', short_name: 'Bob', status: 'active' },
];
const renderPage = (isAdmin = true) => renderLedger(<ClosePage />, { isAdmin });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: {}, error: null });
  navigate.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T10:00:00'));
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8, 'open') }));
  hooks.declarations.mockReturnValue(
    ok([declaration({ id: 'd1', member_id: 'm1', status: 'approved' }), declaration({ id: 'd2', member_id: 'm2', status: 'approved' }), declaration({ id: 'd3', member_id: 'm3', status: 'approved' })]),
  );
  hooks.members.mockReturnValue(ok(MEMBER_ROWS));
  hooks.suggestions.mockReturnValue(ok([]));
  hooks.applied.mockReturnValue(ok([]));
  hooks.loans.mockReturnValue(ok([]));
  hooks.preview.mockReturnValue(previewOk());
});

test('members get the admins-only screen and no ledger request is made', () => {
  renderPage(false);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(hooks.cycle).not.toHaveBeenCalled();
  expect(hooks.preview).not.toHaveBeenCalled();
});

test('with no open month there is nothing to close', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(8) }));
  renderPage();
  expect(screen.getByText('No month is open to close.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Close / })).toBeNull();
});

test('the checklist says what is ready and what is not', () => {
  hooks.declarations.mockReturnValue(ok([declaration({ id: 'd1', member_id: 'm1', status: 'approved', borrowing_request: 1000 })]));
  hooks.suggestions.mockReturnValue(ok([{ member_id: 'm2', short_name: 'Ann', ground: 'late_declaration', amount: 50, detail: 'x' }]));
  renderPage();
  const list = screen.getByRole('heading', { name: 'Before you close' }).closest('section')!;
  expect(within(list).getByText('No declarations are waiting.')).toBeInTheDocument();
  expect(within(list).getByText(/2 members have not declared: Ann, Bob/)).toBeInTheDocument();
  expect(within(list).getByText('1 suggested penalty has not been applied.')).toBeInTheDocument();
  expect(within(list).getByText('1 borrowing request has not been sent.')).toBeInTheDocument();
  expect(within(list).getByText(/Declarations due 7 Oct 2026/)).toBeInTheDocument();
  expect(within(list).getByText('2 days left')).toBeInTheDocument();
});

test('a waiting declaration blocks the close and points back to the Desk', () => {
  hooks.declarations.mockReturnValue(ok([declaration({ id: 'd1', member_id: 'm1', status: 'submitted' })]));
  renderPage();
  expect(screen.getByText('1 declaration is waiting. Approve or return it on the Desk first.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to the Desk' })).toHaveAttribute('href', '/desk');
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeDisabled();
});

test('the preview loading and failing are handled; a refusal reads as its friendly sentence with a retry', async () => {
  hooks.preview.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn(), isSuccess: false, isFetching: true, isPlaceholderData: false });
  const { unmount } = renderPage();
  expect(screen.getByText('Loading the preview')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeDisabled();
  unmount();
  const refetch = vi.fn();
  hooks.preview.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'declarations_pending', code: 'P0001' }, refetch, isSuccess: false, isFetching: false, isPlaceholderData: false });
  renderPage();
  expect(screen.getByText('Some declarations are still waiting. Approve or return them first.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeDisabled();
});

test('the preview is shown, with the commit text naming how many statements it writes', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: 'Group statement' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Members (2)' })).toBeInTheDocument();
  expect(screen.getByText('This writes 2 statements and locks Oct 2026. Anything you correct later goes into the next month.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeEnabled();
});

test('Refresh preview asks again', async () => {
  const refetch = vi.fn();
  hooks.preview.mockReturnValue(previewOk(closePreview(), { refetch }));
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Refresh preview' }));
  expect(refetch).toHaveBeenCalled();
});

test('closing takes a second tap and sends the commit once, then goes back to the Desk', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  expect(rpc).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to close Oct 2026' }));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('close_month', { p_period: 'p9', p_commit: true, p_reason: undefined });
  expect(await screen.findByText('Oct 2026 is closed.')).toBeInTheDocument();
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/desk'));
});

test('unexplained differences need a written reason before the close can be sent, and the reason is sent', async () => {
  hooks.preview.mockReturnValue(
    previewOk(closePreview({ unexplained: 1, diff: [{ member_id: 'm1', short_name: 'Eve', field: 'cum_savings', app: 300, workbook: 350, difference: -50, reason_code: 'unexplained' }] })),
  );
  renderPage();
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Why the differences are acceptable'), 'Workbook typo, checked by hand');
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to close Oct 2026' }));
  expect(rpc).toHaveBeenCalledWith('close_month', { p_period: 'p9', p_commit: true, p_reason: 'Workbook typo, checked by hand' });
});

test('no reason field when nothing is unexplained', () => {
  renderPage();
  expect(screen.queryByLabelText('Why the differences are acceptable')).toBeNull();
});

test('editing the reason or refreshing the preview disarms the second tap', async () => {
  hooks.preview.mockReturnValue(previewOk(closePreview({ unexplained: 1, diff: [{ member_id: 'm1', short_name: 'Eve', field: 'cum_savings', app: 300, workbook: 350, difference: -50, reason_code: 'unexplained' }] })));
  renderPage();
  await userEvent.type(screen.getByLabelText('Why the differences are acceptable'), 'ok');
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  expect(screen.getByRole('button', { name: 'Tap again to close Oct 2026' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Why the differences are acceptable'), '!');
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'Refresh preview' }));
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeInTheDocument();
});

test('a preview that is refetching cannot be committed', () => {
  hooks.preview.mockReturnValue(previewOk(closePreview(), { isFetching: true }));
  renderPage();
  expect(screen.getByRole('button', { name: 'Close Oct 2026' })).toBeDisabled();
});

test('tapping again while the close is running does not send a second one', async () => {
  rpc.mockReturnValue(new Promise(() => {}));
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to close Oct 2026' }));
  await userEvent.click(screen.getByRole('button', { name: /Close Oct 2026|Tap again/ }));
  expect(rpc).toHaveBeenCalledTimes(1);
});

test('already closed (a retry after a dropped connection) says so and stays put', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'already_closed', code: 'P0001' } });
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to close Oct 2026' }));
  expect(await screen.findByText('This month is already closed.')).toBeInTheDocument();
  expect(navigate).not.toHaveBeenCalled();
});

test('an unexplained-differences refusal from the server is shown in plain words', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'unexplained_differences', code: 'P0001' } });
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Close Oct 2026' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to close Oct 2026' }));
  expect(await screen.findByText('Some differences from the workbook aren’t explained. Add a reason to close the month anyway.')).toBeInTheDocument();
});

test('loans already sent to a requester are not counted as unsent requests', () => {
  hooks.declarations.mockReturnValue(ok([declaration({ id: 'd1', member_id: 'm1', status: 'approved', borrowing_request: 1000 }), declaration({ id: 'd2', member_id: 'm2', status: 'approved' }), declaration({ id: 'd3', member_id: 'm3', status: 'approved' })]));
  hooks.loans.mockReturnValue(ok([loan({ member_id: 'm1', principal: 1000 })]));
  renderPage();
  expect(screen.getByText('No borrowing requests are waiting.')).toBeInTheDocument();
});
