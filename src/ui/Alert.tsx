import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react';
import { cn } from './cn';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';
const STYLE: Record<AlertTone, string> = {
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};
const ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: OctagonAlert };

export function Alert({ tone = 'info', title, children, action }: { tone?: AlertTone; title?: string; children: ReactNode; action?: ReactNode }) {
  const Icon = ICON[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl p-3.5', STYLE[tone])}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm text-fg">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
