import type { ReactNode } from 'react';

/** A headline figure: the label, then the value. */
export function Figure({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 md:p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="tabular mt-auto pt-4 text-xl font-semibold tracking-tight text-fg md:pt-6 md:text-2xl">{value}</p>
      {note ? <p className="mt-1 text-sm text-muted">{note}</p> : null}
    </div>
  );
}
