// Skeleton (slice 0.4-07), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Data display and table · 0.4-07"): blocks, text lines and a circle on the
// raised surface, for content whose shape is known (waits without a shape use Spinner). Hidden from
// assistive technology; SkeletonGroup carries the busy state and its name. A soft pulse that stops
// under reduced motion.
import type { ReactNode } from 'react';
import { cn } from '../lib/cn.ts';

export type SkeletonShape = 'block' | 'line' | 'circle';

const SHAPE: Record<SkeletonShape, string> = {
  block: 'rounded-mark',
  line: 'h-3 rounded-full',
  circle: 'rounded-full',
};

const PIECE = 'block shrink-0 bg-bg-surface-raised animate-skeleton motion-reduce:animate-none';

export interface SkeletonProps {
  /** block (default, size it with `className`), line (12 px tall), circle (size it with `className`). */
  shape?: SkeletonShape;
  /** Size utilities from the token scale: `h-20 w-full`, `size-10`. */
  className?: string;
}

/** One placeholder piece. */
export function Skeleton({ shape = 'block', className }: SkeletonProps) {
  return (
    <span data-slot="skeleton" aria-hidden="true" className={cn(PIECE, SHAPE[shape], className)} />
  );
}

export interface SkeletonTextProps {
  /** How many lines; the last one is shorter, like real text. */
  lines?: number;
  className?: string;
}

/** Lines of text, starting at the logical start. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span aria-hidden="true" className={cn('flex w-full flex-col items-start gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <span
          // The lines never reorder: the index is their identity.
          key={i}
          data-slot="skeleton"
          className={cn(PIECE, SHAPE.line, i === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </span>
  );
}

export interface SkeletonGroupProps {
  /** What screen readers hear while the content loads: «جارٍ تحميل بطاقة المريض». */
  label: string;
  children: ReactNode;
  className?: string;
}

/** The container of a loading region: busy, named, and the only part screen readers see. */
export function SkeletonGroup({ label, children, className }: SkeletonGroupProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn('flex flex-col gap-3', className)}
    >
      {children}
    </div>
  );
}
