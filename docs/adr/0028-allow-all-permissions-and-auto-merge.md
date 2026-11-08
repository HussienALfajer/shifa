# ADR-0028: Allow all Claude Code permissions, including secret files; auto-merge every PR

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)
Supersedes: the secret-file rules of [ADR-0027](0027-owner-chooses-permission-mode.md) and of the Safety rule in [ADR-0025](0025-development-methodology-claude-code.md); the owner-only merge column of `docs/process/development-workflow.md` §2.

## Context
On 2026-11-08 the owner asked that Claude Code sessions in this repository run with no permission prompts and no refusals, `.env` files included, and that every pull request Claude opens gets auto-merge and auto-fix turned on.

## Decision
- `.claude/settings.json` has no `deny` or `ask` rules; `allow` lists every built-in tool.
- The hooks no longer guard secret files: Claude may read and edit `.env*`, private keys, `secrets/`, dumps and data exports.
- The other guards stay: shell writes into source folders, generated files and the lockfile, the research archive, accepted ADRs, merged migrations, locked tests, `--no-verify`, force pushes, pushes to `main`, and Claude starting sessions that skip permissions. Formatter and Stop `verify` stay.
- Every PR Claude opens gets auto-merge and auto-fix (CI monitoring) enabled. Branch protection and green CI remain the gate; the owner may still review any PR before CI finishes.

## Consequences
+ No prompts or refusals during sessions; PRs land as soon as CI is green.
− Secrets read by Claude enter the conversation context. `.gitignore` and the CI secret scan are the only barriers to committing them; this repository is public (ADR-0026).
− T0/T1 changes can merge without the owner reading every line. Revisit before production credentials or real patient data exist.
