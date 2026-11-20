# TimeInput

A time of day: an appointment, opening hours.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Inputs and forms · 0.4-05") with OD-62, tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-05).

## When to use
- One time. The clock is the clinic's setting: 24-hour by default (14:30), or `hourCycle: 12` with a ص/م segment (02:30 م; AM/PM in English).

## Look
Input's box with an hour and a minute segment and a clock icon at the logical end. A time is a number, so the segments run left to right in both directions. The focused segment is shaded; an empty one shows «--».

## Behaviour
- Each segment is a spinbutton named by its unit («الساعة», «الدقائق», «ص/م»). Digits fill a segment and move on; Up and Down change it and wrap; Left and Right move to the segment on that side.
- Arabic-Indic digits (٠٩٤٥) are accepted; Western ones are shown.
- The value is always "HH:mm" in 24 hours, whatever the clock shows.

## What you provide
`label`, `defaultValue`, `hourCycle`, `min`, `max`, `hint`, `error`, `required`, `disabled`.

## Tokens
As Input; `shifa-color-selection-strong` (the focused segment), `shifa-color-icon-muted`.
