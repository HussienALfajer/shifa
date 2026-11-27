# RecordHeader

A record's identity at the top of its page: who the patient is, the file number, the main facts and the actions.

Coded from the sheet the owner approved on 2026-11-27 (Shifa Screens · Clinic web, page "Proposals", `A03SheetRecordHeader`, slice A-03-01), tested in Arabic RTL and English LTR, light and dark, both densities.

## When to use
- The top of a record's page (a patient's chart), and compact inside a panel (the file just saved).
- Not for a list of records (use RecordList), not for a section of details (use DescriptionList).

## Look
A card: the avatar, the title (h1 on a page, h2 when `compact`), the record number in a gold tag («ملف 1043»: a gold ring and fill, the text in the text colour), badges, the facts under a rule (label over value, as many 150 px columns as fit), a muted meta line, then the actions at the end: buttons and at most one menu, or a read-only note. `muted` (archived or merged) takes the raised surface and drops the actions. `compact` shows no facts and a larger number. On a phone the actions go under the title and the facts take one column.

## Behaviour
A region named for the record (`aria-label`, the title by default). A badge with `tip` is a focusable trigger whose Tooltip opens at once on focus; the badge's own text («~40 سنة») always says it, the tooltip only explains. The number is read «ملف 1043»; phones and codes are isolated left to right. The menu is the system's Menu (a bottom sheet on touch). Loading shows a named skeleton and marks the region busy.

## What you provide (design system)
`title`, `aria-label`, `avatarName`, `idLabel`, `idValue`, `badges` (`label`, `tone`, `icon`, `tip`), `facts` (`label`, `value`, `kind`), `meta`, `actions` (buttons by `label`, `icon`, `variant`, and one `{ menu: true, ...Menu's props }`), `readOnlyNote`, `muted`, `compact`, `loading`.

In code: `actions` is any React content (Buttons and one Menu).

## Tokens
`shifa-card-bg`, `shifa-card-border`, `shifa-card-radius`, `shifa-card-padding`, `shifa-card-shadow`, `shifa-color-brand-accent`, `shifa-color-brand-accent-soft`, `shifa-color-bg-surface-raised`, `shifa-size-avatar-md`, `-lg`, `shifa-width-37-5`, `shifa-width-80`.
