# Drawer

A panel to edit or look at a record without leaving the page: an appointment, a patient's details, a filter.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Overlays and navigation · 0.4-06", with OD-63), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-06).

## When to use
- A short form or details that belong to the page behind (`side="end"`, the default).
- A navigation list on a narrow screen (`side="start"`).
- Actions or a form on a tablet or phone (`side="bottom"`).
- Not for a question that needs an answer (AlertDialog) or a long task (a page).

## Look
White, the overlay shadow, the overlay colour behind. From the side: 400 px wide (never wider than the screen), the full height, radius 16 on its inner edge only. From the bottom: the full width, at most 5/6 of the screen high, radius 16 on its top corners, a grabber at the top. A header with the title (and a sentence) and a close button at its end; the body scrolls; the actions sit at the end of the last line, the main one last.

## Behaviour
Focus moves to the first field, else to the close button, and stays inside. Escape, the close button, a press outside or a drag toward its edge close it, and focus returns to the button that opened it. It slides in 240 ms; it fades under reduced motion. A confirmation over it (an AlertDialog placed beside the panel) makes it inert and hides it from screen readers until the answer (its own announcements wait too); a confirmation placed inside the body is left exposed.

## What you provide (design system)
`triggerLabel`, `triggerIcon`, `side`, `title`, `description`, `fields` (`label`, `value`), `cancelLabel`, `saveLabel`, `defaultOpen`.

In code: `Drawer` (`side`), `DrawerTrigger`, `DrawerContent` (`title`, `description`, `closeLabel`, `handleLabel`), `DrawerActions`, `DrawerClose`.

## Tokens
`shifa-size-drawer` (400 px), `shifa-color-bg-surface`, `shifa-color-bg-overlay`, `shifa-shadow-overlay`, `shifa-shape-radius-overlay`, `shifa-color-border-default`, `shifa-color-border-strong` (the grabber).
