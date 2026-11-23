# DatePicker

A date, typed or picked from a calendar: appointments, follow-ups, birth dates.

Coded from the sheets the owner approved on 2026-11-20 (Shifa Components (proposals), page "Gate components · 0.4-04") and 2026-11-23 (page "Before Phase A · 0.4-12 and 0.4-13": typed entry A, quick month and year B), tested in Arabic RTL and English LTR (slices 0.4-04 and 0.4-13).

## When to use
- One date. Times use the time input; ranges come later.
- A birth date: `max` today, `maxMessage` «تاريخ الميلاد لا يكون بعد اليوم», and `showAge` for the age under the field.

## Look
A field of three segments day / month / year (14 / 03 / 1987), left to right in both directions with placeholders «يوم / شهر / سنة», and a calendar button at its logical end. Under a complete, valid date its weekday and Levantine month confirm it («السبت 14 آذار 1987», with «· 39 سنة» when `showAge`). The calendar opens below the field at its logical start: the month and year as a heading button with a caret, previous and next arrows that mirror, the week from Saturday. Today has a green ring; the chosen day is filled green; days out of range are pale. The heading opens one panel in the same popup: a column of years at the logical start beside a 3 × 4 grid of month names, and «هذا الشهر» below.

## Behaviour
- Type the date: digits fill a segment and move on («4» becomes 04 at once); `/`, `-`, `.` or a space move on; Backspace in an empty segment goes back; Up and Down change a segment. Arabic-Indic digits are accepted. A pasted 14/03/1987, 14-3-1987, 14.3.1987 or 1987-03-14 fills all three.
- Errors in Arabic, on leaving the field or at once for an impossible date: «أكمل التاريخ: السنة ناقصة», «شباط 1987 فيه 28 يوماً», «اكتب السنة بأربعة أرقام: 1987» (a two-digit year is never guessed), «اختر تاريخاً من … فصاعداً», «اختر تاريخاً حتى …» or `maxMessage`. An error from the form wins.
- A typed date opens the calendar on its month; a chosen day fills the segments.
- In the calendar the arrows follow the reading direction (Left is the next day in Arabic); Up and Down move a week; Page Up and Page Down a month. Enter chooses and closes; Escape closes and keeps the date. Focus returns to the calendar button.
- Month and year panel: press the heading, then a year, then a month: two presses from November 2026 to March 1987. In the years Up/Down move a year, Page Up/Down ten, typing «1987» jumps there; Enter goes to the months. Escape steps back (months, years, days) without closing. Months outside `min`/`max` are pale and cannot be chosen.

## What you provide
`label`, `defaultValue` (an ISO date «2026-11-24», or `value` with `onValueChange` in code), `min`, `max`, `maxMessage`, `showAge`, `hint`, `error`, `disabled`.

## Tokens
`shifa-input-height`, `shifa-input-border`, `shifa-color-brand-primary` (today, the chosen day, year and month), `shifa-color-brand-on-primary`, `shifa-color-selection-strong` (the focused segment), `shifa-color-text-disabled`, `shifa-size-popover`, `shifa-size-year-list-width`, `shifa-size-year-list-height`, `shifa-shadow-dropdown`.
