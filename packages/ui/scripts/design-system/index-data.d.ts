// The data-display components of the Shifa Design System (slice 0.4-07), as documentation;
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
  title: string;
  description?: string;
  /** Makes it a link card: a press anywhere on it follows the title's link. */
  href?: string;
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
  /** numbers (default) or compact («الصفحة 3 من 13»). */
  form?: 'numbers' | 'compact';
}

export interface DataTableProps {
  'aria-label': string;
  /** Columns: `id`, `header`, `kind` (text, number, latin), `sortable`. */
  columns: { id: string; header: string; kind?: 'text' | 'number' | 'latin'; sortable?: boolean }[];
  /** Rows as cell values by column id. */
  rows: Record<string, string | number>[];
  selectable?: boolean;
  /** The ids (row positions from 0, as text) shown selected. */
  defaultSelected?: string[];
  /** The column sorted at first. */
  defaultSort?: { columnId: string; direction: 'ascending' | 'descending' };
  loading?: boolean;
  /** The empty state's title when there is no row. */
  emptyTitle?: string;
}

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
