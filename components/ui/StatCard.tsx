import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, HelpCircle } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  neutral?: boolean;
  period?: string;
  icon?: React.ReactNode;
  sparkline?: number[];
  color?: 'indigo' | 'emerald' | 'amber' | 'purple' | 'blue' | 'rose';
  tooltip?: string;
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  isPositive = true,
  neutral = false,
  period = 'vs last month',
  icon,
  sparkline,
  color = 'indigo',
  tooltip,
  onClick,
  className = '',
}) => {
  const colorMap = {
    indigo: 'from-indigo-500/20 to-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20',
    purple: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20',
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20',
  };

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white/80 dark:bg-zinc-900/50 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-4 transition-all duration-200 hover:border-slate-300 dark:hover:border-white/15 hover:shadow-md flex flex-col justify-between overflow-hidden ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Ambient background glow */}
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${colorMap[color]} rounded-full blur-2xl pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity`} />

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              {label}
            </span>
            {tooltip && (
              <span title={tooltip} className="cursor-help text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300">
                <HelpCircle size={12} />
              </span>
            )}
          </div>
          {icon && (
            <div className={`p-2 rounded-xl border bg-gradient-to-br ${colorMap[color]} shrink-0 shadow-sm`}>
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2 mt-1">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {value}
          </h2>
          {sparkline && sparkline.length > 0 && (
            <div className="h-6 w-16 flex items-end gap-0.5">
              {sparkline.map((val, idx) => {
                const max = Math.max(...sparkline);
                const height = max > 0 ? (val / max) * 100 : 20;
                return (
                  <div
                    key={idx}
                    className={`flex-1 rounded-sm ${
                      isPositive
                        ? 'bg-emerald-500/50 group-hover:bg-emerald-500'
                        : 'bg-rose-500/50 group-hover:bg-rose-500'
                    } transition-colors`}
                    style={{ height: `${Math.max(15, height)}%` }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {change && (
        <div className="relative z-10 flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100 dark:border-white/5 text-[11px]">
          <span
            className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded-md ${
              neutral
                ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                : isPositive
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
            }`}
          >
            {neutral ? (
              <Minus size={11} className="mr-0.5" />
            ) : isPositive ? (
              <ArrowUpRight size={11} className="mr-0.5" />
            ) : (
              <ArrowDownRight size={11} className="mr-0.5" />
            )}
            {change}
          </span>
          <span className="text-slate-400 dark:text-zinc-500 truncate">{period}</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
