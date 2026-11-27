// Data table (slice 0.4-07), as the owner approved the sheet on 2026-11-22 ("Shifa Components
// (proposals)", page "Data display and table · 0.4-07", OD-64). TanStack Table v9 keeps sorting,
// selection and column visibility (use-table-state.ts); TanStack Virtual draws only the rows in
// view; the grid keyboard model is ours (use-grid-keyboard.ts). Comfortable rows of 48 px by
// default, 32 px compact; a sticky header and the first column pinned on the logical start, each
// with a border and a soft shadow once content scrolls under it; selected rows in the selection
// tint. Columns and rows in, no data fetching: server sorting is `manualSorting` with
// `onSortChange`. The columns menu sits under the table, after the grid in the Tab order.
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, type EmptyStateProps } from '../empty-state/empty-state.tsx';
import { cn } from '../lib/cn.ts';
import { NUMBER_LOCALE } from '../number-input/number-input.tsx';
import { useDirection } from '../providers/direction-provider.tsx';
import {
  type ColumnMeta,
  type DataTableColumn,
  type DataTableSort,
  minimumWidth,
  track,
} from './columns.ts';
import { ColumnsMenu, SkeletonCells, TableBar } from './parts.tsx';
import { BodyRow, HeaderRow } from './rows.tsx';
import { type Cell, controlIn, useGridKeyboard } from './use-grid-keyboard.ts';
import { useTableState } from './use-table-state.ts';

export type {
  DataTableCellValue,
  DataTableColumn,
  DataTableColumnKind,
  DataTableColumnWidth,
  DataTableSort,
  DataTableSortDirection,
} from './columns.ts';

export interface DataTableProps<Row extends object> {
  /** What the table lists: «قائمة المرضى». */
  'aria-label': string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string;
  /** The sort, controlled; or `defaultSort`. */
  sort?: DataTableSort | null;
  defaultSort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
  /** The rows come sorted from the server: the table does not reorder them. */
  manualSorting?: boolean;
  /** A selection column with select-all on the shown rows. */
  selectable?: boolean;
  selected?: readonly string[];
  defaultSelected?: readonly string[];
  onSelectedChange?: (ids: string[]) => void;
  hiddenColumns?: readonly string[];
  defaultHiddenColumns?: readonly string[];
  onHiddenColumnsChange?: (ids: string[]) => void;
  /** Enter on a row, or a press on it, opens the record. */
  onRowAction?: (row: Row) => void;
  loading?: boolean;
  /** Skeleton rows while loading. */
  loadingRows?: number;
  /** The empty state when there is no row. */
  empty?: EmptyStateProps;
  /** Rows on the server, when `rows` is one page of them (aria-rowcount). */
  totalRows?: number;
  /** Tools in a bar above the table. */
  toolbar?: ReactNode;
  /** Under the table, before the columns menu: its Pagination. */
  footer?: ReactNode;
  columnsMenuLabel?: string;
  className?: string;
}

export function DataTable<Row extends object>(props: DataTableProps<Row>) {
  const { rows, selectable = false, onRowAction, loading = false } = props;
  const dir = useDirection();
  const number = useMemo(() => new Intl.NumberFormat(NUMBER_LOCALE[dir]), [dir]);
  const table = useTableState({
    columns: props.columns,
    rows,
    getRowId: props.getRowId,
    selectable,
    manualSorting: props.manualSorting === true,
    sort: props.sort,
    defaultSort: props.defaultSort,
    onSortChange: props.onSortChange,
    selected: props.selected,
    defaultSelected: props.defaultSelected,
    onSelectedChange: props.onSelectedChange,
    hiddenColumns: props.hiddenColumns,
    defaultHiddenColumns: props.defaultHiddenColumns,
    onHiddenColumnsChange: props.onHiddenColumnsChange,
  });

  const shown = table.getRowModel().rows;
  const leaves = table.getVisibleLeafColumns();
  const colCount = leaves.length + (selectable ? 1 : 0);
  // A wrapping column makes rows of their own height (the virtualiser measures each drawn row)
  // and takes the width the other columns leave.
  const wraps = leaves.some((c) => (c.columnDef.meta as ColumnMeta).wrap);
  const columnsStyle = {
    gridTemplateColumns: [
      ...(selectable ? ['var(--shifa-space-12)'] : []),
      ...leaves.map((c) => {
        const meta = c.columnDef.meta as ColumnMeta;
        return track(meta.width, meta.wrap);
      }),
    ].join(' '),
  };

  const scroll = useRef<HTMLDivElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  const rowHeight = useCallback(() => {
    const el = scroll.current;
    const value = el
      ? Number.parseFloat(getComputedStyle(el).getPropertyValue('--shifa-table-row-height'))
      : 0;
    return value > 0 ? value : 48;
  }, []);

  const activeRow = useRef(-1);
  const virtual = useVirtualizer({
    count: loading ? 0 : shown.length,
    getScrollElement: () => scroll.current,
    estimateSize: rowHeight,
    overscan: 8,
    getItemKey: (index) => shown[index]?.id ?? index,
    scrollMargin: body.current?.offsetTop ?? 0,
    // Rows scrolled to from the keyboard stop below the sticky header, never under it (review B3).
    scrollPaddingStart: body.current?.offsetTop ?? 0,
    // The active row stays drawn, so keyboard focus survives scrolling it out of view and back.
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);
      const keep = activeRow.current;
      if (keep < 0 || keep >= range.count || indexes.includes(keep)) return indexes;
      return [...indexes, keep].sort((a, b) => a - b);
    },
  });

  const keyboard = useGridKeyboard({
    grid,
    rowCount: loading ? 0 : shown.length,
    colCount,
    pageSize: () => {
      const box = scroll.current;
      if (!wraps || box === null) {
        return Math.max(1, Math.floor((box?.clientHeight ?? 0) / rowHeight()) - 1);
      }
      // Rows of their own height: count the measured rows that fit in the scroll box.
      // Item offsets count from the scroll box's top (the header's height included).
      const top = box.scrollTop + (body.current?.offsetTop ?? 0);
      const bottom = box.scrollTop + box.clientHeight;
      const inView = virtual
        .getVirtualItems()
        .filter((item) => item.start >= top && item.end <= bottom);
      return Math.max(1, inView.length - 1);
    },
    scrollToRow: (index) => {
      virtual.scrollToIndex(index, { align: 'auto' });
    },
    onSpace: (cell: Cell) => {
      if (!selectable) return;
      if (cell.row === 0) {
        table.toggleAllRowsSelected(!(shown.length > 0 && shown.every((r) => r.getIsSelected())));
      } else shown[cell.row - 1]?.toggleSelected();
    },
    onEnter: (cell: Cell, element: HTMLElement) => {
      if (cell.row === 0) {
        element.querySelector<HTMLElement>('button, [role="checkbox"]')?.click();
        return;
      }
      const control = controlIn(element);
      if (control !== null) {
        control.focus();
        return;
      }
      const row = shown[cell.row - 1];
      if (row !== undefined) onRowAction?.(row.original);
    },
  });
  activeRow.current = keyboard.active.row - 1;

  // When the wrapping column is hidden or shown again, the rows' measured heights no longer hold:
  // measure afresh (a row no longer observed would keep its old height and leave a gap).
  useLayoutEffect(() => {
    virtual.measure();
  }, [wraps, virtual]);

  // Controls inside cells are reached with Enter, never with Tab: keep them out of the Tab order.
  useLayoutEffect(() => {
    for (const el of grid.current?.querySelectorAll<HTMLElement>(
      '[data-cell] a[href], [data-cell] button, [data-cell] input, [data-cell] select, [data-cell] textarea, [data-cell] [tabindex]:not([data-cell])',
    ) ?? []) {
      el.tabIndex = -1;
    }
  });

  // The pinned column and the sticky header get their shadow once content scrolls under them.
  const [scrolled, setScrolled] = useState({ x: false, y: false });
  const onScroll = () => {
    const el = scroll.current;
    if (el === null) return;
    const next = { x: Math.abs(el.scrollLeft) > 0, y: el.scrollTop > 0 };
    setScrolled((prev) => (prev.x === next.x && prev.y === next.y ? prev : next));
  };

  const tab = (cell: Cell): 0 | -1 =>
    keyboard.active.row === cell.row && keyboard.active.col === cell.col ? 0 : -1;
  const hideable = table
    .getAllLeafColumns()
    .filter((c) => c.getCanHide())
    .map((c) => ({
      id: c.id,
      header: (c.columnDef.meta as ColumnMeta).header,
      visible: c.getIsVisible(),
    }));
  const selectLabel = (index: number) => {
    const first = leaves[0];
    const value = first ? shown[index]?.getValue(first.id) : undefined;
    return `تحديد ${typeof value === 'string' || typeof value === 'number' ? String(value) : String(index + 1)}`;
  };
  const common = { selectable, tab, columnsStyle };

  return (
    <div
      data-slot="data-table"
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-surface border border-border-default bg-bg-surface font-ui text-text-default',
        props.className,
      )}
    >
      {props.toolbar !== undefined && <TableBar>{props.toolbar}</TableBar>}
      <div
        ref={scroll}
        data-slot="data-table-scroll"
        data-scrolled-x={scrolled.x}
        data-scrolled-y={scrolled.y}
        onScroll={onScroll}
        className="relative max-h-(--shifa-size-table) overflow-auto"
      >
        <div
          ref={grid}
          role="grid"
          aria-label={props['aria-label']}
          aria-rowcount={(props.totalRows ?? shown.length) + 1}
          aria-colcount={colCount}
          aria-busy={loading || undefined}
          onKeyDown={keyboard.onKeyDown}
          onFocus={keyboard.onFocus}
          // A wrapping table is as wide as its box, never narrower than its columns' minimums: the
          // wrapped text never widens it.
          {...(wraps
            ? {
                style: {
                  minWidth: minimumWidth(
                    leaves.map((c) => {
                      const meta = c.columnDef.meta as ColumnMeta;
                      return meta.wrap ? 'md' : meta.width;
                    }),
                    selectable,
                  ),
                },
              }
            : {})}
          className={cn(
            wraps ? 'w-full' : 'w-max min-w-full',
            'text-data leading-tight in-data-[density=compact]:text-200',
          )}
        >
          <HeaderRow table={table} {...common} />
          <div
            ref={body}
            role="presentation"
            className="relative"
            style={{ height: loading || shown.length === 0 ? undefined : virtual.getTotalSize() }}
          >
            {loading &&
              Array.from({ length: props.loadingRows ?? 5 }, (_, i) => (
                // Placeholder rows never reorder.
                <div key={i} role="row" aria-hidden="true" style={columnsStyle} className="grid">
                  <SkeletonCells cols={colCount} seed={i} />
                </div>
              ))}
            {!loading && shown.length === 0 && props.empty !== undefined && (
              <div role="row" style={columnsStyle} className="grid">
                <div role="gridcell" aria-colspan={colCount} className="col-span-full">
                  <EmptyState {...props.empty} />
                </div>
              </div>
            )}
            {!loading &&
              virtual.getVirtualItems().map((item) => {
                const row = shown[item.index];
                if (row === undefined) return null;
                return (
                  <BodyRow
                    key={row.id}
                    row={row}
                    index={item.index}
                    offset={item.start - virtual.options.scrollMargin}
                    format={(n) => number.format(n)}
                    selectLabel={selectLabel(item.index)}
                    onRowAction={onRowAction}
                    {...(wraps ? { measure: virtual.measureElement } : {})}
                    {...common}
                  />
                );
              })}
          </div>
        </div>
      </div>
      {(props.footer !== undefined || hideable.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border-default px-3 py-2">
          <div className="min-w-0 flex-1">{props.footer}</div>
          {hideable.length > 0 && (
            <ColumnsMenu
              label={props.columnsMenuLabel ?? 'الأعمدة'}
              columns={hideable}
              onToggle={(id, on) => {
                table.getColumn(id)?.toggleVisibility(on);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
