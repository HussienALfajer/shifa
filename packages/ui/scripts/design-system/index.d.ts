// The components of the Shifa Design System (window.Shifa), as documentation. The source of truth
// is packages/ui/src; these types follow it.

/** The curated icon names (Phosphor duotone and Healthicons). */
export type IconName =
  | 'arrow-back'
  | 'arrow-forward'
  | 'bell'
  | 'calendar'
  | 'calendar-plus'
  | 'caret-back'
  | 'caret-down'
  | 'caret-forward'
  | 'caret-up'
  | 'check'
  | 'check-circle'
  | 'clock'
  | 'cloud-check'
  | 'dots'
  | 'eye'
  | 'eye-slash'
  | 'file-text'
  | 'gear'
  | 'house'
  | 'info'
  | 'list'
  | 'magnifying-glass'
  | 'minus'
  | 'pencil'
  | 'phone'
  | 'plus'
  | 'printer'
  | 'sign-out'
  | 'trash'
  | 'user'
  | 'users'
  | 'warning'
  | 'wifi-slash'
  | 'x'
  | 'x-circle'
  | 'blood-drop'
  | 'heart-organ'
  | 'medicines'
  | 'stethoscope'
  | 'syringe'
  | 'tooth';

export interface ButtonProps {
  /** primary: the one main action of a view; secondary (default); ghost: light actions inside cards and tables; danger: actions that delete or cancel (brick, never red). */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** sm 36, md 44 (default), lg 52 px high; 28, 32, 40 in the compact density. */
  size?: 'sm' | 'md' | 'lg';
  /** The label. Leave it out for an icon-only button, which then needs `aria-label` and `startIcon`. */
  children?: string;
  /** An icon before the label, on the logical start (the right in Arabic). */
  startIcon?: IconName;
  /** An icon after the label, on the logical end ("التالي" with arrow-forward). */
  endIcon?: IconName;
  /** Busy: keeps the label and its place, shows a spinner first, ignores presses, stays focusable. */
  loading?: boolean;
  /** Stops presses and leaves the tab order. */
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
  onClick?: (event: MouseEvent) => unknown;
}

export interface IconProps {
  name: IconName;
  /** sm 20 px (rows and controls, the default), md 24 px (navigation and cards). */
  size?: 'sm' | 'md';
  /** A name for screen readers; without it the icon is decorative. */
  label?: string;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Tabs of one thing (a patient record): the selected tab green, heavier and underlined. */
export interface TabsProps {
  'aria-label': string;
  items: { value: string; label: string; panel?: string; disabled?: boolean }[];
  defaultValue?: string;
}

/** A button that opens a modal dialog: title, description, the safe action, then the main one. */
export interface DialogProps {
  triggerLabel: string;
  triggerVariant?: Variant;
  triggerIcon?: IconName;
  title: string;
  description?: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmVariant?: Variant;
  defaultOpen?: boolean;
}

/** A button that opens a small panel under it, at its logical start. */
export interface PopoverProps {
  triggerLabel: string;
  triggerIcon?: IconName;
  title: string;
  text: string;
  defaultOpen?: boolean;
}

/** A button that opens a list of actions. */
export interface MenuProps {
  triggerLabel?: string;
  triggerIcon?: IconName;
  'aria-label'?: string;
  items: (
    | {
        value: string;
        label: string;
        icon?: IconName;
        danger?: boolean;
        disabled?: boolean;
        hint?: string;
      }
    | { separator: true }
    | { label: string; icon?: IconName; items: { value: string; label: string }[] }
  )[];
}

interface FieldProps {
  label: string;
  hint?: string;
  /** Marks the field invalid; read with it. */
  error?: string;
  disabled?: boolean;
}

/** Choose one of a short, known list. */
export interface SelectProps extends FieldProps {
  items: { value: string; label: string; disabled?: boolean; hint?: string }[];
  defaultValue?: string | null;
  placeholder?: string;
}

/** Search a long list as you type (a word of the name starts with the text). */
export interface ComboboxProps extends FieldProps {
  items: { value: string; label: string; description?: string; disabled?: boolean }[];
  defaultValue?: string | null;
  emptyMessage: string;
  placeholder?: string;
}

/** A number with − and + (or an amount with a unit and no steppers); Western digits. */
export interface NumberInputProps extends FieldProps {
  defaultValue?: number | null;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  steppers?: boolean;
}

/** A Gregorian date, dd/mm/yyyy, the week from Saturday (OD-61); the value is an ISO date. */
export interface DatePickerProps extends FieldProps {
  defaultValue?: string | null;
  min?: string;
  max?: string;
}

/** A square button with one icon; `label` is its required name. md 44 px, sm 36 px. */
export interface IconButtonProps {
  icon: IconName;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  /** Shows the label in a tooltip on hover and keyboard focus. */
  tooltip?: boolean;
}

/** A short explanation in a dark ink bubble above its trigger; never the only copy of it. */
export interface TooltipProps {
  content: string;
  /** A text trigger, which the tooltip describes. Leave out for an icon button named by `content`. */
  triggerLabel?: string;
  triggerIcon?: IconName;
  side?: 'top' | 'bottom';
  defaultOpen?: boolean;
}

/** Sections of one record that fold away; one open at a time unless `multiple`. */
export interface AccordionProps {
  items: { value: string; title: string; content: string; badge?: string; disabled?: boolean }[];
  defaultValue?: string[];
  multiple?: boolean;
}

/** One choice of two to five that switches a view at once; the chosen segment white and raised. */
export interface SegmentedControlProps {
  'aria-label': string;
  items: { value: string; label: string; icon?: IconName; count?: number; disabled?: boolean }[];
  defaultValue?: string;
  disabled?: boolean;
}

/** A question that needs an explicit answer: «رجوع» focused first, the action last; no close button. */
export interface AlertDialogProps {
  triggerLabel: string;
  triggerIcon?: IconName;
  title: string;
  description?: string;
  /** The mark before the title: danger (default) or info. */
  tone?: 'danger' | 'info';
  cancelLabel: string;
  actionLabel: string;
  /** danger (default) for a deletion, primary for an ordinary confirmation. */
  actionVariant?: 'danger' | 'primary';
  errorText?: string;
  defaultOpen?: boolean;
}

/** A panel from the logical end (default), the start, or the bottom (tablet, phone). */
export interface DrawerProps {
  triggerLabel: string;
  triggerIcon?: IconName;
  side?: 'start' | 'end' | 'bottom';
  title: string;
  description?: string;
  /** Fields in the body, each an Input. */
  fields?: { label: string; value?: string }[];
  cancelLabel?: string;
  saveLabel?: string;
  defaultOpen?: boolean;
}

/**
 * Toasts at the bottom of the screen, at the logical end; this card shows the ones it is given
 * and stays. In code: one ToastProvider and `useToast().show(...)`.
 */
export interface ToastProps {
  toasts: {
    type?: 'default' | 'success' | 'info' | 'warning' | 'error';
    title: string;
    description?: string;
    actionLabel?: string;
  }[];
  triggerLabel?: string;
}

/** One search over patients and actions in a modal panel; Arabic matching folds alef forms. */
export interface CommandPaletteProps {
  triggerLabel?: string;
  title: string;
  inputLabel: string;
  groups: {
    label: string;
    items: { value: string; label: string; description?: string; icon?: IconName }[];
  }[];
  /** The empty state; {query} is replaced by the typed text. */
  emptyText: string;
  defaultOpen?: boolean;
}

/** Text a person types; `dir: 'auto'` where it may be Latin (phone, email, medicine). */
export interface InputProps extends Partial<FieldProps> {
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  dir?: 'auto' | 'ltr' | 'rtl';
  type?: 'text' | 'email' | 'tel' | 'search' | 'url';
  startIcon?: IconName;
}

/** Longer text; grows with it; `maxLength` shows a «n / max» counter. */
export interface TextareaProps extends Partial<FieldProps> {
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  maxLength?: number;
}

/** A password with a show toggle inside at the logical end (one name, aria-pressed). */
export interface PasswordInputProps extends Partial<FieldProps> {
  defaultValue?: string;
  required?: boolean;
  autoComplete?: 'current-password' | 'new-password';
}

/** A choice sent with a form; the text is `children`. */
export interface CheckboxProps {
  children: string;
  defaultChecked?: boolean | 'indeterminate';
  description?: string;
  error?: string;
  disabled?: boolean;
}

/** One of a few choices, vertical or (short ones) horizontal. */
export interface RadioGroupProps extends FieldProps {
  items: { value: string; label: string; description?: string; disabled?: boolean }[];
  defaultValue?: string | null;
  orientation?: 'vertical' | 'horizontal';
  required?: boolean;
}

/** A setting that acts at once; the text is `children`. */
export interface SwitchProps {
  children: string;
  defaultChecked?: boolean;
  description?: string;
  disabled?: boolean;
}

/** A one-time code: 6 slots (OD-62), left to right in both directions; Western digits. */
export interface OtpInputProps extends Partial<FieldProps> {
  length?: number;
  defaultValue?: string;
}

/** A time, "HH:mm"; 24-hour by default, 12-hour with a ص/م segment (a clinic setting, OD-62). */
export interface TimeInputProps extends FieldProps {
  defaultValue?: string | null;
  hourCycle?: 12 | 24;
  min?: string;
  max?: string;
  required?: boolean;
}

/** A Field around an Input: label, required asterisk, hint and error. */
export interface FieldComponentProps extends FieldProps {
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  dir?: 'auto' | 'ltr' | 'rtl';
}

/** A complete form drawn in one state (in code it checks a Zod schema). */
export interface FormProps {
  title?: string;
  summary?: string;
  fields: (
    | {
        kind: 'input' | 'password' | 'textarea' | 'time' | 'otp';
        label: string;
        defaultValue?: string;
        hint?: string;
        error?: string;
        required?: boolean;
        dir?: 'auto' | 'ltr' | 'rtl';
        hourCycle?: 12 | 24;
        half?: boolean;
      }
    | {
        kind: 'radio';
        label: string;
        items: { value: string; label: string }[];
        defaultValue?: string;
        error?: string;
        required?: boolean;
        orientation?: 'vertical' | 'horizontal';
        half?: boolean;
      }
    | {
        kind: 'checkbox' | 'switch';
        label: string;
        defaultChecked?: boolean;
        error?: string;
        half?: boolean;
      }
  )[];
  submitLabel: string;
  cancelLabel?: string;
  submitting?: boolean;
}

export interface SpinnerProps {
  /** sm 20 and md 24 for rows and controls; lg 40 for a whole panel or page. */
  size?: 'sm' | 'md' | 'lg';
  /** What screen readers hear («جارٍ التحميل» by default); shown under the petals with `showLabel`. */
  label?: string;
  showLabel?: boolean;
  /** Milliseconds before it shows (400 by default; 0 in previews). */
  delay?: number;
}

type Name =
  | 'Button'
  | 'Icon'
  | 'Tabs'
  | 'Dialog'
  | 'Popover'
  | 'Menu'
  | 'Select'
  | 'Combobox'
  | 'NumberInput'
  | 'DatePicker'
  | 'IconButton'
  | 'Input'
  | 'Textarea'
  | 'PasswordInput'
  | 'Checkbox'
  | 'RadioGroup'
  | 'Switch'
  | 'OtpInput'
  | 'TimeInput'
  | 'Field'
  | 'Form'
  | 'Tooltip'
  | 'Accordion'
  | 'SegmentedControl'
  | 'AlertDialog'
  | 'Drawer'
  | 'Toast'
  | 'CommandPalette'
  | 'Spinner'
  | 'Badge'
  | 'CountBadge'
  | 'Skeleton'
  | 'Card'
  | 'EmptyState';

/** Renders a component into an element with the bundle's React; returns the unmount. */
export function mount(element: Element, name: Name, props?: object): () => void;
export declare const Button: (props: ButtonProps) => unknown;
export declare const Icon: (props: IconProps) => unknown;
export declare const Tabs: (props: TabsProps) => unknown;
export declare const Dialog: (props: DialogProps) => unknown;
export declare const Popover: (props: PopoverProps) => unknown;
export declare const Menu: (props: MenuProps) => unknown;
export declare const Select: (props: SelectProps) => unknown;
export declare const Combobox: (props: ComboboxProps) => unknown;
export declare const NumberInput: (props: NumberInputProps) => unknown;
export declare const DatePicker: (props: DatePickerProps) => unknown;
export declare const IconButton: (props: IconButtonProps) => unknown;
export declare const Input: (props: InputProps) => unknown;
export declare const Textarea: (props: TextareaProps) => unknown;
export declare const PasswordInput: (props: PasswordInputProps) => unknown;
export declare const Checkbox: (props: CheckboxProps) => unknown;
export declare const RadioGroup: (props: RadioGroupProps) => unknown;
export declare const Switch: (props: SwitchProps) => unknown;
export declare const OtpInput: (props: OtpInputProps) => unknown;
export declare const TimeInput: (props: TimeInputProps) => unknown;
export declare const Field: (props: FieldComponentProps) => unknown;
export declare const Form: (props: FormProps) => unknown;
export declare const Tooltip: (props: TooltipProps) => unknown;
export declare const Accordion: (props: AccordionProps) => unknown;
export declare const SegmentedControl: (props: SegmentedControlProps) => unknown;
export declare const AlertDialog: (props: AlertDialogProps) => unknown;
export declare const Drawer: (props: DrawerProps) => unknown;
export declare const Toast: (props: ToastProps) => unknown;
export declare const CommandPalette: (props: CommandPaletteProps) => unknown;
