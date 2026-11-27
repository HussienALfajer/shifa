// The data table of the design-system bundle (slice 0.4-07), as data: columns and rows of plain
// values cross from a Design canvas into the bundle's React (bundle-entry.tsx); a row's id is its
// position. The empty state takes the EmptyState's data, which is also how an error shows.
import {
  Button,
  DataTable as CodeDataTable,
  type DataTableColumn,
  type EmptyStateArt,
  type IconName,
} from '../../src/index.ts';

type Values = Record<string, string | number>;

export interface DataTableData {
  'aria-label': string;
  columns: {
    id: string;
    header: string;
    kind?: 'text' | 'number' | 'latin';
    sortable?: boolean;
    hideable?: boolean;
    /** Free text shown whole on several lines (a reason, a note). */
    wrap?: boolean;
  }[];
  rows: Values[];
  selectable?: boolean;
  defaultSelected?: string[];
  defaultSort?: { columnId: string; direction: 'ascending' | 'descending' };
  defaultHiddenColumns?: string[];
  loading?: boolean;
  /** How many skeleton rows a load shows. */
  loadingRows?: number;
  /** The empty state (no rows): a search with no match, or an error with its way out. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: IconName;
  emptyArt?: EmptyStateArt;
  /** Buttons of the empty state, the main one first. */
  emptyActions?: { label: string; variant?: 'primary' | 'secondary' }[];
  /** Rows the server has in all (a long list loaded in parts). */
  totalRows?: number;
}

export function DataTable({
  columns,
  rows,
  selectable,
  defaultSelected,
  defaultSort,
  defaultHiddenColumns,
  loading,
  loadingRows,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyArt,
  emptyActions,
  totalRows,
  ...aria
}: DataTableData) {
  const defs: DataTableColumn<Values & { __id: string }>[] = columns.map((c) => ({
    id: c.id,
    header: c.header,
    value: (row) => row[c.id],
    ...(c.kind === undefined ? {} : { kind: c.kind }),
    ...(c.sortable === undefined ? {} : { sortable: c.sortable }),
    ...(c.hideable === undefined ? {} : { hideable: c.hideable }),
    ...(c.wrap === undefined ? {} : { wrap: c.wrap }),
  }));
  const empty =
    emptyTitle === undefined
      ? undefined
      : {
          title: emptyTitle,
          ...(emptyDescription === undefined ? {} : { description: emptyDescription }),
          ...(emptyIcon === undefined ? {} : { icon: emptyIcon }),
          ...(emptyArt === undefined ? {} : { art: emptyArt }),
          ...(emptyActions === undefined || emptyActions.length === 0
            ? {}
            : {
                actions: emptyActions.map((a) => (
                  <Button key={a.label} variant={a.variant ?? 'secondary'}>
                    {a.label}
                  </Button>
                )),
              }),
        };
  return (
    <CodeDataTable
      aria-label={aria['aria-label']}
      columns={defs}
      rows={rows.map((row, i) => ({ ...row, __id: String(i) }))}
      getRowId={(row) => row.__id}
      {...(selectable === undefined ? {} : { selectable })}
      {...(defaultSelected === undefined ? {} : { defaultSelected })}
      {...(defaultSort === undefined ? {} : { defaultSort })}
      {...(defaultHiddenColumns === undefined ? {} : { defaultHiddenColumns })}
      {...(loading === undefined ? {} : { loading })}
      {...(loadingRows === undefined ? {} : { loadingRows })}
      {...(empty === undefined ? {} : { empty })}
      {...(totalRows === undefined ? {} : { totalRows })}
    />
  );
}
