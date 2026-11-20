# Direction A — Precise (الدقيق)

Read [common.md](common.md) first.

## Idea
A clinical ledger. The most information in the least space, with nothing that is not a line, a number or a word. The reference is the dense, border-first clinical design system (3–5 px radius, 1 px borders, almost no shadow) joined with ledger habits: ruled tables and large tabular numerals.

## Values
| Item | Value |
|---|---|
| Radius | 2 (chips, inputs) / 4 (buttons, cards) / 6 (dialogs) |
| Surfaces | 1 px border on everything; white cards on cream; shadow only on popovers and dialogs (one level) |
| Type | ratio 1.125; data 14/20; body 15/22; headings 18, 20, 24; weights 400 and 600 |
| Tables | ruled rows (1 px lines), sticky header, no zebra; compact 32 px, comfortable 44 px |
| Icons | Phosphor light, 16 px in rows and 20 px in toolbars; few, always with a label |
| Motion | 70 ms hover and press, 110 ms popovers, 150 ms dialogs; fade and 4 px shift only |
| Numerals | queue number set large (32–40 px, weight 600) in a ruled box |

## Character
- Navigation as a narrow night-green rail with labels under icons.
- The patient in the room is a ruled panel at the top of the queue, not a card that floats.
- Status as a small square-cornered tag: icon, word, soft fill.
- Gold only as a 2 px rule beside the current row.
- The doctor screen is a three-column ledger: banner across the top, note in the middle, prescription and history at the side.
- The booking screen keeps the same squareness but with 16 px body text and 48 px buttons.

## Risks to watch
May feel cold: keep the cream background and warm ink. Arabic at 14 px needs line height 20 px or more; check tashkeel is not clipped in 32 px rows.
