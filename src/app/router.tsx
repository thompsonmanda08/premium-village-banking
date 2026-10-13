import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { AuthCallback } from '@/features/auth/AuthCallback';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { SignInPage } from '@/features/auth/SignInPage';
import { AccountPage } from '@/features/account/AccountPage';
import { ClosePage } from '@/features/desk/ClosePage';
import { MemberLedgerPage } from '@/features/desk/MemberLedgerPage';
import { MembersPage } from '@/features/desk/MembersPage';
import { ReportsPage } from '@/features/desk/ReportsPage';
import { DeskPage } from '@/features/desk/DeskPage';
import { LedgerCheckPage } from '@/features/desk/LedgerCheckPage';
import { DeclarePage } from '@/features/declare/DeclarePage';
import { CreateGroupPage } from '@/features/group/CreateGroupPage';
import { GroupPage } from '@/features/group/GroupPage';
import { PassbookPage } from '@/features/passbook/PassbookPage';
import { PlanPage } from '@/features/plan/PlanPage';
import { RecordPage } from '@/features/record/RecordPage';
import { RequireMembership } from '@/features/group/RequireMembership';
import { HomePage } from '@/features/home/HomePage';
import { InvitePage } from '@/features/invite/InvitePage';
import { TermsPage } from '@/features/legal/TermsPage';
import { RulesPage } from '@/features/rules/RulesPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
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
      { path: '/terms', element: <TermsPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/create-group', element: <CreateGroupPage /> },
          {
            element: <RequireMembership />,
            children: [
              {
                element: <AppShell />,
                errorElement: <RouteError />,
                children: [
                  { index: true, element: <HomePage />, handle: { title: 'Home' } },
                  page('passbook', 'Passbook', <PassbookPage />),
                  page('declare', 'Declare', <DeclarePage />),
                  page('plan', 'Plan', <PlanPage />),
                  page('record', 'My record', <RecordPage />),
                  page('group', 'Group', <GroupPage />),
                  page('desk', 'Desk', <DeskPage />),
                  page('desk/ledger-check', 'Ledger check', <LedgerCheckPage />),
                  page('desk/close', 'Close the month', <ClosePage />),
                  page('desk/members', 'Members', <MembersPage />),
                  page('desk/members/:memberId', 'Member ledger', <MemberLedgerPage />),
                  page('desk/reports', 'Reports', <ReportsPage />),
                  page('rules', 'Rules', <RulesPage />),
                  page('account', 'Account', <AccountPage />),
                  page('settings/:tab?', 'Group settings', <SettingsPage />),
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
