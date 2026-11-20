# @shifa/tokens

The one source of design values (W3C Design Tokens, DTCG 2025.10) for the web theme and the Flutter theme. Design doc: `docs/architecture/design-system.md`.

## Layout
- `src/<layer>/*.tokens.json`, four layers. The directory is the layer; a token path is the same everywhere (`color.bg.surface`).
  - `primitive`: literal values only (palette steps, scales). Colours are `{ colorSpace: "srgb", components, hex }`; the hex must agree with the components (`srgb('#1f6f5c')` from `src/color.ts` computes them).
  - `semantic`: a reference to a primitive. Meanings: `color.bg.*`, `color.text.*`, `size.control.*`, `text.size.*`.
  - `brand`: `color.brand.*` only, references to primitives. These are the slots a clinic palette replaces (PLT-41).
  - `component`: a reference to a semantic or brand token, never a primitive.
- `$extensions.shifa.modes`: `dark` (colours only) and `compact` (other values only) hold the value in that mode, as a reference. Every semantic and brand colour needs `dark`.
- `$extensions.shifa.locked: true` on every colour under `color.status`, `color.sync`, `color.alert`, `color.queue`, `color.clinical` (semantic layer), and nowhere else. Locked colours come from the `color.signal.*` primitives, never from the brand palette. Red (`crimson`) is `color.alert.critical` only.
- `src/contrast-pairs.json`: each text or icon colour with a surface it is drawn on and its class (`body` 4.5 : 1, `large` or `ui` 3 : 1). A semantic or brand colour that is a foreground (`color.text.*`, `color.icon.*`, a name ending in `fg`, `text`, `icon` or starting with `on-`) must be in at least one pair.
- `src/schema.ts` (the rules above), `src/contrast.ts` (WCAG 2.2), run by `test/` on the real source.
- `scripts/build.ts` (Style Dictionary v5, exact pin) → `generated/css/tokens.css` (`:root`, `[data-theme='dark']`, `[data-density='compact']`), `generated/css/tailwind-theme.css` (Tailwind v4 `@theme inline`) and `packages/shifa_ui/lib/src/generated/tokens.g.dart`. `scripts/values.ts` writes one value for CSS and Dart; `scripts/formats.ts` lays out the files.

## Rules
- Never edit a generated file. After any change under `src/` or `scripts/` run `node scripts/check-drift.mjs --fix` and commit the outputs; the `tokens` drift check fails otherwise. The build refuses a source that breaks the schema or a contrast pair.
- A new colour that carries text or an icon needs its pairs in the same change, checked in light and dark.
- Do not rename a token a component uses; add one and migrate.
- Tailwind gets semantic and brand colours only (`bg-bg-surface`, `text-text-muted`), never a palette step. A new token group needs a line in `THEME` of `scripts/formats.ts` to become a Tailwind name; otherwise use `var(--shifa-…)`.
- A new token type needs a validator in `src/schema.ts` and a CSS and a Dart form in `scripts/values.ts`.
- Type scale, radius, elevation, motion and density values are provisional until slice 0.4-02 records the owner's design language.

## Commands
- `pnpm --filter @shifa/tokens test` — schema, contrast and build tests.
- `node --test scripts/test/drift-tokens.test.mjs` — the drift check against a temp copy.
