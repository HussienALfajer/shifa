# PasswordInput

A password, hidden by default, with a show toggle.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Inputs and forms · 0.4-05"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-05).

## When to use
- Sign-in (`autoComplete: 'current-password'`, the default) and choosing a new password (`'new-password'`).

## Look
Input's box with a 36 px eye button inside it at the logical end (the left in Arabic). Typing is always left to right.

## Behaviour
- Tab goes from the field to the toggle; Space or Enter on it shows or hides the password.
- The toggle keeps one name («إظهار كلمة المرور») and says whether it is pressed; the eye icon swaps.
- Submitting the form, resetting it or leaving the page hides the password again. A shown password is never spellchecked. The component never logs or stores it.

## What you provide
`label`, `hint`, `error`, `required`, `disabled`, `autoComplete`.

## Tokens
As Input; the toggle: `shifa-color-icon-muted`, `shifa-color-selection-subtle` (hover), `shifa-color-border-focus`.
