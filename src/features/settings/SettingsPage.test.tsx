import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';

vi.mock('./GroupDetailsSection', () => ({ GroupDetailsSection: () => <p>group section</p> }));
vi.mock('./VisibilitySection', () => ({ VisibilitySection: () => <p>visibility section</p> }));
vi.mock('./PeopleSection', () => ({ PeopleSection: () => <p>people section</p> }));
vi.mock('./RulesSection', () => ({ RulesSection: () => <p>rules section</p> }));
const { SettingsPage } = await import('./SettingsPage');

function Path() {
  return <output aria-label="path">{useLocation().pathname}</output>;
}

const renderAt = (url: string, isAdmin: boolean) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Path />
      <GroupProvider value={{ group: { id: 'g1', name: 'Premium', currency: 'ZMW', owner_user_id: 'o', figures_visibility: 'open' }, member: null, isAdmin }}>
        <Routes>
          <Route path="/settings/:tab?" element={<SettingsPage />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </GroupProvider>
    </MemoryRouter>,
  );

test('/settings opens the General tab', () => {
  renderAt('/settings', true);
  expect(screen.getByLabelText('path')).toHaveTextContent('/settings/general');
  expect(screen.getByText('group section')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'General' })).toHaveAttribute('aria-current', 'page');
});

test('each tab is its own URL and shows only its panel', () => {
  renderAt('/settings/members', true);
  expect(screen.getByText('people section')).toBeInTheDocument();
  expect(screen.queryByText('group section')).toBeNull();
  expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute('aria-current', 'page');
});

test('switching tabs changes the URL and panel', async () => {
  renderAt('/settings/general', true);
  await userEvent.click(screen.getByRole('link', { name: 'Rules' }));
  expect(screen.getByLabelText('path')).toHaveTextContent('/settings/rules');
  expect(screen.getByText('rules section')).toBeInTheDocument();
});

test('an unknown tab falls back to General', () => {
  renderAt('/settings/nope', true);
  expect(screen.getByLabelText('path')).toHaveTextContent('/settings/general');
});

test('a member who types the URL is sent home', () => {
  renderAt('/settings/privacy', false);
  expect(screen.getByLabelText('path')).toHaveTextContent(/^\/$/);
  expect(screen.queryByText('visibility section')).toBeNull();
});
