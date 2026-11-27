// The data-display components of the Shifa Design System (slice 0.4-07), and Menu since its
// groups (A-01-08) outgrew index.d.ts, as documentation;
// bundle.ts appends this file to index.d.ts. The source of truth is packages/ui/src.
import type { IconName } from './index.d.ts';

/** Queue states of a visit (locked colours). */
type QueueState = 'booked' | 'confirmed' | 'arrived' | 'waiting' | 'in-room' | 'done';
type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'outline'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | `queue-${QueueState | 'no-show' | 'cancelled'}`;

export interface BadgeProps {
  /** neutral (default), brand, outline follow the clinic's theme; success, warning, danger, info and the queue-* tones are locked colours with their icon. */
  tone?: BadgeTone;
  /** sm 24 px (default), md 28 px. */
  size?: 'sm' | 'md';
  /** An icon before the word on a themed tone. */
  icon?: IconName;
  children: string;
}

export interface CountBadgeProps {
  /** What screen readers hear: «12 رسالة غير مقروءة». */
  label: string;
  /** The count; nothing at 0, «99+» above `max`. */
  count?: number;
  max?: number;
  /** A dot without a number. */
  dot?: boolean;
  tone?: 'neutral' | 'brand' | 'danger';
}

export interface SkeletonProps {
  /** What screen readers hear while it loads. */
  label: string;
  /** A circle before two short lines, as a person's row. */
  avatar?: boolean;
  /** Lines of text (3 by default; the last one shorter). */
  lines?: number;
  /** A block for a picture or a chart. */
  block?: boolean;
}

export interface ActionData {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export interface CardProps {
  /** Leave out for a body-only card (a figure). */
  title?: string;
  description?: string;
  /** Makes it a link card: a press anywhere on it follows the title's link. */
  href?: string;
  /** Small buttons at the logical end of the header. */
  actions?: ActionData[];
  body?: string[];
  /** Footer buttons, the main one first. */
  footer?: ActionData[];
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** A line drawing for an empty list or page. */
  art?: 'jasmine' | 'star';
  /** An icon instead: search without results, a load that failed. */
  icon?: IconName;
  /** panel (default) or page. */
  size?: 'panel' | 'page';
  /** Up to two buttons, the main one first. */
  actions?: ActionData[];
}

export interface CalloutProps {
  /** info (default), success, warning, danger: locked status colours with their icon. */
  tone?: 'info' | 'success' | 'warning' | 'danger';
  /** A one-line title in weight 500. */
  title?: string;
  /** The message: one or two sentences. */
  text: string;
  /** Replaces the tone's icon (clock for a lock, wifi-slash for the network). */
  icon?: IconName;
  /** The label of at most one button at the end of the line. */
  action?: string;
}

export interface AvatarProps {
  /** One person: the name gives the initials, the colour and the accessible name. */
  name?: string;
  /** The picture; the initials stand while it loads or when it fails. */
  src?: string;
  /** xs 24, sm 32, md 40 (default), lg 56, xl 80 px. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** A group instead: overlapping avatars and «و3 آخرون». */
  people?: { name: string; src?: string }[];
  max?: number;
  /** What the group is: «الأطباء المناوبون». */
  label?: string;
}

export interface ToolbarProps {
  'aria-label': string;
  /** Groups of buttons split by separators; what does not fit goes into «المزيد». */
  groups: { label: string; icon?: IconName; pressed?: boolean; disabled?: boolean }[][];
}

export interface PaginationProps {
  totalItems: number;
  defaultPage?: number;
  /** 25 by default. */
  pageSize?: number;
  /** The page-size choices: 25, 50, 100. */
  pageSizes?: number[];
  /** auto (default: compact below 430 px of its own width), numbers, or compact («الصفحة 3 من 13»). */
  form?: 'auto' | 'numbers' | 'compact';
  /** Hides the «عرض 51–75 من 312» line. */
  hideSummary?: boolean;
  /** The navigation's name. */
  label?: string;
}

export interface DataTableProps {
  'aria-label': string;
  /** Columns: `id`, `header`, `kind` (text, number, latin), `sortable`, `hideable`, `wrap`. */
  columns: {
    id: string;
    header: string;
    kind?: 'text' | 'number' | 'latin';
    sortable?: boolean;
    hideable?: boolean;
    /** Free text (a reason, a note) shown whole on several lines; the row grows to fit. */
    wrap?: boolean;
  }[];
  /** Rows as cell values by column id. */
  rows: Record<string, string | number>[];
  selectable?: boolean;
  /** The ids (row positions from 0, as text) shown selected. */
  defaultSelected?: string[];
  /** The column sorted at first. */
  defaultSort?: { columnId: string; direction: 'ascending' | 'descending' };
  /** Columns hidden at first (the «الأعمدة» menu shows them again). */
  defaultHiddenColumns?: string[];
  loading?: boolean;
  /** Skeleton rows while loading. */
  loadingRows?: number;
  /** The empty state when there is no row: no match, or an error with its way out. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: IconName;
  emptyArt?: 'jasmine' | 'star';
  emptyActions?: { label: string; variant?: 'primary' | 'secondary' }[];
  /** Rows the server has in all. */
  totalRows?: number;
}

/** A value shown once to copy or send (slice A-01-10): a setup link. */
export interface CopyFieldProps {
  /** The value to copy; absent: loading. */
  value?: string;
  /** The visible label and the box's name («رابط الإعداد»). */
  label: string;
  copyLabel?: string;
  copiedLabel?: string;
  /** Shown when the clipboard refused; the value is selected to copy by hand. */
  refusedText?: string;
  /** «إرسال عبر واتساب» to the server's address; hidden when disabled. */
  share?: { href: string; label: string };
  /** The line under the box: the expiry, or why it no longer works. */
  expiry?: string;
  /** Wraps a long value over several lines (a phone). */
  multiline?: boolean;
  /** The copy button shows its icon only (still named). */
  iconOnly?: boolean;
  /** A replaced link: muted, nothing to copy or share. */
  disabled?: boolean;
}

export declare const CopyField: (props: CopyFieldProps) => unknown;
export declare const Spinner: (props: SpinnerProps) => unknown;
export declare const Badge: (props: BadgeProps) => unknown;
export declare const CountBadge: (props: CountBadgeProps) => unknown;
export declare const Skeleton: (props: SkeletonProps) => unknown;
export declare const Card: (props: CardProps) => unknown;
export declare const EmptyState: (props: EmptyStateProps) => unknown;
export declare const Callout: (props: CalloutProps) => unknown;
export declare const Avatar: (props: AvatarProps) => unknown;
export declare const Toolbar: (props: ToolbarProps) => unknown;
export declare const Pagination: (props: PaginationProps) => unknown;
export declare const DataTable: (props: DataTableProps) => unknown;

/** Daily counts of the last 30 days (A-02): bars, quarter axis, the average line, today in gold. */
export interface UsageChartProps {
  /** The chart's name: «آخر 30 يومًا». */
  'aria-label': string;
  /** Oldest first, the last is today: `{ date: '2026-11-26', count: 14 }`. None: the empty state. */
  days: { date: string; count: number }[];
  /** The figure's words in the tooltip, `{n}` for the count: «{n} تسجيل دخول». */
  unit?: string;
  /** The last day is today, drawn in gold (default true). */
  lastIsToday?: boolean;
  loading?: boolean;
}

export declare const UsageChart: (props: UsageChartProps) => unknown;

/** Several choices by search (A-02): chips with a named remove, the list open after each pick. */
export interface MultiComboboxProps {
  label: string;
  hint?: string;
  /** Marks the field invalid; read with it. */
  error?: string;
  disabled?: boolean;
  items: { value: string; label: string; disabled?: boolean }[];
  /** The chosen values at mount. */
  defaultValue?: string[];
  emptyMessage: string;
  placeholder?: string;
  /** The list open at mount, to show it at rest. */
  defaultOpen?: boolean;
  /** The text in the field at mount, as if typed. */
  defaultInputValue?: string;
}

export declare const MultiCombobox: (props: MultiComboboxProps) => unknown;

/** A button that opens a list of actions, or a choice among groups (A-01-08). */
export interface MenuProps {
  triggerLabel?: string;
  triggerIcon?: IconName;
  'aria-label'?: string;
  /** `sheet`: the rows rising from the bottom, as on a phone, under `title`. */
  presentation?: 'popover' | 'sheet';
  title?: string;
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
    | {
        /** A radio group: the label, the current value, its rows. */
        group: string;
        value: string | null;
        radios: {
          value: string;
          label: string;
          avatar?: string;
          icon?: IconName;
          description?: string;
          badge?: string;
          disabled?: boolean;
          busy?: boolean;
        }[];
      }
    | { group: string; notes: { label: string; icon?: IconName; description?: string }[] }
  )[];
  triggerVariant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  triggerSize?: 'sm' | 'md';
  triggerDisabled?: boolean;
  /** Opens the menu when it mounts, to show its rows. */
  defaultOpen?: boolean;
}

export declare const Menu: (props: MenuProps) => unknown;
