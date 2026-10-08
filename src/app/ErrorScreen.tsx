import { Alert, Button } from '@/ui';

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5">
      <Alert tone="danger" title="Couldn’t load your group" action={<Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>}>
        {message}
      </Alert>
    </main>
  );
}
