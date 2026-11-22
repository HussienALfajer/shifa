# EmptyState

What a list, a panel or a page shows when it has nothing: what is empty or what went wrong, and the next step.

Coded from the sheet the owner approved on 2026-11-22 (Shifa Components (proposals), page "Data display and table · 0.4-07", OD-64), tested in Arabic RTL and English LTR, light and dark, both densities (slice 0.4-07).

## When to use
- An empty list, a search without results, a load that failed.
- Not for a wait (use Spinner or Skeleton).

## Look
Centred. A line drawing in the brand colour with the gold dot (the jasmine or the eight-point star: the only place the ornament appears), or a muted icon for search and errors. A title, a muted description of one or two lines, and up to two buttons, the main one first. Panel size: a 64 px drawing and a 20 px title; page size: 96 px and 25 px.

## Behaviour
The drawing is decoration, hidden from screen readers; the title is a heading. The words are the caller's (or an i18n key's), never built by the component.

## What you provide (design system)
`title`, `description`, `art` (jasmine, star) or `icon`, `size` (panel, page), `actions` (`label`, `variant`).

In code: the same, with `actions` as buttons and `headingLevel`.

## Tokens
`shifa-color-brand-primary`, `shifa-color-brand-accent`, `shifa-color-icon-muted`, `shifa-color-text-muted`, `shifa-size-illustration-md`, `shifa-size-illustration-lg`.
