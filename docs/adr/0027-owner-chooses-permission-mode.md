# ADR-0027: The owner chooses the Claude Code permission mode; `bypassPermissions` allowed

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)
Supersedes: the "never `bypassPermissions`" part of the Safety rule in [ADR-0025](0025-development-methodology-claude-code.md).

## Context
Slice 0.2-03 set `"disableBypassPermissionsMode": "disable"` in `.claude/settings.json`, following ADR-0025. On 2026-11-08 the owner chose `bypassPermissions` as the default mode in the Claude desktop app and asked for the project lock to be removed, so that sessions in this repository run without permission prompts.

## Decision
- `.claude/settings.json` no longer disables `bypassPermissionsMode`. The permission mode is each developer's choice in their own settings or the app; `auto` stays the recommendation.
- Hooks are unchanged and run in every mode: edit guard (secrets, generated files, lockfile, research archive, accepted ADRs, merged migrations, locked tests), shell guard (writes into source folders, reading secrets, `--no-verify`, force pushes, pushes to `main`), formatter and Stop `verify`.
- Claude itself never starts another session that skips permissions: the shell guard still refuses `--dangerously-skip-permissions` and `--permission-mode bypassPermissions`.
- Branch protection, required CI and owner review of T0/T1 PRs stay the hard gates.

## Consequences
+ No permission prompts during long slice sessions.
− Nothing asks before commands the hooks do not recognise (for example `cp`/`mv` or `node -e` writes into source folders, deleting files, network calls); the `ask` rules for merge, migrate and deploy may not prompt. Until the WSL2 sandbox (slice 0.2-09) this relies on the hooks, CI and review.
− Revisit before real infrastructure credentials or production access exist on a developer machine.
