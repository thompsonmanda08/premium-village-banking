import { useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, id, className, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={fieldId} className="text-sm font-medium text-fg">{label}</label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-fg transition placeholder:text-muted focus-visible:border-accent',
          error ? 'border-danger' : 'border-line',
        )}
        {...rest}
      />
      {hint && !error ? <p id={hintId} className="text-sm text-muted">{hint}</p> : null}
      {error ? <p id={errorId} role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
