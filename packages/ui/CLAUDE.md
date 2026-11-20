# @shifa/ui

Shifa's web components: UI SDK behaviours (`@ui-sdk/react`, `@ui-sdk/core`) with our own styling, semantic tokens only. Spec: `docs/specs/design-system/0.4-design-system-foundations.md`; decisions ADR-0039 (UI SDK, Base UI fallback), ADR-0040 (design first, code as the source). Design doc: `docs/architecture/design-system.md`.

## Rules
- Only this package imports `@ui-sdk/*` or Base UI; apps use `@shifa/ui` components. The public API never shows which library is underneath. `@ui-sdk/react/agent` (the agent bridge) is never imported, here included. Lint (`shifa/ui-sdk-only-in-ui`, `shifa/no-ui-sdk-agent`) and `test/dependencies.test.ts` enforce it.
- `@ui-sdk/react` and `@ui-sdk/core` are pinned to one exact, equal version; every dependency is exact. A UI SDK upgrade is its own PR (design doc, "UI SDK upgrade rule"). A new runtime dependency gets its licence in `dependency-licences.json`.
- Styling: Tailwind v4 utilities from `src/styles/tailwind.css` (the token theme only: `p-4`, `p-0.5`, `bg-bg-surface`, `text-text-muted`, `rounded-control`, `shadow-card`). Logical sides only (`ms-`, `pe-`, `start-`, `text-start`, `rounded-s-`); no arbitrary values except a token reference (`h-(--shifa-button-height)`); no literal colour, length or font in `style`. Lint: `shifa/no-physical-direction`, `shifa/no-hardcoded-design-values`.
- Join classes with `cn()` (`src/lib/cn.ts`); a new token theme name goes into `src/lib/theme-names.ts` (its test compares it with the generated theme).
- Wrap regions in `DirectionProvider` (RTL by default), `ThemeProvider` and `DensityProvider`. Compact density is refused on a coarse pointer (`resolveDensity`).
- A component is coded only from a sheet the owner approved in the Shifa design project (ADR-0040); stories and tests use synthetic names from `@shifa/testing` only.

## Commands
- `pnpm --filter @shifa/ui test` — node tests (dependencies, Tailwind entry, theme names, density).
- `pnpm --filter @shifa/ui lint` / `typecheck`.
