import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'pill' | 'underline' | 'boxed';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'pill',
  size = 'md',
  fullWidth = false,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-xs px-3.5 py-1.5 gap-2',
    lg: 'text-sm px-4 py-2 gap-2.5',
  };

  if (variant === 'underline') {
    return (
      <div className={`border-b border-slate-200 dark:border-white/10 flex items-center gap-4 overflow-x-auto no-scrollbar ${className}`}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={`relative pb-3 flex items-center font-semibold text-xs transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span className="ml-1.5">{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Boxed or Pill variant
  return (
    <div
      className={`inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-white/5 ${
        fullWidth ? 'w-full flex' : ''
      } ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`flex items-center justify-center font-semibold rounded-lg transition-all duration-150 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
              sizeStyles[size]
            } ${fullWidth ? 'flex-1' : ''} ${
              isActive
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-white/10'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
