# IconButton

A square button with one icon and no visible text: edit, close, delete in a row.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Inputs and forms · 0.4-05"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-05).

## When to use
- Where space is short and the icon is well known (pencil, x, trash, plus). Otherwise use a Button with a label.
- `label` is required: it is the button's name for screen readers («تعديل»). A tooltip showing it joins with the Tooltip of slice 0.4-06.

## Look
The Button's variants: secondary (default), ghost, primary, danger. md 44 px and sm 36 px square (32 and 28 compact). Directional icons (back, forward) mirror in Arabic; others do not.

## What you provide
`icon`, `label`, `variant`, `size`, `disabled`.

## Tokens
As Button: `shifa-button-*`, `shifa-size-control-*`, `shifa-color-border-focus`, `shifa-shadow-focus`.
