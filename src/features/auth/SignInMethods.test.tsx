import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';

const auth = {
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
};
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));
const { SignInMethods } = await import('./SignInMethods');

const renderIt = () => render(<MemoryRouter><SignInMethods next="/passbook" /></MemoryRouter>);

beforeEach(() => Object.values(auth).forEach((f) => f.mockReset().mockResolvedValue({ error: null })));

test('offers all three sign-in methods', () => {
  renderIt();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Email me a sign-in link' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Use a password instead' })).toBeInTheDocument();
});

test('asks for an email before sending a link', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter your email address.');
  expect(auth.signInWithOtp).not.toHaveBeenCalled();
});

test('sends a magic link that never creates accounts', async () => {
  renderIt();
  await userEvent.type(screen.getByLabelText('Email'), 'tafara@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  expect(auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'tafara@example.com',
    options: { emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2Fpassbook', shouldCreateUser: false },
  });
  expect(await screen.findByText(/Check your email/)).toBeInTheDocument();
});

test('shows a friendly message for a wrong password', async () => {
  auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials', status: 400 } });
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: 'Use a password instead' }));
  await userEvent.type(screen.getByLabelText('Email'), 'tafara@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'wrong-pass');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('That email and password don’t match.')).toBeInTheDocument();
});
