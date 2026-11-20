# ADR-0040: Design first in a Claude Design project, with code as the source of truth

Status: Accepted (owner, 2026-11-20) · Date: 2026-11-20 · Deciders: product owner (with Claude) · Amends: [ADR-0039](0039-ui-sdk-headless-base.md) (design source), [ADR-0025](0025-development-methodology-claude-code.md) (slice loop)

## Context
ADR-0039 closed OD-19: tokens are edited in code, visual exploration is done in Claude Design, Storybook is the living reference, Figma is not used. It did not say where designs live or when a design is made. The owner asked for the working method of a design tool (one place with colours and type, components, icons and screens, and every screen designed before it is coded) so that all surfaces share one look (OD-58).

Checked on 2026-11-20 in the owner's Claude account:
- A **Design System** artifact type holds a brand book, tokens (colours per theme, type, spacing, radius, shadows), fonts, asset groups, and components with live previews and guidelines. Its tokens file is a list format of its own, not DTCG. It can be marked as synced from code, which makes the page read-only; `/design-sync` pushes a local component library to it one component at a time.
- A **Design** artifact type is a canvas of artboards grouped in pages. It installs a design system (a copy of its tokens taken at install time) and mounts the system's real components from its bundle instead of look-alikes.
- Components reach the design system as one classic script that sets one global, with React loaded beside it. `packages/ui` needs React 19, Tailwind v4 and UI SDK; whether it bundles that way is not yet proven.
- Standalone Claude Design (claude.ai/design) closes on 2026-12-14; the artifact types inside Claude replace it.
- These artifacts are private to the account by default.

## Decision
- **One design project, "Shifa", in Claude**, made of:
  1. **Shifa Design System** (Design System type): brand book, tokens, fonts, logo and icons, and the components of `packages/ui`. Marked as synced from code and set as the account's default design system.
  2. **Shifa Guide** (Design canvas): a readable guide page drawn from the tokens: the flow primitive → brand → semantic → component, then foundations, theme, tokens, effects, typography and rules.
  3. **Shifa Components (proposals)** (Design canvas): one sheet per batch of components, drawn before the batch is coded.
  4. **Shifa Screens** (one Design canvas per app: clinic web, admin, display, booking pages, patient app; one page per module).
- **Code is the source of truth; the design project mirrors it.**
  - Tokens: `packages/tokens` gains a generated output in the design system's token format, under the `tokens` drift check. A value is changed in the token source, regenerated and synced; it is never edited in the design project.
  - Components: the design system holds only components built and tested in `packages/ui`, pushed with `/design-sync`. Nothing is edited there.
- **Design before code, with the owner's approval as the gate.**
  - Design language (slice 0.4-02): three directions drawn in the project; the owner picks one (OD-57).
  - Components: for each batch, a sheet in the proposals canvas shows every component in all its states, light and dark, RTL and LTR, both densities, using the real tokens. The owner approves the sheet once per batch; only then is the batch coded. After the batch passes its tests, the real components are synced to the design system and the sheet is marked superseded.
  - Screens: from Phase A on, `/spec` for a feature with UI draws each screen in the screens canvas from the design system's components, with synthetic data, in Arabic RTL, light and dark, at the sizes the feature needs. The owner approves the screens with the spec. A screen that needs a component the design system lacks sends that component through the component cycle first; it is never drawn as a one-off inside the screen.
  - Evidence: the slice's browser screenshot of the built screen is compared with the approved drawing; a difference is fixed or explained in the slice file.
- **Changes later:** a colour, type or component change starts in code and is synced; a screen change starts in its drawing, then its code.
- **What a drawing does not decide.** Keyboard behaviour in RTL, focus, typeahead, screen-reader output and digit entry are proven only by the tests in `packages/ui` (the RTL gate, axe, screenshots). A component whose behaviour fails on UI SDK is built on Base UI behind the same API (ADR-0039); its approved look does not change. For the Flutter patient app the drawings are a visual reference, not a pixel contract: golden tests of `shifa_ui` are the check.
- **Unproven step and its fallback.** Slice 0.4-03 first tries to bundle Button for the design system. If `packages/ui` cannot be bundled that way, the design system shows each component as a static preview taken from Storybook, screens are drawn with the tokens and matching markup, and the "same component" guarantee is replaced by the screenshot comparison above. The owner is told the result before the batches start.
- **Privacy.** Design artifacts use synthetic names from `@shifa/testing` only, stay private to the owner's account, and their links are not committed to this public repository. No secret, production host or real patient data enters them.
- **Skills.** `/spec` gains the screen-drawing step, `/build-slice` the comparison step; `/ui-component` (slice 0.4-04) includes the sheet and the sync.

Everything else in ADR-0039 stands, including Storybook as the technical reference for components and their tests.

## Consequences
+ One look across all surfaces, decided before code is written, when a change is cheapest.
+ The design project cannot drift from the product: tokens are generated and drift-checked, components come from the tested code, and the system is read-only.
+ Screens are assembled from the same components that ship, so a drawing is a realistic promise.
− One more owner gate per component batch and per feature with UI; a slice waits for the approval.
− A fourth generated token output and a bundle of `packages/ui` to maintain; each sync is a step someone must run.
− Screen canvases hold a copy of the tokens taken at install; after a token change they must be refreshed.
− Dependence on Claude's artifact types, which are new and may change; the repository (tokens, components, Storybook) stays complete without them.

## Alternatives considered
- Design project as the source of truth (design-tool first, code follows): familiar from Figma, but two editable sources drift, and the contrast, drift and RTL checks live in code. Rejected.
- Storybook only, no design project (ADR-0039 as written): nothing to approve before code, and no place for screens. Rejected by the owner.
- Figma with Code Connect (ADR-0011's original plan): closed by OD-19.
- Drawing components inside the design system before coding them: mixes proposals with shipped parts in the one reference agents read. Rejected in favour of a separate proposals canvas.
