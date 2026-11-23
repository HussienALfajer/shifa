# Pagination

Page controls under a long list: patients, invoices, visits.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Data display and table · 0.4-07", OD-64), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-07). Narrow widths from the sheet "Before Phase A · 0.4-12 and 0.4-13" (approved 2026-11-23, OD-66; slice 0.4-12).

## When to use
- A list the server sends a page at a time.
- Not for steps of a flow, nor for a short list that fits on one screen.

## Look
On one line: «عرض 51–75 من 312» in muted text, then previous, the page numbers and next, then the page-size select («صفوف في الصفحة»: 25, 50, 100). Previous sits at the logical start and next at the end; their arrows mirror in RTL. The current page is filled green and heavier. One page at each end and one each side of the current one, with ellipses between. Western digits with comma grouping (OD-20, OD-61). The compact form shows «الصفحة 3 من 13» between the arrows, the summary on a second line. It fills its container and picks its form from that width: below 430 px the compact form, from 430 px the page numbers (`form` forces one). The page-size select is 88 px wide (76 px compact), enough for «100» and its chevron.

## Behaviour
A named navigation; Tab reaches every button. The current page is announced (`aria-current="page"`) and each number is read «الصفحة 4». Previous is disabled on the first page and next on the last. Changing the page size goes back to page 1. It fetches nothing: the caller loads the page.

## What you provide (design system)
`totalItems`, `defaultPage`, `pageSize`, `pageSizes`, `form` (`auto`, `numbers`, `compact`).

In code: `page` with `onPageChange`, `pageSize`, `totalItems`, `pageSizes` with `onPageSizeChange`, `form`, `hideSummary`, `label`, `copy` (the words of an English screen).

## Tokens
`shifa-color-brand-primary`, `shifa-color-brand-on-primary`, `shifa-color-selection-subtle`, `shifa-color-text-muted`, `shifa-size-control-md`, `shifa-size-control-select-narrow`, `shifa-shape-radius-control`.
