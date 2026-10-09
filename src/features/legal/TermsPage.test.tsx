import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, test } from 'vitest';
import { AuthLayout } from '@/app/AuthLayout';
import { TermsPage } from './TermsPage';

const renderAt = (ui: React.ReactNode, path = '/terms') => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

test('holds the terms and the privacy policy, each linkable', () => {
  renderAt(<TermsPage />);
  expect(screen.getByRole('heading', { level: 1, name: 'Terms and privacy' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Terms of use' }).closest('section')).toHaveAttribute('id', 'terms');
  expect(screen.getByRole('heading', { level: 2, name: 'Privacy policy' }).closest('section')).toHaveAttribute('id', 'privacy');
});

test('points to the live rules instead of repeating figures that change each cycle', () => {
  renderAt(<TermsPage />);
  for (const link of screen.getAllByRole('link', { name: 'Rules page' })) expect(link).toHaveAttribute('href', '/rules');
  expect(screen.queryByText(/K\s?\d/)).not.toBeInTheDocument();
});

test('names the law members can rely on', () => {
  renderAt(<TermsPage />);
  expect(screen.getAllByText(/Data Protection Act No\. 3 of 2021/).length).toBeGreaterThan(0);
});

test('says that accepting an invitation or creating an account accepts the terms', () => {
  renderAt(<TermsPage />);
  expect(screen.getByText(/You accept these terms when you accept an invitation to join the group or create an account/)).toBeInTheDocument();
});

test('sign-in and invite screens tell people that accepting means agreeing, with links', () => {
  renderAt(<AuthLayout title="Join your group">form</AuthLayout>, '/invite/tok');
  expect(screen.getByText(/By accepting an invitation or creating an account, you accept/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Terms of use' })).toHaveAttribute('href', '/terms');
  expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/terms#privacy');
});
