import React, { useState } from 'react';
import { Search, X, Eye, EyeOff, AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isClearable?: boolean;
  onClear?: () => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  helperText,
  errorMessage,
  leftIcon,
  rightIcon,
  isClearable,
  onClear,
  type = 'text',
  value,
  onChange,
  disabled,
  className = '',
  id,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 tracking-tight"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3 text-slate-400 dark:text-zinc-500 pointer-events-none shrink-0">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`w-full rounded-xl border bg-white dark:bg-zinc-900/90 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-zinc-950 ${
            leftIcon ? 'pl-9' : 'pl-3.5'
          } ${
            rightIcon || isPassword || (isClearable && value) ? 'pr-10' : 'pr-3.5'
          } py-2 ${
            errorMessage
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
              : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-indigo-500/20'
          } ${className}`}
          {...props}
        />

        {/* Action icons right side */}
        <div className="absolute right-3 flex items-center gap-1.5 text-slate-400 dark:text-zinc-400">
          {isClearable && value && (
            <button
              type="button"
              onClick={onClear}
              className="hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          )}

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}

          {!isPassword && rightIcon && <span>{rightIcon}</span>}
        </div>
      </div>

      {errorMessage ? (
        <p className="text-[11px] font-medium text-rose-500 dark:text-rose-400 flex items-center gap-1">
          <AlertCircle size={12} className="shrink-0" />
          <span>{errorMessage}</span>
        </p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-400 dark:text-zinc-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';

export interface SearchInputProps extends Omit<InputProps, 'leftIcon'> {
  shortcutHint?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  placeholder = 'Search anything...',
  shortcutHint = '⌘K',
  value,
  onClear,
  ...props
}) => {
  return (
    <Input
      placeholder={placeholder}
      leftIcon={<Search size={15} />}
      isClearable={Boolean(value)}
      onClear={onClear}
      rightIcon={
        !value && shortcutHint ? (
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded">
            {shortcutHint}
          </kbd>
        ) : undefined
      }
      value={value}
      {...props}
    />
  );
};

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  helperText,
  errorMessage,
  disabled,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 tracking-tight"
        >
          {label}
        </label>
      )}

      <textarea
        id={inputId}
        disabled={disabled}
        className={`w-full rounded-xl border bg-white dark:bg-zinc-900/90 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm p-3 transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-zinc-950 resize-y min-h-[90px] ${
          errorMessage
            ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
            : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-indigo-500/20'
        } ${className}`}
        {...props}
      />

      {errorMessage ? (
        <p className="text-[11px] font-medium text-rose-500 dark:text-rose-400 flex items-center gap-1">
          <AlertCircle size={12} className="shrink-0" />
          <span>{errorMessage}</span>
        </p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-400 dark:text-zinc-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};

export default Input;
