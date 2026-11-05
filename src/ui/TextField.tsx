import { useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';
import { InfoTip } from './InfoTip';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  /** A fuller explanation, shown from an "i" beside the label. */
  info?: string;
  /** A short unit shown inside the field, such as K. */
  prefix?: string;
}

export function TextField({ label, hint, error, info, prefix, id, className, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-center gap-1">
        <label htmlFor={fieldId} className="text-sm font-medium text-fg">{label}</label>
        {info ? <InfoTip label={label}>{info}</InfoTip> : null}
      </div>
      <div className="relative">
      {prefix ? <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-base text-muted">{prefix}</span> : null}
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-fg transition placeholder:text-muted focus-visible:border-accent',
          prefix && 'pl-8',
          error ? 'border-danger' : 'border-line',
        )}
        {...rest}
      />
      </div>
      {hint && !error ? <p id={hintId} className="text-sm text-muted">{hint}</p> : null}
      {error ? <p id={errorId} role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
