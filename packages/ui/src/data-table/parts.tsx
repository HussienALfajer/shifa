// The parts of the data table (slice 0.4-07): the selection mark, the header cell with its sort
// button, the columns menu and the skeleton rows. Looks from the approved sheet: a raised header
// in muted text (the sorted one heavier, in the text colour, with its arrow), the selection
// checkbox of 0.4-05, the pinned column on the logical start with a border and a soft shadow once
// content scrolls under it.
import type { ReactNode } from 'react';
import { Checkbox } from '../checkbox/checkbox.tsx';
import { Icon } from '../icons/icon.tsx';
import { cn } from '../lib/cn.ts';
import { Popover, PopoverContent, PopoverTrigger } from '../popover/popover.tsx';
import { Skeleton } from '../skeleton/skeleton.tsx';
import type { DataTableSortDirection } from './columns.ts';

/** Every cell: the grid track box, one line, the focus ring inside the cell. */
export const CELL = cn(
  'flex min-w-0 items-center gap-2 overflow-hidden px-3 whitespace-nowrap',
  'border-b border-border-default bg-bg-surface outline-none',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus',
);

/** A pinned cell: sticky at the logical start; a border and a shadow when the table scrolled sideways. */
export const PINNED = cn(
  'sticky z-1',
  'in-data-[scrolled-x=true]:border-e in-data-[scrolled-x=true]:shadow-card',
);

export function SelectMark({
  checked,
  label,
  onToggle,
}: {
  checked: boolean | 'mixed';
  label: string;
  onToggle: () => void;
}) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      tabIndex={-1}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => {
        if (event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }
      }}
      className={cn(
        'inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-mark border-2',
        checked === false
          ? 'border-border-strong bg-bg-surface'
          : 'border-brand-primary bg-brand-primary text-brand-on-primary',
      )}
    >
      {checked === true && <Icon name="check" className="size-3" />}
      {checked === 'mixed' && <Icon name="minus" className="size-3" />}
    </span>
  );
}

export function SortButton({
  label,
  direction,
  onSort,
}: {
  label: string;
  direction: DataTableSortDirection | null;
  onSort: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={(event) => {
        event.stopPropagation();
        onSort();
      }}
      className="inline-flex h-full min-w-0 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-ui text-200 font-medium text-current"
    >
      <span className="truncate">{label}</span>
      {direction !== null && (
        <Icon name={direction === 'ascending' ? 'caret-up' : 'caret-down'} className="size-4" />
      )}
    </button>
  );
}

export function ColumnsMenu({
  label,
  columns,
  onToggle,
}: {
  label: string;
  columns: { id: string; header: string; visible: boolean }[];
  onToggle: (id: string, visible: boolean) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger variant="ghost" startIcon="list">
        {label}
      </PopoverTrigger>
      <PopoverContent title={label}>
        <div className="flex flex-col">
          {columns.map((column) => (
            <Checkbox
              key={column.id}
              checked={column.visible}
              onCheckedChange={(checked) => {
                onToggle(column.id, checked);
              }}
            >
              {column.header}
            </Checkbox>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The bar above the table: the caller's tools, then the columns menu at the logical end. */
export function TableBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-border-default px-3 py-2">
      {children}
    </div>
  );
}

const WIDTHS = ['w-1/2', 'w-2/5', 'w-3/5', 'w-1/3', 'w-1/2'] as const;

/** Skeleton cells for one loading row. */
export function SkeletonCells({ cols, seed }: { cols: number; seed: number }) {
  return (
    <>
      {Array.from({ length: cols }, (_, col) => (
        // The placeholder cells never reorder.
        <div
          key={col}
          role="gridcell"
          aria-hidden="true"
          className={cn(CELL, 'h-(--shifa-table-row-height)')}
        >
          <Skeleton shape="line" className={WIDTHS[(seed + col) % WIDTHS.length] ?? 'w-1/2'} />
        </div>
      ))}
    </>
  );
}
