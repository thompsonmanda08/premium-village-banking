import { useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/ui';

export const PULL_TRIGGER = 64;
export const pullDistance = (dy: number): number => (dy <= 0 ? 0 : Math.min(96, Math.round(dy * 0.5)));

export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const [distance, setDistance] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);

  return (
    <div
      onTouchStart={(e) => {
        if (window.scrollY <= 0 && !busy) startY.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchMove={(e) => {
        if (startY.current !== null) setDistance(pullDistance((e.touches[0]?.clientY ?? 0) - startY.current));
      }}
      onTouchCancel={() => {
        startY.current = null;
        setDistance(0);
      }}
      onTouchEnd={async () => {
        const pulled = distance;
        startY.current = null;
        setDistance(0);
        if (pulled < PULL_TRIGGER) return;
        setBusy(true);
        try {
          await onRefresh();
        } catch {
          // the caller surfaces its own errors; the indicator just resets
        } finally {
          setBusy(false);
        }
      }}
    >
      <div aria-hidden className={cn('flex justify-center overflow-hidden', distance === 0 && 'transition-[height] duration-150')} style={{ height: busy ? 40 : distance }}>
        <RefreshCw className={cn('mt-2 size-5 text-muted', busy && 'animate-spin')} style={{ transform: `rotate(${distance * 3}deg)` }} />
      </div>
      {children}
    </div>
  );
}
