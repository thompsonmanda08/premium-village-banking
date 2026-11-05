import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { GROUPS, PERIODS, STATEMENTS } from '@/features/ledger/groupFixtures';
import { MEMBER, renderLedger, year } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ cycle: vi.fn(), groupRows: vi.fn(), statements: vi.fn(), rules: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useLedgerCycle: () => hooks.cycle(),
  useGroupStatements: (...a: unknown[]) => hooks.groupRows(...a),
  useCycleStatements: (...a: unknown[]) => hooks.statements(...a),
  useCycleRules: () => hooks.rules(),
}));
const { GroupReport } = await import('./GroupReport');

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const failed = () => ({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch: vi.fn() });
const PEOPLE = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }, { id: 'm3', short_name: 'Bob' }, { id: 'm4', short_name: 'Cy' }];
const render = (o: { isAdmin?: boolean; visibility?: 'open' | 'private'; member?: typeof MEMBER | null } = {}) =>
  renderLedger(<GroupReport people={PEOPLE} />, { isAdmin: o.isAdmin ?? false, visibility: o.visibility ?? 'open', member: o.member });

beforeEach(() => {
  Object.values(hooks).forEach((h) => h.mockReset());
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: PERIODS }));
  hooks.groupRows.mockReturnValue(ok(GROUPS));
  hooks.statements.mockReturnValue(ok(STATEMENTS));
  hooks.rules.mockReturnValue(ok({ min_saving: 250, loan_rate: 0.15, excess_rate: 0.1, loan_multiples: {}, membership_fee: 50 }));
});

test('the treasurer sees the figures, the health check, every chart, the report and the follow-up list', () => {
  render({ isAdmin: true });
  expect(screen.getByRole('heading', { name: 'Group health check' })).toBeInTheDocument();
  expect(screen.getByText('Needs attention')).toBeInTheDocument();
  for (const sign of ['Pool working', 'Minimum payments met', 'Balances at risk', 'Largest saver’s share']) expect(screen.getAllByText(sign).length).toBeGreaterThan(0);
  for (const chart of [/Savings growth/, /How much of the pool is working/, /Discipline/, /Who is ahead/]) expect(screen.getByRole('img', { name: chart })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Monthly group report' })).toBeInTheDocument();
  const follow = screen.getByRole('heading', { name: 'Follow-up list' }).closest('section')!;
  expect(within(follow).getByText('Cy')).toBeInTheDocument();
  expect(within(follow).getByText('Owes K 400')).toBeInTheDocument();
  expect(within(follow).getByText('Saved K 100')).toBeInTheDocument();
});

test('a member of a group that keeps figures open sees the health check and charts but not the follow-up list', () => {
  render({ visibility: 'open', member: MEMBER });
  expect(screen.getByRole('heading', { name: 'Group health check' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /Who is ahead/ })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Follow-up list' })).toBeNull();
  expect(hooks.statements.mock.calls[0]![1]).toBe(true);
});

test('a member of a private group sees group totals only: no health check, no names, and member statements are never asked for', () => {
  render({ visibility: 'private', member: MEMBER });
  expect(screen.getByRole('img', { name: /Savings growth/ })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /How much of the pool is working/ })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: /Who is ahead/ })).toBeNull();
  expect(screen.queryByRole('img', { name: /Discipline/ })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Group health check' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Follow-up list' })).toBeNull();
  expect(screen.getByText('Per-member figures are shown to the treasurer in groups that keep figures private.')).toBeInTheDocument();
  for (const name of ['Cy', 'Bob', 'Ann']) expect(screen.queryByText(name)).toBeNull();
  expect(hooks.statements.mock.calls.every((c) => c[1] === false)).toBe(true);
});

test('the figures come from the latest closed month, with the change in savings since the month before', () => {
  render({ isAdmin: true });
  const figures = screen.getByRole('heading', { name: 'Where the group stands' }).closest('section')!;
  expect(within(figures).getByText('K 4,700')).toBeInTheDocument(); // total savings in May
  expect(within(figures).getByText(/Up K 1,100 since Apr 2026/)).toBeInTheDocument();
  expect(within(figures).getByText('K 2,400')).toBeInTheDocument(); // idle cash
  expect(within(figures).getByText('K 600')).toBeInTheDocument(); // owed
});

test('the monthly report lists every month and a totals row', () => {
  render({ isAdmin: true });
  const table = screen.getByRole('heading', { name: 'Monthly group report' }).closest('section')!.querySelector('table')!;
  const rows = [...table.querySelectorAll('tbody tr')];
  expect(rows).toHaveLength(4);
  const total = table.querySelector('tfoot tr')!;
  expect(total).toHaveTextContent('Total');
  expect(total).toHaveTextContent('4,700'); // 1,100 + 1,250 + 1,250 + 1,100 saved
  expect(rows[3]).toHaveTextContent('May 2026');
  expect(rows[3]).toHaveTextContent('20%'); // pool working
  expect(rows[3]).toHaveTextContent('1 of 2'); // paid minimum
});

test('the viewer is the highlighted bar in “Who is ahead”', () => {
  const { container } = render({ visibility: 'open', member: MEMBER });
  const mine = container.querySelector('rect[data-row="Eve"]')!;
  expect(mine.getAttribute('class')).toContain('fill-warning');
  expect(container.querySelector('rect[data-row="Ann"]')!.getAttribute('class')).toContain('fill-success');
  expect(container.querySelector('rect[data-row="Bob"]')!.getAttribute('class')).toContain('fill-danger');
});

test('no month closed yet says so, and draws no chart', () => {
  hooks.cycle.mockReturnValue(ok({ cycle: { id: 'c1', label: 'Cycle 2026' }, periods: year(0, 'open') }));
  hooks.groupRows.mockReturnValue({ ...ok(undefined), data: undefined });
  render({ isAdmin: true });
  expect(screen.getByText('No months closed yet')).toBeInTheDocument();
  expect(screen.getByText('The group report appears after the first month is closed.')).toBeInTheDocument();
  expect(screen.queryByRole('img')).toBeNull();
});

test('while loading there is a labelled skeleton', () => {
  hooks.cycle.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  render({ isAdmin: true });
  expect(screen.getByText('Loading the group report')).toBeInTheDocument();
});

test('if the group statements cannot be read the treasurer can try again', async () => {
  const bad = failed();
  hooks.groupRows.mockReturnValue(bad);
  render({ isAdmin: true });
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(bad.refetch).toHaveBeenCalled();
});

test('if only the member statements fail, the group totals still show and the member sections say why they are missing', () => {
  hooks.statements.mockReturnValue(failed());
  render({ isAdmin: true });
  expect(screen.getByRole('img', { name: /Savings growth/ })).toBeInTheDocument();
  expect(screen.getByText('Member figures could not be loaded just now.')).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: /Who is ahead/ })).toBeNull();
});
