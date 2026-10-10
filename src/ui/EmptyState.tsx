import type { ReactNode } from 'react';

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon ? <div aria-hidden className="mb-4 grid size-14 place-items-center rounded-full bg-accent-soft text-accent">{icon}</div> : null}
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {children ? <div className="mt-2 max-w-sm text-base text-muted">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
