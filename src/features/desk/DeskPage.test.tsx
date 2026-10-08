import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, test } from 'vitest';
import { GroupProvider } from '@/features/group/GroupContext';
import type { Membership } from '@/features/group/useMembership';
import { DeskPage } from './DeskPage';

const membership = (isAdmin: boolean): Membership => ({
  group: { id: 'g1', name: 'Premium', currency: 'ZMW', owner_user_id: 'x', figures_visibility: 'open' },
  member: null,
  isAdmin,
});

test('members get a not-available screen', () => {
  render(<MemoryRouter><GroupProvider value={membership(false)}><DeskPage /></GroupProvider></MemoryRouter>);
  expect(screen.getByText('This page is for admins')).toBeInTheDocument();
});

test('admins get the desk placeholder', () => {
  render(<MemoryRouter><GroupProvider value={membership(true)}><DeskPage /></GroupProvider></MemoryRouter>);
  expect(screen.getByText('The treasurer desk arrives with the ledger')).toBeInTheDocument();
});
