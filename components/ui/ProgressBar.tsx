import React from 'react';

export interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'blue' | 'gradient';
  animated?: boolean;
  striped?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showPercentage = true,
  size = 'md',
  color = 'indigo',
  animated = false,
  striped = false,
  className = '',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const heightStyles = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const colorStyles = {
    indigo: 'bg-indigo-600',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    purple: 'bg-purple-600',
    blue: 'bg-blue-600',
    gradient: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500',
  };

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs">
          {label && (
            <span className="font-semibold text-slate-700 dark:text-zinc-300 truncate">
              {label}
            </span>
          )}
          {showPercentage && (
            <span className="font-mono text-slate-500 dark:text-zinc-400 font-medium">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}

      <div
        className={`w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden ${heightStyles[size]}`}
      >
        <div
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            colorStyles[color]
          } ${striped ? 'bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem]' : ''} ${
            animated ? 'animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]' : ''
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export interface CircularGaugeProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  className?: string;
}

export const CircularGauge: React.FC<CircularGaugeProps> = ({
  value,
  max = 100,
  size = 100,
  strokeWidth = 8,
  label,
  sublabel,
  color = '#6366f1',
  className = '',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`relative inline-flex flex-col items-center justify-center ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-zinc-800"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
          {Math.round(percentage)}%
        </span>
        {label && (
          <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mt-0.5">
            {label}
          </span>
        )}
      </div>
      {sublabel && (
        <span className="text-xs text-slate-500 dark:text-zinc-400 mt-2 font-medium">
          {sublabel}
        </span>
      )}
    </div>
  );
};

export default ProgressBar;
