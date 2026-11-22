// The data table's state on TanStack Table v9 (slice 0.4-07): sorting, selection and column
// visibility, each the caller's when given (controlled) or the table's own (default). Nothing of
// TanStack is exported from here: the hook returns our structural TableLike (columns.ts).
import {
  type ColumnDef,
  type ColumnVisibilityState,
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  type RowSelectionState,
  rowSelectionFeature,
  rowSortingFeature,
  type SortingState,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { type ReactNode, useMemo, useState } from 'react';
import type { ColumnMeta, DataTableColumn, DataTableSort, TableLike } from './columns.ts';

const FEATURES = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
});

type Features = typeof FEATURES;

/** TanStack columns for ours; the first column never hides. */
function toColumnDefs<Row extends object>(
  columns: readonly DataTableColumn<Row>[],
): ColumnDef<Features, Row>[] {
  const helper = createColumnHelper<Features, Row>();
  return columns.map((column, index) => {
    const kind = column.kind ?? 'text';
    const meta: ColumnMeta = {
      kind,
      width: column.width ?? (index === 0 ? 'lg' : 'md'),
      render: column.cell as ((row: unknown) => ReactNode) | undefined,
      header: column.header,
    };
    return helper.accessor((row: Row) => column.value?.(row), {
      id: column.id,
      header: column.header,
      enableSorting: column.sortable === true,
      enableHiding: index > 0 && column.hideable !== false,
      sortFn: kind === 'number' ? 'basic' : 'alphanumeric',
      sortUndefined: 'last',
      meta,
    }) as ColumnDef<Features, Row>;
  });
}

function toSortingState(sort: DataTableSort | null | undefined): SortingState {
  return sort ? [{ id: sort.columnId, desc: sort.direction === 'descending' }] : [];
}

function fromSortingState(state: SortingState): DataTableSort | null {
  const first = state[0];
  return first ? { columnId: first.id, direction: first.desc ? 'descending' : 'ascending' } : null;
}

export interface TableStateOptions<Row extends object> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string;
  selectable: boolean;
  manualSorting: boolean;
  sort: DataTableSort | null | undefined;
  defaultSort: DataTableSort | null | undefined;
  onSortChange: ((sort: DataTableSort | null) => void) | undefined;
  selected: readonly string[] | undefined;
  defaultSelected: readonly string[] | undefined;
  onSelectedChange: ((ids: string[]) => void) | undefined;
  hiddenColumns: readonly string[] | undefined;
  defaultHiddenColumns: readonly string[] | undefined;
  onHiddenColumnsChange: ((ids: string[]) => void) | undefined;
}

const toSelection = (ids: readonly string[] | undefined): RowSelectionState =>
  Object.fromEntries((ids ?? []).map((id) => [id, true as const]));
/** Hidden columns; the first column never hides, whatever the caller passes. */
const toVisibility = (
  ids: readonly string[] | undefined,
  first: string | undefined,
): ColumnVisibilityState =>
  Object.fromEntries((ids ?? []).filter((id) => id !== first).map((id) => [id, false]));

/** State that is the caller's when `value` is given, the table's otherwise. */
function useMaybeControlled<T>(value: T | undefined, initial: T) {
  const [own, setOwn] = useState(initial);
  return [value ?? own, setOwn] as const;
}

export function useTableState<Row extends object>(o: TableStateOptions<Row>): TableLike<Row> {
  const defs = useMemo(() => toColumnDefs(o.columns), [o.columns]);
  const [sorting, setSorting] = useMaybeControlled<SortingState>(
    o.sort === undefined ? undefined : toSortingState(o.sort),
    toSortingState(o.defaultSort),
  );
  const [selection, setSelection] = useMaybeControlled<RowSelectionState>(
    o.selected === undefined ? undefined : toSelection(o.selected),
    toSelection(o.defaultSelected),
  );
  const [visibility, setVisibility] = useMaybeControlled<ColumnVisibilityState>(
    o.hiddenColumns === undefined ? undefined : toVisibility(o.hiddenColumns, o.columns[0]?.id),
    toVisibility(o.defaultHiddenColumns, o.columns[0]?.id),
  );
  return useTable({
    features: FEATURES,
    columns: defs,
    data: o.rows,
    getRowId: (row) => o.getRowId(row),
    state: { sorting, rowSelection: selection, columnVisibility: visibility },
    manualSorting: o.manualSorting,
    enableMultiSort: false,
    enableSortingRemoval: false,
    sortDescFirst: false,
    enableRowSelection: o.selectable,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(next);
      o.onSortChange?.(fromSortingState(next));
    },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(selection) : updater;
      setSelection(next);
      // Every selected id, the shown rows first: a selection kept from other pages or a narrower
      // list is reported too (review B2).
      const shownIds = o.rows.map((row) => o.getRowId(row));
      const kept = Object.keys(next).filter((id) => next[id] === true && !shownIds.includes(id));
      o.onSelectedChange?.([...shownIds.filter((id) => next[id] === true), ...kept]);
    },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === 'function' ? updater(visibility) : updater;
      setVisibility(next);
      o.onHiddenColumnsChange?.(Object.keys(next).filter((id) => next[id] === false));
    },
  });
}
