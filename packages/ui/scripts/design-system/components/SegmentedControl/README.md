# SegmentedControl

One choice of two to five options that switches a view at once: day, week or month; all, waiting, in the room.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Overlays and navigation · 0.4-06"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-06).

## When to use
- Switching how the same content is shown or filtered, right away.
- Not for a value sent with a form (use RadioGroup), nor for separate views of a record with their own panels (use Tabs). More than five options: use Select.

## Look
A 44 px track (32 compact) in the raised surface colour with a light border, radius 12. The chosen option is a white raised segment with heavier text, so it is not told by colour alone. An option may carry an icon at its logical start or a count after its label. A disabled option is grey.

## Behaviour
A radio group with one Tab stop, on the chosen option. The arrows move and choose together and follow the reading direction (Left is next in Arabic), Home and End reach the first and the last, a disabled option is skipped. The white segment's colour change takes 150 ms; at once under reduced motion.

## What you provide (design system)
`aria-label` (what the choice is about), `items` (`value`, `label`, `icon`, `count`, `disabled`), `defaultValue`, `disabled`.

In code: the same props, plus `value` with `onValueChange`.

## Tokens
`shifa-color-bg-surface-raised`, `shifa-color-bg-surface`, `shifa-color-border-default`, `shifa-shadow-card`, `shifa-size-control-md`, `shifa-size-target-min`, `shifa-shape-radius-control`.
