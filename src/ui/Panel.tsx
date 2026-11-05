import type { ReactNode } from 'react';
import { Card } from './Card';

/** A card with a labelled section: a title, an optional one-line hint, then the content. */
export function Panel({ id, title, hint, children }: { id?: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <section aria-labelledby={id} aria-label={id ? undefined : title} className="grid gap-3">
        <div>
          <h2 id={id} className="text-lg font-semibold text-fg">{title}</h2>
          {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
        </div>
        {children}
      </section>
    </Card>
  );
}
