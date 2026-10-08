import { cn } from './cn';

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export function Avatar({ name, src, size = 'md' }: { name: string; src?: string | null; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm';
  return src ? (
    <img src={src} alt="" className={cn('rounded-full object-cover', box)} />
  ) : (
    <span aria-hidden className={cn('grid place-items-center rounded-full bg-accent-soft font-semibold text-accent', box)}>
      {initials(name)}
    </span>
  );
}
