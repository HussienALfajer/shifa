# Checkbox

A yes-or-no choice sent with a form: «مريض جديد», a consent, a row in a table.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Inputs and forms · 0.4-05"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-05).

## When to use
- A choice that takes effect when the form is sent. A setting that acts at once is a Switch; one of several is a RadioGroup.
- `defaultChecked: 'indeterminate'` for a "select all" that covers some rows.

## Look
A 20 px mark (radius 4) at the logical start, the text after it; the whole line is a 44 px target (32 compact). Checked is a green mark with a white tick, "some" a dash, so the state is told by its shape, not by colour alone. A `description` sits under the text; an error (a danger border on the mark, a warning icon and text) under the line.

## Behaviour
- Space and a press on the text toggle it; a mixed box becomes checked.

## What you provide
`children` (the text), `defaultChecked`, `description`, `error`, `disabled`.

## Tokens
`shifa-color-brand-primary`, `shifa-color-brand-on-primary`, `shifa-color-border-strong`, `shifa-shape-radius-mark`, `shifa-size-target-min`, `shifa-color-status-danger-fg`.
