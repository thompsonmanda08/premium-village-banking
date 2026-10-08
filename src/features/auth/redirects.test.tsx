import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, test, vi } from 'vitest';

let state: { session: object | null; loading: boolean } = { session: null, loading: false };
vi.mock('./SessionProvider', () => ({ useSession: () => state }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {} } }));
const { SignInPage } = await import('./SignInPage');
const { RequireAuth } = await import('./RequireAuth');

function Where() {
  const { pathname, search } = useLocation();
  return <p>at {pathname}{search}</p>;
}

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/sign-in" element={<><SignInPage /><Where /></>} />
        <Route element={<RequireAuth />}>
          <Route path="*" element={<Where />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

test('a signed-in visitor with an off-site next lands on the home route', () => {
  state = { session: {}, loading: false };
  renderAt('/sign-in?next=//evil.example');
  expect(screen.getByText('at /')).toBeInTheDocument();
});

test('a signed-in visitor with an in-app next is sent there', () => {
  state = { session: {}, loading: false };
  renderAt('/sign-in?next=%2Fgroup%3Fx%3D1');
  expect(screen.getByText('at /group?x=1')).toBeInTheDocument();
});

test('a signed-out visitor is sent to sign in and remembers where they were going', () => {
  state = { session: null, loading: false };
  renderAt('/group?x=1');
  expect(screen.getByText('at /sign-in?next=%2Fgroup%3Fx%3D1')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
});
