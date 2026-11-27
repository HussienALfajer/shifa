# EditableList

A short list a person edits in place: a choice field's choices in «حقول ملف المريض», and later any small list the clinic owns.

Coded from the sheet the owner approved on 2026-11-27 (Shifa Screens · Clinic web, page "Proposals", `A03SheetEditableList`, slice A-03-01), tested in Arabic RTL and English LTR, light and dark, both densities.

## When to use
- A few named items the clinic orders, renames and archives (choices, up to a maximum).
- Not for records with many fields (use RecordList and a form).

## Look
The label with the count against the maximum («3 من 250», in the warning colour when full), then a bordered list: each row numbered among the active ones, its name, how many charts hold it, and its tools (up, down, rename, archive). An archived row sits on the raised surface, struck through and muted, with a badge and «استعادة». Under the list, the add line (a field and «إضافة») and a note on archived items.

## Behaviour
A group named by its label; each row a list item. Every tool is named by its row («نقل «صيدلية» للأعلى»). Up on the first row and down on the last stay focusable but disabled, so focus stays on a row after it moves. Rename opens an Input in place: Enter saves, Escape cancels. Enter in the add field adds. A name that folds (hamza, taa marbuta) to one already there is refused with an error, as search folds it. Archiving is at once and never deletes; the screen shows «أُرشف …» with «تراجع». When full the add button is disabled and the reason shown; the server stays the judge. Read-only shows no tools and no add line.

## What you provide (design system)
`label`, `items` (`id`, `label`, `use`, `archived`), `max`, `readOnly`, `addError`, `foot`. On a board the edits stay local.

In code: `onMove(id, 'up' | 'down')`, `onRename(id, label)`, `onArchive(id)`, `onRestore(id)`, `onAdd(label)`, and `words` for any text.

## Tokens
`shifa-color-border-default`, `shifa-color-bg-surface`, `shifa-color-bg-surface-raised`, `shifa-color-text-muted`, `shifa-color-status-warning-fg`, `shifa-size-control-md`, `shifa-shape-radius-input`.
