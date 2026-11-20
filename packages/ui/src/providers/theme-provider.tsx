import { createContext, type ReactNode, useContext } from 'react';

export type Theme = 'light' | 'dark';

const ThemeContext = createContext<Theme>('light');

/**
 * Sets the colour theme of everything inside (`data-theme`); the semantic tokens switch with it.
 * Light and dark ship together (spec 0.4). A light region inside a dark one needs the
 * `[data-theme='light']` token block (backlog, before PLT-41).
 */
export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <ThemeContext value={theme}>
      <div data-theme={theme} className="contents">
        {children}
      </div>
    </ThemeContext>
  );
}

/** The colour theme in effect here. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
