import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ThemeProvider } from '@/app/ThemeProvider';
import { GroupProvider } from '@/features/group/GroupContext';
import type { Membership } from '@/features/group/useMembership';
import { ToastProvider } from '@/ui';

const auth = { getUserIdentities: vi.fn(), updateUser: vi.fn(), reauthenticate: vi.fn(), linkIdentity: vi.fn() };
const signOutEverywhere = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUserIdentities: (...a: unknown[]) => auth.getUserIdentities(...a),
      updateUser: (...a: unknown[]) => auth.updateUser(...a),
      reauthenticate: (...a: unknown[]) => auth.reauthenticate(...a),
      linkIdentity: (...a: unknown[]) => auth.linkIdentity(...a),
    },
  },
}));
vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1', email: 'member@pvb.test' } }, loading: false }),
}));
vi.mock('@/features/auth/signOut', () => ({ signOutEverywhere: (...a: unknown[]) => signOutEverywhere(...a) }));
const { AccountPage } = await import('./AccountPage');

const MEMBERSHIP: Membership = {
  group: { id: 'g1', name: 'Premium Village Banking', currency: 'ZMW', owner_user_id: 'x', figures_visibility: 'open' },
  member: { id: 'm1', group_id: 'g1', full_name: 'Sapi Mulimbika', short_name: 'Sapi', role: 'member', status: 'active', email: 'member@pvb.test' },
  isAdmin: false,
};
const GOOD = 'village2027bank';
const identities = (...providers: string[]) => ({ data: { identities: providers.map((provider) => ({ provider })) }, error: null });

function Where() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}
const renderAccount = (url = '/account') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[url]}>
            <GroupProvider value={MEMBERSHIP}><AccountPage /></GroupProvider>
            <Where />
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );

async function fillPasswords(password = GOOD, confirm = password) {
  await userEvent.type(screen.getByLabelText('New password'), password);
  await userEvent.type(screen.getByLabelText('Confirm password'), confirm);
}
const savePassword = () => userEvent.click(screen.getByRole('button', { name: 'Save password' }));

const replace = vi.fn();
// Braces matter: vitest runs a function returned from beforeEach as teardown, and mockReset() returns the mock.
beforeEach(() => {
  for (const fn of [...Object.values(auth), signOutEverywhere, replace]) fn.mockReset();
  auth.getUserIdentities.mockResolvedValue(identities('email'));
  vi.stubGlobal('location', { ...window.location, origin: 'http://localhost:3000', replace });
});
afterEach(() => vi.unstubAllGlobals());

test('shows name, email and the group', async () => {
  renderAccount();
  expect(screen.getByRole('heading', { name: 'Account' }).parentElement).toHaveTextContent('Premium Village Banking');
  expect(screen.getByText('Sapi Mulimbika')).toBeInTheDocument();
  expect(screen.getByText('member@pvb.test')).toBeInTheDocument();
  await screen.findByText('Email');
});

test('lists each linked sign-in method by name; Google is offered only while it is not linked', async () => {
  renderAccount();
  const list = await screen.findByRole('list', { name: 'Ways to sign in' });
  expect(list).toHaveTextContent('Email');
  expect(list).not.toHaveTextContent('Google');
  expect(screen.getByRole('button', { name: 'Link Google' })).toBeInTheDocument();
});

test('a linked Google account shows as Google, with no link button', async () => {
  auth.getUserIdentities.mockResolvedValue(identities('email', 'google'));
  renderAccount();
  const list = await screen.findByRole('list', { name: 'Ways to sign in' });
  expect(list).toHaveTextContent('Email');
  expect(list).toHaveTextContent('Google');
  expect(screen.queryByRole('button', { name: 'Link Google' })).toBeNull();
});

test('while the methods load there is a labelled placeholder; if they fail, a friendly sentence and no link button', async () => {
  auth.getUserIdentities.mockResolvedValue({ data: null, error: { code: 'PGRST301', message: 'JWT expired secret-detail' } });
  renderAccount();
  expect(screen.getByText('Loading sign-in methods…')).toBeInTheDocument();
  expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  expect(screen.queryByText(/secret-detail/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Link Google' })).toBeNull();
});

test('Link Google starts the link flow and returns to the account page', async () => {
  auth.linkIdentity.mockResolvedValue({ data: {}, error: null });
  renderAccount();
  await userEvent.click(await screen.findByRole('button', { name: 'Link Google' }));
  expect(auth.linkIdentity).toHaveBeenCalledWith({
    provider: 'google',
    options: { redirectTo: 'http://localhost:3000/auth/callback?next=%2Faccount' },
  });
});

test('a refused Google link says so in a friendly sentence', async () => {
  auth.linkIdentity.mockResolvedValue({ data: null, error: { code: 'over_request_rate_limit', message: 'x' } });
  renderAccount();
  await userEvent.click(await screen.findByRole('button', { name: 'Link Google' }));
  expect(await screen.findByText('Too many attempts. Please wait a minute and try again.')).toBeInTheDocument();
});

test('?reset=1 shows the set-a-new-password prompt; a plain visit does not', async () => {
  const { unmount } = renderAccount('/account?reset=1');
  expect(screen.getByText('Choose a new password below.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Set a new password' })).toBeInTheDocument();
  await screen.findByText('Email');
  unmount();
  renderAccount();
  expect(screen.queryByText('Choose a new password below.')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Password' })).toBeInTheDocument();
  await screen.findByText('Email');
});

test.each([
  ['too short', 'short1', 'short1', 'New password', 'Use at least 12 characters.'],
  ['letters only', 'villagebanking', 'villagebanking', 'New password', 'Use both letters and numbers.'],
  ['digits only', '123456789012', '123456789012', 'New password', 'Use both letters and numbers.'],
  ['mismatched', GOOD, 'village2027banK', 'Confirm password', 'The passwords don’t match.'],
])('a %s password is stopped on its field, with focus, before anything is sent', async (_name, password, confirm, field, sentence) => {
  renderAccount();
  await fillPasswords(password, confirm);
  await savePassword();
  const input = screen.getByLabelText(field);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription(sentence);
  expect(input).toHaveFocus();
  expect(auth.updateUser).not.toHaveBeenCalled();
});

test('saving a password: sent once, fields cleared, confirmation toast, and the reset prompt goes away', async () => {
  auth.updateUser.mockResolvedValue({ data: {}, error: null });
  renderAccount('/account?reset=1');
  await fillPasswords();
  await savePassword();
  expect(await screen.findByText('Password saved')).toBeInTheDocument();
  expect(auth.updateUser).toHaveBeenCalledTimes(1);
  expect(auth.updateUser).toHaveBeenCalledWith({ password: GOOD });
  expect(auth.reauthenticate).not.toHaveBeenCalled();
  expect(screen.getByLabelText('New password')).toHaveValue('');
  expect(screen.getByLabelText('Confirm password')).toHaveValue('');
  await waitFor(() => expect(screen.queryByText('Choose a new password below.')).toBeNull());
  expect(screen.getByTestId('search').textContent).toBe('');
});

test('the server refusing a password shows its friendly sentence on the field, never the raw message', async () => {
  auth.updateUser.mockResolvedValue({ data: null, error: { code: 'same_password', message: 'New password should be different from the old password.' } });
  renderAccount();
  await fillPasswords();
  await savePassword();
  const input = await screen.findByLabelText('New password');
  await waitFor(() => expect(input).toHaveAccessibleDescription('Choose a password you haven’t used before.'));
  expect(screen.queryByText('Password saved')).toBeNull();
});

test('a password change needing a recent sign-in emails a code, asks for it, and saves with it', async () => {
  auth.updateUser
    .mockResolvedValueOnce({ data: null, error: { code: 'reauthentication_needed', message: 'Password update requires reauthentication' } })
    .mockResolvedValueOnce({ data: {}, error: null });
  auth.reauthenticate.mockResolvedValue({ data: {}, error: null });
  renderAccount('/account?reset=1');
  await fillPasswords();
  await savePassword();

  expect(await screen.findByText('We sent a code to your email. Enter it to confirm.')).toBeInTheDocument();
  expect(auth.reauthenticate).toHaveBeenCalledTimes(1);
  const code = screen.getByLabelText('Code from your email');
  expect(code).toHaveAttribute('inputmode', 'numeric');
  expect(code).toHaveAttribute('autocomplete', 'one-time-code');
  expect(code).toHaveFocus();
  expect(screen.queryByLabelText('New password')).toBeNull();

  await userEvent.type(code, '123456');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(await screen.findByText('Password saved')).toBeInTheDocument();
  expect(auth.updateUser).toHaveBeenLastCalledWith({ password: GOOD, nonce: '123456' });
  // Back on the plain form, emptied, and out of the reset prompt.
  expect(screen.getByLabelText('New password')).toHaveValue('');
  expect(screen.queryByLabelText('Code from your email')).toBeNull();
  await waitFor(() => expect(screen.queryByText('Choose a new password below.')).toBeNull());
});

test('a wrong code says so in a friendly sentence and stays on the code step; Back returns to the password form', async () => {
  auth.updateUser
    .mockResolvedValueOnce({ data: null, error: { code: 'reauthentication_needed', message: 'x' } })
    .mockResolvedValueOnce({ data: null, error: { code: 'reauthentication_not_valid', message: 'Reauthentication needed secret-detail' } });
  auth.reauthenticate.mockResolvedValue({ data: {}, error: null });
  renderAccount();
  await fillPasswords();
  await savePassword();
  const code = await screen.findByLabelText('Code from your email');
  await userEvent.type(code, '000000');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  const sentence = 'That code isn’t right or has expired. Check your email, or go back to get a new code.';
  await waitFor(() => expect(screen.getByLabelText('Code from your email')).toHaveAccessibleDescription(sentence));
  expect(screen.queryByText(/secret-detail/)).toBeNull();
  expect(screen.queryByText('Password saved')).toBeNull();
  expect(screen.getByLabelText('Code from your email')).toHaveAttribute('aria-invalid', 'true');

  await userEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('New password')).toHaveValue(GOOD);
  expect(screen.queryByLabelText('Code from your email')).toBeNull();
});

test('when the code email cannot be sent, the form stays and says why', async () => {
  auth.updateUser.mockResolvedValue({ data: null, error: { code: 'reauthentication_needed', message: 'x' } });
  auth.reauthenticate.mockResolvedValue({ data: null, error: { code: 'over_email_send_rate_limit', message: 'x' } });
  renderAccount();
  await fillPasswords();
  await savePassword();
  expect(await screen.findByText('Too many attempts. Please wait a minute and try again.')).toBeInTheDocument();
  expect(screen.getByLabelText('New password')).toHaveValue(GOOD);
  expect(screen.queryByLabelText('Code from your email')).toBeNull();
});

test('Sign out wipes and reloads like every other sign-out, with a 48px target', async () => {
  signOutEverywhere.mockResolvedValue(undefined);
  renderAccount();
  const button = screen.getByRole('button', { name: 'Sign out' });
  expect(button).toHaveClass('h-12');
  await userEvent.click(button);
  expect(signOutEverywhere).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'));
  await screen.findByText('Email');
});
