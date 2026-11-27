# RecordList

Rows of people or records: search results, a family, duplicate candidates, treating doctors, the recently opened, a clinic's fields.

Coded from the sheet the owner approved on 2026-11-27 (Shifa Screens · Clinic web, page "Proposals", `A03SheetRecordList`, slice A-03-01), tested in Arabic RTL and English LTR, light and dark, both densities.

## When to use
- A list of people or records a person opens or acts on, one row each.
- Not for records that are read, sorted and paged by column (use DataTable).

## Look
Each row: the avatar (or a type icon, or a dashed lock for a hidden record), the title with the matched words in a heavier weight (never another colour), a second line of badges and short texts separated by «·», optional columns, and at the end a chevron (the row is a link), a button, small tool buttons and a button, or a badge. Three layouts: `table` (a raised header row and the DataTable's row height; under 640 px of width it shows as two lines), `stack` (two lines) and `tiles` (small link cards in a grid). Sizes `md` and `sm`. A current row has the selection colour; an archived one (`dim`) is muted. Loading shows skeleton rows, an empty list its EmptyState, and a footer line can close the list.

## Behaviour
A named list of list items. Link rows are real links, all behind one Tab stop: ↑ ↓ move between rows, Home and End go to the first and last, Enter opens. A row with its own buttons keeps them in the Tab order, and the arrows land on its first one. Each row is read once: the name, the second line, then each column with its header. The avatar is not read again; a hidden row is read by its title («ملف مشابه لدى طبيب آخر») and its lock («مخفي عنك»). Numbers and phones are isolated left to right.

## What you provide (design system)
`aria-label`, `items` (`id`, `title`, `matches`, `avatarName`, `icon`, `details`, `cells`, `href`, `action`, `tools`, `badge`, `locked`, `dim`, `current`), `layout`, `size`, `columns` (`header`, `weight`), `titleHeader`, `framed`, `chevron`, `loading`, `empty`, `footer`.

In code: `action.onClick`, `tools[].onClick`, and `onOpen(id, event)` for a link row (call `event.preventDefault()` to route in the app).

## Tokens
`shifa-size-row`, `shifa-table-row-height`, `shifa-size-avatar-sm`, `-md`, `shifa-color-selection-subtle`, `-default`, `-strong`, `shifa-color-bg-surface-raised`, `shifa-color-border-default`, `shifa-card-radius`, `shifa-width-60`.
