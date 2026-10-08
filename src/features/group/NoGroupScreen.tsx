import { Users } from 'lucide-react';
import { AuthLayout } from '@/app/AuthLayout';
import { useSignOut } from '@/features/auth/useSignOut';
import { Button, EmptyState } from '@/ui';

export function NoGroupScreen({ email }: { email?: string }) {
  const { signOut, pending } = useSignOut();
  return (
    <AuthLayout title="Almost there">
      <EmptyState
        icon={<Users className="size-7" />}
        title="Your account isn’t linked to a group"
        action={<Button variant="secondary" isLoading={pending} onClick={() => void signOut()}>Sign out</Button>}
      >
        Ask your treasurer for an invite{email ? <> for <strong className="text-fg">{email}</strong></> : null}. The invite link connects this account to your name.
      </EmptyState>
    </AuthLayout>
  );
}
