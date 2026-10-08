import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { AuthCallback } from '@/features/auth/AuthCallback';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { SignInPage } from '@/features/auth/SignInPage';
import { RequireMembership } from '@/features/group/RequireMembership';
import { InvitePage } from '@/features/invite/InvitePage';
import { ComingSoon } from '@/features/shells/ComingSoon';
import { NotFound } from '@/features/shells/NotFound';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';

const page = (path: string, title: string, element: ReactNode) => ({ path, element, handle: { title } });

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: '/sign-in', element: <SignInPage /> },
      { path: '/auth/callback', element: <AuthCallback /> },
      { path: '/invite/:token', element: <InvitePage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireMembership />,
            children: [
              {
                element: <AppShell />,
                errorElement: <RouteError />,
                children: [
                  { index: true, element: <ComingSoon title="Home" />, handle: { title: 'Home' } },
                  page('passbook', 'Passbook', <ComingSoon title="Passbook" />),
                  page('declare', 'Declare', <ComingSoon title="Declaration" />),
                  page('plan', 'Plan', <ComingSoon title="Plan" />),
                  page('record', 'My record', <ComingSoon title="Record" />),
                  page('group', 'Group', <ComingSoon title="Group" />),
                  page('desk', 'Desk', <ComingSoon title="Desk" />),
                  page('rules', 'Rules', <ComingSoon title="Rules" />),
                  page('account', 'Account', <ComingSoon title="Account" />),
                  page('*', 'Not found', <NotFound />),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
