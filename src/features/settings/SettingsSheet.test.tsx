import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, test, vi } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';

vi.mock('./GroupDetailsSection', () => ({ GroupDetailsSection: () => <p>group section</p> }));
vi.mock('./VisibilitySection', () => ({ VisibilitySection: () => <p>visibility section</p> }));
vi.mock('./PeopleSection', () => ({ PeopleSection: () => <p>people section</p> }));
vi.mock('./RulesSection', () => ({ RulesSection: () => <p>rules section</p> }));
const { SettingsSheet } = await import('./SettingsSheet');

const renderAt = (url: string, isAdmin: boolean) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <GroupProvider value={{ group: { id: 'g1', name: 'Premium', currency: 'ZMW', owner_user_id: 'o', figures_visibility: 'open' }, member: null, isAdmin }}>
        <SettingsSheet />
      </GroupProvider>
    </MemoryRouter>,
  );

test('admins get the drawer with every section when ?settings=open', () => {
  renderAt('/?settings=open', true);
  expect(screen.getByRole('dialog', { name: 'Group settings' })).toBeInTheDocument();
  for (const s of ['group section', 'visibility section', 'people section', 'rules section']) expect(screen.getByText(s)).toBeInTheDocument();
});

test('a member who types ?settings=open sees no drawer', () => {
  renderAt('/?settings=open', false);
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('admins see nothing until the gear sets ?settings=open', () => {
  renderAt('/', true);
  expect(screen.queryByRole('dialog')).toBeNull();
});
