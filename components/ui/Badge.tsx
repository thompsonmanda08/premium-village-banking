import React from 'react';
import { X } from 'lucide-react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  pulse?: boolean;
  onRemove?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  dot = false,
  pulse = false,
  onRemove,
  icon,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-0.5 gap-1.5',
    lg: 'text-xs px-3 py-1 gap-2',
  };

  const variantStyles = {
    primary: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
    secondary: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/10',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    info: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
    purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
    neutral: 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-white/5',
    outline: 'bg-transparent text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700',
  };

  const dotColors = {
    primary: 'bg-indigo-500',
    secondary: 'bg-slate-400 dark:bg-zinc-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-sky-500',
    purple: 'bg-purple-500',
    neutral: 'bg-slate-400',
    outline: 'bg-slate-500',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border tracking-tight ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors[variant]}`} />
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColors[variant]}`} />
        </span>
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70 rounded-full p-0.5 transition-opacity"
          aria-label="Remove badge"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
};

export default Badge;
