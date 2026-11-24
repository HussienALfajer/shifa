# CodeList

The ten recovery codes, shown once: after TOTP enrolment, and after «إنشاء رموز جديدة» on My account.

Coded from the sheet the owner approved on 2026-11-24 (Shifa Screens · Clinic web, page "A-01-07 Sign-in batch", ADR-0046), tested in Arabic RTL and English LTR, light and dark, both densities (slice A-01-07).

## When to use
- Only for codes the person must keep and will never see again. Put a «حفظتُ الرموز» checkbox after it before the screen lets them go on.

## Look
Two columns laid out left to right in both directions; each code numbered (muted), in the mono font with tabular digits, in a cell on the raised surface with the default border and radius 8. Comfortable 8 × 12 cells with an 8 gap; compact 4 × 8 with a 4 gap. Under it two small buttons: «نسخ الكل» and «طباعة».

## Behaviour
Copy puts one code per line, without numbers; the button then reads «نُسخت الرموز العشرة» with a tick for three seconds. Print prints only the sheet: light in both themes, the logo, «طُبعت 24/11/2026», the person and the clinic, the codes with a box to cross out each, and the advice to keep it away from the phone. The codes are never stored in the browser or sent anywhere; they go with the screen. No file download.

## What you provide
`codes`, `label` (the list's name), `print` (`title`, `who`, `date`, `note`, `logoSrc`; without it there is no «طباعة»), and the button texts if they differ.

## Tokens
`shifa-color-bg-surface-raised`, `shifa-color-border-default`, `shifa-shape-radius-input`, `shifa-color-text-muted` (numbers), `font-mono`; the print sheet `shifa-color-scan-bg` and `shifa-color-scan-fg` (fixed light paper and ink).
