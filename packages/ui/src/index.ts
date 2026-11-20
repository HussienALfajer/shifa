// The public API of @shifa/ui. It never exposes which library is underneath (spec 0.4, edge
// cases): components wrap UI SDK (or Base UI as the per-component fallback) behind our props.
export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './button/button.tsx';
export {
  Combobox,
  type ComboboxItem,
  type ComboboxProps,
} from './combobox/combobox.tsx';
export { DatePicker, type DatePickerProps } from './date-picker/date-picker.tsx';
export { DensityProvider, useCoarsePointer, useDensity } from './density/density-provider.tsx';
export {
  Dialog,
  DialogActions,
  DialogClose,
  type DialogCloseProps,
  DialogContent,
  type DialogContentProps,
  type DialogProps,
  DialogTrigger,
  type DialogTriggerProps,
} from './dialog/dialog.tsx';
export {
  Menu,
  MenuContent,
  MenuItem,
  type MenuItemProps,
  type MenuProps,
  MenuSeparator,
  MenuTrigger,
  type MenuTriggerProps,
  Submenu,
  type SubmenuProps,
} from './menu/menu.tsx';
export { NumberInput, type NumberInputProps } from './number-input/number-input.tsx';
export {
  Popover,
  PopoverContent,
  type PopoverContentProps,
  type PopoverProps,
  PopoverTrigger,
  type PopoverTriggerProps,
} from './popover/popover.tsx';
export { Select, type SelectItem, type SelectProps } from './select/select.tsx';
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
