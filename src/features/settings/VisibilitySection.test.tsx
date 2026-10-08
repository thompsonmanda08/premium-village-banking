import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import { ToastProvider } from '@/ui';

const select = vi.fn();
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ update }) } }));
const { VisibilitySection } = await import('./VisibilitySection');

beforeEach(() => {
  select.mockReset().mockResolvedValue({ data: [{ id: 'g1' }], error: null });
  update.mockClear();
});

const renderSection = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <GroupProvider value={{ group: { id: 'g1', name: 'Premium', currency: 'ZMW', owner_user_id: 'o', figures_visibility: 'open' }, member: null, isAdmin: true }}>
          <VisibilitySection />
        </GroupProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );

const makePrivate = async () => {
  await userEvent.click(screen.getByLabelText(/Only the member and admins/));
  await userEvent.click(screen.getByRole('button', { name: 'Make figures private' }));
};

test('switching to private needs a second tap', async () => {
  renderSection();
  await makePrivate();
  expect(update).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to confirm' }));
  expect(update).toHaveBeenCalledWith({ figures_visibility: 'private' });
});

test('says what each mode does and confirms only after the row came back', async () => {
  renderSection();
  expect(screen.getByText(/Members can see each other’s savings and loans/)).toBeInTheDocument();
  expect(screen.getByText(/Members see their own figures and group totals/)).toBeInTheDocument();
  await makePrivate();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to confirm' }));
  expect(await screen.findByText('Figures are now private')).toBeInTheDocument();
});

test('an update that RLS filtered out (zero rows) is an error, never "Figures are now private"', async () => {
  select.mockResolvedValue({ data: [], error: null });
  renderSection();
  await makePrivate();
  await userEvent.click(screen.getByRole('button', { name: 'Tap again to confirm' }));
  expect(await screen.findByText('Only admins can do this.')).toBeInTheDocument();
  expect(screen.queryByText(/Figures are now/)).toBeNull();
});
