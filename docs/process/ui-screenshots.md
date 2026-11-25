# UI screenshots, browser checks and the design-system sync

Status: Living · Last updated: 2026-11-20 · Owner: product owner

How `packages/ui` is checked in a browser (slice 0.4-03): component tests, every story with axe, and a screenshot of every story compared with a committed baseline. Spec 0.4 criterion 9; design doc `docs/architecture/design-system.md`.

## What runs where
| Check | Command | `verify` |
|---|---|---|
| Component tests in Chromium (Vitest browser mode) | `pnpm --filter @shifa/ui test:browser` | `ui-browser` |
| Every story as a test, interactions and axe | `pnpm --filter @shifa/ui test:storybook` | `ui-storybook` |
| Storybook build | `pnpm --filter @shifa/ui storybook:build` | `ui-storybook-build` |
| Screenshot of every story against `packages/ui/screenshots/baselines/` | `pnpm ui:screenshots` | `ui-screenshots` |

These four steps are the `ui` part of `verify full` (`node scripts/verify.mjs full --part ui`) and the `verify ui` job of CI, behind the required `verify (full)` check. `verify` fast runs none of them. Chromium comes from the pinned `playwright` package (`pnpm --filter @shifa/ui exec playwright install chromium` once per machine).

## Why screenshots need Docker
Pixels depend on the browser build, fonts and the system's rendering, so the screenshots are drawn only by the browser inside the Playwright image pinned by digest in `packages/ui/scripts/screenshot-image.ts`. `pnpm ui:screenshots` starts that image as a Playwright browser server; Playwright Test on your machine connects to it and serves the built Storybook to it through the connection. The result is the same on Windows, WSL2 and CI. Every story already shows the eight combinations of direction × theme × density; stories with a play function are left to the Storybook test run. Docs pages (`@storybook/addon-docs`, autodocs, one per stories file) get no screenshot, since each of their stories has one; the spec asserts there are 37 of them.

## Refreshing the baselines
After an intended visual change (a component, a token, the image or Playwright version):
1. `pnpm --filter @shifa/ui storybook:build`
2. `pnpm ui:screenshots --update` (needs Docker).
3. Look at every changed file in `packages/ui/screenshots/baselines/` against the approved sheet before committing it; the PR says why the pictures changed.

Without Docker (the sandboxed WSL2 session, OD-24): run the **ui-baselines** workflow (Actions, run workflow on your branch), download its `ui-screenshot-baselines` artifact, copy the files into `packages/ui/screenshots/baselines/`, look at them and commit them. The workflow reads the repository only; it never commits or pushes.

## Syncing the design system
The Shifa Design System (a Design System artifact in Claude, read-only, `"editing": "code"`) is rebuilt from the repository, never edited on its page (ADR-0040).
1. `pnpm design-system:build` writes every file into `packages/ui/design-system/project/` (git-ignored), from the sources in `packages/ui/scripts/design-system/`:
   - the brand book `README.md` and the cover;
   - `tokens.json`, copied from `packages/tokens/generated/design-system/`, and `tokens.css`, compiled from it;
   - the six static fonts, with IBM Plex Sans Arabic renamed Shifa Sans Arabic (OD-59);
   - the logos from `docs/brand/logo/` and the Icons group;
   - the component bundle `components/bundle.js`: one classic script with React 19 inside and the global `Shifa`, with `bundle.css`, `index.d.ts`, and a preview and guidelines per public component.
2. The owner starts the sync; Claude publishes that folder to the artifact with the Artifact tool:
   - it re-reads the system's index first;
   - it uploads new images under `assets/` and records them in the index;
   - it publishes the changed files, then the index last, keeping `"editing": "code"`, with `lastChange.via` naming the branch and commit.
   Standalone Claude Design projects (`/design-sync` with the `DesignSync` tool) close on 2026-12-14 and are not used.
3. After a sync, the "Shifa Components" canvas gets the same copy of the system (`ds/shifa/`: tokens, `components/bundle.js` and `bundle.css`, its `designSystems` record) and a sheet for each new or changed component, mounting the real component (`Shifa.<Name>`) in every state, light and dark, comfortable and compact; `support/states.css` is regenerated from the new `bundle.css`. The steps: `pnpm design-system:build`; `node scripts/design-system/canvas/canvas.ts <dir> <canvas.json read from the canvas> <heights.json>` (from `packages/ui`); `node scripts/design-system/canvas/check.ts <dir> <heights.json> --measure`, then `canvas.ts` again with the heights and `check.ts` without `--measure` (it must report no problem, an undeclared token included); then publish the boards, `support/`, `ds/shifa/` and the index. Each sheet's playground has a props panel at its right (`dock.ts`) built from the system's own controls; it works in Play and starts from the board's Tweaks.

A component enters the bundle only after its sheet was approved and its tests pass. To add one, list it in `COMPONENTS` of `bundle-entry.tsx` and in `BUNDLE_COMPONENTS` of `bundle.ts`, and add `components/<Name>/README.md` and `preview.html` (line 1 `<!-- @dsCard group="…" height=… -->`, mounting with `Shifa.mount`). The preview's `<style>` starts with `*, *::before, *::after { box-sizing: border-box; }`, since the bundle's stylesheet carries no page reset and a full-width field would otherwise overflow its column; a grid of fields wraps (`repeat(auto-fill, minmax(min(200px, 100%), 1fr))`) instead of fixing a column count. `test/design-system-bundle.test.ts` refuses a public component without them. On a Design canvas (React 18) the bundle's components are islands: they open their own React 19 root, and only text children cross.

## When a check fails
- Screenshot: CI uploads `ui-screenshot-diffs` (expected, actual, diff per story); locally they are in `packages/ui/screenshots/results/`. A difference you did not intend is a bug; one you intended needs new baselines (above).
- axe: the story names the rule (`button-name`, `color-contrast`) and the element. Fix the component, never silence the rule.
- Upgrading Playwright: change `playwright`, `@playwright/test` and the image tag and digest together (`scripts/test/ui-baselines-workflow.test.mjs` checks they agree), then refresh the baselines.
