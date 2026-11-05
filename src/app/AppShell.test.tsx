import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import type { Membership } from '@/features/group/useMembership';
import { ThemeProvider } from './ThemeProvider';

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
const { AppShell } = await import('./AppShell');

function renderShell(isAdmin: boolean) {
  const membership: Membership = {
    group: { id: 'g1', name: 'Premium Village Banking', currency: 'ZMW', owner_user_id: 'x', figures_visibility: 'open' },
    member: { id: 'm1', group_id: 'g1', full_name: 'Tafara', short_name: 'Tafara', role: isAdmin ? 'admin' : 'member', status: 'active', email: null },
    isAdmin,
  };
  const router = createMemoryRouter(
    [{ element: <AppShell />, children: [{ index: true, element: <p>Home body</p>, handle: { title: 'Home' } }] }],
    { initialEntries: ['/'] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <GroupProvider value={membership}>
          <RouterProvider router={router} />
        </GroupProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

test('member bottom nav has Plan and no Desk or gear', () => {
  renderShell(false);
  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(within(nav).getByRole('link', { name: 'Plan' })).toBeInTheDocument();
  expect(within(nav).queryByRole('link', { name: 'Desk' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Group settings' })).toBeNull();
});

test('admin bottom nav has Desk and the gear', () => {
  renderShell(true);
  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(within(nav).getByRole('link', { name: 'Desk' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Group settings' })[0]).toHaveAttribute('href', '/settings');
});

test('marks the current tab', () => {
  renderShell(false);
  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
});
