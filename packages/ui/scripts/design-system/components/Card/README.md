# Card

A white surface on the cream page that groups one thing: today's appointment, a patient, a figure.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Data display and table · 0.4-07"), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-07).

## When to use
- A record or a summary that stands on its own on a dashboard or a list of cards.
- Not around a whole form or page (the page is the surface), and never a card inside a card.

## Look
Padding 24 (16 compact), radius 12, a light border and the small card shadow; in dark the border carries it. An optional header (a 20 px title, a muted description, actions at the logical end), a body of 15 px text, and a footer of buttons above a divider. A figure card has a body only.

## Behaviour
A card is not a control. A **link card** puts one link in its title: a press anywhere on the card outside a button follows it, the card lifts on hover, and keyboard focus on the link rings the whole card. Buttons in the card stay their own controls; nothing interactive is nested in the link.

## What you provide (design system)
`title`, `description`, `href` (a link card), `body` (lines), `footer` (buttons: `label`, `variant`).

In code: `Card` with `CardHeader` (`title`, `description`, `actions`, `headingLevel`), `CardBody`, `CardFooter` and `CardLink`.

## Tokens
`shifa-card-bg`, `shifa-card-border`, `shifa-card-radius`, `shifa-card-padding`, `shifa-shadow-card`, `shifa-color-selection-subtle`, `shifa-color-border-focus`.
