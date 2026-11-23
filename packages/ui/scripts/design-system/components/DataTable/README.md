# DataTable

A dense list of records that stays fast with thousands of rows: patients, invoices, visits.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Data display and table · 0.4-07", OD-64), tested in Arabic RTL and English LTR, light and dark, both densities, with 5,000 rows (slice 0.4-07).

## When to use
- Records people scan, sort, select and open.
- Not for a short list of cards, nor for a form laid out in rows.

## Look
A bordered surface, radius 12. A raised header in muted 14 px text; the sorted column heavier, in the text colour, with its arrow. Rows of 48 px (32 compact), divided by light lines; a hovered row takes the light selection tint, a selected row the selection colour. The first column is pinned on the logical start and the header stays on top; once content scrolls under them they get a border and a soft shadow. A header never widens its column: a longer one ends in an ellipsis and shows its full text in a tooltip, after 500 ms on hover and at once on keyboard focus, read once by screen readers (OD-66, slice 0.4-12). Numbers sit at the cell's end in tabular Western digits with grouping; codes and phone numbers are isolated. While loading, skeleton rows; with no row, the empty state under the header. Under the table: the pagination, then the columns menu at the logical end.

## Behaviour
A grid with one Tab stop on the active cell. The arrows move it in the reading direction (Left is the next column in Arabic), Home and End reach the row's ends, Ctrl+Home and Ctrl+End the table's, PageUp and PageDown a visible page. Space selects the row (select-all on the header, mixed when some are selected). Enter on a sortable header sorts; on a cell with a link or button it goes into it (Escape comes back); elsewhere it opens the record, as a press on the row does. Only the rows in view are drawn; the grid still tells screen readers its full size. Not in this version: resizing or moving columns, grouping, editing in a cell, export.

## What you provide (design system)
`aria-label`, `columns` (`id`, `header`, `kind`, `sortable`), `rows` (values by column id), `selectable`, `defaultSelected`, `defaultSort`, `loading`, `emptyTitle`.

In code: `columns` (`DataTableColumn`: `id`, `header`, `value`, `cell`, `kind`, `width`, `sortable`, `hideable`), `rows`, `getRowId`; `sort`/`defaultSort` with `onSortChange` and `manualSorting` for the server; `selectable`, `selected`/`defaultSelected` with `onSelectedChange`; `hiddenColumns`/`defaultHiddenColumns`; `onRowAction`; `loading`, `empty`, `totalRows`, `toolbar`, `footer`.

## Tokens
`shifa-table-row-height`, `shifa-size-table`, `shifa-color-bg-surface-raised`, `shifa-color-selection-subtle`, `-default`, `-strong`, `shifa-color-border-default`, `shifa-color-border-focus`, `shifa-shadow-card`.
