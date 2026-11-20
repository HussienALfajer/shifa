// The public API of @shifa/ui. It never exposes which library is underneath (spec 0.4, edge
// cases): components wrap UI SDK (or Base UI as the per-component fallback) behind our props.
export { DensityProvider, useCoarsePointer, useDensity } from './density/density-provider.tsx';
export { DENSITIES, type Density, resolveDensity } from './density/resolve.ts';
export { cn } from './lib/cn.ts';
export {
  type Direction,
  DirectionProvider,
  useDirection,
} from './providers/direction-provider.tsx';
export { type Theme, ThemeProvider, useTheme } from './providers/theme-provider.tsx';
