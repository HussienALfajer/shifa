# Tabs

Switch between views of one thing, such as the summary, visits and prescriptions of a patient record.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Gate components · 0.4-04") and passed the Arabic RTL gate (slice 0.4-04).

## When to use
- Views of the same record that a person moves between often. Steps of a flow are not tabs.
- Up to about six short labels; on a narrow screen the list scrolls sideways.

## Look
The selected tab is leaf green, heavier and underlined with 2 px, so it is not told by colour alone. A disabled tab is pale and says it is disabled to screen readers.

## Behaviour
- Left and Right follow the reading direction: in Arabic, Left goes to the next tab. Home and End reach the ends.
- Moving selects (automatic activation). Only the selected tab is a Tab stop; Tab then goes into the panel.
- A disabled tab is reached by the arrows but never selected.

## What you provide (design system)
- `aria-label`: what the tabs are about («ملف المريض»).
- `items`: `value`, `label`, an optional `panel` text, `disabled`.
- `defaultValue`: the tab selected at first.

In code the parts are `Tabs`, `TabList`, `Tab` and `TabPanel`.

## Tokens
`shifa-color-brand-primary` (selected text and underline), `shifa-color-text-muted`, `shifa-color-selection-subtle` (hover), `shifa-color-border-default` (the line), `shifa-size-control-md`.
