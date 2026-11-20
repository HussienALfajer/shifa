# Textarea

Longer text: notes for the doctor, instructions, a reason.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Inputs and forms · 0.4-05"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-05).

## When to use
- Text of more than one line. One line is Input.

## Look
Input's box, about 88 px high at first, growing with its text. With a limit (`maxLength`), a «n / max» counter in Western digits at the logical end under it. Error, disabled and read-only as Input.

## Behaviour
- Enter adds a line and never submits the form.

## What you provide
`label`, `defaultValue`, `placeholder`, `maxLength`, `hint`, `error`, `required`, `disabled`, `readOnly`.

## Tokens
As Input: `shifa-input-*`, `shifa-color-border-focus`, `shifa-color-status-danger-fg`, `shifa-color-text-muted` (counter).
