import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rounded' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const variantStyles = {
    text: 'rounded-md h-3.5 w-full',
    circular: 'rounded-full',
    rounded: 'rounded-xl',
    rectangular: 'rounded-none',
  };

  const customStyle: React.CSSProperties = {
    ...style,
    width: width !== undefined ? width : undefined,
    height: height !== undefined ? height : undefined,
  };

  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-zinc-800/80 ${variantStyles[variant]} ${className}`}
      style={customStyle}
      {...props}
    />
  );
};

export const SkeletonCard: React.FC = () => (
  <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-zinc-900/40 space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton variant="circular" width={36} height={36} />
      <Skeleton width={60} height={18} />
    </div>
    <Skeleton width="40%" height={24} />
    <Skeleton width="70%" height={12} />
    <div className="pt-2">
      <Skeleton height={6} />
    </div>
  </div>
);

export const SkeletonTableRow: React.FC<{ cols?: number }> = ({ cols = 4 }) => (
  <tr className="border-b border-slate-100 dark:border-white/5">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="py-3.5 px-4">
        <Skeleton width={i === 0 ? '70%' : '50%'} height={14} />
      </td>
    ))}
  </tr>
);

export default Skeleton;
