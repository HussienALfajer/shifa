# Spinner

Shifa's loading indicator: the four jasmine petals of the logo, on the diagonals, light in turn.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Data display and table · 0.4-07", OD-64), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-07).

## When to use
- A wait without a known shape: a panel, a page, a refresh. Inside a Button use `loading` (the button draws the petals itself and says it is busy).
- Not for content whose shape is known (a list, a card): use Skeleton.

## Look
sm 20 and md 24 px (the icon sizes) in rows and controls, lg 40 px for a whole panel or page. The petals take the colour of the text around them; on a panel use the brand colour. With `showLabel` the label sits under the petals in muted text.

## Behaviour
Alone it is a status named «جارٍ التحميل» (or `label`). It shows only after 400 ms, so quick loads do not flash, and once shown it stays at least 400 ms. One petal lights every 200 ms (an 800 ms cycle); under reduced motion the petals stand still at their stepped shades.

## What you provide (design system)
`size`, `label`, `showLabel`, `delay` (0 in drawings).

In code: the same, plus `active` (keep it mounted and set it to false when the wait ends).

## Tokens
`shifa-size-icon-sm`, `shifa-size-icon-md`, `shifa-color-brand-primary`, `shifa-color-text-muted`, `shifa-motion-easing-exit`.
