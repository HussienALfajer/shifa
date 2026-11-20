# Icon

An icon by name from the curated set: Phosphor (MIT) drawn duotone for interface actions and states, Healthicons (CC0) for medical glyphs.

## When to use
- Next to a word, never instead of one for a status (a status is a pill with an icon and a word).
- `sm` (20 px) in rows and controls, `md` (24 px) in navigation and cards.
- It takes the colour of its text: `shifa-color-icon-default` beside text, the button's text colour inside a button.

## What you provide
- `name`: one of the curated names (`calendar-plus`, `printer`, `tooth`…, see the Icons group and `IconName`). A new icon is added in `packages/ui` first, never drawn on a canvas.
- `label`: only when the icon carries meaning alone; without it the icon is hidden from screen readers.

## Direction
Only `arrow-forward`, `arrow-back`, `caret-forward`, `caret-back` and `sign-out` mirror in RTL ("forward" points to the end of the line). Clocks, media controls, medical glyphs and the logo never mirror.

## Tokens
`shifa-size-icon-sm`, `shifa-size-icon-md`, `shifa-color-icon-default`, `shifa-color-icon-muted`. The duotone second tone is 20 % of the stroke for now; the mint and gold `shifa-color-icon-tone-*` tones join with the navigation components.
