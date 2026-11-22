# Accordion

Sections of one record that fold away: allergies, current medicines, past visits.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Overlays and navigation · 0.4-06"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-06).

## When to use
- A long record read one part at a time, where a person opens what they need.
- Not for views a person switches between (use Tabs), nor to hide something everyone must see.

## Look
One card (radius 12, a light border), lines between sections. Each header is a 48 px row (32 compact) with the title, an optional count, and a caret at the logical end (the left in Arabic). Open, the caret turns over and the title is heavier, so it is not told by colour alone. A disabled header is grey.

## Behaviour
Enter and Space open and close a section. The up and down arrows move between headers, Home and End reach the first and the last; a disabled header is skipped and never opens. One section open at a time by default; `multiple` keeps several open. The panel opens by its height in 200 ms; at once under reduced motion.

## What you provide (design system)
`items` (`value`, `title`, `content`, `badge`, `disabled`), `defaultValue` (the open values), `multiple`.

In code: `Accordion` (`defaultValue`, `value` with `onValueChange`, `multiple`) holding `AccordionItem` (`value`, `title`, `badge`, `disabled`, any content).

## Tokens
`shifa-color-bg-surface`, `shifa-color-border-default`, `shifa-shape-radius-surface`, `shifa-size-row`, `shifa-color-selection-subtle`, `shifa-color-status-neutral-bg`, `shifa-color-status-neutral-fg`.
