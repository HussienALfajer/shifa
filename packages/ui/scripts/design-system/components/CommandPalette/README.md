# CommandPalette

One search over patients and actions: type part of a name, a record number or an action, then Enter.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Overlays and navigation · 0.4-06", with OD-63), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-06).

## When to use
- To reach a patient or an action from anywhere in the clinic system without walking the menus.
- Not for choosing a value in a form (use Combobox) or filtering a list on the page (use a search Input).

## Look
A modal panel 560 px wide (never wider than the screen less 16 px a side), near the top of the screen, radius 16, the modal shadow, the overlay colour behind. The search field is 56 px high with the lens at the logical start and an Esc key at the end. Options come in titled groups (patients, actions), each 48 px (32 compact) with an icon, a name and a second line; the active option is in the selection colour. The matched part of a name is marked with a light gold background and heavier text. A line of keyboard hints at the bottom.

## Behaviour
Focus stays in the field. Typing filters; the up and down arrows move the active option; Enter runs it and closes the palette; Escape clears the text, then closes it, and focus returns to what opened it. An Arabic query finds a name whatever its diacritics, tatweel or alef form («احمد» finds «أحمد» and «الأحمد»). Nothing matching shows the empty state. It rises 8 px and fades in 200 ms; at once under reduced motion. The shortcut that opens it belongs to the app shell (Phase A).

## What you provide (design system)
`triggerLabel`, `title` (names the panel for screen readers), `inputLabel` (the field's name and placeholder), `groups` (`label`, `items`: `value`, `label`, `description`, `icon`), `emptyText` (with `{query}`), `defaultOpen`.

In code: the same, with `onAction(value)`, `emptyText(query)`, `emptyAction`, `normalise` (Phase A passes the name normaliser), `open` with `onOpenChange`.

## Tokens
`shifa-size-command` (560 px), `shifa-color-bg-surface`, `shifa-color-bg-overlay`, `shifa-shadow-modal`, `shifa-shape-radius-overlay`, `shifa-color-selection-default`, `shifa-color-brand-accent-soft` (the mark), `shifa-size-row`.
