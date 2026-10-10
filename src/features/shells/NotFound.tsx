import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/ui';

export function NotFound({ title = 'Page not found', body = 'That page doesn’t exist.' }: { title?: string; body?: string }) {
  return (
    <EmptyState
      icon={<Compass className="size-7" />}
      title={title}
      action={
        <Link to="/" className="inline-flex h-12 items-center rounded-full px-5 font-semibold text-accent underline transition duration-150 hover:bg-surface-2 active:scale-[.97]">
          Go home
        </Link>
      }
    >
      {body}
    </EmptyState>
  );
}
