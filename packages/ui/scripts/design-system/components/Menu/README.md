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

## Groups (A-01-08)
Added from the sheet `MenuGroupsSheet` the owner approved on 2026-11-24 ("Shifa Screens · Clinic web", page "A-01-08 Team batch"), for the clinic and branch switcher:
- A group of rows under a small muted label that names it, a separator between groups.
- A radio row: an avatar (a clinic) or an icon (a branch), the name, a second line (role, scope, last activity, or why it is disabled), a warning badge («موقوفة»), the check of the current row at the logical end in the brand colour and heavier text; while busy a spinner in its place. Choosing a row keeps the menu open until the caller closes it (a switch waits for the server).
- A note row: information only (an invitation answered on its own link), dashed outline; a disabled item, read aloud, never run.
- On a phone (`presentation: 'sheet'`): the same rows rising from the bottom under a grabber, the `title` and a close button; the title names the menu.

## What you provide (design system)
`triggerLabel` (or `triggerIcon` with `aria-label` for an icon-only button), `presentation` and `title` for a sheet, and `items`: actions (`value`, `label`, `icon`, `danger`, `disabled`, `hint`), `{ separator: true }`, submenus (`label`, `icon`, `items`), radio groups (`group`, `value`, `radios`: `value`, `label`, `avatar`, `icon`, `description`, `badge`, `disabled`, `busy`) and note groups (`group`, `notes`).

In code: `Menu` (`onAction`, `presentation`), `MenuTrigger`, `MenuContent` (`title`), `MenuItem` (`closeOnSelect`), `MenuSeparator`, `Submenu`, `MenuGroup`, `MenuRadioGroup`, `MenuRadioItem`, `MenuNote`.

## Tokens
`shifa-size-row`, `shifa-color-selection-subtle`, `shifa-color-status-danger-fg`, `shifa-color-text-disabled`, `shifa-shadow-dropdown`, `shifa-shape-radius-surface`.
