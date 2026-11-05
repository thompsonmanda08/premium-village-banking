import { Info } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * An "i" beside a label. Hover, focus or a tap shows the explanation; a second tap, a tap elsewhere or Escape closes it.
 * The explanation is placed against the nearest `relative` ancestor (TextField's label row), so it stays inside the field's width.
 */
export function InfoTip({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);
  const hovered = useRef(false); // a mouse is over it, so the tip is already showing
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  return (
    <span
      ref={root}
      className="inline-flex"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') { hovered.current = true; setOpen(true); } }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') { hovered.current = false; setOpen(false); } }}
    >
      <button
        type="button"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        // A tap or Enter toggles it; a click under a mouse that is already showing it does nothing.
        onClick={() => { if (!hovered.current) setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        className="-m-3 inline-flex size-11 items-center justify-center rounded-full text-muted transition duration-150 hover:text-fg"
      >
        <Info aria-hidden className="size-4" />
      </button>
      {open ? (
        <span id={id} role="tooltip" className="absolute left-0 top-full z-20 mt-1.5 w-[min(16rem,100%)] rounded-xl bg-fg px-3 py-2 text-sm font-normal text-canvas shadow-lg">
          {children}
        </span>
      ) : null}
    </span>
  );
}
