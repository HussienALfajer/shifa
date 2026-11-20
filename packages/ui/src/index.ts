// The public API of @shifa/ui. It never exposes which library is underneath (spec 0.4, edge
// cases): components wrap UI SDK (or Base UI as the per-component fallback) behind our props.
export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './button/button.tsx';
export { Checkbox, type CheckboxProps } from './checkbox/checkbox.tsx';
export {
  Combobox,
  type ComboboxItem,
  type ComboboxProps,
} from './combobox/combobox.tsx';
export { DatePicker, type DatePickerProps } from './date-picker/date-picker.tsx';
export { DensityProvider, useCoarsePointer, useDensity } from './density/density-provider.tsx';
export { DENSITIES, type Density, resolveDensity } from './density/resolve.ts';
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
export { Field, type FieldProps } from './field/field.tsx';
export {
  Form,
  FormField,
  type FormFieldControl,
  type FormFieldProps,
  type FormProps,
  FormSubmit,
  type FormSubmitProps,
  type ShifaForm,
  type Translate,
  useShifaForm,
} from './form/form.tsx';
export { IconButton, type IconButtonProps } from './icon-button/icon-button.tsx';
export {
  DIRECTIONAL_ICONS,
  HEALTH_ICONS,
  ICON_NAMES,
  Icon,
  type IconName,
  type IconProps,
} from './icons/icon.tsx';
export { Input, type InputProps } from './input/input.tsx';
export { cn } from './lib/cn.ts';
export { toWesternDigits } from './lib/digits.ts';
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
export { OtpInput, type OtpInputProps } from './otp-input/otp-input.tsx';
export {
  PasswordInput,
  type PasswordInputProps,
} from './password-input/password-input.tsx';
export {
  Popover,
  PopoverContent,
  type PopoverContentProps,
  type PopoverProps,
  PopoverTrigger,
  type PopoverTriggerProps,
} from './popover/popover.tsx';
export {
  type Direction,
  DirectionProvider,
  useDirection,
} from './providers/direction-provider.tsx';
export { type Theme, ThemeProvider, useTheme } from './providers/theme-provider.tsx';
export {
  Radio,
  RadioGroup,
  type RadioGroupProps,
  type RadioProps,
} from './radio/radio.tsx';
export { Select, type SelectItem, type SelectProps } from './select/select.tsx';
export { Switch, type SwitchProps } from './switch/switch.tsx';
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
export { Textarea, type TextareaProps } from './textarea/textarea.tsx';
export { TimeInput, type TimeInputProps } from './time-input/time-input.tsx';
