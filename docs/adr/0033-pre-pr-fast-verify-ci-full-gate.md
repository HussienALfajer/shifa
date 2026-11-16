# ADR-0033: Before a PR, fast `verify` locally; CI is the full gate

Status: Accepted (owner, 2026-11-16) · Date: 2026-11-16 · Deciders: product owner (with Claude) · Amends: the "Checks" step of root `CLAUDE.md` "Finishing a task" and the Verify step and definition of done in [development workflow](../process/development-workflow.md) §3–§4

## Context
Root `CLAUDE.md` asked for `pnpm verify:full` green on the final tree before every PR, and CI then ran the same full `verify` again as the required `verify (full)` check, which blocks the merge (branch protection, ADR-0028 auto-merge). The owner found that checks after a task took longer than the task. Phases 1–3 of the speed-up (#46, #47, #48–#51) cut local `verify full` from about 2.5–3 min to about 65–70 s and split CI into parallel jobs, but a local full run still repeats, on one machine, work that CI repeats anyway on every pull request; and inside a sandboxed WSL2 session the Docker-backed half cannot run at all (OD-24).

## Decision
- Before a PR, `pnpm verify` (fast: packages affected since `main`, with the Docker-backed script tests only when their files changed) must be green on the final tree. CI's `verify (full)` runs everything on every PR and blocks the merge; it is the full gate.
- Also run `pnpm verify:full` locally, before the PR, when the change touches what fast mode does not exercise or what CI's own gate depends on: the build or the API boot check (`apps/*/scripts/boot-check.ts`, build config), the DB test harness (`packages/db/test-harness/`, `vitest.db.config.ts`), drift generators (`scripts/drift.config.mjs`, `scripts/lib/drift*.mjs`, the generator scripts) or CI and `verify` itself (`.github/`, `scripts/verify.mjs`, `scripts/lib/verify-steps.mjs`).
- Docs-only changes need no local run (CI runs `verify docs`), as before. The rest of "Finishing a task" is unchanged.

## Consequences
+ A typical PR waits for a fast run (seconds when little changed) instead of a full one (more than a minute); CI's parallel jobs report the full result a few minutes later and auto-fix acts on failures.
+ The rule matches the sandboxed WSL2 setup, where Docker-backed tests already ran only in CI.
− A failure that only full mode catches (build, boot, Dart client drift, DB tests of an unaffected package) is found in CI, after the PR is open, at the cost of another push. The list of paths that still need a local full run covers the cases where that cost is highest.
− The owner relies on CI being the gate: branch protection on `main` must keep `verify (full)` required.

## Alternatives considered
- Keep `verify:full` before every PR: the safest, and the slowest; what the owner asked to stop.
- No local run at all, CI only: the Stop hook already runs fast mode, but a PR opened on a red fast run wastes a CI cycle.
