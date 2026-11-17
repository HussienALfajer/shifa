# Cloud sessions (Claude Code on the web)

Status: Living · Last updated: 2026-11-17 · Owner: product owner
Sources: [WSL2 setup](wsl2-setup.md), [development workflow](development-workflow.md) §7 and §10, ADR-0028, ADR-0033, OD-24, [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)

Purpose: how to work on Shifa in a Claude Code cloud session (claude.ai/code or the Claude app), what the cloud container gives you, and what differs from the WSL2 machine ([setup guide](wsl2-setup.md)), which stays the primary environment. The rules of `CLAUDE.md` apply unchanged; only the mechanics below differ.

## 1. The environment

Cloud sessions run in the owner's personal cloud environment named `shifa`, attached to `HussienALfajer/shifa`. It is configured in claude.ai (environment settings), not in this repository, so nothing here is secret or applies to anyone else. Its setup script runs when a container is built fresh, after the clone, and:

- installs Node 24 (`.nvmrc`) ahead of the image's Node on every shell's PATH; pnpm 12 comes from `packageManager`;
- installs `bubblewrap` and `socat`, which `pnpm env:check` expects;
- downloads the Flutter SDK pinned in `.github/workflows/ci.yml` (`FLUTTER_VERSION`, checked against `FLUTTER_SHA256`) to `/opt/flutter` and links it as the git-ignored `.fvm/flutter_sdk`, so `node scripts/dart.mjs` finds it without FVM;
- points Docker at the `mirror.gcr.io` registry mirror (Docker Hub refuses anonymous pulls from the cloud) and starts `dockerd` in login shells;
- runs `pnpm install --frozen-lockfile` and `flutter pub get --enforce-lockfile`, as CI does.

Network access is limited: package registries, MCP servers, `storage.googleapis.com` (Flutter SDK) and `mirror.gcr.io`. Anything else is refused by the proxy; ask the owner to add an exact host in the environment settings rather than working around it. The container is ephemeral: work that is not pushed is lost when the session ends.

When `ci.yml` moves to a new Flutter version, the next fresh container installs it; a running container keeps the old SDK until it is rebuilt.

## 2. First check in a session

```bash
pnpm env:check
pnpm verify
```

Expected in a cloud session (checked 2026-11-17):

| Check | Cloud result | Meaning |
|---|---|---|
| `env:check`: `node`, `pnpm`, `flutter`, `git autocrlf`, `line endings`, `repo location`, `bwrap`, `socat` | `ok` | Toolchain installed |
| `env:check`: `docker` | `fail` (Docker daemon not reachable) | Expected: `dockerd` runs, but the Bash sandbox refuses its socket. See section 3 |
| `verify`: script tests, format, lint, file length, drift, instructions | pass | Node side ready |
| `verify`: `pub-get`, then `typecheck+lint+test` skipped | `fail` (`Read-only file system` under `/opt/flutter/bin/cache` and `~/.dart-tool`) | Expected: Flutter writes into its SDK and the home folder on every run, and the Bash sandbox allows writes only in the repository and the temp folder. See section 3 |

Any other `fail` means the setup script did not finish; read the fix `env:check` prints, or start a new session so the container is rebuilt.

## 3. What runs only in CI

Bash commands in a cloud session run in a sandbox (bubblewrap) built from the session's limits plus this repository's `sandbox` settings in `.claude/settings.json`, and retrying unsandboxed is disabled, as in WSL2 (OD-24). Two kinds of check cannot run there:

- **Docker-backed:** the database tests (Testcontainers), the Docker script suites (OD-32), `obs:*` and `backup:*`. The sandbox refuses `/var/run/docker.sock` (`permission denied`).
- **Flutter and Dart:** `pub-get` and every task behind it in `verify` (the TypeScript typecheck, lint and tests included, since `verify` skips them once `pub-get` fails). Flutter rewrites `bin/cache/engine.stamp` in its SDK on each run and creates `~/.dart-tool`; both are outside the sandbox's writable paths. A copy of the SDK inside the repository is no way out: ESLint then scans it and runs out of memory.

So in a cloud session `pnpm verify` ends red on those steps, and the gate is CI: `verify (full)` on every PR (ADR-0033). Say so in the report, as `CLAUDE.md` "Finishing a task" step 4 asks, and read the PR's CI result before calling the work done. Making them run in the session would mean widening the sandbox (`sandbox.filesystem.allowWrite` for the Flutter paths, or `sandbox.excludedCommands` for `docker`), which is an owner decision, not something a session changes on its own.

Docs-only changes are unaffected: CI runs `verify docs`.

## 4. GitHub: commits and PRs without `gh`

The cloud container has no authenticated `gh` CLI; GitHub is reached through the session's GitHub MCP tools, scoped to this repository. Inside the Bash sandbox, `git commit` and `git push` also fail: the container signs commits and authenticates pushes through local services that a sandboxed command cannot reach (`fatal: failed to write commit object`, `could not read Username for 'https://github.com'`). So `CLAUDE.md` step 6 maps to:

| Step | WSL2 / Windows | Cloud session |
|---|---|---|
| Commit and push | `git commit`, `git push -u origin <branch>` | GitHub MCP `push_files` (one commit with the changed files, by name) onto the session's branch, created from `main` with `create_branch` |
| Open the PR | `gh pr create --base main` | GitHub MCP `create_pull_request` (base `main`, `## Summary`, `## Test plan`) |
| Auto-merge | `gh pr merge --auto --squash` | GitHub MCP `enable_pr_auto_merge` (squash) |
| Auto-fix | toggled in the Claude app | subscribe the session to the PR's activity (comments and CI arrive as turns) |

The local checkout then lags the remote branch; run `git fetch` before later work in the same session. The session's branch is assigned by the cloud session (`claude/<name>`); it replaces the `feat/`, `fix/`, `chore/`, `docs/` naming of step 1 for that session.

## 5. Differences from WSL2

- **Hooks** in `.claude/hooks/` are part of the repository and load in cloud sessions too; they need only `node`.
- **Sandbox** combines the cloud session's own limits with the repository's `sandbox` settings; `.claude/settings.json`, hooks, skills and commands are read-only from Bash, so change them with the editor tools, on a branch, through a PR.
- **The owner's cleanup line** (`cd D:\shifa; ...`) in the report still applies: it runs on the owner's machine after the merge.
- **Stray files:** while a sandboxed command runs, `git status` can list untracked `.bashrc`, `.gitconfig`, `.mcp.json`, `.idea`, `.claude/commands` and similar in the repository. They are the sandbox's placeholders (character devices that point to `/dev/null`), not project files: never `git add -A` or `git add .`; add paths by name (`CLAUDE.md` step 3).
- **Commit signing:** the container signs commits through a global `commit.gpgsign`. Tests that build throwaway git repositories set `commit.gpgsign false` in them, so they do not depend on the machine.
- **No real patient data**, as everywhere (`docs/compliance/data-handling.md`).
