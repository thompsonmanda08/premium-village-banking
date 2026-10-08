import type { ReactNode } from 'react';
import { AlertTriangle, Check, Circle, Clock, Dot, Info, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

// Label text is always text-fg (the soft tints fail AA at 12px); only the glyph carries the tone colour.
const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-2',
  accent: 'bg-accent-soft',
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  info: 'bg-info-soft',
};
const GLYPH_COLOR: Record<Tone, string> = {
  neutral: 'text-muted',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};
const GLYPH: Record<Tone, LucideIcon> = { neutral: Circle, accent: Dot, success: Check, warning: Clock, danger: AlertTriangle, info: Info };

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const Glyph = GLYPH[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold text-fg', TONE[tone], className)}>
      <Glyph aria-hidden className={cn('size-3.5', GLYPH_COLOR[tone])} />
      {children}
    </span>
  );
}
