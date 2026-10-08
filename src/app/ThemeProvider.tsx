import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyTheme, readPref, resolveTheme, writePref, type ResolvedTheme, type ThemePref } from '@/lib/theme';

type ThemeState = { pref: ThemePref; resolved: ResolvedTheme; setPref: (p: ThemePref) => void };
const ThemeContext = createContext<ThemeState | null>(null);
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => readPref());
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia(DARK_QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveTheme(pref, prefersDark);
  useEffect(() => applyTheme(resolved), [resolved]);

  const setPref = useCallback((p: ThemePref) => {
    writePref(p);
    setPrefState(p);
  }, []);

  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
