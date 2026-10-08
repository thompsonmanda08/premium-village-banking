import { Loader2 } from 'lucide-react';

export function FullScreenLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-dvh place-items-center">
      <Loader2 aria-hidden className="size-8 animate-spin text-accent" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
