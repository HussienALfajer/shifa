# Form

A complete form: fields, errors after a failed submit, and its actions.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Inputs and forms · 0.4-05", last frame), tested in Arabic RTL and English LTR, light and dark (slice 0.4-05).

## When to use
- Any screen where a person fills fields and sends them. Here a form is drawn in one state from `fields`; in code it is React Hook Form with the same Zod schema as the server (`useShifaForm`, `Form`, `FormField`, `FormSubmit`).

## Look
Fields 16 px apart, two short ones may share a row (`half`). After a failed submit: a danger summary line at the top («حقلان يحتاجان إلى تصحيح») and each error under its field. The actions at the end of the last line: the primary one last (the left in Arabic), a secondary «إلغاء» before it.

## Behaviour (code)
- Nothing is sent while a field is invalid; on submit the first invalid field, in page order, takes focus.
- A Zod message is an i18n key; the app's `translate` gives the text. An error clears as soon as its field is corrected.
- Its fields store nothing in the browser (`autocomplete="off"`, OD-67); a `FormField` on the patient's own booking form may name a token (`autoComplete`).
- During an async submit the button stays busy with its label and a spinner and ignores a second press.

## What you provide
`title`, `summary`, `fields` (`kind`: input, password, textarea, time, otp, radio, checkbox, switch, with each control's own props), `submitLabel`, `cancelLabel`, `submitting`.

## Tokens
The controls' own; the summary: `shifa-color-status-danger-bg`, `shifa-color-status-danger-border`, `shifa-color-status-danger-fg`.
