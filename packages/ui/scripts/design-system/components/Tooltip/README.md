# Tooltip

A short explanation in a small bubble above a button, shown on hover and keyboard focus.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Overlays and navigation · 0.4-06", with OD-63), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-06).

## When to use
- The name of an icon button («طباعة الوصفة»), or a few words that add to a button's label («إرسال تذكير عبر واتساب»).
- Never the only copy of something a person needs: a field's explanation goes in its hint, under the field, because a tooltip disappears and never shows on touch.
- Plain text only; for links or buttons use a Popover.

## Look
Dark ink with light text (the text and surface colours swapped, so it inverts in dark), radius 8, 14 px medium text, at most 240 px wide, then the text wraps. It sits above its trigger, centred, 8 px away, and below when asked or when there is no room. No arrow.

## Behaviour
Keyboard focus opens it at once; hover after 500 ms; a touch tap never. Escape closes it and focus stays on the trigger. One tooltip is open at a time. It fades in 150 ms; at once under reduced motion.

## What you provide (design system)
`content`, `triggerLabel` (a text button the tooltip describes; leave it out for an icon button named by `content`), `triggerIcon`, `side`, `defaultOpen`.

In code: `<Tooltip content="…"><Button>…</Button></Tooltip>`, `type="label"` when the tooltip says the trigger's own name; on an icon button, `IconButton`'s `tooltip` prop.

## Tokens
`shifa-tooltip-bg`, `shifa-tooltip-fg`, `shifa-size-tooltip` (240 px), `shifa-shape-radius-input`, `shifa-shadow-dropdown`.
