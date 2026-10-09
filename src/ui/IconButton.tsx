import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  badge?: number;
}

export function IconButton({ label, icon, badge, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={badge ? `${label}, ${badge} waiting` : label}
      title={label}
      className={cn(
        'relative inline-grid size-12 place-items-center rounded-full text-muted transition duration-150 hover:bg-surface-2 hover:text-fg active:scale-[.97]',
        className,
      )}
      {...rest}
    >
      <span aria-hidden>{icon}</span>
      {badge ? (
        <span aria-hidden className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-accent-solid px-1 text-center text-xs font-semibold leading-5 text-on-accent">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
}
