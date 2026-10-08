import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

type ToastTone = 'neutral' | 'success' | 'danger';
type ToastOptions = { tone?: ToastTone; action?: { label: string; onClick: () => void } };
type ToastItem = { id: number; message: string; tone: ToastTone; action?: ToastOptions['action'] };
type Show = (message: string, opts?: ToastOptions) => void;

const ToastContext = createContext<Show>(() => {});
const ICON = { neutral: Info, success: CheckCircle2, danger: AlertTriangle };
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback<Show>((message, opts = {}) => {
    const id = nextId++;
    setItems((list) => [...list.slice(-2), { id, message, tone: opts.tone ?? 'neutral', action: opts.action }]);
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div key={t.id} className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-fg px-4 py-3 text-sm text-canvas shadow-lg">
              <Icon aria-hidden className="size-5 shrink-0" />
              <span className="flex-1">{t.message}</span>
              {t.action ? (
                <button type="button" onClick={t.action.onClick} className="min-h-12 min-w-12 rounded-lg px-2 font-semibold underline">
                  {t.action.label}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = (): Show => useContext(ToastContext);
