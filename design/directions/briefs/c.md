# Direction C — Warm (الدافئ)

Read [common.md](common.md) first.

## Idea
A welcoming place. Generous cards, rounder shapes, larger text and a little gold, so the patient app feels kind and the clinic screens feel human. The reference is consumer care apps, tempered by public-service plainness: big text, obvious buttons, nothing clever.

## Values
| Item | Value |
|---|---|
| Radius | 8 (inputs, chips) / 12 (buttons, cards) / 16 (dialogs, sheets); pills for status |
| Surfaces | white cards on cream with one small soft shadow (0 1px 2px, low opacity) and a light border; popovers and dialogs one level higher |
| Type | ratio 1.25; data 15/24; body 16/26 (18/28 on the phone); headings 20, 25, 31; weights 400, 600, 700 for display numbers |
| Tables | card rows with 8 px gaps in comfortable; plain ruled rows in compact (32 px) |
| Icons | Phosphor duotone, 20–24 px, mint second tone; gold second tone only for the current item |
| Motion | 150 ms hover and press, 200 ms popovers, 240 ms dialogs and sheets; gentle ease-out, 8 px rise |
| Numerals | queue number 44 px, weight 700, in a round badge |

## Character
- Navigation is a night-green sidebar with large labelled items.
- The patient in the room is a large card with a duotone icon, the name at 22 px and a wide green button.
- Status as a rounded pill with a filled icon.
- A small jasmine or eight-point star drawing in empty states only.
- The doctor screen is cards in two columns; the tablet layout stacks them with 48 px controls.
- The booking screen is where this direction leads: big day and time chips, a friendly confirmation with the queue number and the clinic's address.

## Risks to watch
Wastes space on the reception queue: show at least ten rows at 1366 × 768 in compact. Keep the shadow small enough to cost nothing on low-end PCs and to be replaced by the border in dark.
