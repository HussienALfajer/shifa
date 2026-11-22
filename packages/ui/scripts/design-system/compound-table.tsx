// The data table of the design-system bundle (slice 0.4-07), as data: columns and rows of plain
// values cross from a Design canvas into the bundle's React (bundle-entry.tsx); a row's id is its
// position.
import { DataTable as CodeDataTable, type DataTableColumn } from '../../src/index.ts';

type Values = Record<string, string | number>;

export interface DataTableData {
  'aria-label': string;
  columns: { id: string; header: string; kind?: 'text' | 'number' | 'latin'; sortable?: boolean }[];
  rows: Values[];
  selectable?: boolean;
  defaultSelected?: string[];
  defaultSort?: { columnId: string; direction: 'ascending' | 'descending' };
  loading?: boolean;
  emptyTitle?: string;
}

export function DataTable({
  columns,
  rows,
  selectable,
  defaultSelected,
  defaultSort,
  loading,
  emptyTitle,
  ...aria
}: DataTableData) {
  const defs: DataTableColumn<Values & { __id: string }>[] = columns.map((c) => ({
    id: c.id,
    header: c.header,
    value: (row) => row[c.id],
    ...(c.kind === undefined ? {} : { kind: c.kind }),
    ...(c.sortable === undefined ? {} : { sortable: c.sortable }),
  }));
  return (
    <CodeDataTable
      aria-label={aria['aria-label']}
      columns={defs}
      rows={rows.map((row, i) => ({ ...row, __id: String(i) }))}
      getRowId={(row) => row.__id}
      {...(selectable === undefined ? {} : { selectable })}
      {...(defaultSelected === undefined ? {} : { defaultSelected })}
      {...(defaultSort === undefined ? {} : { defaultSort })}
      {...(loading === undefined ? {} : { loading })}
      {...(emptyTitle === undefined ? {} : { empty: { title: emptyTitle } })}
    />
  );
}
