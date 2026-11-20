# Dialog

A modal dialog for one decision or a short form, over the page.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Gate components · 0.4-04") and passed the Arabic RTL gate (slice 0.4-04).

## When to use
- A confirmation before something that cannot be undone («إلغاء الموعد؟»), or a short form.
- Not for information a person reads on the way (use a card or a message), nor for a long form (use a page).

## Look
One level above the page: radius 16, the modal shadow, the overlay colour behind. The title is a question for a confirmation; one or two sentences under it; a close button at the end of the title (the left in Arabic). Actions sit at the end of the line, the main one last.

## Behaviour
- Focus starts on the first field, else on the safe action («رجوع»), else on the close button. Tab stays inside.
- Escape, the close button and the safe action close it; focus returns to the button that opened it.

## What you provide (design system)
`triggerLabel`, `triggerVariant`, `triggerIcon`, `title`, `description`, `cancelLabel` (the safe action), `confirmLabel` and `confirmVariant` (danger for a deletion), `defaultOpen`.

In code the parts are `Dialog`, `DialogTrigger`, `DialogContent` (`title`, `description`), `DialogActions` and `DialogClose`.

## Tokens
`shifa-color-bg-surface`, `shifa-color-bg-overlay`, `shifa-shadow-modal`, `shifa-shape-radius-overlay`, `shifa-size-dialog` (480 px, never wider than the screen less 16 px a side), `shifa-inset-surface`.
