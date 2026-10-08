import { LogOut } from 'lucide-react';
import { useSignOut } from '@/features/auth/useSignOut';
import { Alert, Button } from '@/ui';

export function ErrorScreen({ message, onRetry, title = 'Couldn’t load your group' }: { message: string; onRetry: () => void; title?: string }) {
  const { signOut, pending } = useSignOut();
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5">
      <Alert
        tone="danger"
        title={title}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>
            <Button size="sm" variant="ghost" isLoading={pending} leftIcon={<LogOut className="size-4" />} onClick={() => void signOut()}>Sign out</Button>
          </div>
        }
      >
        {message}
      </Alert>
    </main>
  );
}
