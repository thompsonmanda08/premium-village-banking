import React from 'react';

export interface AvatarProps {
  src?: string;
  name?: string;
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'busy' | 'offline' | 'away';
  variant?: 'circle' | 'rounded';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  initials,
  size = 'md',
  status,
  variant = 'circle',
  className = '',
}) => {
  const sizeStyles = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const statusDotSizes = {
    xs: 'w-1.5 h-1.5 bottom-0 right-0',
    sm: 'w-2 h-2 bottom-0 right-0',
    md: 'w-2.5 h-2.5 bottom-0 right-0',
    lg: 'w-3 h-3 bottom-0.5 right-0.5',
    xl: 'w-4 h-4 bottom-1 right-1',
  };

  const statusColors = {
    online: 'bg-emerald-500 ring-white dark:ring-zinc-950',
    busy: 'bg-rose-500 ring-white dark:ring-zinc-950',
    offline: 'bg-slate-400 dark:bg-zinc-600 ring-white dark:ring-zinc-950',
    away: 'bg-amber-500 ring-white dark:ring-zinc-950',
  };

  const roundedStyle = variant === 'circle' ? 'rounded-full' : 'rounded-xl';

  const derivedInitials =
    initials ||
    (name
      ? name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : 'U');

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className={`${sizeStyles[size]} ${roundedStyle} object-cover bg-slate-200 dark:bg-zinc-800 border border-slate-200 dark:border-white/10`}
        />
      ) : (
        <div
          className={`${sizeStyles[size]} ${roundedStyle} bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 text-white font-bold flex items-center justify-center border border-white/20 shadow-sm`}
        >
          {derivedInitials}
        </div>
      )}

      {status && (
        <span
          className={`absolute ${statusDotSizes[size]} ${statusColors[status]} rounded-full ring-2`}
        />
      )}
    </div>
  );
};

export interface AvatarGroupProps {
  avatars: Array<{ src?: string; name: string; initials?: string }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  max = 3,
  size = 'sm',
  className = '',
}) => {
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const sizeStyles = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div className={`flex items-center -space-x-2 overflow-hidden ${className}`}>
      {visible.map((av, idx) => (
        <div key={idx} className="ring-2 ring-white dark:ring-zinc-950 rounded-full">
          <Avatar src={av.src} name={av.name} initials={av.initials} size={size} />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={`${sizeStyles[size]} rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 ring-2 ring-white dark:ring-zinc-950 flex items-center justify-center font-bold text-xs border border-slate-300 dark:border-white/10`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
};

export default Avatar;
