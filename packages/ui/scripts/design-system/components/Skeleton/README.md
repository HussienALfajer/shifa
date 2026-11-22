# Skeleton

Placeholders that stand where content of a known shape will appear: a person's row, a card, lines of text, a picture.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Data display and table · 0.4-07"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-07).

## When to use
- Loading content whose layout is known, so the page does not jump when it arrives.
- Not for a wait without a shape (use Spinner).

## Look
Blocks (radius 4), 12 px text lines (fully rounded) and circles, on the raised surface colour. Lines start at the logical start (the right in Arabic) and the last one is shorter, like real text. A soft pulse of 1.2 s each way; still under reduced motion.

## Behaviour
The pieces are hidden from screen readers. The group around them is a busy status named by `label` («جارٍ تحميل بطاقة المريض»). The data table draws its own skeleton rows while it loads.

## What you provide (design system)
`label`, `avatar` (a circle and two short lines), `lines`, `block`.

In code: `Skeleton` (`shape` block, line or circle, sized with token classes), `SkeletonText` (`lines`) and `SkeletonGroup` (`label`) composed freely.

## Tokens
`shifa-color-bg-surface-raised`, `shifa-shape-radius-mark`, `shifa-motion-easing-standard`.
