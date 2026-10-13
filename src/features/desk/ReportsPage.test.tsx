import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { renderLedger, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ cycle: vi.fn(), members: vi.fn() }));
const actions = vi.hoisted(() => ({ exportMonth: vi.fn(), exportPeriod: vi.fn(), exportMember: vi.fn() }));
const download = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/features/group/GroupPage', () => ({ useGroupMembers: () => hooks.members() }));
vi.mock('@/features/ledger/queries', async (orig) => ({ ...(await orig<typeof import('@/features/ledger/queries')>()), useLedgerCycle: () => hooks.cycle() }));
vi.mock('@/features/exports/exportActions', () => actions);
vi.mock('@/features/exports/download', () => ({ downloadBytes: download }));
const { ReportsPage } = await import('./ReportsPage');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const CYCLE = { id: 'c1', label: 'Cycle 2026' };
const ROWS = [
  { id: 'm1', short_name: 'Eve', full_name: 'Eve Example', status: 'active' },
  { id: 'm2', short_name: 'Ann', full_name: 'Ann Example', status: 'active' },
  { id: 'm3', short_name: 'Old', full_name: 'Old Example', status: 'left' },
];
const result = (fileName: string, note?: string) => ({ bytes: new Uint8Array([1]), fileName, note });
const renderPage = (isAdmin = true) => renderLedger(<ReportsPage />, { isAdmin });

beforeEach(() => {
  Object.values(actions).forEach((f) => f.mockReset());
  download.mockReset();
  hooks.cycle.mockReturnValue(ok({ cycle: CYCLE, periods: year(3, 'open') })); // Feb, Mar, Apr closed; May open
  hooks.members.mockReturnValue(ok(ROWS));
  actions.exportMonth.mockResolvedValue(result('Test Group Apr 2026.xlsx'));
  actions.exportPeriod.mockResolvedValue(result('Test Group Cycle 2026 through May 2026 (preview).xlsx'));
  actions.exportMember.mockResolvedValue(result('Test Group Ann Cycle 2026 through May 2026 (preview).xlsx'));
});

test('members get the admins-only screen and no request is made', () => {
  renderPage(false);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
  expect(hooks.cycle).not.toHaveBeenCalled();
});

test('loading, then an error with a way to retry', () => {
  hooks.cycle.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderPage();
  expect(screen.getByText('Loading the reports')).toBeInTheDocument();
  unmount();
  const refetch = vi.fn();
  hooks.cycle.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch });
  renderPage();
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

test('it warns that the files hold members’ figures', () => {
  renderPage();
  expect(screen.getByText(/These files contain members’ figures\. Send a member only their own report\./)).toBeInTheDocument();
});

test('the month list is newest first, the open month marked as a preview, and the latest closed month is chosen', () => {
  renderPage();
  const select = screen.getByLabelText('Month') as HTMLSelectElement;
  expect([...select.options].map((o) => o.text)).toEqual(['May 2026 (preview)', 'Apr 2026', 'Mar 2026', 'Feb 2026']);
  expect(select.value).toBe('p3');
  expect(screen.getByRole('button', { name: 'Download Apr 2026 workbook' })).toBeEnabled();
});

test('downloading a month loads it once and hands the file to the browser', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Download Apr 2026 workbook' }));
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  expect(actions.exportMonth).toHaveBeenCalledTimes(1);
  expect(actions.exportMonth.mock.calls[0]![0]).toMatchObject({ groupId: 'g1', groupName: 'Test Group', cycle: CYCLE });
  expect(actions.exportMonth.mock.calls[0]![1]).toMatchObject({ id: 'p3', label: 'Apr 2026' });
  expect(download).toHaveBeenCalledWith(expect.any(Uint8Array), 'Test Group Apr 2026.xlsx');
  expect(await screen.findByText('Test Group Apr 2026.xlsx downloaded.')).toBeInTheDocument();
});

test('choosing the preview names it on the button', async () => {
  renderPage();
  await userEvent.selectOptions(screen.getByLabelText('Month'), 'p4');
  await userEvent.click(screen.getByRole('button', { name: 'Download May 2026 (preview) workbook' }));
  expect(actions.exportMonth.mock.calls[0]![1]).toMatchObject({ id: 'p4' });
});

test('the whole-period file says what it covers, and a left-out month is mentioned in the toast', async () => {
  actions.exportPeriod.mockResolvedValue(result('Test Group Cycle 2026 through Apr 2026.xlsx', 'May 2026 is left out: declarations are still waiting.'));
  renderPage();
  expect(screen.getByText('Covers closed months through Apr 2026, plus May 2026 as a preview.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Download the whole-period workbook' }));
  expect(await screen.findByText(/downloaded\. May 2026 is left out: declarations are still waiting\./)).toBeInTheDocument();
});

test('a member’s report: active members only, alphabetical, and the button names them', async () => {
  renderPage();
  const select = screen.getByLabelText('Member') as HTMLSelectElement;
  expect([...select.options].map((o) => o.text)).toEqual(['Ann', 'Eve']);
  await userEvent.click(screen.getByRole('button', { name: 'Download Ann’s report' }));
  await waitFor(() => expect(actions.exportMember).toHaveBeenCalledTimes(1));
  expect(actions.exportMember.mock.calls[0]![1]).toBe('m2');
  await waitFor(() => expect(select).toBeEnabled());
  await userEvent.selectOptions(select, 'm1');
  expect(screen.getByRole('button', { name: 'Download Eve’s report' })).toBeInTheDocument();
});

test('a refused load shows the friendly sentence, downloads nothing and leaves the buttons usable', async () => {
  actions.exportMonth.mockRejectedValue({ message: 'declarations_pending', code: 'P0001' });
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Download Apr 2026 workbook' }));
  expect(await screen.findByText('Some declarations are still waiting. Approve or return them first.')).toBeInTheDocument();
  expect(download).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Download Apr 2026 workbook' })).toBeEnabled();
});

test('while one export runs every button is disabled and a second press makes no second file', async () => {
  let release: (v: ReturnType<typeof result>) => void = () => {};
  actions.exportMonth.mockReturnValue(new Promise((resolve) => { release = resolve; }));
  renderPage();
  const month = screen.getByRole('button', { name: 'Download Apr 2026 workbook' });
  await userEvent.click(month);
  await userEvent.click(month);
  expect(actions.exportMonth).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Download the whole-period workbook' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Download Ann’s report' })).toBeDisabled();
  expect(within(screen.getByRole('button', { name: /Preparing/ })).getByText('Preparing…')).toBeInTheDocument();
  release(result('Test Group Apr 2026.xlsx'));
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Download the whole-period workbook' })).toBeEnabled());
});

test('with no month opened yet there is nothing to export', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: CYCLE, periods: year(0) }));
  renderPage();
  expect(screen.getByText('Nothing to export yet.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Download/ })).toBeNull();
});

test('with only the open month the whole-period file is just the preview', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: CYCLE, periods: year(0, 'open') }));
  renderPage();
  expect(screen.getByText('Covers Feb 2026 as a preview.')).toBeInTheDocument();
});

test('a group with no active cycle says so', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: null, periods: [] }));
  renderPage();
  expect(screen.getByText('No active cycle')).toBeInTheDocument();
});
