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
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              'flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-medium transition active:scale-[.97]',
              pref === value ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-fg',
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
