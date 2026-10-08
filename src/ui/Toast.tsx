import { createContext, useCallback, useContext, useEffect, useState, type FocusEvent, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

type ToastTone = 'neutral' | 'success' | 'danger';
type ToastOptions = { tone?: ToastTone; action?: { label: string; onClick: () => void } };
type ToastItem = { id: number; message: string; tone: ToastTone; action?: ToastOptions['action'] };
type Show = (message: string, opts?: ToastOptions) => void;

const ToastContext = createContext<Show>(() => {});
const ICON = { neutral: Info, success: CheckCircle2, danger: AlertTriangle };
const DISMISS_MS = 5000;
let nextId = 1;

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const { id, tone, message, action } = item;
  const Icon = ICON[tone];

  // The timer lives and dies with the toast: paused while hovered/focused, restarted on leave/blur, cleared on unmount.
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(id), DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [paused, id, onDismiss]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e: FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-fg px-4 py-3 text-sm text-canvas shadow-lg"
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className="flex-1">{message}</span>
      {action ? (
        <button
          type="button"
          onClick={() => {
            onDismiss(id);
            action.onClick();
          }}
          className="min-h-12 min-w-12 rounded-lg px-2 font-semibold underline"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback<Show>((message, opts = {}) => {
    const id = nextId++;
    setItems((list) => [...list.slice(-2), { id, message, tone: opts.tone ?? 'neutral', action: opts.action }]);
  }, []);
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = (): Show => useContext(ToastContext);
