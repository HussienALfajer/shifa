# Field

The label, required mark, hint and error around a control, wired to it for screen readers.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Inputs and forms · 0.4-05"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-05).

## When to use
- Every control of the set takes `label`, `hint` and `error` itself; in code, `Field` wraps a control that has none (a form field). Here it is shown around an Input.

## Look
From top to bottom: the label (label-sm, 14/500) with a danger-coloured asterisk when required; the control; a muted hint; the error with a warning icon in the danger colour, so it is never told by colour alone. 4 px between the parts, 16 px between fields.

## Behaviour
- The label names the control; the hint and then the error are read with it. The asterisk is hidden from screen readers, which hear "required" from the control.
- Error text is a message, never an i18n key (Form translates its keys).

## What you provide
`label`, `hint`, `error`, `required`, `disabled`, and for the Input inside: `defaultValue`, `placeholder`, `dir`.

## Tokens
`shifa-color-text-default`, `shifa-color-text-muted`, `shifa-color-status-danger-fg`, `shifa-gap-*`.
