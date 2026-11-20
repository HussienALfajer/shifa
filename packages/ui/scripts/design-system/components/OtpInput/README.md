# OtpInput

A one-time code sent by message: sign-in, confirming a phone number.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Inputs and forms · 0.4-05") with OD-62, tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-05).

## When to use
- A short code of digits only (6 by default, `length` for others).

## Look
Six large slots, 48 × 52 px, the same in both densities (it is used on phones). A code is a number and numbers never mirror: the slots run left to right in both directions; in Arabic the row sits at the line's start (the right). The active slot shows the green ring and a caret. An error marks every slot with a danger border.

## Behaviour
- One field for screen readers («رمز التحقق, 6 أرقام») with `autocomplete="one-time-code"`, so a phone can fill it from the message.
- Arabic-Indic (٤٨٢٠٧١) and Western digits are accepted; the value keeps Western ones. Letters are ignored.
- Pasting the whole code (482-071) fills every slot. Left and Right move to the slot on that side; Backspace goes back one.

## What you provide
`label`, `length`, `defaultValue`, `hint`, `error`, `disabled`.

## Tokens
`shifa-input-border`, `shifa-input-bg`, `shifa-input-radius`, `shifa-color-border-focus`, `shifa-shadow-focus`, `shifa-color-status-danger-fg`.
