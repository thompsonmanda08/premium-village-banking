import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { AuthCallback } from '@/features/auth/AuthCallback';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { SignInPage } from '@/features/auth/SignInPage';
import { AccountPage } from '@/features/account/AccountPage';
import { DeskPage } from '@/features/desk/DeskPage';
import { GroupPage } from '@/features/group/GroupPage';
import { RequireMembership } from '@/features/group/RequireMembership';
import { HomePage } from '@/features/home/HomePage';
import { InvitePage } from '@/features/invite/InvitePage';
import { RulesPage } from '@/features/rules/RulesPage';
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
                  { index: true, element: <HomePage />, handle: { title: 'Home' } },
                  page('passbook', 'Passbook', <ComingSoon title="Passbook" />),
                  page('declare', 'Declare', <ComingSoon title="Declaration" />),
                  page('plan', 'Plan', <ComingSoon title="Plan" />),
                  page('record', 'My record', <ComingSoon title="Record" />),
                  page('group', 'Group', <GroupPage />),
                  page('desk', 'Desk', <DeskPage />),
                  page('rules', 'Rules', <RulesPage />),
                  page('account', 'Account', <AccountPage />),
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
