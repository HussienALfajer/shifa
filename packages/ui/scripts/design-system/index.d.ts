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

/** Renders a component into an element with the bundle's React; returns the unmount. */
export function mount(element: Element, name: 'Button' | 'Icon', props?: object): () => void;
export declare const Button: (props: ButtonProps) => unknown;
export declare const Icon: (props: IconProps) => unknown;
