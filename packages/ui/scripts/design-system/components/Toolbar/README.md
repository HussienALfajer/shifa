# Toolbar

A strip of light buttons above a list or an editor: print, export, sort, columns.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Data display and table · 0.4-07"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-07).

## When to use
- Several actions on the same list or text, side by side.
- Not for the one main action of a screen (a primary Button beside the toolbar), nor for page navigation (Tabs, Pagination).

## Look
A bordered strip, radius 12, padding 4, with ghost buttons in the text colour; a toggle that is on has the selected tint and a stronger border. Vertical separators split the groups. When the strip is too narrow, the last buttons move into a «المزيد» menu (three dots) at its end.

## Behaviour
One Tab stop. The arrows move between the buttons in the reading direction (Left is next in Arabic) and stop at the ends; Home and End reach the first and the last; a disabled button is skipped. A toggle says it is pressed.

## What you provide (design system)
`aria-label`, `groups` (lists of `label`, `icon`, `pressed`, `disabled`).

In code: `Toolbar` (`aria-label`, `moreLabel`) with `ToolbarButton` (`icon`, `pressed`, `disabled`, `onClick`) and `ToolbarSeparator`.

## Tokens
`shifa-color-bg-surface`, `shifa-color-border-default`, `shifa-color-selection-subtle`, `shifa-color-selection-default`, `shifa-shape-radius-control`, `shifa-size-control-md`.
