import type { ReactNode } from 'react';
import { render } from 'vitest-browser-react';
import {
  type Density,
  DensityProvider,
  type Direction,
  DirectionProvider,
  type Theme,
  ThemeProvider,
} from '../../src/index.ts';

export interface Region {
  dir?: Direction;
  theme?: Theme;
  density?: Density;
}

/**
 * Renders `ui` the way a screen holds it: inside the direction (Arabic RTL by default), theme and
 * density providers, on the app background in the theme's text colour, so geometry, colours and
 * axe's contrast check see what a person would.
 */
export async function renderDir(
  ui: ReactNode,
  { dir = 'rtl', theme = 'light', density = 'comfortable' }: Region = {},
) {
  return render(
    <DirectionProvider dir={dir}>
      <ThemeProvider theme={theme}>
        <DensityProvider density={density}>
          <div className="bg-bg-app font-ui text-text-default">{ui}</div>
        </DensityProvider>
      </ThemeProvider>
    </DirectionProvider>,
  );
}
