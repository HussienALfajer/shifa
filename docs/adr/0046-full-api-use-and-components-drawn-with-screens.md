# ADR-0046: Screens use the whole API; a missing component is drawn with its screens

Status: Accepted (owner, 2026-11-24); component-only sheets go to the Proposals page of "Shifa Components", amended by [ADR-0048](0048-components-canvas-holds-the-coded-components.md); the route, field and error table is made in the design slice before the API, amended by [ADR-0047](0047-screens-drawn-before-the-api-with-a-contract.md) · Date: 2026-11-24 · Deciders: product owner (with Claude) · Amends: [ADR-0042](0042-screens-drawn-per-ui-batch-with-analysis.md) (analysis, design-system gaps), [ADR-0040](0040-design-first-in-claude-design-code-as-source.md) (where a component sheet is drawn)

## Context
ADR-0042 has each UI batch draw its screens after the API with an analysis of API gaps. It does not say that the screens must use everything the API already gives, so a screen could ignore a field (a lock's end time, a clinic's last activity, a link's expiry) and look poorer than the backend allows. The re-plan of A-01-07 (OD-94) showed the opposite risk too: gaps such as the signed-in person's name were found only by reading every route against every screen.

ADR-0042 also sends a missing component through its own cycle first (`/ui-component`: a sheet on "Shifa Components (proposals)", owner approval, code, sync) before the batch draws with it. The owner then sees the component apart from the screen that needs it, and the batch waits for a separate approval round.

## Decision
- **Every UI batch uses the whole API it sits on, with all its data.** The batch's analysis starts from a table of the routes the batch's screens use, every field of every response and every error code or status: each is shown on a screen, drives a state, or is named with the reason it is not shown. A route of the feature that no screen of any planned batch uses is named. The analysis then reports, for the owner to add:
  1. **missing data or actions** the screens need and the API does not give (ADR-0042 "API gaps");
  2. **anything unprofessional in the API** as the screens meet it: an error the client cannot tell apart, a contract that does not declare a status the route answers, a list without the order or search the screen needs, a field in a form the user cannot read well (raw ids, UTC times without the clinic's zone).
  Each item is fixed in the API (in the batch or a small slice before it), never worked around in the client.
- **A missing component is drawn with the batch's screens, not before them.** In the batch's first checkpoint:
  1. the component is drawn **on its own** as a sheet with every state (default, hover, focus, disabled, error, loading, empty where they apply), light and dark, RTL and LTR, both densities, from the Shifa Design System's tokens and real components only;
  2. the same component is drawn **at once on every screen that needs it**, in the screen's real states;
  3. the owner **approves the component** (it then counts as its approved sheet for ADR-0040 and `/ui-component`) **or asks for changes**, which are redrawn on the sheet and the screens before approval.
  After approval the component is built with `/ui-component` from that sheet (tests, stories, screenshots, review), added to the Shifa Design System (`pnpm design-system:build` and the publish of `docs/process/ui-screenshots.md`), and only then used by the batch's code. It is built in the batch's PR when the line budget allows (ADR-0032), else in its own PR first.
- Everything else in ADR-0040 and ADR-0042 stands: the Shifa Design System and its Guide's rules only, working prototypes in Play, every inventory state reachable, the full analysis, no code before approval, screenshots against the real backend compared with the drawings.

## Consequences
- The analysis of every batch grows by a route-and-field table; gaps surface while the owner looks at the drawings, not during coding.
- One approval round covers the screens and their new components; the owner judges a component where it is used.
- Component sheets for screen batches live on the batch's screens canvas page beside the screens; component-only batches (Phase 0.4 style) keep "Shifa Components (proposals)".

## Alternatives considered
- Keep the separate component cycle before the batch: rejected by the owner (a second approval round, and the component seen away from its screens).
- Let screens show only what the spec's inventory names: rejected; the API may give more useful data than the inventory lists, and the owner wants all of it used or explained.
