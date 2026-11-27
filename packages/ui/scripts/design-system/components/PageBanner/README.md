# PageBanner

A strip the width of the page, above the top bar on every page: announcements to the clinic, the owner's notice that support is reading the clinic, and the support session's own strip.

Coded from the sheet the owner approved on 2026-11-27 (Shifa Screens · Clinic web, page "Proposals", `A02cSheetPageBanner`, slice A-02-01), tested in Arabic RTL and English LTR, light and dark, both densities.

## When to use
- A message about the whole app that stays on every page: an announcement, a support session.
- Not for a message about one page (use Callout), not for a passing confirmation (use Toast).

## Look
A full-width row with a bottom border: the icon and a bold word or sentence («تنبيه:», «معلومة:»), the text, then at most one small button, the pager and the close button at the end. `info` and `warning` use the locked status colours; `support` is solid (the info solid with its text on it). Several announcements show one at a time with «1 من 3» between previous and next. Stacked, the support session comes first, then the owner's notice, then announcements. Under 430 px of width (a phone) the icon and text take the whole line and the buttons go under it.

## Behaviour
A region named by its word. The text is a polite live region, so paging to another announcement is read. Previous and next are disabled at the ends. The close button («إخفاء الإعلان») hides an announcement for the person; the support banners have none while the access is open. Never colour alone: the icon and the word say what it is.

## What you provide (design system)
`tone` (info, warning, support), `title`, `text`, `icon` (`eye` for the owner's notice), `action` (the button's label), `texts` and `index` (several in turn), `dismissible`, `dismissLabel`, `aria-label`.

In code: `children` for the text, `action` as a Button, `pager` (`index`, `count`, `onIndexChange`), `onDismiss`.

## Tokens
`shifa-color-status-info-bg`, `-border`, `-fg`, `-solid`, `-on-solid`, `shifa-color-status-warning-bg`, `-border`, `-fg`, `shifa-size-control-md`, `shifa-text-size-data`.
