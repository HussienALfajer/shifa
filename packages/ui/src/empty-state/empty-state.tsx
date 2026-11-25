// Empty state (slice 0.4-07), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Data display and table · 0.4-07", OD-64): says what is happening and the next
// step. A line drawing in the brand colour with the gold dot (the jasmine or the eight-point star,
// in empty states only) or an icon (search, errors), a title, a description and up to two actions;
// panel and page sizes. The text is the caller's (or an i18n key's), never built here.
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';

export type EmptyStateArt = 'jasmine' | 'star';
export type EmptyStateSize = 'panel' | 'page';

function Jasmine() {
  return (
    <>
      {[
        [22, 22, -45],
        [42, 22, 45],
        [42, 42, -45],
        [22, 42, 45],
      ].map(([cx, cy, r]) => (
        <ellipse
          key={`${String(cx)}-${String(cy)}`}
          cx={cx}
          cy={cy}
          rx="7"
          ry="13"
          transform={`rotate(${String(r)} ${String(cx)} ${String(cy)})`}
        />
      ))}
    </>
  );
}

function Star() {
  return (
    <path d="M32 6 39 18 52 12 46 25 58 32 46 39 52 52 39 46 32 58 25 46 12 52 18 39 6 32 18 25 12 12 25 18Z" />
  );
}

function Drawing({ art, size }: { art: EmptyStateArt; size: EmptyStateSize }) {
  return (
    <svg
      data-slot="empty-art"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={size === 'page' ? 1.5 : 2}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn(
        'shrink-0 text-brand-primary',
        size === 'page'
          ? 'size-(--shifa-size-illustration-lg)'
          : 'size-(--shifa-size-illustration-md)',
      )}
    >
      {art === 'jasmine' ? <Jasmine /> : <Star />}
      <circle
        cx="32"
        cy="32"
        r={art === 'jasmine' ? 4 : 5}
        className="fill-brand-accent"
        stroke="none"
      />
    </svg>
  );
}

export interface EmptyStateProps {
  /** The title: what is empty or what went wrong («لا مواعيد اليوم»). */
  title: ReactNode;
  /** The next step or the reason. */
  description?: ReactNode;
  /** A line drawing for an empty list or page. */
  art?: EmptyStateArt;
  /** An icon instead of a drawing: search without results, a load that failed. */
  icon?: IconName;
  /** Up to two buttons, the main one first. */
  actions?: ReactNode;
  /** panel (default) inside a card or table; page for a whole empty screen. */
  size?: EmptyStateSize;
  /** The title's heading level (3 by default); 1 when it is a whole page's title. */
  headingLevel?: 1 | 2 | 3 | 4;
  className?: string;
}

export function EmptyState({
  title,
  description,
  art,
  icon,
  actions,
  size = 'panel',
  headingLevel = 3,
  className,
}: EmptyStateProps) {
  const Heading = `h${String(headingLevel)}` as 'h3';
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center text-center font-ui text-text-default',
        size === 'page' ? 'gap-4 px-6 py-16' : 'gap-3 px-6 py-8',
        className,
      )}
    >
      {art !== undefined ? (
        <Drawing art={art} size={size} />
      ) : (
        icon !== undefined && <Icon name={icon} className="size-10 text-icon-muted" />
      )}
      <Heading
        className={cn(
          'm-0 leading-heading font-semibold',
          size === 'page' ? 'text-heading-md' : 'text-heading-sm',
        )}
      >
        {title}
      </Heading>
      {description !== undefined && (
        <p className="m-0 max-w-(--shifa-size-toast) text-data leading-body text-text-muted">
          {description}
        </p>
      )}
      {actions !== undefined && (
        <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>
      )}
    </div>
  );
}
