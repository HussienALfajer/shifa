# Button

A button runs one action: primary for the one main action of a view, secondary for the others, ghost for light actions inside cards and tables, danger for actions that delete or cancel.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page Button) and tested in Arabic RTL and English LTR, light and dark, both densities, with axe and screenshots.

## When to use
- **primary**: once per view (حفظ الزيارة، احجز، ادفع). Leaf green, white text.
- **secondary** (the default): every other action (طباعة، رجوع، إلغاء in a dialog).
- **ghost**: light actions that sit inside a card or a table row (تعديل). Green text, no box until hovered.
- **danger**: deletes or cancels something (إلغاء الموعد). Brick, never red: red is for critical clinical alerts only.
- Dialog actions end with the primary button at the end of the line (the left in Arabic): «إلغاء» then «حفظ».

## What you provide
- `children`: one verb, the clinic's words, no exclamation mark. A Latin part (PDF, A4) goes in `<bdi>`.
- `startIcon`: an icon before the label, on the logical start; `endIcon` after it ("التالي" with `arrow-forward`). Icons that point a direction mirror in RTL.
- Icon only: leave `children` out and give `aria-label` and `startIcon`; the button is square.
- `size`: `sm` 36, `md` 44 (default), `lg` 52 px; 28, 32, 40 in the compact density (pointer devices only).
- `disabled`: leaves the tab order; text stays readable (3 : 1) and the state is not shown by colour alone.
- `loading`: keeps the label and its place, shows a spinner before it, announces it is busy, stays focusable and ignores presses (no double submit). A press that returns a Promise does the same until it settles.

## States
Rest, hover (selection tint or the darker brand step), focus (2 px green outline and halo, at once), pressed (1 px down; none under reduced motion), disabled, loading. In the tokens, pressed shares the hover colour.

## Tokens
`shifa-button-height`, `shifa-button-padding-inline`, `shifa-button-radius`, `shifa-button-primary-bg`, `-bg-hover`, `-bg-pressed`, `-fg`; secondary uses `shifa-color-bg-surface` and `shifa-color-border-strong`; ghost `shifa-color-brand-primary` and `shifa-color-selection-*`; danger `shifa-color-status-danger-solid` and `-on-solid`, hover `shifa-color-status-danger-fg`.
