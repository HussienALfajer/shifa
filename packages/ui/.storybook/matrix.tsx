// Every story in the eight combinations of direction × theme × density (spec 0.4 criterion 9),
// side by side, so a reviewer sees RTL and LTR, light and dark, both densities at once.
import type { Decorator } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import {
  type Density,
  DensityProvider,
  type Direction,
  DirectionProvider,
  type Theme,
  ThemeProvider,
} from '../src/index.ts';

export interface Combination {
  dir: Direction;
  theme: Theme;
  density: Density;
}

const DIRECTIONS: Direction[] = ['rtl', 'ltr'];
const THEMES: Theme[] = ['light', 'dark'];
const DENSITIES: Density[] = ['comfortable', 'compact'];

/** Arabic RTL first, then English LTR; light before dark; comfortable before compact. */
export const MATRIX: readonly Combination[] = DIRECTIONS.flatMap((dir) =>
  THEMES.flatMap((theme) => DENSITIES.map((density) => ({ dir, theme, density }))),
);

const NAMES = { rtl: 'RTL · العربية', ltr: 'LTR · English', light: 'light', dark: 'dark' };

/** One region of the matrix: the providers, the app background, the story. */
export function Region({ dir, theme, density, children }: Combination & { children: ReactNode }) {
  return (
    <DirectionProvider dir={dir}>
      <ThemeProvider theme={theme}>
        <DensityProvider density={density}>
          <div className="rounded-surface border border-border-default bg-bg-app p-4 font-ui text-text-default">
            {children}
          </div>
        </DensityProvider>
      </ThemeProvider>
    </DirectionProvider>
  );
}

/**
 * Renders `children()` once per combination, each cell named and marked `data-matrix-cell`.
 * Two columns when the story itself is at least 72 rem wide (a container query, not the
 * viewport): the story canvas at 1280 px has two, a docs page (about 1000 px of content) one, so
 * a wide component such as the data table is never squeezed into half a docs page.
 */
export function Matrix({ children }: { children: () => ReactNode }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @6xl:grid-cols-2">
        {MATRIX.map(({ dir, theme, density }) => (
          <section
            key={`${dir} ${theme} ${density}`}
            data-matrix-cell={`${dir} ${theme} ${density}`}
            className="flex flex-col gap-2"
          >
            <p className="m-0 font-ui text-200 text-text-muted" dir="ltr">
              {NAMES[dir]} · {NAMES[theme]} · {density}
            </p>
            <Region dir={dir} theme={theme} density={density}>
              {children()}
            </Region>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * The global decorator. `parameters.matrix: false` renders a story once, in Arabic RTL, light,
 * comfortable (stories whose play function looks for one element).
 */
export const withMatrix: Decorator = (Story, context) => {
  if (context.parameters['matrix'] === false) {
    return (
      <Region dir="rtl" theme="light" density="comfortable">
        <Story />
      </Region>
    );
  }
  return <Matrix>{() => <Story />}</Matrix>;
};
