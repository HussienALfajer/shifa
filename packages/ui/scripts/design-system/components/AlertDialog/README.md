# AlertDialog

A question that needs an explicit answer before something that cannot be undone: deleting a prescription, cancelling an appointment, ending a visit.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Overlays and navigation · 0.4-06"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-06).

## When to use
- One question with two answers, one of which acts. For a short form or a decision that can be dismissed, use Dialog.

## Look
The Dialog's panel: 480 px, radius 16, the modal shadow, the overlay colour behind. A round mark before the title (danger: brick with a warning sign; info: blue with an «i»), the title a question, one or two sentences under it. «رجوع» then the action at the end of the line (the left in Arabic), in the danger look for a deletion (brick, never red) or primary for an ordinary confirmation. No close button.

## Behaviour
Focus starts on «رجوع», the least harmful answer, and Tab stays inside. A press outside does nothing. Escape and «رجوع» close it and focus returns to the button that opened it. While the action runs the dialog stays open and cannot be dismissed; the button keeps its label, shows a spinner and says it is busy. If the action fails the dialog stays open and shows the message above the actions. It rises 8 px and fades in 240 ms; it only fades under reduced motion.

## What you provide (design system)
`triggerLabel`, `triggerIcon`, `title`, `description`, `tone`, `cancelLabel`, `actionLabel`, `actionVariant`, `errorText`, `defaultOpen`.

In code: `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent` (`title`, `description`, `tone`), `AlertDialogCancel` and `AlertDialogAction` (`variant`, `onAction`, `errorText`).

## Tokens
`shifa-color-bg-surface`, `shifa-color-bg-overlay`, `shifa-shadow-modal`, `shifa-shape-radius-overlay`, `shifa-size-dialog`, `shifa-color-status-danger-*`, `shifa-color-status-info-*`.
