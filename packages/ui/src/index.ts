// The public API of @shifa/ui. It never exposes which library is underneath (spec 0.4, edge
// cases): components wrap UI SDK (or Base UI as the per-component fallback) behind our props.
export {
  Accordion,
  AccordionItem,
  type AccordionItemProps,
  type AccordionProps,
} from './accordion/accordion.tsx';
export {
  AlertDialog,
  AlertDialogAction,
  type AlertDialogActionProps,
  AlertDialogCancel,
  type AlertDialogCancelProps,
  AlertDialogContent,
  type AlertDialogContentProps,
  type AlertDialogProps,
  AlertDialogTrigger,
  type AlertDialogTriggerProps,
} from './alert-dialog/alert-dialog.tsx';
export {
  Avatar,
  AvatarGroup,
  type AvatarGroupPerson,
  type AvatarGroupProps,
  type AvatarProps,
  type AvatarSize,
  avatarInitials,
} from './avatar/avatar.tsx';
export {
  Badge,
  type BadgeProps,
  type BadgeSize,
  type BadgeTone,
  CountBadge,
  type CountBadgeProps,
  type CountBadgeTone,
} from './badge/badge.tsx';
export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './button/button.tsx';
export { Callout, type CalloutProps, type CalloutTone } from './callout/callout.tsx';
export {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  type CardHeaderProps,
  CardLink,
  type CardLinkProps,
  type CardProps,
} from './card/card.tsx';
export { Checkbox, type CheckboxProps } from './checkbox/checkbox.tsx';
export { CodeList, type CodeListPrint, type CodeListProps } from './code-list/code-list.tsx';
export {
  Combobox,
  type ComboboxItem,
  type ComboboxProps,
  resultsAnnouncement,
} from './combobox/combobox.tsx';
export {
  CommandPalette,
  type CommandPaletteGroup,
  type CommandPaletteItem,
  type CommandPaletteProps,
  normaliseForSearch,
} from './command-palette/command-palette.tsx';
export {
  CopyField,
  type CopyFieldProps,
  type CopyFieldShare,
} from './copy-field/copy-field.tsx';
export {
  DataTable,
  type DataTableCellValue,
  type DataTableColumn,
  type DataTableColumnKind,
  type DataTableColumnWidth,
  type DataTableProps,
  type DataTableSort,
  type DataTableSortDirection,
} from './data-table/data-table.tsx';
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
export {
  Drawer,
  DrawerActions,
  DrawerClose,
  type DrawerCloseProps,
  DrawerContent,
  type DrawerContentProps,
  type DrawerProps,
  type DrawerSide,
  DrawerTrigger,
  type DrawerTriggerProps,
} from './drawer/drawer.tsx';
export {
  EmptyState,
  type EmptyStateArt,
  type EmptyStateProps,
  type EmptyStateSize,
} from './empty-state/empty-state.tsx';
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
export { foldArabic } from './lib/fold-arabic.ts';
export {
  Menu,
  MenuContent,
  type MenuContentProps,
  MenuGroup,
  type MenuGroupProps,
  MenuItem,
  type MenuItemProps,
  MenuNote,
  type MenuNoteProps,
  type MenuPresentation,
  type MenuProps,
  MenuRadioGroup,
  type MenuRadioGroupProps,
  MenuRadioItem,
  type MenuRadioItemProps,
  MenuSeparator,
  MenuTrigger,
  type MenuTriggerProps,
  Submenu,
  type SubmenuProps,
} from './menu/menu.tsx';
export { NumberInput, type NumberInputProps } from './number-input/number-input.tsx';
export { OtpInput, type OtpInputProps } from './otp-input/otp-input.tsx';
export {
  type PageItem,
  Pagination,
  type PaginationCopy,
  type PaginationProps,
  pageItems,
} from './pagination/pagination.tsx';
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
export { QrCode, type QrCodeProps } from './qr-code/qr-code.tsx';
export {
  Radio,
  RadioGroup,
  type RadioGroupProps,
  type RadioProps,
} from './radio/radio.tsx';
export {
  SegmentedControl,
  type SegmentedControlItem,
  type SegmentedControlProps,
} from './segmented-control/segmented-control.tsx';
export { Select, type SelectItem, type SelectProps } from './select/select.tsx';
export {
  Skeleton,
  SkeletonGroup,
  type SkeletonGroupProps,
  type SkeletonProps,
  type SkeletonShape,
  SkeletonText,
  type SkeletonTextProps,
} from './skeleton/skeleton.tsx';
export { Spinner, type SpinnerProps, type SpinnerSize } from './spinner/spinner.tsx';
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
export {
  type ToastApi,
  type ToastOptions,
  ToastProvider,
  type ToastProviderProps,
  type ToastType,
  useToast,
} from './toast/toast.tsx';
export {
  Toolbar,
  ToolbarButton,
  type ToolbarButtonProps,
  type ToolbarProps,
  ToolbarSeparator,
} from './toolbar/toolbar.tsx';
export { Tooltip, type TooltipProps } from './tooltip/tooltip.tsx';
export {
  UsageChart,
  type UsageChartDay,
  type UsageChartLabels,
  type UsageChartProps,
} from './usage-chart/usage-chart.tsx';
