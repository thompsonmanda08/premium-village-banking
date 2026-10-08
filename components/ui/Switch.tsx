import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  id,
  className = '',
}) => {
  const switchId = id || `switch-${Math.random().toString(36).substr(2, 9)}`;

  const trackSizes = {
    sm: 'w-8 h-4 p-0.5',
    md: 'w-11 h-6 p-0.5',
    lg: 'w-14 h-7 p-1',
  };

  const thumbSizes = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-5 h-5',
  };

  const translateStyles = {
    sm: checked ? 'translate-x-4' : 'translate-x-0',
    md: checked ? 'translate-x-5' : 'translate-x-0',
    lg: checked ? 'translate-x-7' : 'translate-x-0',
  };

  return (
    <div
      className={`flex items-start justify-between gap-3 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      {(label || description) && (
        <div className="flex-1 min-w-0 select-none">
          {label && (
            <label
              htmlFor={switchId}
              className="text-xs font-semibold text-slate-800 dark:text-zinc-200 cursor-pointer block leading-snug"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-[11px] text-slate-400 dark:text-zinc-400 mt-0.5 leading-snug">
              {description}
            </p>
          )}
        </div>
      )}

      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          trackSizes[size]
        } ${
          checked
            ? 'bg-indigo-600'
            : 'bg-slate-300 dark:bg-zinc-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block rounded-full bg-white shadow-md transform ring-0 transition duration-200 ease-in-out ${
            thumbSizes[size]
          } ${translateStyles[size]}`}
        />
      </button>
    </div>
  );
};

export default Switch;
