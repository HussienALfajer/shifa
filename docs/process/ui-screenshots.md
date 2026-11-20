# UI screenshots and browser checks

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
Pixels depend on the browser build, fonts and the system's rendering, so the screenshots are drawn only by the browser inside the Playwright image pinned by digest in `packages/ui/scripts/screenshot-image.ts`. `pnpm ui:screenshots` starts that image as a Playwright browser server; Playwright Test on your machine connects to it and serves the built Storybook to it through the connection. The result is the same on Windows, WSL2 and CI. Every story already shows the eight combinations of direction × theme × density; stories with a play function are left to the Storybook test run.

## Refreshing the baselines
After an intended visual change (a component, a token, the image or Playwright version):
1. `pnpm --filter @shifa/ui storybook:build`
2. `pnpm ui:screenshots --update` (needs Docker).
3. Look at every changed file in `packages/ui/screenshots/baselines/` against the approved sheet before committing it; the PR says why the pictures changed.

Without Docker (the sandboxed WSL2 session, OD-24): run the **ui-baselines** workflow (Actions, run workflow on your branch), download its `ui-screenshot-baselines` artifact, copy the files into `packages/ui/screenshots/baselines/`, look at them and commit them. The workflow reads the repository only; it never commits or pushes.

## When a check fails
- Screenshot: CI uploads `ui-screenshot-diffs` (expected, actual, diff per story); locally they are in `packages/ui/screenshots/results/`. A difference you did not intend is a bug; one you intended needs new baselines (above).
- axe: the story names the rule (`button-name`, `color-contrast`) and the element. Fix the component, never silence the rule.
- Upgrading Playwright: change `playwright`, `@playwright/test` and the image tag and digest together (`scripts/test/ui-baselines-workflow.test.mjs` checks they agree), then refresh the baselines.
