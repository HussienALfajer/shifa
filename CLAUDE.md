# Shifa

Multi-tenant clinic platform for Syria (Aleppo, Azaz): clinic web system, super admin, waiting-room display, public booking pages and a Flutter patient app. Status lives in `docs/roadmap.md`, never here.

## Start here
- Docs map: `docs/README.md` · Status: `docs/roadmap.md` · Slice hand-over: `docs/slices/`
- How we work (slice loop, risk tiers, definition of done): `docs/process/development-workflow.md`
- Release 1 scope: `docs/product/scope-release-1.md` · Architecture: `docs/architecture/overview.md`
- Decisions: `docs/adr/README.md` · Open questions: `docs/open-decisions.md`

## Commands
- `pnpm install` — Node 24, pnpm 12 (pinned); refuses packages younger than 24 hours.
- `pnpm verify` — checks packages affected since `main`; run after every change. `pnpm verify:full` before a PR (CI runs the same).
- Read the `verify` summary; full logs are in `.verify/logs/`. One `verify` at a time (a lock refuses a second).
- `pnpm format` — Biome formats; ESLint (type-aware, `tooling/eslint-config`) lints. Files over 400 lines fail lint.
- Script and hook tests: `node scripts/run-script-tests.mjs`.

## Slice loop
`/spec` → `/slice-plan` (plan mode, fresh session) → `/build-slice` → `reviewer` agent (+ `security-reviewer` for T0) → PR. One slice per session and per PR. Every PR gets auto-merge and auto-fix (ADR-0028).

## Non-negotiables
- Repository content (code, docs, commit messages) is English. The product UI is Arabic-first (RTL). Reports to the owner are in Arabic.
- No real patient data anywhere in this repository or the development environment; synthetic data only (`docs/compliance/data-handling.md`).
- This repository is public (ADR-0026): never commit secrets, credentials, production hosts or private notes. `docs/research/archive/2026-11-08-r4-claude-code-method/project_*.md` stay local and git-ignored.
- Do not guess open decisions; ask the owner and record the answer in `docs/open-decisions.md`.
- Requirements are cited by ID (`SCH-07`, `DEN-12`); keep IDs stable. Research is cited as `[RN-xx §section]`.
- `main` changes only through a reviewed PR with green CI.

## Enforced by hooks (`.claude/hooks/`)
- Secret files (`.env*`, keys, dumps) are allowed (ADR-0028); never commit them.
- Edits are refused for generated files, `pnpm-lock.yaml`, `docs/research/archive/`, accepted ADRs on `main` (only the `Status:` line may change; write a superseding ADR), migrations merged to `main` (add a new one) and the slice's locked tests (`.claude/state/locked-tests.txt`).
- Shell writes into `apps/`, `packages/`, `tooling/`, `scripts/`, `.claude/` are refused: use Edit/Write so the formatter hook runs. The guard reads command text, so it cannot see `cd apps && echo > x` or `cp`/`node -e` writes: do not use them.
- `--no-verify`, force pushes and pushes to `main` are refused.
- On stop, uncommitted code changes must pass `verify` (fast), unless `.claude/state/red-phase` exists (red phase of `/build-slice`).
- Hooks need `node` on the PATH of Git Bash.

## Gotchas
- Windows for now (Git Bash); the sandbox only runs under WSL2 (slice 0.2-09).
- TypeScript stays on 6.0 until typescript-eslint supports 7.
- Workspace packages import `.ts` paths directly (`allowImportingTsExtensions`, no build step yet).
