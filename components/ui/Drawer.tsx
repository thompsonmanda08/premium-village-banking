import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  position?: 'right' | 'left';
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  position = 'right',
  className = '',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-xs',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  const positionStyles = {
    right: 'right-0 slide-in-from-right',
    left: 'left-0 slide-in-from-left',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className={`fixed inset-y-0 ${positionStyles[position]} flex max-w-full`}>
        <div
          className={`w-screen ${sizeStyles[size]} bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col justify-between text-slate-900 dark:text-zinc-100 animate-in duration-300 ${className}`}
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200 dark:border-white/5 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {title && (
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="p-4 bg-slate-50 dark:bg-zinc-950/50 border-t border-slate-200 dark:border-white/5 flex items-center justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Drawer;
