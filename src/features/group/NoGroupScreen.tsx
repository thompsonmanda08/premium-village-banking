import { Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { AuthLayout } from '@/app/AuthLayout';
import { useSignOut } from '@/features/auth/useSignOut';
import { Button } from '@/ui';

export function NoGroupScreen({ email }: { email?: string }) {
  const navigate = useNavigate();
  const { signOut, pending } = useSignOut();

  return (
    <AuthLayout title="Almost there">
      <div className="flex flex-col items-center px-2 py-8 text-center">
        <div aria-hidden className="mb-4 grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
          <Users className="size-7" />
        </div>
        <h2 className="text-lg font-semibold text-fg">Your account isn't linked to a group</h2>

        {/* Primary path: create a new group */}
        <div className="mt-6 w-full">
          <Button fullWidth onClick={() => navigate('/create-group')}>
            Create a new group
          </Button>
        </div>

        {/* Divider */}
        <div className="my-5 flex w-full items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-sm text-muted">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* Secondary path: waiting for an invite */}
        <p className="text-base text-muted">
          Ask your treasurer for an invite
          {email ? (
            <> for <strong className="font-semibold text-fg">{email}</strong></>
          ) : null}
          . The invite link connects this account to your name.
        </p>

        <div className="mt-6 w-full">
          <Button variant="secondary" fullWidth isLoading={pending} onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
