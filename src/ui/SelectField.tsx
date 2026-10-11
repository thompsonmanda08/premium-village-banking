import { useId, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

/** A labelled native select, styled like TextField. */
export function SelectField({ label, error, id, className, children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={fieldId} className="text-sm font-medium text-fg">{label}</label>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-fg transition focus-visible:border-accent',
          error ? 'border-danger' : 'border-line',
        )}
        {...rest}
      >
        {children}
      </select>
      {error ? <p id={errorId} role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
