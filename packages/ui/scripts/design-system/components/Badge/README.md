# Badge

A small mark beside a name or in a table cell: a draft, a specialty, a payment or a visit state. Never pressed, never focused.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Data display and table · 0.4-07", OD-64), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-07).

## When to use
- A short state or category that is read, not acted on.
- Not for an action (use Button) nor for a count on a tab (use CountBadge).

## Look
A pill, sm 24 px (12 px text) or md 28 px (14 px text). **Themed tones** follow the clinic's palette: neutral (slate), brand (the selection tint) and outline. **Locked tones** never change with a clinic theme and always carry their icon besides the word, so colour is never the only cue: success (a check), warning (a triangle), danger (a cross, brick, never red), info (an i), and the visit queue (booked, confirmed, arrived, waiting, in room with a dot; done with a check; no-show and cancelled with an open ring). A long word is cut with an ellipsis.

## What you provide (design system)
`children` (the word), `tone`, `size`, `icon` (themed tones only).

In code: the same; `icon={false}` drops a themed tone's icon (a locked tone keeps its own).

## Tokens
`shifa-color-status-*-bg`, `-fg`, `-border`, `shifa-color-queue-*-bg`, `-fg`, `shifa-color-selection-default`, `shifa-color-border-strong`, `shifa-shape-radius-pill`.
