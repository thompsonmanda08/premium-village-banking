import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';

/** A headline figure with its page one tap away, in the round link that sits in the tile's cut corner. */
export function StatTile({ label, value, note, to, linkLabel }: { label: string; value: ReactNode; note?: ReactNode; to: string; linkLabel: string }) {
  return (
    <div className="relative">
      <div className="notch flex h-full flex-col rounded-2xl border border-line bg-surface p-4 md:p-5">
        <p className="pr-12 text-sm text-muted">{label}</p>
        <p className="tabular mt-auto pt-4 text-xl font-semibold tracking-tight text-fg md:pt-6 md:text-2xl xl:text-[1.75rem]">{value}</p>
        {note ? <p className="mt-1 text-sm text-muted">{note}</p> : null}
      </div>
      <Link
        to={to}
        viewTransition
        aria-label={linkLabel}
        title={linkLabel}
        className="absolute right-0 top-0 grid size-11 place-items-center rounded-full border border-line bg-surface text-fg transition duration-150 hover:border-transparent hover:bg-accent-solid hover:text-on-accent active:scale-[.95]"
      >
        <ArrowUpRight aria-hidden className="size-5" />
      </Link>
    </div>
  );
}
