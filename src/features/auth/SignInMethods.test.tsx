import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';

const auth = {
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
};
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));
const { SignInMethods } = await import('./SignInMethods');

const renderIt = (next = '/passbook') => render(<MemoryRouter><SignInMethods next={next} /></MemoryRouter>);
const SENT_LINK = 'We’ve sent a sign-in link. Check your inbox — and the address, if nothing arrives.';
const SENT_RESET = 'If that email has an account, we’ve sent a password reset link. Check your inbox — and the address, if nothing arrives.';

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
  const email = screen.getByLabelText('Email');
  expect(email).toHaveAttribute('aria-invalid', 'true');
  expect(email).toHaveAccessibleDescription('Enter your email address.');
  expect(email).toHaveFocus();
});

test('asks for a password before signing in, on the password field', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: 'Use a password instead' }));
  await userEvent.type(screen.getByLabelText('Email'), 'tafara@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter your password.');
  const password = screen.getByLabelText('Password');
  expect(password).toHaveAttribute('aria-invalid', 'true');
  expect(password).toHaveFocus();
  expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  expect(auth.signInWithPassword).not.toHaveBeenCalled();
});

test('clears a field error once the person starts typing in that field', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  await userEvent.type(screen.getByLabelText('Email'), 't');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('sends a magic link that never creates accounts', async () => {
  renderIt();
  await userEvent.type(screen.getByLabelText('Email'), 'tafara@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  expect(auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'tafara@example.com',
    options: { emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2Fpassbook' },
  });
  expect(await screen.findByText(/Check your email/)).toBeInTheDocument();
  expect(screen.getByText(SENT_LINK)).toBeInTheDocument();
});

test('still reports rate limits and network failures on the magic link', async () => {
  auth.signInWithOtp.mockResolvedValueOnce({ error: { code: 'over_email_send_rate_limit', message: 'x', status: 429 } });
  renderIt();
  await userEvent.type(screen.getByLabelText('Email'), 'tafara@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  expect(await screen.findByText('Too many attempts. Please wait a minute and try again.')).toBeInTheDocument();
  expect(screen.queryByText(SENT_LINK)).not.toBeInTheDocument();

  auth.signInWithOtp.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  expect(await screen.findByText('You seem to be offline. Check your connection and try again.')).toBeInTheDocument();
});

test('moves focus to the confirmation and lets the person fix the address', async () => {
  renderIt();
  await userEvent.type(screen.getByLabelText('Email'), 'tafra@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  const heading = await screen.findByRole('heading', { name: 'Check your email' });
  expect(heading).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
  const email = screen.getByLabelText('Email');
  expect(email).toHaveValue('tafra@example.com');
  expect(email).toHaveFocus();
});

test('sends a password reset with the same uniform wording', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: 'Use a password instead' }));
  await userEvent.type(screen.getByLabelText('Email'), 'tafara@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
  expect(await screen.findByText(SENT_RESET)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Check your email' })).toHaveFocus();
});

test('applies safeNext to its own next prop', async () => {
  renderIt('//evil.example');
  await userEvent.type(screen.getByLabelText('Email'), 'tafara@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  expect(auth.signInWithOtp).toHaveBeenCalledWith(
    expect.objectContaining({ options: expect.objectContaining({ emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2F' }) }),
  );
});

test('a password sign-in never navigates off-site', async () => {
  render(
    <MemoryRouter initialEntries={['/sign-in']}>
      <Routes>
        <Route path="/sign-in" element={<SignInMethods next="https://evil.example" />} />
        <Route path="/" element={<p>home</p>} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Use a password instead' }));
  await userEvent.type(screen.getByLabelText('Email'), 'tafara@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'right-pass');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('home')).toBeInTheDocument();
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
