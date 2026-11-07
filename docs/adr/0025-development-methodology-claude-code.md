# ADR-0025: Development methodology — Claude Code, harness-first, with risk tiers for review

Status: Accepted; the `bypassPermissions` safety rule is superseded by [ADR-0027](0027-owner-chooses-permission-mode.md) · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
Shifa will be built almost entirely with Claude Code (Opus 5.5). Anthropic's guidance: give Claude checks that pass or fail, keep CLAUDE.md short, put unbreakable rules in hooks/CI, spec first, independent review, small PRs [RN-18 §4]. The owner's three earlier Claude-built projects show what worked (spec interviews, layered slices, reviewer/checker agents, one `verify`, rules as tests) and what wasted time (verification tooling arriving late, instruction bloat, an ever-growing TASKS.md, giant PRs, mocked E2E, shell edits bypassing hooks, `bypassPermissions`, auto-merge without human review, huge contexts) [RN-20 §7] [RN-21 §7] [RN-22 §7].

## Decision
- Harness first: Phase 0 builds the repository skeleton, `verify` (fast/affected and full), hooks, agents, skills, architecture and isolation tests, CI and drift checks before any feature.
- Instructions: root CLAUDE.md ≤ 8 KB and per-package CLAUDE.md ≤ 4 KB, rules only; path-scoped `.claude/rules/`; procedures as skills; sizes enforced in CI. Status lives in `docs/roadmap.md` and per-slice handover files in `docs/slices/`, never in CLAUDE.md.
- Risk tiers: T0 (auth, RLS/tenancy, personal health data, audit, money/currency, migrations, permissions, infrastructure) — owner reads every line, isolation tests, security review, no auto-merge; T1 (domain services, contracts) — reviewer agent + owner reviews the diff against the spec; T2 (UI polish, copy, docs, tests) — may auto-merge after green CI and reviewer.
- Per-slice loop: spec interview → plan mode in a fresh session → test-first, layered implementation → verification with evidence (including real-backend checks) → independent reviewer + `/code-review` (+ `/security-review` for T0) → small PR (≈1,000 hand-written lines cap) → owner approval by tier → compound step (repeated corrections become rules/hooks).
- Safety: never `bypassPermissions`; deny rules for secrets/data; hooks also guard shell writes; sandbox via WSL2; no real patient data ([ADR-0023](0023-no-real-patient-data-in-dev.md)).
- Cadence: `/clear` between slices, one PR per session, 2–3 parallel worktrees on independent slices, per-phase audits plus an owner walkthrough, golden tasks re-run after model releases.
- Full process: [development workflow](../process/development-workflow.md).

## Consequences
+ Speed of agent development with defects caught early and decisions preserved.
− Up-front Phase 0 investment before visible features.

## Alternatives considered
- Feature-first with tooling added later: measured 22.8 h and 44 h of wasted checks in earlier projects [RN-20 §4] [RN-21 §4].
- Heavy spec frameworks (Spec Kit, Kiro): still "Assess" on the Thoughtworks Radar; risk of instruction bloat [RN-18 §3].

## Sources
[RN-18 §4, §6], [RN-20 §7], [RN-21 §7], [RN-22 §7]
