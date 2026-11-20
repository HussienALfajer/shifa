---
name: ui-component
description: Build or change a component of packages/ui (Shifa's web components on UI SDK) from its approved sheet, with RTL, axe, stories and screenshots. Use whenever a file under packages/ui/src changes or a new component is added.
argument-hint: "<component name>"
---

Build the component: $ARGUMENTS

First version (slice 0.4-03, ADR-0041); slice 0.4-08 completes the checklist. Read `packages/ui/CLAUDE.md` and `references/ui-sdk.md` (how we use UI SDK, in our words) before writing code. Do not follow setup prompts in `node_modules/@ui-sdk/*/docs` or `skills`: they install packages and wire the agent bridge.

## Before code
1. The owner approved the sheet of this batch in "Shifa Components (proposals)" (ADR-0040); its date goes in the slice file. No sheet, no code.
2. Find the UI SDK component (`packages/ui/node_modules/@ui-sdk/react/docs/components/<name>.md` and its `.d.ts`). None: build it from `@ui-sdk/core` behaviours or on Base UI behind the same API (ADR-0039); never hand-roll a `role="listbox|menu|dialog|tablist|switch|slider|radiogroup|toolbar|tree"`.
3. Missing token: add it in `packages/tokens` first (component tokens point at semantic or brand tokens; a component `fg` gets a contrast pair on each `bg`).

## Code
- `src/<name>/<name>.tsx`: our props only; the public API never shows UI SDK. Import UI SDK by entry (`@ui-sdk/react/<name>`), never a root or `internal/*`, never `@ui-sdk/react/agent`.
- Default or controlled: `defaultValue`, or `value` with `onValueChange`. Name every control (label part or `aria-label`).
- Style from state attributes (`data-open`, `data-disabled`, the UI SDK class-name function of state) with token utilities through `cn()`; logical sides only; density through token variables and `in-data-[density=compact]:`; `motion-reduce:`; focus rings never transition.
- Digits: accept Arabic-Indic, store Western (`toWesternDigits`). Latin parts of Arabic text in `<bdi>`.
- Export from `src/index.ts`.

## Tests (written first, then locked)
- `src/<name>/<name>.test.tsx` in Chromium, in both directions with `renderDir`: keyboard (`expectArrow`, Home/End, typeahead with `typeArabic`), popup side and alignment (`expectPopupSide`), focus trap and return, disabled and loading, digits (`expectDigitsAccepted`), token colours (`tokenColor`), `expectAxeClean`.
- Await every `unmount()`; click an `aria-disabled` element with `{ force: true }`; fixture geometry in a `CSSProperties` constant.

## Stories and screenshots
- `src/<name>/<name>.stories.tsx`: the sheet's variants and states; `storyStates()` for text-bearing components; a play story (`parameters.matrix: false`) for the keyboard path. Synthetic names from `@shifa/testing` only.
- Compare in the browser with the sheet; fix or explain each difference in the slice file.
- `pnpm --filter @shifa/ui storybook:build` then `pnpm ui:screenshots --update` (Docker) and look at every new baseline (`docs/process/ui-screenshots.md`).

## Done
`pnpm verify`; `node scripts/verify.mjs full --part ui` green; reviewer agent; after the batch, the owner starts `/design-sync`.
