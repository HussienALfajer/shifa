# Direction B — Calm (الهادئ)

Read [common.md](common.md) first.

## Idea
A quiet professional tool: structure is felt, not seen. Fewer lines, fewer icons, warm low-saturation neutrals, and one thing on the screen that asks for attention. The reference is the current generation of calm work tools (softer separators, dim navigation, tonal layers instead of boxes).

## Values
| Item | Value |
|---|---|
| Radius | 4 (chips) / 6 (inputs, buttons) / 8 (cards) / 12 (dialogs, sheets) |
| Surfaces | tonal layers: cream app, white content, cream-200 side panels; separators are spacing first, then a cream-300 hairline; two shadow levels (popover, dialog) |
| Type | ratio 1.2; data 14/22; body 16/24; headings 19, 23, 28; weights 400, 500, 600 |
| Tables | no vertical lines; hairline between rows; row hover tint; compact 32 px, comfortable 44 px |
| Icons | Phosphor regular, 18 px; only where they add recognition; navigation icons dimmed until active |
| Motion | 100 ms hover and press, 150 ms popovers, 200 ms panels, 240 ms dialogs; ease-out in, faster out |
| Numerals | queue number 36 px, weight 500, mint soft fill for the current one |

## Character
- Navigation is a night-green sidebar, dimmer than the content; the active item has a gold mark at the start edge.
- The patient in the room is a white panel with a mint tint; the rest of the queue is a quiet list.
- Status as a pill with icon and word; the fill is soft, the text carries the colour.
- A command palette hint (Ctrl K) in the top bar.
- The doctor screen is two panes: the note large and central, the rest in a collapsible side pane.
- The booking screen uses the same soft layers, with 16–17 px body and 12 px radius sheets.

## Risks to watch
Hairlines and tints can vanish on cheap panels: every separator must still read at 3 : 1 where it marks an input, and row boundaries must survive a washed-out screen (test with contrast lowered).
