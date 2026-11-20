# Menu

A list of actions that opens from a button.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Gate components · 0.4-04") and passed the Arabic RTL gate (slice 0.4-04).

## When to use
- Actions on one thing (an appointment row): «تعديل الموعد», «طباعة», «إلغاء الموعد».
- Not for a choice that stays shown (Select), nor for fields (Popover).

## Look
48 px rows (32 compact). An icon on the logical start; a submenu chevron pointing to the logical end; the item under the keyboard or pointer in the light selection tint. The danger item is brick (never red), last, after a separator. A disabled item is pale and says why at the end of its row.

## Behaviour
- Up and Down move; Home and End reach the ends. Typing a letter (Arabic too) moves to the item that starts with it.
- The forward arrow of the reading direction (Left in Arabic) opens a submenu beside the item; the other arrow closes it.
- Enter runs the item and closes the menu; Escape closes it. Focus returns to the button.
- A disabled item is reached and announced, but never runs.

## What you provide (design system)
`triggerLabel` (or `triggerIcon` with `aria-label` for an icon-only button) and `items`: actions (`value`, `label`, `icon`, `danger`, `disabled`, `hint`), `{ separator: true }`, and submenus (`label`, `icon`, `items`).

In code: `Menu` (`onAction`), `MenuTrigger`, `MenuContent`, `MenuItem`, `MenuSeparator`, `Submenu`.

## Tokens
`shifa-size-row`, `shifa-color-selection-subtle`, `shifa-color-status-danger-fg`, `shifa-color-text-disabled`, `shifa-shadow-dropdown`, `shifa-shape-radius-surface`.
