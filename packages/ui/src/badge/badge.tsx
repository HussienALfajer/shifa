// Badge and count badge (slice 0.4-07), as the owner approved the sheet on 2026-11-22 ("Shifa
// Components (proposals)", page "Data display and table · 0.4-07", OD-64). A small mark that is
// never pressed. Neutral, brand and outline follow the clinic's theme; status and visit-queue
// badges use the locked colours and always carry an icon besides their word (principle 7).
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

type ThemedTone = 'neutral' | 'brand' | 'outline';
type StatusTone = 'success' | 'warning' | 'danger' | 'info';
type QueueTone =
  | 'queue-booked'
  | 'queue-confirmed'
  | 'queue-arrived'
  | 'queue-waiting'
  | 'queue-in-room'
  | 'queue-done'
  | 'queue-no-show'
  | 'queue-cancelled';

export type BadgeTone = ThemedTone | StatusTone | QueueTone;
export type BadgeSize = 'sm' | 'md';

const TONE: Record<BadgeTone, string> = {
  neutral: 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg',
  brand: 'border-transparent bg-selection-default text-text-default',
  outline: 'border-border-strong bg-transparent text-text-default',
  success: 'border-status-success-border bg-status-success-bg text-status-success-fg',
  warning: 'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
  danger: 'border-status-danger-border bg-status-danger-bg text-status-danger-fg',
  info: 'border-status-info-border bg-status-info-bg text-status-info-fg',
  'queue-booked': 'border-transparent bg-queue-booked-bg text-queue-booked-fg',
  'queue-confirmed': 'border-transparent bg-queue-confirmed-bg text-queue-confirmed-fg',
  'queue-arrived': 'border-transparent bg-queue-arrived-bg text-queue-arrived-fg',
  'queue-waiting': 'border-transparent bg-queue-waiting-bg text-queue-waiting-fg',
  'queue-in-room': 'border-transparent bg-queue-in-room-bg text-queue-in-room-fg',
  'queue-done': 'border-transparent bg-queue-done-bg text-queue-done-fg',
  'queue-no-show': 'border-transparent bg-queue-no-show-bg text-queue-no-show-fg',
  'queue-cancelled': 'border-transparent bg-queue-cancelled-bg text-queue-cancelled-fg',
};

/** The icon a locked tone always carries; a queue state is a filled dot, an exit an open ring. */
const STATUS_ICON: Partial<Record<BadgeTone, IconName | 'dot' | 'ring'>> = {
  success: 'check-circle',
  warning: 'warning',
  danger: 'x-circle',
  info: 'info',
  'queue-booked': 'dot',
  'queue-confirmed': 'dot',
  'queue-arrived': 'dot',
  'queue-waiting': 'dot',
  'queue-in-room': 'dot',
  'queue-done': 'check-circle',
  'queue-no-show': 'ring',
  'queue-cancelled': 'ring',
};

const SIZE: Record<BadgeSize, string> = {
  sm: 'h-6 gap-1 px-2 text-caption',
  md: 'h-7 gap-2 px-3 text-data',
};

function Mark({ kind }: { kind: 'dot' | 'ring' }) {
  return (
    <svg viewBox="0 0 8 8" aria-hidden="true" focusable="false" className="size-2 shrink-0">
      {kind === 'dot' ? (
        <circle cx="4" cy="4" r="4" fill="currentColor" />
      ) : (
        <circle cx="4" cy="4" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      )}
    </svg>
  );
}

export interface BadgeProps {
  /** neutral (default), brand and outline follow the clinic's theme; the status and queue tones are locked colours with their icon. */
  tone?: BadgeTone;
  /** sm 24 px (default), md 28 px. */
  size?: BadgeSize;
  /** An icon before the word on a themed tone; `false` for none. Status and queue tones always keep their own icon. */
  icon?: IconName | false;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', size = 'sm', icon, children, className }: BadgeProps) {
  const locked = STATUS_ICON[tone];
  const mark = locked ?? (icon === false ? undefined : icon);
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex max-w-full shrink-0 items-center rounded-pill border font-ui leading-none font-medium whitespace-nowrap',
        SIZE[size],
        TONE[tone],
        className,
      )}
    >
      {mark === 'dot' || mark === 'ring' ? (
        <Mark kind={mark} />
      ) : mark === undefined ? null : (
        <Icon name={mark} className={size === 'sm' ? 'size-3' : 'size-4'} />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}

export type CountBadgeTone = 'neutral' | 'brand' | 'danger';

const COUNT_TONE: Record<CountBadgeTone, string> = {
  neutral: 'bg-status-neutral-bg text-status-neutral-fg',
  brand: 'bg-brand-primary text-brand-on-primary',
  danger: 'bg-status-danger-solid text-status-danger-on-solid',
};

export type CountBadgeProps = {
  /** What screen readers hear instead of the bare number: «12 رسالة غير مقروءة». */
  label: string;
  tone?: CountBadgeTone;
  className?: string;
} & (
  | {
      /** The count; nothing is shown at 0. */
      count: number;
      /** The largest count shown; above it «99+». */
      max?: number;
      dot?: false;
    }
  | { dot: true; count?: undefined; max?: undefined }
);

/** A number on a tab or menu item (tabular Western digits, capped), or a dot without a number. */
export function CountBadge(props: CountBadgeProps) {
  const { label, tone = 'neutral', className } = props;
  if (props.dot === true) {
    return (
      <span
        data-slot="count-badge"
        role="img"
        aria-label={label}
        className={cn(
          'inline-block size-2 shrink-0 rounded-full',
          COUNT_TONE[tone === 'neutral' ? 'danger' : tone],
          className,
        )}
      />
    );
  }
  const { count, max = 99 } = props;
  if (count <= 0) return null;
  const shown = count > max ? `${String(max)}+` : String(count);
  return (
    <span
      data-slot="count-badge"
      className={cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-pill px-1',
        'font-ui text-caption leading-none font-semibold tabular-nums',
        COUNT_TONE[tone],
        className,
      )}
    >
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
