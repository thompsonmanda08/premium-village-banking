import { Info } from 'lucide-react';
import { useId, useState } from 'react';

/** An "i" beside a label. Hover, focus or a tap shows the explanation; Escape closes it. */
export function InfoTip({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        className="-m-3 inline-flex size-11 items-center justify-center rounded-full text-muted transition duration-150 hover:text-fg"
      >
        <Info aria-hidden className="size-4" />
      </button>
      {open ? (
        <span id={id} role="tooltip" className="absolute left-1/2 top-full z-20 mt-1.5 w-56 -translate-x-1/2 rounded-xl bg-fg px-3 py-2 text-sm font-normal text-canvas shadow-lg">
          {children}
        </span>
      ) : null}
    </span>
  );
}
