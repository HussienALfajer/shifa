# CountBadge

A number on a tab, a menu item or a navigation entry: patients waiting, unread messages. Or a dot when only "something new" matters.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Data display and table · 0.4-07", OD-64), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-07).

## When to use
- A count that tells a person where to look next.
- Not for a state (use Badge).

## Look
A 20 px pill with Western tabular digits (OD-20): neutral (slate), brand (green, the selected tab) or danger (brick fill, for unread). Above `max` (99 by default) it shows «99+»; at 0 it is not drawn. The dot is 8 px.

## Behaviour
Screen readers hear `label` («12 رسالة غير مقروءة»), never the bare number; the dot is an image named by `label`.

## What you provide (design system)
`label`, `count`, `max`, `dot`, `tone`.

In code: the same.

## Tokens
`shifa-color-status-neutral-bg`, `-fg`, `shifa-color-brand-primary`, `shifa-color-brand-on-primary`, `shifa-color-status-danger-solid`, `-on-solid`, `shifa-shape-radius-pill`.
