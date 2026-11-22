# Avatar

A person's picture beside their name: a patient in a list, the doctor on a card, the team on duty.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Data display and table · 0.4-07", OD-64), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-07).

## When to use
- Wherever a person is named and a face helps to find them.
- Never as the only way to tell who someone is: the name stays beside it or is its accessible name.

## Look
A circle: xs 24, sm 32 (table rows, groups), md 40 (beside a name, default), lg 56 (a card), xl 80 (a record's header). Without a picture: the first letters of the first and last names on one of the six avatar hues (green, gold, blue, violet, cyan, sand; never red, no meaning), picked from the name, so the same person has the same colour everywhere. «ال» and titles such as «د.» are skipped; Arabic letters stand apart («س خ»); a Latin name gives two capitals, isolated; one name gives one letter. A group overlaps toward the logical end with a white ring and ends with «+3».

## Behaviour
The picture enters only once it has loaded; a slow or broken one leaves the initials. The full name is read; a group is named and its rest is read as «و3 آخرون».

## What you provide (design system)
`name`, `src`, `size`; for a group `people` (`name`, `src`), `max`, `label`.

In code: `Avatar` (`name`, `src`, `size`) and `AvatarGroup` (`label`, `people` with `id`, `max`, `size`, `moreLabel`); `avatarInitials(name)` gives the letters.

## Tokens
`shifa-color-avatar-*-bg`, `-fg`, `shifa-size-avatar-xs` to `-xl`, `shifa-color-bg-surface-raised`, `shifa-color-border-default`.
