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
  | 'DatePicker';

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
