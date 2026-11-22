# Toast

A short message after something happened: a prescription saved, an appointment moved, a reminder not yet sent.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Overlays and navigation · 0.4-06", with OD-63), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-06).

## When to use
- To confirm an action a person just took, or to say something happened in the background.
- Not for a question (AlertDialog), nor for an error inside a form (the field's error), nor for something that must stay on the screen (a card or a banner on the page).

## Look
A white card, radius 12, a light border and the dropdown shadow, 360 px (the screen less 16 px a side on a phone). Success, info, warning and error carry their icon in the status colour before the words; a plain toast has none. A title, one optional line under it, one optional action (a ghost button with one verb), and a close button at the end of the line. At the bottom of the screen, at the logical end (the bottom left in Arabic); three at most, the newest at the bottom; when a fourth comes, the oldest steps out and waits (its timer stopped) until there is room again.

## Behaviour
Success and info close after 5 s, warning after 8 s, errors stay until closed. The timer stops while the pointer or focus is on a toast. Screen readers hear a toast once, politely; an error at once. F6 moves focus to the newest toast and back; Escape closes the focused one. It rises 8 px and fades in 200 ms, and fades out in 150 ms; only fades under reduced motion.

## What you provide (design system)
`toasts` (`type`, `title`, `description`, `actionLabel`), `triggerLabel`. This card keeps its toasts on screen so a drawing can show them.

In code: one `ToastProvider` beside the other providers (`label`, `closeLabel`), then `useToast().show({ type, title, description, action, duration })` and `dismiss(id)`. The text is the caller's, translated before it is shown.

## Tokens
`shifa-size-toast` (360 px), `shifa-color-bg-surface`, `shifa-color-border-default`, `shifa-shadow-dropdown`, `shifa-shape-radius-surface`, `shifa-color-status-*-fg`, `shifa-z-toast`.
