import { createBrowserRouter } from 'react-router';
import { AuthCallback } from '@/features/auth/AuthCallback';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { SignInPage } from '@/features/auth/SignInPage';

export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    element: <RequireAuth />,
    children: [{ index: true, element: <p className="p-6">Signed in.</p> }],
  },
]);
