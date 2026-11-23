# Select

Choose one of a short, known list: a doctor, a room, a visit type.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Gate components · 0.4-04") and passed the Arabic RTL gate (slice 0.4-04).

## When to use
- Up to about fifteen options a person knows. A long or searched list is a Combobox.

## Look
A field like an input, with a caret at its logical end and the label above. The list opens below it, at its logical start, at least as wide; rows of 48 px (32 compact). The chosen option has a check at its start and the selection colour, so it is not told by colour alone. An unavailable option is pale and says why at the end of its row. An error is brick with a warning icon under the field.

## Behaviour
- Up and Down move; typing a letter (Arabic too) moves to the option whose name starts with it, skipping a title such as «د.»; hamza and other letter forms are folded, so «ا» reaches «أحمد» (OD-40, slice 0.4-12).
- Enter chooses and closes; Escape closes and keeps the value. Focus returns to the field.

## What you provide
`label`, `items` (`value`, `label`, `disabled`, `hint`), `defaultValue` (or `value` with `onValueChange` in code), `placeholder`, `hint`, `error`, `disabled`.

## Tokens
`shifa-input-height`, `shifa-input-border`, `shifa-input-bg`, `shifa-input-radius`, `shifa-size-row`, `shifa-color-selection-default`, `shifa-color-status-danger-fg`, `shifa-shadow-dropdown`.
