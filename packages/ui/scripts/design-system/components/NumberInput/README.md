# NumberInput

A number with − and + (a count, an age), or an amount typed with its unit.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Gate components · 0.4-04") and passed the Arabic RTL gate (slice 0.4-04).

## When to use
- Small counts that change by one: steppers on.
- Amounts and prices: `steppers={false}` and a `unit` («ل.س»).

## Look
«إنقاص» (−) at the logical start and «زيادة» (+) at the end, each a 44 px target (32 compact), divided from the number by a line. Western digits (OD-20) in tabular figures, grouped with a comma (125,000, OD-61). A stepper at its limit is pale and disabled; the rest of the field stays as it is.

## Behaviour
- Up and Down step by one; Page Up and Page Down by ten; Home and End go to the limits.
- Arabic-Indic digits typed (١٢) are accepted and kept as Western ones (12); the Arabic decimal mark is a point.
- Out-of-range text is clamped when the field is left; say the range in `hint` or `error`.

## What you provide
`label`, `defaultValue` (or `value` with `onValueChange` in code), `min`, `max`, `step`, `unit`, `steppers`, `hint`, `error`, `disabled`.

## Tokens
`shifa-input-height`, `shifa-input-border`, `shifa-input-bg`, `shifa-color-border-default` (the dividers), `shifa-color-selection-subtle` (stepper hover), `shifa-color-text-disabled`.
