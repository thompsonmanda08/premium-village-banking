import type { ReactNode } from 'react';

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-3">
      <div>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
