# QrCode

The authenticator's `otpauth://` link drawn as a code a camera reads, for TOTP enrolment (and the new link of a reset).

Coded from the sheet the owner approved on 2026-11-24 (Shifa Screens · Clinic web, page "A-01-07 Sign-in batch", ADR-0046), tested in Arabic RTL and English LTR, light and dark, both densities (slice A-01-07).

## When to use
- Beside the manual key, on desktop and tablet screens of enrolment.
- On phones it is folded behind «عرض رمز QR لمسحه من جهاز آخر»; the screen leads with «فتح في تطبيق المصادقة» (the `otpauth://` link) and the key with copy.
- Never for anything else: a code that only the person's own camera should read.

## Look
A 150 px square: a white plate with ink modules in both themes (many readers cannot read an inverted code), a quiet zone of four modules inside it, radius 8 and the default border. Never mirrored in RTL. While the key is being made, a large spinner sits in the same square on the raised surface.

## Behaviour
Encoded in the page (error correction M); the link is never sent to a service, since it carries the secret key, and never shown as text. An error is the screen's Callout with «إعادة المحاولة», never an empty code.

## What you provide
`value` (the `otpauth://` link; absent: loading) and `label` (what screen readers hear: «رمز QR لإضافة حساب شفاء إلى تطبيق المصادقة»).

## Tokens
`shifa-color-scan-bg` (the plate), `shifa-color-scan-fg` (the modules), `shifa-color-bg-surface-raised` (loading), `shifa-color-border-default`, `shifa-shape-radius-input`, `shifa-width-37-5`.
