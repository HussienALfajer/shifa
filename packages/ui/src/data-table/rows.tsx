// The header row and the body rows of the data table (slice 0.4-07). Every cell is a grid cell of
// the keyboard model (data-cell, data-row, data-col; tabindex 0 only on the active one). The
// selection column and the first data column are pinned on the logical start; a hovered row takes
// the light selection tint, a selected row the selection colour, both the strong one.
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/cn.ts';
import type { ColumnMeta, RowLike, TableLike } from './columns.ts';
import {
  CELL,
  CutHeader,
  HeaderBox,
  HeaderLabel,
  PINNED,
  SelectMark,
  SortButton,
} from './parts.tsx';
import type { Cell } from './use-grid-keyboard.ts';

const ROW_TINT =
  'transition-colors duration-(--shifa-motion-duration-fast) motion-reduce:transition-none group-hover/row:bg-selection-subtle';
const SELECTED = 'bg-selection-default group-hover/row:bg-selection-strong';
const HEAD = 'h-11 bg-bg-surface-raised in-data-[density=compact]:h-9';
const HEIGHT = 'h-(--shifa-table-row-height)';
/** The first band of a growing row: one row high, its content centred in it. */
// The band stretches over the cell's content box (inside its bottom border), up to one row.
const BAND = 'flex min-w-0 items-center gap-2 self-stretch max-h-(--shifa-table-row-height)';
/**
 * A wrapping cell: the whole text on as many lines as it needs, its first line level with the
 * band; the bottom padding is a step smaller, so a one-line cell with its border keeps one row.
 */
const WRAP = cn(
  // Its text never widens the table: the column takes its width from the tracks, not the text.
  'pt-3 pb-2 leading-body whitespace-normal wrap-anywhere contain-inline-size',
  'in-data-[density=compact]:pt-1 in-data-[density=compact]:pb-0.5',
);

/** The sticky start of a pinned cell: the selection column at 0, the first data column after it. */
const pinStart = (col: number) => (col === 0 ? 'start-0' : 'start-(--shifa-space-12)');

const metaOf = (column: { columnDef: { meta?: unknown } }) => column.columnDef.meta as ColumnMeta;

export interface RowsCommon {
  selectable: boolean;
  /** The tabindex of a cell: 0 for the active one. */
  tab: (cell: Cell) => 0 | -1;
  columnsStyle: CSSProperties;
}

export function HeaderRow<Row extends object>({
  table,
  selectable,
  tab,
  columnsStyle,
}: RowsCommon & { table: TableLike<Row> }) {
  // Select-all speaks for the shown rows only: a selection kept from rows that are gone does not
  // make it mixed (review B2).
  const shown = table.getRowModel().rows;
  const all = shown.length > 0 && shown.every((r) => r.getIsSelected());
  const some = !all && shown.some((r) => r.getIsSelected());
  const firstData = selectable ? 1 : 0;
  return (
    <div
      role="row"
      aria-rowindex={1}
      style={columnsStyle}
      className="sticky top-0 z-2 grid in-data-[scrolled-y=true]:shadow-card"
    >
      {selectable && (
        <div
          role="columnheader"
          data-cell
          data-row={0}
          data-col={0}
          tabIndex={tab({ row: 0, col: 0 })}
          className={cn(CELL, PINNED, pinStart(0), HEAD)}
        >
          <SelectMark
            checked={all ? true : some ? 'mixed' : false}
            label="تحديد كل الصفوف"
            onToggle={() => {
              table.toggleAllRowsSelected(!all);
            }}
          />
        </div>
      )}
      {table.getHeaderGroups()[0]?.headers.map((header, i) => {
        const col = i + firstData;
        const meta = metaOf(header.column);
        const sorted = header.column.getIsSorted();
        const direction = sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : null;
        const canSort = header.column.getCanSort();
        return (
          <CutHeader key={header.id} text={meta.header}>
            {(labelRef) => (
              <div
                role="columnheader"
                data-cell
                data-row={0}
                data-col={col}
                tabIndex={tab({ row: 0, col })}
                {...(canSort ? { 'aria-sort': direction ?? 'none' } : {})}
                className={cn(
                  CELL,
                  HEAD,
                  'text-200 font-medium text-text-muted',
                  direction !== null && 'font-semibold text-text-default',
                  meta.kind === 'number' && 'justify-end',
                  i === 0 && cn(PINNED, pinStart(col)),
                )}
              >
                <HeaderBox end={meta.kind === 'number'}>
                  {canSort ? (
                    <SortButton
                      label={meta.header}
                      direction={direction}
                      labelRef={labelRef}
                      onSort={() => {
                        header.column.toggleSorting(direction === 'ascending');
                      }}
                    />
                  ) : (
                    <HeaderLabel text={meta.header} labelRef={labelRef} />
                  )}
                </HeaderBox>
              </div>
            )}
          </CutHeader>
        );
      })}
    </div>
  );
}

export function BodyRow<Row extends object>({
  row,
  index,
  offset,
  selectable,
  tab,
  columnsStyle,
  format,
  selectLabel,
  onRowAction,
  measure,
}: RowsCommon & {
  row: RowLike<Row>;
  /** The data row's index (its grid row is index + 1). */
  index: number;
  /** Its offset from the top of the body, from the virtualiser. */
  offset: number;
  format: (value: number) => string;
  selectLabel: string;
  onRowAction: ((row: Row) => void) | undefined;
  /** Set when a column wraps: the virtualiser measures the row's own height. */
  measure?: (node: Element | null) => void;
}) {
  const r = index + 1;
  const wraps = measure !== undefined;
  /** A cell's height: fixed, or at least a row's in a table whose rows grow. */
  const cellHeight = wraps ? 'h-auto min-h-(--shifa-table-row-height) items-start' : HEIGHT;
  /** In a growing row, a one-line cell keeps its content in the row's first band, at the top. */
  const band = (node: ReactNode) => (wraps ? <span className={BAND}>{node}</span> : node);
  const selected = row.getIsSelected();
  const firstData = selectable ? 1 : 0;
  const content = (meta: ColumnMeta, value: unknown): ReactNode => {
    if (meta.render !== undefined) return meta.render(row.original);
    if (typeof value === 'number') return meta.kind === 'number' ? format(value) : String(value);
    if (typeof value !== 'string') return '';
    return meta.kind === 'latin' ? <bdi>{value}</bdi> : value;
  };
  return (
    <div
      role="row"
      aria-rowindex={r + 1}
      {...(selectable ? { 'aria-selected': selected } : {})}
      {...(wraps ? { 'data-index': index, ref: measure } : {})}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('a, button, input, [role="checkbox"]') !== null) return;
        onRowAction?.(row.original);
      }}
      // The virtualiser's offset of this row: computed, not a design value.
      style={{ ...columnsStyle, transform: `translateY(${String(offset)}px)` }}
      className={cn(
        'group/row absolute inset-x-0 top-0 grid',
        onRowAction !== undefined && 'cursor-pointer',
      )}
    >
      {selectable && (
        <div
          role="gridcell"
          data-cell
          data-row={r}
          data-col={0}
          tabIndex={tab({ row: r, col: 0 })}
          className={cn(CELL, PINNED, pinStart(0), ROW_TINT, selected && SELECTED, cellHeight)}
        >
          {band(
            <SelectMark
              checked={selected}
              label={selectLabel}
              onToggle={() => {
                row.toggleSelected();
              }}
            />,
          )}
        </div>
      )}
      {row.getVisibleCells().map((c, i) => {
        const col = i + firstData;
        const meta = metaOf(c.column);
        return (
          <div
            key={c.id}
            role="gridcell"
            data-cell
            data-row={r}
            data-col={col}
            tabIndex={tab({ row: r, col })}
            className={cn(
              CELL,
              ROW_TINT,
              selected && SELECTED,
              cellHeight,
              meta.kind === 'number' && 'justify-end text-end tabular-nums',
              i === 0 && cn(PINNED, pinStart(col), 'font-medium'),
              meta.wrap && WRAP,
            )}
          >
            {meta.wrap
              ? content(meta, c.getValue())
              : band(
                  wraps ? (
                    // One line, cut with an ellipsis in a narrow box.
                    <span className="min-w-0 truncate">{content(meta, c.getValue())}</span>
                  ) : (
                    content(meta, c.getValue())
                  ),
                )}
          </div>
        );
      })}
    </div>
  );
}
