# ADR-0049: The clinic screens canvas shows the coded screens, with a Proposals page

Status: Accepted (owner, 2026-11-25) · Date: 2026-11-25 · Deciders: product owner (with Claude) · Amends: [ADR-0046](0046-full-api-use-and-components-drawn-with-screens.md), [ADR-0047](0047-screens-drawn-before-the-api-with-a-contract.md)

## Context
ADR-0047 has a design slice draw a spec's screens on "Shifa Screens · Clinic web" before the API, one page per batch. After A-01a and A-01b were coded, the canvas held four pages of drawings (A-01 Foundation, A-01-07, A-01-10, A-01-08): prototypes, analyses and component sheets of what is now code, some of it superseded, none of it updated when the code changed.

On 2026-11-25 the owner asked for the four pages to be deleted and replaced by one page, "Clinic Web Screens", with one sheet per screen that exists in the code, showing every state the screen can show and every answer of the server, exactly as the code renders it, working in Play. ADR-0048 made the same change for the components canvas.

## Decision
- **"Clinic Web Screens" shows the coded screens.** One sheet per screen of `packages/web-shell` on clinic web (sign-in, setup link, invitation, the second factor's challenge and enrolment, the clinic chooser, home and its frame, the switcher, team, branches, My account, the clinic's settings, the remaining shell pages). Each board is clinic web itself: the shell's providers, router and pages, built into one script (`packages/web-shell/scripts/screens/`), opened at one address with a fake server that answers as the API's contracts say, with synthetic data from `@shifa/testing`. A state reached by acting (an error after sending, an open drawer, a dialog's second step) is reached by the same presses and typing a person makes; time passing (the idle warning) moves the board's clock, never the app's limits. Nothing is drawn by hand.
- **Light and dark, desktop and phone.** Every state is shown in both themes on a 1440 px window; the sheet's main states also on a 390 px phone. The clinic web app has one density (comfortable), so the screens show no compact copy.
- **Rebuilt from the code.** `scripts/screens/check.ts` opens every board in Chromium and fails on a state not reached, a page or console error or content wider than the window; `scripts/screens/canvas.ts` writes the boards and the canvas index. Both run after any change to the screens, before the canvas is published again.
- **A "Proposals" page holds screens not yet coded.** A design slice (ADR-0047) draws its screens there, with the screen-to-API contract and the costed improvements, for the owner to approve. Once the screens are coded, their drawings are deleted from that page and their sheets on "Clinic Web Screens" are built from the code. The page is created with the first such slice (A-02-01).
- **The same for admin web** when its screens are reworked this way (not yet decided for "Shifa Screens · Admin web").

## Consequences
+ One place shows every clinic-web screen as the code renders it today, with every state and every server answer, and works in Play.
+ The canvas cannot drift from the code: it is rebuilt from it, and the check fails before a broken state is published.
− About 400 boards, each running the app: the canvas is heavy to open and to publish (two publishes, as one takes at most 255 files).
− The screens bundle and its fake server are code to keep: a new route, field or error code needs its answer and its states there, or the sheet misses them.
− Approvals of the old batches stay in their slice files only; the drawings are gone.

## Alternatives considered
- Keep the batch pages marked "superseded" (the old practice): stale drawings beside the code. Rejected by the owner.
- Screenshots of the app instead of the app: no Play, and every change needs new images. Rejected.
- Draw the screens again with the components (as the components canvas does with its bundle): a second copy of every screen that drifts from the code. Rejected.
