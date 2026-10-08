import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import { ToastProvider } from '@/ui';

const from = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { from } }));
const cyclesState = vi.hoisted(() => ({ current: { isPending: false, isError: false, data: [] as unknown[] } }));
vi.mock('@/features/cycles/useCycles', () => ({ useCycles: () => cyclesState.current }));
const { RulesForm, RulesSection } = await import('./RulesSection');

const cycle = {
  id: 'c1', label: 'Cycle 2026', starts_on: '2026-02-15', ends_on: '2027-02-15', payout_on: '2027-02-06', status: 'active',
  rules: { min_saving: 250, membership_fee: 50, penalty_per_day: 50, loan_rate: 0.15, excess_rate: 0.1, window_open_day: 5, window_close_day: 7, loan_multiples: [], tenor_bands: [] },
};

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <ToastProvider>
      <GroupProvider value={{ group: { id: 'g1', name: 'Premium', currency: 'ZMW', owner_user_id: 'o', figures_visibility: 'open' }, member: null, isAdmin: true }}>
        {children}
      </GroupProvider>
    </ToastProvider>
  </QueryClientProvider>
);
const renderForm = (locked: boolean, status = 'active') => render(<Wrap><RulesForm cycle={{ ...cycle, status } as never} locked={locked} /></Wrap>);

// from('cycles') and from('cycle_rules') each answer .update(payload).eq(...).select(...) with the queued result.
const updates = { cycles: vi.fn(), cycle_rules: vi.fn() };
const results = { cycles: vi.fn(), cycle_rules: vi.fn() };
beforeEach(() => {
  from.mockReset().mockImplementation((table: 'cycles' | 'cycle_rules') => ({
    update: (payload: unknown) => {
      updates[table](payload);
      return { eq: () => ({ select: () => results[table]() }) };
    },
  }));
  for (const k of ['cycles', 'cycle_rules'] as const) {
    updates[k].mockClear();
    results[k].mockReset().mockResolvedValue({ data: [{ id: 'x' }], error: null });
  }
});

test('locked rules are read-only with no save button', () => {
  renderForm(true);
  expect(screen.getByLabelText('Minimum saving (K)')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save cycle and rules' })).toBeNull();
});

test('planned rules are editable', () => {
  renderForm(false, 'planned');
  expect(screen.getByLabelText('Minimum saving (K)')).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Save cycle and rules' })).toBeInTheDocument();
});

test('saves the cycle and rules, with rates stored as ratios, and confirms', async () => {
  renderForm(false, 'planned');
  await userEvent.click(screen.getByRole('button', { name: 'Save cycle and rules' }));
  expect(await screen.findByText('Cycle and rules saved')).toBeInTheDocument();
  expect(updates.cycle_rules).toHaveBeenCalledWith(expect.objectContaining({ min_saving: 250, loan_rate: 0.15, excess_rate: 0.1 }));
});

test('invalid values show field errors and nothing is sent', async () => {
  renderForm(false, 'planned');
  await userEvent.clear(screen.getByLabelText('Cycle name'));
  await userEvent.click(screen.getByRole('button', { name: 'Save cycle and rules' }));
  expect(screen.getByText('Enter a name for the cycle.')).toBeInTheDocument();
  expect(from).not.toHaveBeenCalled();
});

test('a cycle update that RLS filtered out (zero rows) shows the locked sentence, not "saved"', async () => {
  results.cycles.mockResolvedValue({ data: [], error: null });
  renderForm(false, 'planned');
  await userEvent.click(screen.getByRole('button', { name: 'Save cycle and rules' }));
  expect(await screen.findByText('Rules can only change before the cycle starts.')).toBeInTheDocument();
  expect(screen.queryByText(/saved/i)).toBeNull();
  expect(updates.cycle_rules).not.toHaveBeenCalled();
});

test('a rules update that RLS filtered out (zero rows) shows the locked sentence, not "saved"', async () => {
  results.cycle_rules.mockResolvedValue({ data: [], error: null });
  renderForm(false, 'planned');
  await userEvent.click(screen.getByRole('button', { name: 'Save cycle and rules' }));
  expect(await screen.findByText('Rules can only change before the cycle starts.')).toBeInTheDocument();
  expect(screen.queryByText(/saved/i)).toBeNull();
});

test('a started cycle renders disabled inputs with an explanation and no save button', () => {
  cyclesState.current = { isPending: false, isError: false, data: [cycle] };
  render(<Wrap><RulesSection /></Wrap>);
  expect(screen.getByText('Cycle 2026 has started, so its rules are locked.')).toBeInTheDocument();
  expect(screen.getByLabelText('Minimum saving (K)')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save cycle and rules' })).toBeNull();
});

test('a planned cycle is editable inside the section', () => {
  cyclesState.current = { isPending: false, isError: false, data: [{ ...cycle, id: 'c2', label: 'Cycle 2027', status: 'planned' }, cycle] };
  render(<Wrap><RulesSection /></Wrap>);
  expect(screen.getByLabelText('Cycle name')).toHaveValue('Cycle 2027');
  expect(screen.getByLabelText('Minimum saving (K)')).toBeEnabled();
});
