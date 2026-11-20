# DatePicker

A date, typed or picked from a calendar: appointments, follow-ups, birth dates.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Gate components · 0.4-04") and passed the Arabic RTL gate (slice 0.4-04).

## When to use
- One date. Times use the time input (0.4-05); ranges come later.

## Look
A field showing dd/mm/yyyy in Western digits (24/11/2026, OD-61) with a calendar button at its logical end. The calendar opens below the field at its logical start: the month and year as a heading with Levantine names in Arabic («تشرين الثاني 2026»), previous and next arrows that mirror, the week from Saturday. Today has a green ring; the chosen day is filled green; days out of range are pale.

## Behaviour
- Type the date (Arabic-Indic digits accepted) or pick it. Gregorian only.
- In the calendar the arrows follow the reading direction (Left is the next day in Arabic); Up and Down move a week; Page Up and Page Down a month.
- Enter chooses and closes; Escape closes and keeps the date. Focus returns to the calendar button.

## What you provide
`label`, `defaultValue` (an ISO date «2026-11-24», or `value` with `onValueChange` in code), `min`, `max`, `hint`, `error`, `disabled`.

## Tokens
`shifa-input-height`, `shifa-input-border`, `shifa-color-brand-primary` (today, the chosen day), `shifa-color-brand-on-primary`, `shifa-color-text-disabled`, `shifa-size-popover`, `shifa-shadow-dropdown`.
