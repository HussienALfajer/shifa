# TimeInput

A time of day: an appointment, opening hours.

Coded from the sheets the owner approved on 2026-11-20 (Shifa Components (proposals), page "Inputs and forms · 0.4-05") with OD-62, and on 2026-11-23 (page "Before Phase A · 0.4-12 and 0.4-13", time chooser B) with OD-70 and OD-73; tested in Arabic RTL and English LTR, light and dark, both densities (slices 0.4-05 and 0.4-13).

## When to use
- One time. The clock is the clinic's setting: 24-hour by default (14:30), or `hourCycle: 12` with a ص/م segment (02:30 م; AM/PM in English).
- An appointment: `min` and `max` are the clinic's hours, `step` its slot length (15 minutes by default).

## Look
Input's box with an hour and a minute segment and a clock button at the logical end. A time is a number, so the segments run left to right in both directions. The focused segment is shaded; an empty one shows «--». The clock opens a popup under the field: the times in four columns under «ليلاً», «صباحاً», «بعد الظهر», «مساءً» (only the parts of the day that have times), the chosen one filled green, and a footer «كل 15 دقيقة · 09:00–17:00» with «أقرب وقت».

## Behaviour
- Typing is the main way in. Each segment is a spinbutton named by its unit («الساعة», «الدقائق», «ص/م»). Digits fill a segment and move on; Up and Down change it and wrap; Left and Right move to the segment on that side.
- Arabic-Indic digits (٠٩٤٥) are accepted; Western ones are shown.
- The clock button («اختيار الوقت»), or Alt+Down from a segment, opens the times: from `min` up to, not including, `max` (a 09:00–17:00 day ends at 16:45), every `step` minutes. Focus starts on the chosen time or the next one after now; one press fills the segments and closes; Escape closes. «أقرب وقت» picks the next time after now.
- The value is always "HH:mm" in 24 hours, whatever the clock shows.

## What you provide
`label`, `defaultValue`, `hourCycle`, `min`, `max`, `step`, `hint`, `error`, `required`, `disabled`.

## Tokens
As Input; `shifa-color-selection-strong` (the focused segment), `shifa-color-icon-default` (the clock button), `shifa-color-brand-primary` (the chosen time), `shifa-size-popover`, `shifa-size-slot-list-height`.
