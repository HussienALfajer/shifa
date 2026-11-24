# Callout

A message inside the page that stays while its cause holds: a lock with its countdown, a blocked network, a server out of reach, a session that ended, a suspended clinic, few recovery codes left.

Coded from the sheet the owner approved on 2026-11-24 (Shifa Screens · Clinic web, page "A-01-07 Sign-in batch", ADR-0046), tested in Arabic RTL and English LTR, light and dark, both densities (slice A-01-07).

## When to use
- Under the page title, above the fields, for a state of the page.
- Not for a passing confirmation (use Toast), not for one field (its error goes under the field), not for a question (use AlertDialog).

## Look
A row on the tone's background with its border, radius 8 like the fields beside it: the icon in the tone's colour at the start, an optional title in weight 500, one or two sentences in the default text colour, and at most one small secondary button at the end of the line. No close button: it goes when its cause does. Comfortable padding 12 × 16 with a 12 gap; compact 8 × 12 with an 8 gap.

## Behaviour
warning and danger are announced once as an alert, info and success as a status. The icon is decoration; the words carry the meaning, never the colour alone. A countdown inside the text uses tabular Western digits; in code it is hidden from screen readers, which hear the end time once instead.

## What you provide (design system)
`tone` (info, success, warning, danger), `title`, `text`, `icon` (replaces the tone's: clock for a lock, wifi-slash for the network), `action` (the button's label).

In code: the same, with the text as children and `action` as a button.

## Tokens
`shifa-color-status-{info,success,warning,danger}-bg`, `-border`, `-fg` (the icon), `shifa-color-text-default`, `shifa-shape-radius-input`, `shifa-shape-border-default`.
