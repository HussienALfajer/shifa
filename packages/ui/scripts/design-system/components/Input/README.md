# Input

One line of text a person types: a name, a phone number, a search.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Inputs and forms · 0.4-05"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-05).

## When to use
- Short free text. A number with steps is NumberInput; a date is DatePicker; a time is TimeInput.
- Latin content inside Arabic (phone, email, medicine name): `dir: 'auto'`, so it is written left to right and kept apart from the Arabic around it.

## Look
The field box shared with Select and NumberInput: 44 px (32 compact), radius 8, a light border that darkens on hover, the green focus ring at once. An error is a 2 px danger border with a warning icon and text under the field. Disabled is pale on the raised surface and leaves the tab order; read-only keeps its text readable on the raised surface and can be copied. An optional icon at the logical start (`startIcon`, e.g. search).

## What you provide
`label` (or put it in a Field), `defaultValue`, `placeholder`, `hint`, `error`, `required`, `disabled`, `readOnly`, `dir`, `type`, `startIcon`.

## Tokens
`shifa-input-height`, `shifa-input-radius`, `shifa-input-border`, `shifa-input-bg`, `shifa-input-fg`, `shifa-color-border-strong` (hover), `shifa-color-border-focus`, `shifa-shadow-focus`, `shifa-color-status-danger-fg`, `shifa-color-bg-surface-raised`.
