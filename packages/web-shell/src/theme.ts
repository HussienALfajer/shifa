// The colour theme the person chose (light, dark, or the device's), kept in localStorage.
import type { Theme } from '@shifa/ui';
import { useCallback, useSyncExternalStore } from 'react';

export type ThemePreference = Theme | 'system';

export const THEME_STORAGE_KEY = 'shifa.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const CHANGED = 'shifa-theme-changed';

const isPreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

function readPreference(): ThemePreference {
  try {
    const stored = globalThis.localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function subscribe(onChange: () => void): () => void {
  const query = globalThis.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  globalThis.addEventListener(CHANGED, onChange);
  globalThis.addEventListener('storage', onChange);
  return () => {
    query.removeEventListener('change', onChange);
    globalThis.removeEventListener(CHANGED, onChange);
    globalThis.removeEventListener('storage', onChange);
  };
}

/** The preference, the theme it resolves to, and the setter. */
export function useThemePreference(): {
  preference: ThemePreference;
  theme: Theme;
  setPreference: (next: ThemePreference) => void;
} {
  const preference = useSyncExternalStore(subscribe, readPreference, () => 'system' as const);
  const dark = useSyncExternalStore(
    subscribe,
    () => globalThis.matchMedia(DARK_QUERY).matches,
    () => false,
  );
  const setPreference = useCallback((next: ThemePreference) => {
    try {
      globalThis.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
    globalThis.dispatchEvent(new Event(CHANGED));
  }, []);
  const theme: Theme = preference === 'system' ? (dark ? 'dark' : 'light') : preference;
  return { preference, theme, setPreference };
}
