import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';

let state: { session: object | null; loading: boolean } = { session: null, loading: false };
vi.mock('./SessionProvider', () => ({ useSession: () => state }));
const { AuthCallback } = await import('./AuthCallback');

function Where() {
  const { pathname, search } = useLocation();
  return <p>at {pathname}{search}</p>;
}

function renderAt(search = '', hash = '') {
  window.location.hash = hash;
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  window.location.hash = '';
  state = { session: null, loading: false };
  vi.useRealTimers();
});

const INVITED = 'This account isn’t invited yet. Ask your treasurer for an invite.';
const CANCELLED = 'Sign-in was cancelled. You can try again.';
const EXPIRED = 'This sign-in link has expired or was already used. Request a new one.';
const FAILED = 'We couldn’t finish signing you in. Please try again.';
const SECRET = 'Database error saving new user (internal detail)';

test.each([
  ['query string', `?error=server_error&error_code=signup_disabled&error_description=${encodeURIComponent(SECRET)}`, '', INVITED],
  ['hash', '', `#error=server_error&error_code=signup_disabled&error_description=${encodeURIComponent(SECRET)}`, INVITED],
  ['a cancelled Google consent (error only)', '?error=access_denied&error_description=User+denied+access', '', CANCELLED],
  ['an expired link (hash)', '', `#error=access_denied&error_code=otp_expired&error_description=${encodeURIComponent(SECRET)}`, EXPIRED],
  ['an expired link (query)', `?error=access_denied&error_code=otp_expired&error_description=${encodeURIComponent(SECRET)}`, '', EXPIRED],
  ['an unknown error code', `?error=server_error&error_code=unexpected_failure&error_description=${encodeURIComponent(SECRET)}`, '', FAILED],
  ['a description with no code', `?error_description=${encodeURIComponent(SECRET)}`, '', FAILED],
  ['a code that belongs to another screen', '?error_code=last_admin', '', FAILED],
])('explains a callback error from %s', (_name, search, hash, text) => {
  renderAt(search, hash);
  expect(screen.getByText(text)).toBeInTheDocument();
  expect(document.body).not.toHaveTextContent('internal detail');
  expect(document.body).not.toHaveTextContent('User denied');
  const link = screen.getByRole('link', { name: 'Back to sign in' });
  expect(link).toHaveAttribute('href', '/sign-in');
  expect(link).toHaveClass('min-h-12');
});

test('gives up with a plain message when no session arrives', () => {
  vi.useFakeTimers();
  renderAt();
  expect(screen.getByRole('status')).toHaveTextContent('Signing you in');
  act(() => void vi.advanceTimersByTime(8000));
  expect(screen.getByText(FAILED)).toBeInTheDocument();
});

test('after a successful sign-in it goes to the requested in-app page', () => {
  state = { session: {}, loading: false };
  renderAt('?next=%2Fpassbook%3Fx%3D1');
  expect(screen.getByText('at /passbook?x=1')).toBeInTheDocument();
});

test.each(['//evil.example', '%2F%2Fevil.example', 'https://evil.example', '/\\evil.example'])('after a successful sign-in an off-site next (%s) lands on /', (next) => {
  state = { session: {}, loading: false };
  renderAt(`?next=${next}`);
  expect(screen.getByText('at /')).toBeInTheDocument();
});
