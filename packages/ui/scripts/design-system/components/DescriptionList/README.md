# DescriptionList

Labels and their values, grouped by section: a clinic's own fields on a patient's chart, and later the details of any record.

Coded from the sheet the owner approved on 2026-11-27 (Shifa Screens · Clinic web, page "Proposals", `A03SheetDescriptionList`, slice A-03-01), tested in Arabic RTL and English LTR, light and dark, both densities.

## When to use
- Read-only details of a record, a label beside each value.
- Not for values a person edits here (use a form), not for a list of records (use RecordList).

## Look
Each section: a small muted heading, then rows of a muted label and its value, a rule between rows (the first rule stronger under a heading). An empty value shows «—» muted. A value may carry one badge after it («حساس»). Latin values (card numbers, codes) are in the mono face, isolated left to right. One column, or with `columns: 2` the sections side by side, each at least 320 px, one column again when narrow.

## Behaviour
A named group; each section a real description list (dl, dt, dd) under an h3. An empty value is read «فارغ», not «dash». The badge is read after the value. Nothing in it is pressed: editing happens in the record's form. Loading shows a named skeleton and marks the group busy.

## What you provide (design system)
`aria-label`, `sections` (`id`, `title`, `rows`: `id`, `label`, `value`, `kind`, `badge`), `columns`, `loading`, `loadingLabel`, `emptyLabel`.

## Tokens
`shifa-color-text-muted`, `shifa-color-border-default`, `shifa-color-border-strong`, `shifa-text-size-caption`, `shifa-text-size-data`, `shifa-font-family-mono`, `shifa-width-80`.
