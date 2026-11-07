# Development workflow

Status: Accepted (ADR-0025) · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-18, RN-20, RN-21, RN-22

How Shifa is built: almost all code is written by Claude Code (Opus 5.5) under the owner's direction. This document defines the operating model: risk tiers, the slice loop, verification, review, instruction files and the Claude Code configuration. It is the reference for every session.

## 1. Principles

1. **Harness over prompt.** Rules that must never break are enforced by hooks, permission deny rules, tests and CI — not by prose. If a written rule is ignored twice, it becomes a hook or a test [RN-18 §4.1].
2. **Verify with evidence.** Every change is proven by a check that passes or fails (tests, typecheck, isolation suite, browser run, screenshots). "Done" without evidence is not done. Do not add generic "double-check" wording to prompts; give mechanisms instead [RN-18 §4.5, §4.13].
3. **Spec first.** No feature code without an approved spec that contains acceptance criteria and a verification contract.
4. **Small slices.** One slice per session, one slice per PR, small diffs [RN-18 §4.6].
5. **Independent review.** The session that wrote the code never approves it. A fresh-context reviewer checks it against the spec.
6. **Compounding.** A correction made twice becomes a rule, a skill, a hook or a test.
7. **No real patient data** anywhere in development ([ADR-0023](../adr/README.md), [data handling](../compliance/data-handling.md)).
8. **Ask, don't guess.** Open questions go to the owner and to [open decisions](../open-decisions.md).

## 2. Risk tiers

Every slice and every PR carries a tier. The tier decides effort level, review depth and who may merge.

| Tier | Areas | Effort | Review gate | Merge |
|---|---|---|---|---|
| T0 critical | Auth and sessions, RLS and tenant context, patient data handling, audit log, clinical record integrity (signing, laterality, tooth numbering), money and exchange rates, migrations, permissions, infrastructure | high / xhigh | Reviewer agent + `/security-review` + owner reads every line + isolation suite green | Owner only |
| T1 core | Domain services, API contracts, data access, clinical templates, scheduling engine | medium (high for tricky logic) | Reviewer agent vs spec + owner reads the diff with the spec | Owner |
| T2 peripheral | UI polish, copy, docs, internal tooling, added tests | medium / low | Reviewer agent; owner checks intent and evidence | Auto-merge allowed when CI is green |

## 3. The slice loop

1. **Spec** — run `/spec`. Claude interviews the owner with recommended options, never guesses open questions, and writes `docs/specs/<area>/<id>-<name>.md`: goal, user stories, acceptance criteria, edge cases, money/abuse/privacy considerations, verification contract (exactly how each criterion will be proven), open questions. Owner approves. A new decision becomes an ADR.
2. **Plan** — fresh session in plan mode; `/slice-plan` writes the plan into the slice file ([docs/slices](../slices/README.md)): layers, files, tests first, risk tier, PR size estimate. Owner approves. For T0, a second session critiques the plan.
3. **Build** — `/build-slice`: failing test first, then implementation layer by layer (contracts → db → API → web → Flutter → end-to-end), `verify` (fast) after each layer, commit at each green checkpoint.
4. **Verify** — full `verify`, isolation suite, browser verification of UI against the real backend (not mocks), Flutter widget/golden tests. Paste the commands and their summarised output as evidence in the slice file.
5. **Review** — reviewer agent against the spec ("correctness only, skip style"); `/code-review`; `/security-review` for T0. Fix real findings; write non-blocking findings to `docs/backlog.md`.
6. **PR** — one slice, linked spec and slice file, evidence, agent-written description checked by the owner. Merge per tier.
7. **Close** — update the slice file (status, "stopped at", evidence), update [roadmap](../roadmap.md) status, apply the compounding rule, end the session with the owner report (§9).

## 4. Definition of done

- [ ] Every acceptance criterion in the spec is met and proven by the evidence listed in the verification contract.
- [ ] Full `verify` green; CI green; no new lint suppressions without a written reason.
- [ ] Tenant isolation, permission matrix and architecture tests green.
- [ ] UI: Arabic RTL checked, keyboard and screen-reader basics, offline behaviour where specified, screenshots attached.
- [ ] No real patient data, secrets or production identifiers in code, fixtures, logs or screenshots.
- [ ] Docs updated where behaviour changed (spec, domain doc, ADR via a new ADR); nothing documented that the code already shows.
- [ ] PR within size budget; slice file and roadmap updated.

## 5. Verification

- `verify` has two modes: **fast** (affected packages, cached; used after every layer and by the Stop hook) and **full** (PR and CI). Both print a short summary and keep full logs on disk. It exists before the first feature [RN-20, RN-21].
- One test run at a time (test guard); per-worker test databases; fixed clocks in tests.
- End-to-end: typed, per-feature mocks for UI tests are allowed, but every critical path (booking, queue, payment, signing a note) also has a smoke test against the real backend [RN-21].
- Clinical calculations (CAL, RUST, EDD, currency conversion and rounding) have table-driven unit tests with worked examples from the domain docs.
- Generated code (API clients, token outputs) is checked for drift, never edited by hand.

## 6. Pull requests

- Size budget: about 1,000 hand-written lines (generated files excluded); CI warns above it and fails above 2,000 unless the owner adds the `size/override` label (`scripts/check-pr-size.mjs`; lockfiles, binaries and `linguist-generated` files are not counted). Split specs by sub-feature, not only by backend/frontend [RN-20].
- Squash-merge one slice per PR; conventional commit title; branches deleted after merge; worktrees pruned weekly.
- No deploy-only or bookkeeping PRs: deployment logs and status live outside feature PRs.

## 7. Working with Claude Code

**Models and effort** [RN-18 §4.13]
- Opus 5.5 at `medium` for most work; `high`/`xhigh` for T0 and for schema changes; `max` only for dedicated security hunts.
- Checker agent on Haiku 5.5. Do not write "think harder" or "keep going"; give a check and use `/goal` or the Stop hook for long runs.

**Context hygiene**
- One slice per session; `/clear` between slices; compact between layers when a session grows; never paste whole logs (use `verify` summaries).
- Use subagents for independent review and noisy exploration, not to "think better". Cap delegation.
- Track context size; vertex-hub's median of ~249k tokens per call is the anti-example [RN-21].

**Parallel work**
- 2–3 sessions in separate git worktrees on independent slices. Schema and API-contract changes are serialised (one at a time).
- `/batch` or workflows only for mechanical fan-out, after a small trial.

**Unattended runs**
- Only with an approved spec, a `/goal` or Stop-hook check, sandboxed permissions, turn/budget limits, and output as a PR.

## 8. Instruction files

| File | Budget | Contains |
|---|---|---|
| `CLAUDE.md` (root) | ≤ 8 KB | Commands, non-negotiables, where decisions live, gotchas |
| `apps/*/CLAUDE.md`, `packages/*/CLAUDE.md` | ≤ 4 KB each | The pattern to copy, exact test command, package-specific gotchas |
| `.claude/rules/*.md` (path-scoped) | ≤ 3 KB each | Rules for migrations, RLS, patient data, logging, RTL, money, Flutter |
| Skills (`.claude/skills/*/SKILL.md`) | Short entry + linked files | Procedures used sometimes |

Rules:
- Write only what the code does not show. No architecture essays, no status, no history, no ALL-CAPS emphasis [RN-18 §4.3, §4.14].
- State each rule once and point to it; repetition is a signal to move it into a hook [RN-21].
- CI checks the byte budgets. Run `/doctor prompt-audit` weekly and after every model release.
- `AGENTS.md` is added only if another agent (for example Codex) joins; then `CLAUDE.md` imports it.

## 9. Session protocol

- **Start:** read [roadmap](../roadmap.md) and the slice file; check `git status` and the branch; restate the goal and the tier.
- **During:** commit at green checkpoints; keep the slice file's "stopped at" line current.
- **End:** update the slice file and roadmap; report to the owner **in Arabic**: what changed, evidence, risks, what is left, and the next session's first message, model and effort.

## 10. Claude Code configuration (built in Phase 0.2)

- **Plan (OD-06, closed 2026-11-08):** the owner's standard Anthropic plan, no HIPAA-style configuration; this holds only while no real patient data enters development ([ADR-0023](../adr/README.md)).
- **Settings:** model `claude-opus-5-5`; default effort per §7; permission mode `auto` with deny rules; `bypassPermissions` is never used. Deny: `.env*`, secrets, data dumps, production config. Ask: push to `main`, applying migrations, deploy.
- **Hooks:**
  - after edits: formatter (Biome/Prettier, `dart format`);
  - before edits: block generated files, applied migrations, locked tests during implementation, env files;
  - Bash guard: block shell writes into source folders (shell edits bypassed formatting in past projects) [RN-21];
  - Stop: fast `verify` of affected packages;
  - session end: warn about uncommitted work.
- **Agents:** `reviewer` (Opus, high, fresh context, healthcare checklist: patient data in logs, tenant scoping, audit of reads, consent, money and rounding, laterality); `checker` (Haiku, runs checks only); `security-reviewer` (T0).
- **Skills:** `/spec`, `/slice-plan`, `/build-slice`, `/db-migration` (expand → migrate → contract; refuses destructive changes), `/rls-policy`, `/add-endpoint`, `/ui-component`, `/flutter-screen`, `/audit-phase`, `/release` (user-invoked only).
- **Plugins and MCP:** TypeScript LSP; official Flutter plugin and Dart MCP server (rules copied into the Flutter app's CLAUDE.md); Figma MCP; browser automation for `/verify`.
- **Environment:** WSL2 (the sandbox does not run on native Windows); sandbox on with a network allowlist.

## 11. Documentation rules

- Repository content is English; the product UI is Arabic-first; the owner is addressed in Arabic.
- [Research archive](../research/README.md) is read-only evidence. ADRs are immutable once accepted; changes come as superseding ADRs.
- Specs are updated when behaviour changes; domain docs hold requirements; the roadmap holds status; slice files hold hand-over. Nothing else holds status.
- Delete stale docs rather than leaving them wrong.

## 12. Cadence

- **Per phase:** audit with parallel read-only reviewers (`/audit-phase`) and an owner walkthrough of the real app before the next phase starts [RN-20].
- **Before first production deploy:** dual independent audit.
- **Weekly:** prune instructions, review backlog and roadmap, read a few session transcripts.
- **After each model or Claude Code release:** re-run a set of golden tasks from this repo; remove scaffolding the new model no longer needs.

## 13. Anti-patterns seen in the owner's earlier projects

| Anti-pattern | Seen in | Countermeasure here |
|---|---|---|
| Verification tooling added late (hours lost to repeated full runs) | vertex-digital, vertex-hub | `verify` and guard in Phase 0.2 |
| Instruction files of 186–206 KB mixing rules, status and history | vertex-digital, fox-drop | Byte budgets checked by CI |
| One shared task file growing to 64 KB | fox-drop, vertex-hub | One slice file per slice; roadmap holds status |
| Very large PRs (10% over 5,500 lines) | vertex-digital | PR size budget |
| Late discovery (523 issues in a final audit) | vertex-digital | Per-phase audits, backlog for non-blocking findings |
| Mock-only end-to-end tests hiding the biggest rework | vertex-hub | Real-backend smoke tests on critical paths |
| Shell edits bypassing the format hook | vertex-hub | Bash guard on source folders |
| Permissions widened over time for speed | earlier projects | Deny rules and hooks stay on; no `bypassPermissions` |
| Auto-merge with no human review | fox-drop | Tiered merge rights |
| Heavy generated Dart client from unnamed schemas | fox-drop | Named Zod schemas, precise nullability, lighter generator (ADR-0013) |
