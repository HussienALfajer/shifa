# MultiCombobox

Several choices from a long list, found by typing: the clinics a flag or an announcement is for.

Coded from the sheet the owner approved on 2026-11-27 (Shifa Screens · Admin web, page "Proposals", `A02SheetMultiCombobox`, slice A-02-01), tested in Arabic RTL and English LTR, light and dark, both densities.

## When to use
- Choosing any number of items from a list too long to show as checkboxes.
- Not for one choice (use Combobox), nor for a short known list (use Checkbox or Select).

## Look
A field like Combobox: label above, hint or error below. The chosen ones are chips inside the box, in the selection colour with radius 8, each with a small remove button (×); the text field follows them and wraps to a new line when the box is full. The list opens below the field at its logical start; each option has a tick column (the brand colour on the chosen), the typed part in bold. No match says so. An error draws the box's danger border with the error line; disabled greys the box and its chips.

## Behaviour
A name matches when one of its words starts with the typed text, Arabic folded as in Combobox («احمد» finds «أحمد»). Enter or a press toggles the highlighted option; the list stays open and the typed text clears. Backspace in the empty field removes the last chip; each chip's remove button is named «إزالة …». The number of results is announced once typing pauses.

## What you provide (design system)
`label`, `items` (`value`, `label`), `defaultValue` (the chosen values), `emptyMessage`, `placeholder`, `hint`, `error`, `disabled`, `defaultOpen`, `defaultInputValue`.

In code: the same (with results from a server search, `items` holds the chosen ones as well, since a chip's label is read from them), with `value` and `onValueChange` for a controlled choice, `removeLabel` for the remove buttons' names, `open` and `onOpenChange`.

## Tokens
`shifa-input-border`, `shifa-input-bg`, `shifa-input-fg`, `shifa-color-border-focus`, `shifa-shadow-focus`, `shifa-color-status-danger-fg`, `shifa-color-selection-default`, `-strong`, `-subtle`, `shifa-color-brand-primary`, `shifa-shape-radius-input`, `shifa-width-37-5`.
