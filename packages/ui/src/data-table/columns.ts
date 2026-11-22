// The data table's own types (slice 0.4-07): the column type callers write, and the structural
// shapes of the table, rows, columns and cells it reads. The public API, and every declaration it
// reaches, shows only these (test/public-api.test.ts); TanStack stays inside use-table-state.ts.
import type { ReactNode } from 'react';

/** What a column shows: text (default), a number (end-aligned, tabular, grouped) or Latin text isolated in `<bdi>` (codes, phones). */
export type DataTableColumnKind = 'text' | 'number' | 'latin';

/** sm and md columns share the rest of the width; lg takes twice as much and is wider at least. */
export type DataTableColumnWidth = 'sm' | 'md' | 'lg';

export type DataTableCellValue = string | number | null | undefined;

export interface DataTableColumn<Row> {
  /** Stable, unique within the table; the key of sorting and visibility. */
  id: string;
  /** The column header (also the name of its visibility toggle). */
  header: string;
  /** The cell's value: shown when there is no `cell`, and what sorting compares. */
  value?: (row: Row) => DataTableCellValue;
  /** Own content for the cell (a link, a badge). A control inside is reached with Enter. */
  cell?: (row: Row) => ReactNode;
  kind?: DataTableColumnKind;
  width?: DataTableColumnWidth;
  /** Sortable from its header (a button, aria-sort). */
  sortable?: boolean;
  /** Offered in the columns menu (default true; the first column never hides). */
  hideable?: boolean;
}

export type DataTableSortDirection = 'ascending' | 'descending';

export interface DataTableSort {
  columnId: string;
  direction: DataTableSortDirection;
}

export interface ColumnMeta {
  kind: DataTableColumnKind;
  width: DataTableColumnWidth;
  render: ((row: unknown) => ReactNode) | undefined;
  header: string;
}

/** A column as the table reads it. */
export interface ColumnLike {
  id: string;
  columnDef: { meta?: unknown };
  getIsSorted: () => false | 'asc' | 'desc';
  getCanSort: () => boolean;
  toggleSorting: (desc?: boolean) => void;
  getCanHide: () => boolean;
  getIsVisible: () => boolean;
  toggleVisibility: (value?: boolean) => void;
}

export interface CellLike {
  id: string;
  column: ColumnLike;
  getValue: () => unknown;
}

export interface RowLike<Row> {
  id: string;
  original: Row;
  getIsSelected: () => boolean;
  toggleSelected: (value?: boolean) => void;
  getVisibleCells: () => CellLike[];
  getValue: (columnId: string) => unknown;
}

export interface TableLike<Row> {
  getRowModel: () => { rows: RowLike<Row>[] };
  getVisibleLeafColumns: () => ColumnLike[];
  getAllLeafColumns: () => ColumnLike[];
  getColumn: (id: string) => ColumnLike | undefined;
  getHeaderGroups: () => { headers: { id: string; column: ColumnLike }[] }[];
  getIsAllRowsSelected: () => boolean;
  getIsSomeRowsSelected: () => boolean;
  toggleAllRowsSelected: (value?: boolean) => void;
}

/** The grid track of a column: tokens only. */
export function track(width: DataTableColumnWidth): string {
  if (width === 'lg') return 'minmax(var(--shifa-width-60), 2fr)';
  if (width === 'sm') return 'minmax(var(--shifa-space-16), 1fr)';
  return 'minmax(calc(var(--shifa-space-16) * 2), 1fr)';
}
