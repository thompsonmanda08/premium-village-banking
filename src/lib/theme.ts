export type ThemePref = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export const THEME_KEY = 'pvb-theme';
const CANVAS: Record<ResolvedTheme, string> = { light: '#EEF0F2', dark: '#0F1113' };

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem' | 'removeItem'>;

export function readPref(storage: Reader = window.localStorage): ThemePref {
  try {
    const v = storage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function writePref(pref: ThemePref, storage: Writer = window.localStorage): void {
  try {
    if (pref === 'system') storage.removeItem(THEME_KEY);
    else storage.setItem(THEME_KEY, pref);
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }
}

export const resolveTheme = (pref: ThemePref, prefersDark: boolean): ResolvedTheme =>
  pref === 'system' ? (prefersDark ? 'dark' : 'light') : pref;

export function applyTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CANVAS[theme]);
}
