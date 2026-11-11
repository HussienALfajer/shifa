# Shifa

Multi-tenant clinic platform for Syria (Aleppo, Azaz): clinic web system, super admin, waiting-room display, public booking pages and a Flutter patient app. Status lives in `docs/roadmap.md`, never here.

## Start here
- Docs map: `docs/README.md` · Status: `docs/roadmap.md` · Slice hand-over: `docs/slices/`
- How we work (slice loop, risk tiers, definition of done): `docs/process/development-workflow.md`
- Release 1 scope: `docs/product/scope-release-1.md` · Architecture: `docs/architecture/overview.md`
- Decisions: `docs/adr/README.md` · Open questions: `docs/open-decisions.md`

## Commands
- `pnpm install` — Node 24, pnpm 12 (pinned); refuses packages younger than 24 hours.
- Flutter is pinned in `.fvmrc`: once per machine `dart pub global activate fvm 4.3.2` and `fvm install`. Dart tools run through `node scripts/dart.mjs <dart|flutter> ...`, never a global SDK (`.claude/rules/dart.md`).
- `pnpm env:check` — one line per toolchain item (`ok`/`warn`/`fail`) with the fix; run on a new machine or when tools misbehave.
- `pnpm verify` — checks packages affected since `main`; run after every change. `pnpm verify:full` before a PR (CI runs the same).
- Read the `verify` summary; full logs are in `.verify/logs/`. One `verify` at a time (a lock refuses a second).
- `pnpm obs:up` / `obs:smoke` / `obs:down` / `obs:reset --yes` — local Grafana + GlitchTip stack (`docs/process/observability.md`); needs Docker.
- `pnpm format` — Biome formats; ESLint (type-aware, `tooling/eslint-config`) lints. Files over 400 lines fail lint.
- Script and hook tests: `node scripts/run-script-tests.mjs`.
- Database tests need Docker running (Testcontainers, PostgreSQL 18); see `packages/db/CLAUDE.md`. Schema changes: `/db-migration`.

## Slice loop
`/spec` → `/slice-plan` (plan mode, fresh session) → `/build-slice` → `reviewer` agent (+ `security-reviewer` for T0) → PR. One slice per session and per PR. Every PR gets auto-merge and auto-fix (ADR-0028).

## Non-negotiables
- Repository content (code, docs, commit messages) is English. The product UI is Arabic-first (RTL). Reports to the owner are in Arabic.
- No real patient data anywhere in this repository or the development environment; synthetic data only (`docs/compliance/data-handling.md`).
- This repository is public (ADR-0026): never commit secrets, credentials, production hosts or private notes. `docs/research/archive/2026-11-08-r4-claude-code-method/project_*.md` stay local and git-ignored.
- Do not guess open decisions; ask the owner and record the answer in `docs/open-decisions.md`.
- Requirements are cited by ID (`SCH-07`, `DEN-12`); keep IDs stable. Research is cited as `[RN-xx §section]`.
- `main` changes only through a reviewed PR with green CI.

## Finishing a task: open the PR at once
When a task's work is done (a spec, a slice, a fix, a docs change), finish it in the same turn; never ask whether to commit, push, open the PR or enable auto-merge and Auto-fix (ADR-0028). Stop and report at the first step that fails.
1. **Branch:** not `main`; name it by type (`feat/`, `fix/`, `chore/`, `docs/`, or the slice ID).
2. **Docs:** update `docs/roadmap.md`, the slice file and every doc the change made stale.
3. **Secrets:** `git status` and `git diff --stat` show no `.env`, key, dump or stray file.
4. **Checks:** `pnpm verify:full` passes on the final tree (docs-only changes: CI runs the checks). In a sandboxed WSL2 session Docker is blocked (OD-24): Docker-backed tests run in CI, so say so in the report.
5. **Review:** for a slice, the `reviewer` agent (+ `security-reviewer` for T0) has run and its blocking findings are fixed.
6. **Commit and PR:** Conventional Commit; `gh pr create --base main` with `## Summary` and `## Test plan`; then enable auto-merge (squash) and Auto-fix. If CI fails, fix the cause on the branch and push.
7. **Report** in Arabic in the format below.

## Reporting
End every substantial task with these sections, in this order:
1. **Needs from you**: blocking decisions, a slice's acceptance steps, or "nothing". When the task opened or merged a PR, end with the cleanup line in a code block, to run after the merge (squash merges need `-D`): `cd D:\shifa; git switch main; git pull --ff-only; git fetch --prune; git branch -D <branch>`
2. **Changed**: what was built or modified, with the PR link.
3. **Verified**: checks run and their results (the `verify` summary, CI).
4. **Found**: issues, risks or follow-ups noticed.
5. **Next step**, always last: the next task (from `docs/roadmap.md` or what this task uncovered), why it comes next and what it needs from the owner; whether it needs a new session (`/clear`) and plan mode; the model and effort to set (`docs/process/development-workflow.md` §7); and the exact first message to send, in its own code block.

## Enforced by hooks (`.claude/hooks/`)
- Secret files (`.env*`, keys, dumps) are allowed (ADR-0028); never commit them.
- Edits are refused for generated files, `pnpm-lock.yaml`, `docs/research/archive/`, accepted ADRs on `main` (only the `Status:` line may change; write a superseding ADR), migrations merged to `main` (add a new one) and the slice's locked tests (`.claude/state/locked-tests.txt`).
- Shell writes into `apps/`, `packages/`, `tooling/`, `scripts/`, `.claude/` are refused: use Edit/Write so the formatter hook runs. The guard reads command text, so it cannot see `cd apps && echo > x` or `cp`/`node -e` writes: do not use them.
- `--no-verify`, force pushes and pushes to `main` are refused.
- On stop, uncommitted code changes must pass `verify` (fast), unless `.claude/state/red-phase` exists (red phase of `/build-slice`).
- Hooks need `node` on the PATH of the shell Claude uses (WSL2: `bash -lc 'command -v node'`; Windows: Git Bash).

## Gotchas
- WSL2 (Ubuntu 26.04, repo in `~/src/shifa`) is primary and sandboxed; setup in `docs/process/wsl2-setup.md`. Windows (`D:\shifa`, Git Bash) is the unsandboxed fallback.
- TypeScript stays on 6.0 until typescript-eslint supports 7.
- Workspace packages import `.ts` paths directly (`allowImportingTsExtensions`, no build step yet).
