# RadioGroup

One of a few choices, all visible: visit type, sex.

Coded from the sheet the owner approved on 2026-11-20 (Shifa Components (proposals), page "Inputs and forms · 0.4-05"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-05).

## When to use
- Two to five choices a person should see at once. More, or a long list: Select or Combobox.
- `orientation: 'horizontal'` for two or three short choices (أنثى / ذكر); vertical is the default.

## Look
A 20 px ring at the logical start of each line, the text after it; checked is a green ring with a green dot. The group's label is above it; its error (a warning icon and text) under it, with a danger border on every ring.

## Behaviour
- The group is one Tab stop: the checked option, else the first.
- Arrows move and check. In a row they follow the reading direction: Left is the next option in Arabic, Right in English. They skip a disabled option and wrap from the last to the first.

## What you provide
`label`, `items` (`value`, `label`, `description`, `disabled`), `defaultValue`, `orientation`, `hint`, `error`, `required`, `disabled`. In code the items are `Radio` parts.

## Tokens
`shifa-color-brand-primary`, `shifa-color-border-strong`, `shifa-shape-radius-pill`, `shifa-size-target-min`, `shifa-color-status-danger-fg`.
