// The classes Menu's rows share (slice 0.4-04, and the groups of slice A-01-08): 48 px rows (32
// compact), the row under the keyboard or pointer in the light selection tint, brick for danger,
// the disabled colour for a disabled row.
import { cn } from '../lib/cn.ts';

export const ITEM = cn(
  'flex min-h-(--shifa-size-row) cursor-pointer select-none items-center gap-2 rounded-input px-3 outline-none',
  'text-body leading-heading text-text-default in-data-[density=compact]:text-250',
  'data-highlighted:bg-selection-subtle data-open:bg-selection-default',
  'data-destructive:text-status-danger-fg',
  'data-disabled:cursor-not-allowed data-disabled:text-text-disabled',
);

/** A group's label: small, muted, above its rows. */
export const GROUP_LABEL = 'm-0 px-3 pt-2 pb-1 text-200 leading-body font-medium text-text-muted';
