# Switch

A setting that acts at once: WhatsApp reminders, online booking on or off.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Inputs and forms · 0.4-05"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-05).

## When to use
- A setting saved the moment it changes. A choice sent with a form is a Checkbox.

## Look
A 44 × 24 track at the logical start of the line, the text after it (or, in a settings row, the text first and the switch at the end). Off: grey, the thumb at the start. On: green, the thumb at the logical end (the left in Arabic) with a tick in it, so the state is told by position and mark, not by colour alone. 150 ms, off under reduced motion.

## Behaviour
- Space toggles; Enter never does. A press on the text toggles.
- No error message: a failed save turns it back and the screen says why.

## What you provide
`children` (the text), `defaultChecked`, `description`, `disabled`.

## Tokens
`shifa-color-brand-primary`, `shifa-color-border-strong`, `shifa-color-bg-surface` (thumb), `shifa-shadow-card`, `shifa-shape-radius-pill`.
