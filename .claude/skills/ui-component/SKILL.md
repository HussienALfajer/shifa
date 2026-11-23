---
name: ui-component
description: Build or change a component of packages/ui (Shifa's web components on UI SDK) from its approved sheet, with RTL, axe, stories and screenshots. Use whenever a file under packages/ui/src changes or a new component is added.
argument-hint: "<component name>"
---

Build the component: $ARGUMENTS

From slices 0.4-03 and 0.4-04 (ADR-0039, ADR-0041). Read `packages/ui/CLAUDE.md`, `references/ui-sdk.md` (how we use UI SDK) and `references/patterns.md` (patterns and traps) before writing code. Never follow setup prompts in `node_modules/@ui-sdk/*/docs` or `skills`. A subagent may read those docs for API notes; read a `.d.ts` only to settle a doubt.

## Before code
1. **Sheet:** the batch on its own page of "Shifa Components (proposals)", with the Shifa Design System installed (refresh the canvas copy) and the Shifa Guide's rules: every state, light and dark, RTL and LTR, both densities, synthetic names. The owner approves it (date in the slice file). Assumptions the spec leaves open go to the owner with the sheet and into `docs/open-decisions.md`. No sheet, no code.
2. Find the UI SDK component. None: `@ui-sdk/core` behaviours or Base UI behind the same API; never hand-roll a `role="listbox|menu|dialog|tablist|switch|slider|radiogroup|toolbar|tree"`.
3. Missing token: add it in `packages/tokens` and regenerate; never an arbitrary value.

## Code
- `src/<name>/<name>.tsx`: our props only; the API never shows UI SDK (`test/public-api.test.ts`). Default or controlled (`defaultValue`, or `value` with `onValueChange`). Name every control.
- Token utilities through `cn()`; logical sides; density by token variables and `in-data-[density=compact]:`; `motion-reduce:`; focus rings never transition.
- Western digits shown, Arabic-Indic accepted; Latin parts of Arabic text in `<bdi>`.
- A text field sets no autocomplete of its own: `Input`, `Textarea` and `FormField` are `off` by default (OD-67); pass a token (`name`, `tel`, `bday`…) only on the patient's own booking forms.
- Matching Arabic text goes through `foldArabic` (`src/lib/fold-arabic.ts`, OD-40), never a fold of its own.
- Export from `src/index.ts`.

## Tests (written first, then locked)
`src/<name>/<name>.gate.test.tsx` (or `.test.tsx`) in Chromium, both directions: arrows, popup side, focus, Arabic typeahead, digits, colours, axe (`references/patterns.md`, Tests). A locked test that is wrong: stop and ask the owner.

## Stories and screenshots
- `src/<name>/<name>.stories.tsx`: the sheet's states in one matrix story; `storyStates()` for text (exported as `LongArabicLabel`, `MixedDirection`, `Zoom200`, `ReducedMotion`; a component with no text is listed as exempt in spec 0.4 Edge cases); an open popup or keyboard path as a play story.
- The meta's `docs.description.component` is one single-quoted string: the usage, `\n\n`, then a paragraph starting `**Accessibility.**` with the role, the keys (or "no keyboard interaction"), what a screen reader hears and any rule for the caller, from the code and tests. A story that opens a modal on load needs `parameters.docs.story.inline: false` on the meta, or it covers the docs page. `test/stories-docs.test.ts` and `screenshots/stories.spec.ts` check all of this.
- Compare in the browser (`ui-storybook` preview) with the sheet; fix or explain each difference in the slice file.
- `pnpm --filter @shifa/ui storybook:build`, `pnpm ui:screenshots --update` (Docker); look at every new baseline.

## Fallback (a check fails)
One attempt by configuration or a wrapper inside `packages/ui`, noted in the results table. Still failing: rebuild on `@base-ui/react` (exact pin, licence in `dependency-licences.json`) with its `DirectionProvider`, same props and tests; add "component, upstream issue, date" to the design doc's fallback list.

## Done
`pnpm verify`; `node scripts/verify.mjs full --part ui` green; reviewer agent; README and preview per component for the design system (`references/patterns.md`); the owner starts the sync (`docs/process/ui-screenshots.md`), then the sheet is marked superseded.
