# Popover

A small panel under a button, for a short form or a few details.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Gate components · 0.4-04") and passed the Arabic RTL gate (slice 0.4-04).

## When to use
- A quick note, a filter, a short detail that belongs to one button.
- For a list of actions use Menu; for a choice that stays shown use Select; for a decision use Dialog.

## Look
White, one level above the page: a light border, the dropdown shadow, radius 12, 320 px wide (never wider than the screen). It opens below its button, starting at the button's logical edge (the right in Arabic), and above it when there is no room. It fades in; it does not rise.

## Behaviour
Focus moves to its first field. Escape or a press outside closes it and focus returns to the button. The page stays usable behind it.

## What you provide (design system)
`triggerLabel`, `triggerIcon`, `title` (names it for screen readers), `text`, `defaultOpen`.

In code: `Popover`, `PopoverTrigger` (a Button) and `PopoverContent` (`title`, any content).

## Tokens
`shifa-color-bg-surface`, `shifa-color-border-default`, `shifa-shadow-dropdown`, `shifa-shape-radius-surface`, `shifa-size-popover`.
