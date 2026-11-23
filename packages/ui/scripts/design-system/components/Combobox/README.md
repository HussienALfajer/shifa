# Combobox

Search a long list as you type: patients, medicines, diagnoses.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Gate components · 0.4-04") and passed the Arabic RTL gate (slice 0.4-04).

## When to use
- A list too long to scan, found by name or number. A short list is a Select.

## Look
A search field with a magnifier at its logical start and a clear button at its end. Suggestions open below it, at its logical start: the name with the typed part in bold (never a colour), and a muted second line («ملف 1042»). When nothing matches, the list says so.

## Behaviour
- A name matches when one of its words starts with the typed text, through the shared Arabic folding (OD-40, slice 0.4-12): «احمد» finds «أحمد», «فاطمه» finds «فاطمة», harakat and tatweel do not matter.
- Once typing pauses, screen readers hear how many names match: «3 نتائج», «نتيجة واحدة», «نتيجتان», «لا نتائج» in Arabic, «3 results» in English.
- Focus stays in the field; Up and Down move the highlight; Enter chooses and the field shows the name; Escape closes.
- The clear button («مسح») empties the field.

## What you provide
`label`, `items` (`value`, `label`, `description`, `disabled`), `emptyMessage`, `placeholder`, `defaultValue` (or `value` with `onValueChange` in code), `hint`, `error`, `disabled`.

## Tokens
`shifa-input-height`, `shifa-input-border`, `shifa-input-bg`, `shifa-size-row`, `shifa-color-selection-subtle`, `shifa-color-text-muted`, `shifa-shadow-dropdown`.
