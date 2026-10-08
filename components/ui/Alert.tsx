import React, { useState } from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  action,
  dismissible = false,
  onDismiss,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const icons = {
    info: <Info size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />,
    success: <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />,
    warning: <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />,
    danger: <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />,
  };

  const variantStyles = {
    info: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20 text-sky-900 dark:text-sky-200',
    success: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-900 dark:text-emerald-200',
    warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-200',
    danger: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-900 dark:text-rose-200',
  };

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) onDismiss();
  };

  return (
    <div
      role="alert"
      className={`rounded-2xl border p-4 flex items-start gap-3 relative transition-all ${variantStyles[variant]} ${className}`}
    >
      <div className="mt-0.5">{icons[variant]}</div>

      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="text-xs font-bold tracking-tight mb-1">
            {title}
          </h4>
        )}
        <div className="text-xs leading-relaxed opacity-90">{children}</div>
        {action && <div className="mt-2.5">{action}</div>}
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-opacity"
          aria-label="Dismiss alert"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default Alert;
