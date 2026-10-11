import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { entry, renderLedger } from '@/features/ledger/testFixtures';

const hooks = vi.hoisted(() => ({ suggestions: vi.fn(), applied: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/features/ledger/queries', async (orig) => ({
  ...(await orig<typeof import('@/features/ledger/queries')>()),
  useSuggestedPenalties: () => hooks.suggestions(),
  useMonthPenalties: () => hooks.applied(),
}));
const { PenaltiesSection } = await import('./PenaltiesSection');

const MEMBERS = [{ id: 'm1', short_name: 'Eve' }, { id: 'm2', short_name: 'Ann' }];
const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const s = (member_id: string, short_name: string, ground: string, amount: number, detail: string) => ({ member_id, short_name, ground, amount, detail });

const renderSection = () => renderLedger(<PenaltiesSection periodId="p9" members={MEMBERS} />, { isAdmin: true });

beforeEach(() => {
  hooks.suggestions.mockReturnValue(ok([s('m1', 'Eve', 'late_declaration', 100, 'Declared 2 days after the deadline'), s('m2', 'Ann', 'under_saving', 50, 'Saved K100 of the K250 minimum')]));
  hooks.applied.mockReturnValue(ok([]));
});

test('suggestions show member, ground, amount and the engine’s detail', () => {
  renderSection();
  const row = screen.getByRole('button', { name: 'Apply penalty to Eve' }).closest('li')!;
  expect(within(row).getByText('Eve')).toBeInTheDocument();
  expect(within(row).getByText(/Late declaration/)).toBeInTheDocument();
  expect(within(row).getByText('K 100')).toBeInTheDocument();
  expect(within(row).getByText('Declared 2 days after the deadline')).toBeInTheDocument();
});

test('a suggestion already applied this month is not shown again', () => {
  hooks.applied.mockReturnValue(ok([entry({ id: 'p1', kind: 'penalty', member_id: 'm1', source: 'app', amount: 100, reason: 'late_declaration: Declared 2 days after the deadline' })]));
  renderSection();
  expect(screen.queryByRole('button', { name: 'Apply penalty to Eve' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Apply penalty to Ann' })).toBeInTheDocument();
});

test('Not now hides a suggestion for the session and records nothing', async () => {
  renderSection();
  await userEvent.click(screen.getByRole('button', { name: 'Not now for Eve' }));
  expect(screen.queryByRole('button', { name: 'Apply penalty to Eve' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Apply penalty to Ann' })).toBeInTheDocument();
});

test('Apply opens the sheet for that suggestion', async () => {
  renderSection();
  await userEvent.click(screen.getByRole('button', { name: 'Apply penalty to Ann' }));
  expect(screen.getByRole('dialog', { name: 'Apply a penalty' })).toBeInTheDocument();
  expect(screen.getByLabelText('Amount')).toHaveValue('50');
});

test('Add a penalty opens an empty sheet with a member to choose', async () => {
  renderSection();
  await userEvent.click(screen.getByRole('button', { name: 'Add a penalty' }));
  expect(screen.getByLabelText('Member')).toHaveValue('');
});

test('nothing to suggest says so', () => {
  hooks.suggestions.mockReturnValue(ok([]));
  renderSection();
  expect(screen.getByText('Nothing to suggest right now.')).toBeInTheDocument();
});

test('penalties applied this month are listed with their ground and reason, and flagged when corrected', () => {
  hooks.applied.mockReturnValue(
    ok([
      entry({ id: 'p1', kind: 'penalty', member_id: 'm1', source: 'app', amount: 100, reason: 'late_declaration: Declared 2 days after the deadline' }),
      entry({ id: 'p2', kind: 'waiver', member_id: 'm1', source: 'correction', corrects_entry_id: 'p1', amount: 100, reason: 'Slip found' }),
    ]),
  );
  renderSection();
  const list = screen.getByRole('heading', { name: 'Applied this month (1)' }).closest('div')!;
  expect(within(list).getByText('Eve')).toBeInTheDocument();
  expect(within(list).getByText('K 100')).toBeInTheDocument();
  expect(within(list).getByText(/Late declaration: Declared 2 days after the deadline/)).toBeInTheDocument();
  expect(within(list).getByText('Corrected')).toBeInTheDocument();
});

test('loading and failure', async () => {
  hooks.suggestions.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
  const { unmount } = renderSection();
  expect(screen.getByText('Loading penalties')).toBeInTheDocument();
  unmount();
  const refetch = vi.fn();
  hooks.suggestions.mockReturnValue({ data: undefined, isPending: false, isError: true, error: { message: 'x', code: 'PGRST301' }, refetch });
  renderSection();
  expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalled();
});
