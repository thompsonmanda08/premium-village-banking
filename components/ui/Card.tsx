import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'outline' | 'flat';
  hoverEffect?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'glass',
  hoverEffect = true,
  className = '',
  ...props
}) => {
  const variantStyles = {
    glass: 'bg-white/80 dark:bg-zinc-900/50 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 shadow-sm text-slate-900 dark:text-zinc-100',
    default: 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm text-slate-900 dark:text-zinc-100',
    outline: 'bg-transparent border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-zinc-100',
    flat: 'bg-slate-100 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-white/5 text-slate-900 dark:text-zinc-100',
  };

  const hoverStyles = hoverEffect
    ? 'transition-all duration-200 hover:border-indigo-400/40 dark:hover:border-indigo-500/30 hover:shadow-md'
    : '';

  return (
    <div
      className={`rounded-2xl p-5 relative overflow-hidden ${variantStyles[variant]} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, icon, className = '' }) => (
  <div className={`flex items-start justify-between gap-3 mb-4 ${className}`}>
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <div className="p-2 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const CardContent: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`space-y-3 ${className}`}>{children}</div>
);

export const CardFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`mt-4 pt-3 border-t border-slate-200 dark:border-white/5 flex items-center justify-between gap-2 ${className}`}>
    {children}
  </div>
);

export default Card;
