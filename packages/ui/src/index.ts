// The public API of @shifa/ui. It never exposes which library is underneath (spec 0.4, edge
// cases): components wrap UI SDK (or Base UI as the per-component fallback) behind our props.
export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './button/button.tsx';
export { DensityProvider, useCoarsePointer, useDensity } from './density/density-provider.tsx';
export { DENSITIES, type Density, resolveDensity } from './density/resolve.ts';
export {
  DIRECTIONAL_ICONS,
  HEALTH_ICONS,
  ICON_NAMES,
  Icon,
  type IconName,
  type IconProps,
} from './icons/icon.tsx';
export { cn } from './lib/cn.ts';
export { toWesternDigits } from './lib/digits.ts';
export {
  type Direction,
  DirectionProvider,
  useDirection,
} from './providers/direction-provider.tsx';
export { type Theme, ThemeProvider, useTheme } from './providers/theme-provider.tsx';
export {
  Tab,
  TabList,
  type TabListProps,
  TabPanel,
  type TabPanelProps,
  type TabProps,
  Tabs,
  type TabsProps,
} from './tabs/tabs.tsx';
