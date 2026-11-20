# @shifa/ui

Shifa's web components: UI SDK behaviours (`@ui-sdk/react`, `@ui-sdk/core`) with our own styling, semantic tokens only. Spec: `docs/specs/design-system/0.4-design-system-foundations.md`; ADR-0039 (UI SDK, Base UI fallback), ADR-0040 (design first). Design doc: `docs/architecture/design-system.md`.

## Rules
- Only this package imports `@ui-sdk/*` or Base UI; the public API never shows which. `@ui-sdk/react/agent` is never imported, here included (lint and `test/dependencies.test.ts`).
- `@ui-sdk/*` pinned to one exact, equal version; every dependency exact; a UI SDK upgrade is its own PR. A new runtime dependency gets its licence in `dependency-licences.json`.
- Styling: Tailwind v4 from `src/styles/tailwind.css`, token theme only (`p-4`, `p-0.5`, `bg-bg-surface`, `rounded-control`, `text-body`). Logical sides only; no arbitrary value but a token reference (`h-(--shifa-button-height)`); no literal colour, length or font in `style`. Fixture geometry in tests goes in a `CSSProperties` constant.
- Join classes with `cn()`; put `leading-*` after the text size (tailwind-merge drops it otherwise). A new theme name goes into `src/lib/theme-names.ts`.
- Density by token variables and `in-data-[density=compact]:`; `motion-reduce:` also matches `data-motion="reduce"`. Focus rings never transition.
- A component is coded only from a sheet the owner approved (ADR-0040). Icons: `Icon` over the curated list in `src/icons/icon.tsx` (Phosphor duotone; Healthicons CC0 in `src/icons/health/` with `LICENSE.md`); directional icons mirror in RTL.
- Stories (`*.stories.tsx`) render in the eight combinations of direction × theme × density (`.storybook/matrix.tsx`; `parameters.matrix: false` for one); text states via `storyStates()`; synthetic names from `@shifa/testing` only.
- Browser tests use `test/support/` (`renderDir`, `expectArrow`, `expectPopupSide`, `typeArabic`, `expectDigitsAccepted`, `expectAxeClean`, `tokenColor`). `await` every `unmount()`; click an `aria-disabled` element with `{ force: true }`.

## Commands
- `pnpm --filter @shifa/ui test` — node tests (in `verify` fast).
- `pnpm --filter @shifa/ui test:browser` — component tests in Chromium (Playwright browsers installed).
- `pnpm --filter @shifa/ui test:storybook` — every story as a test, with axe.
- `pnpm --filter @shifa/ui storybook` (port 6006) / `storybook:build`.
