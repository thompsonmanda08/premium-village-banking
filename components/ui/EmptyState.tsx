import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-white/40 dark:bg-zinc-900/30 backdrop-blur-md ${className}`}
    >
      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 mb-3.5 border border-slate-200 dark:border-white/5">
        {icon || <Inbox size={28} />}
      </div>

      <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight mb-1">
        {title}
      </h3>

      <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mb-5 leading-relaxed">
        {description}
      </p>

      {(actionText || secondaryActionText) && (
        <div className="flex items-center gap-2.5">
          {secondaryActionText && (
            <Button variant="outline" size="sm" onClick={onSecondaryAction}>
              {secondaryActionText}
            </Button>
          )}
          {actionText && (
            <Button variant="primary" size="sm" onClick={onAction}>
              {actionText}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
