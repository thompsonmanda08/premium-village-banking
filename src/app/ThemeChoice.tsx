import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/ui';
import type { ThemePref } from '@/lib/theme';
import { useTheme } from './ThemeProvider';

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function ThemeChoice() {
  const { pref, setPref } = useTheme();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-fg">Theme</legend>
      <div className="grid grid-cols-3 gap-1 rounded-full border border-line bg-surface-2 p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              'flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-medium transition active:scale-[.97] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
              pref === value ? 'bg-accent-solid text-on-accent' : 'text-muted hover:text-fg',
            )}
          >
            <input type="radio" name="theme" value={value} checked={pref === value} onChange={() => setPref(value)} className="sr-only" />
            <Icon aria-hidden className="size-4" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
