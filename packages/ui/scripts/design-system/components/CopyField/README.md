# CopyField

A value shown once to copy or send: the owner's setup link on admin web, a member's link on clinic web.

Coded from the sheet the owner approved on 2026-11-24 (Shifa Screens · Clinic web, page "A-01-10 Account batch", `CopyFieldSheet`, ADR-0046), tested in Arabic RTL and English LTR, light and dark, both densities (slice A-01-10).

## When to use
- Only for a value the person must pass on and will not see again (a one-time link). For a TOTP key or recovery codes use the enrolment screens and CodeList.

## Look
The field box on the raised surface (read-only), the value left to right in the mono font in both directions; «نسخ» as a small ghost button inside the box at the logical end. Under it, optionally, «إرسال عبر واتساب» (a small secondary button that opens a new tab) and the expiry line in muted text. Multiline wraps a long value on a phone; `iconOnly` shows the copy as its icon. Disabled mutes the value and hides the share.

## Behaviour
Focus selects the whole value. After a copy the button reads «نُسخ» with a tick for three seconds and a status announces it once. If the clipboard refuses, the value is selected and a warning line asks to copy it by hand. The value is never stored in the browser or sent anywhere by the component.

## What you provide
`value` (absent: loading), `label`, `share` (`href`, `label`), `expiry`, and the texts if they differ.

## Tokens
`shifa-color-bg-surface-raised`, `shifa-input-border`, `shifa-shape-radius-input`, `font-mono`, `shifa-color-text-muted` (expiry, disabled value), `shifa-color-status-warning-fg` (refused copy).
