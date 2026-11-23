# Cloud sessions (Claude Code on the web)

Status: Living · Last updated: 2026-11-23 · Owner: product owner
Sources: [WSL2 setup](wsl2-setup.md), [development workflow](development-workflow.md) §7 and §10, ADR-0028, ADR-0033, OD-24, OD-49, OD-81, OD-83, OD-84, [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)

Purpose: how to work on Shifa in a Claude Code cloud session (claude.ai/code or the Claude app), what the cloud container gives you, and what differs from the WSL2 machine ([setup guide](wsl2-setup.md)), which stays the primary environment. The rules of `CLAUDE.md` apply unchanged; only the mechanics below differ.

## 1. The environment

Cloud sessions run in the owner's personal cloud environment named `shifa`, attached to `HussienALfajer/shifa`. It is configured in claude.ai (environment settings), not in this repository, so nothing here is secret or applies to anyone else. Its setup script runs when a container is built fresh, after the clone, and:

- installs Node 24 (`.nvmrc`) ahead of the image's Node on every shell's PATH; pnpm 12 comes from `packageManager`;
- installs `bubblewrap` and `socat`, which `pnpm env:check` expects;
- downloads the Flutter SDK pinned in `.github/workflows/ci.yml` (`FLUTTER_VERSION`, checked against `FLUTTER_SHA256`) to `/opt/flutter` and links it as the git-ignored `.fvm/flutter_sdk`, so `node scripts/dart.mjs` finds it without FVM;
- makes `/opt/flutter` owned by root (`chown -R root:root`) and creates `/root/.dart-tool`, so sandboxed Flutter commands can write there (section 3);
- points Docker at the `mirror.gcr.io` registry mirror (Docker Hub refuses anonymous pulls from the cloud) and starts `dockerd` in login shells;
- runs `pnpm install --frozen-lockfile` and `flutter pub get --enforce-lockfile`, as CI does;
- installs the Chromium of the pinned `playwright` package into `/opt/pw-browsers` (`pnpm --filter @shifa/ui exec playwright install chromium`, from `cdn.playwright.dev`), as CI does: the image ships an older Playwright's browsers, and without this `ui-browser` and `ui-storybook` fail with `Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-<rev>`;
- writes the git-ignored `.claude/settings.local.json` with `{"sandbox": {"enabled": false}}` (OD-83), which outranks `.claude/settings.json`: cloud sessions run without the Bash sandbox, WSL2 keeps it (section 3).

Network access is `Full` (OD-84, owner, 2026-11-23): the session can reach any public host. The hosts the work actually needs are package registries, MCP servers, `storage.googleapis.com` (Flutter SDK), `mirror.gcr.io` (Docker images) and `cdn.playwright.dev` (Playwright's browsers); if the environment is set back to `Limited`, these are the allowlist, and a refused host is added by name in the environment settings rather than worked around. The container is ephemeral: work that is not pushed is lost when the session ends.

When `ci.yml` moves to a new Flutter version, the next fresh container installs it; a running container keeps the old SDK until it is rebuilt.

## 2. First check in a session

```bash
pnpm env:check
pnpm verify
```

Confirmed 2026-11-23 in the first session whose container was built with the OD-83 setup script (sandbox off):

| Check | Cloud result | Meaning |
|---|---|---|
| `env:check` | every item `ok`, `docker` included (daemon 29.10.0) | Node reaches Docker |
| `verify:full`, first run | 12 of 14 steps pass; `ui-browser` and `ui-storybook` `fail` with `Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1255` | The image ships Playwright 1.63's browsers (revision 1243); the repository pins 1.65.1 (revision 1255), and `cdn.playwright.dev` was not allowed |
| `verify:full`, after allowing `cdn.playwright.dev` and installing the pinned Chromium | all 14 steps pass, `all green`, 7 min 18 s wall time | Includes `@shifa/db` against PostgreSQL 18 and PgBouncer in Testcontainers (27 files, 156 tests, isolation suite included), `apps/api` (34 files, 224 tests), the script tests with the Docker suites (583 pass, 0 skipped), Vitest browser mode (66 files) and story tests (37 files) in Chromium, `boot`, and the screenshots in the Playwright Docker image |

The setup script now installs that Chromium (section 1); a container built before that change lacks it until the same command is run by hand. Whether a container built with the new script passes `verify:full` without that manual step is unproven until a fresh session confirms it.

The table below is the sandboxed state, still what a container built before OD-83 shows (checked 2026-11-17):

| Check | Cloud result | Meaning |
|---|---|---|
| `env:check`: `node`, `pnpm`, `flutter`, `git autocrlf`, `line endings`, `repo location`, `bwrap`, `socat` | `ok` | Toolchain installed |
| `env:check`: `docker` | `fail` (Docker daemon not reachable) | Expected: `env:check` runs `docker` from Node, which stays sandboxed. A `docker` command typed directly works (OD-49). See section 3 |
| `verify`: script tests, format, lint, file length, drift, instructions | pass | Node side ready |
| `verify`: `pub-get`, `typecheck+lint+test` | pass once the container is built with the current setup script; `fail` (`Permission denied` under `/opt/flutter/bin/cache`, then `typecheck+lint+test` skipped) in a container built before it | See section 3 |

Any other `fail` means the setup script did not finish; read the fix `env:check` prints, or start a new session so the container is rebuilt.

## 3. The sandbox: off in the cloud (OD-83)

Since OD-83 (owner, 2026-11-23) cloud sessions run Bash without the sandbox, so everything a terminal on the owner's machine runs also runs in the session: the database tests (Testcontainers), the isolation suite, the Docker script suites, screenshots in Docker, Playwright against the real backend, `obs:*` and `backup:*`. The setup script turns it off through the git-ignored `.claude/settings.local.json`; `.claude/settings.json` and its policy test are unchanged, and WSL2 keeps the sandbox. What still bounds a session: the ephemeral container (nothing on the owner's machine is reachable) and the hooks (no `--no-verify`, no force push, no push to `main`). Accepted risk: a command Claude runs, or is steered to by injected text, runs unrestricted inside the container, which holds the checkout and can push to the session's branch (already possible since OD-81), and, with network access `Full` (OD-84), can reach any public host. Not available in the cloud: the Android emulator (no KVM), Windows-only checks, physical devices.

The rest of this section describes the sandboxed state: WSL2, and a cloud container built before OD-83. There, Bash commands run in a sandbox (bubblewrap) built from the session's limits plus this repository's `sandbox` settings in `.claude/settings.json`, and retrying unsandboxed is disabled, as in WSL2 (OD-24). The owner allowed these exceptions (OD-49, OD-81), pinned by `scripts/test/sandbox-policy.test.mjs`:

- `excludedCommands: ["docker *"]`: a command that **starts with** `docker` (`docker info`, `docker compose ps`, `docker logs ...`) runs outside the sandbox, with the daemon's root access. The bare `"docker"` did not match `docker info`; the ` *` is needed. Docker started by another program does not match: `pnpm env:check`, the database tests (Testcontainers), the Docker script suites (OD-32), `obs:*` and `backup:*` all start it from Node, so they still meet the sandbox (`permission denied ... docker.sock`) and run in CI.
- `filesystem.allowWrite: ["//opt/flutter/bin/cache", "~/.dart-tool"]`: Flutter rewrites `bin/cache/engine.stamp` in its SDK on every run and creates `~/.dart-tool`. In WSL2 the FVM SDK lives under `~/fvm`, so the `/opt/flutter` entry only matters in the cloud.
- `excludedCommands` for git (OD-81): `git commit *`, `git push *`, `git merge *`, `git rebase *`, `git cherry-pick *`, `git revert *` and `git pull *` run outside the sandbox, so commits are signed and pushes authenticated as on a local machine (section 4). Only a command typed with that start matches (`git -C dir push` does not); the `guard-bash` hook still checks it first.

The exception is not enough on its own: the SDK archive unpacks with its owner (`nobody`), and root inside the sandbox has no override, so writes to files it does not own are refused (`Permission denied`); a sandboxed command also cannot create `~/.dart-tool`, only write inside it once it exists. The setup script therefore runs, after the Flutter step, `chown -R root:root /opt/flutter` and `mkdir -p /root/.dart-tool`; a sandboxed command cannot do either itself (`Operation not permitted`, `Read-only file system`).

Checked 2026-11-17 against a root-owned copy of the SDK and a HOME with an empty `.dart-tool`: `flutter pub get --enforce-lockfile` and the whole of `pnpm verify` pass inside the sandbox. Flutter writes only these paths on a run:

- `/opt/flutter/bin/cache` (`engine.stamp`, `engine.realm`, `lockfile`, `*.stamp`);
- `~/.dart-tool` (analytics state: `CLIENT_ID`, `dart-flutter-telemetry*`);
- inside the repository (`.dart_tool/`), which the sandbox allows.

`~/.pub-cache` and `~/.config/flutter` are only read, because the setup script's `pub get` fills the cache; a lockfile change that needs a new package still downloads into `~/.pub-cache` and is refused until the next fresh container. Flutter's analytics calls to `www.google-analytics.com` are refused by the network proxy; that is noise in the sandbox log, not a failure. One SDK file (`bin/cache/artifacts/material_fonts/codepoints`, mode `640`) cannot be read in the sandbox; `pub get` and `verify` do not use it.

A container built before this setup-script change still fails `pub-get`; start a new session to get one built with it. A copy of the SDK inside the repository is no way out: ESLint then scans it and runs out of memory.

With the sandbox off (OD-83), run the Docker-backed checks a change needs in the session, as on the owner's machine (`pnpm verify`, and `pnpm verify:full` for the paths in ADR-0033); CI's `verify (full)` stays the merge gate. In a sandboxed container (built before OD-83) the gate is CI alone: say so in the report, as `CLAUDE.md` "Finishing a task" step 4 asks, and read the PR's CI result before calling the work done. Docs-only changes are unaffected: CI runs `verify docs`.

## 4. GitHub: commits and PRs without `gh`

The cloud container has no authenticated `gh` CLI; GitHub's API is reached through the session's GitHub MCP tools, scoped to this repository. Inside the Bash sandbox `git commit` and `git push` would fail: the container signs commits and authenticates pushes through local services that a sandboxed command cannot reach (`fatal: failed to write commit object`, `could not read Username for 'https://github.com'`). Since OD-81 the git commands that sign or push run outside the sandbox (section 3), so commits and pushes work as on a local machine. A session started before that change was merged still has the old settings: there, commit and push with GitHub MCP `push_files` onto the session's branch (created from `main` with `create_branch`) and `git fetch` afterwards, since the local checkout then lags the remote branch. `CLAUDE.md` step 6 maps to:

| Step | WSL2 / Windows | Cloud session |
|---|---|---|
| Commit and push | `git commit`, `git push -u origin <branch>` | the same (OD-81) |
| Open the PR | `gh pr create --base main` | GitHub MCP `create_pull_request` (base `main`, `## Summary`, `## Test plan`) |
| Auto-merge | `gh pr merge --auto --squash` | GitHub MCP `enable_pr_auto_merge` (squash) |
| Auto-fix | toggled in the Claude app | subscribe the session to the PR's activity (comments and CI arrive as turns) |

The session's branch is assigned by the cloud session (`claude/<name>`); it replaces the `feat/`, `fix/`, `chore/`, `docs/` naming of step 1 for that session.

## 5. Differences from WSL2

- **Hooks** in `.claude/hooks/` are part of the repository and load in cloud sessions too; they need only `node`.
- **Sandbox** combines the cloud session's own limits with the repository's `sandbox` settings; `.claude/settings.json`, hooks, skills and commands are read-only from Bash, so change them with the editor tools, on a branch, through a PR.
- **The owner's cleanup line** (`cd D:\shifa; ...`) in the report still applies: it runs on the owner's machine after the merge.
- **Stray files:** while a sandboxed command runs, `git status` can list untracked `.bashrc`, `.gitconfig`, `.mcp.json`, `.idea`, `.claude/commands` and similar in the repository. They are the sandbox's placeholders (character devices that point to `/dev/null`), not project files: never `git add -A` or `git add .`; add paths by name (`CLAUDE.md` step 3).
- **Commit signing:** the container signs commits through a global `commit.gpgsign`. Tests that build throwaway git repositories set `commit.gpgsign false` in them, so they do not depend on the machine.
- **No real patient data**, as everywhere (`docs/compliance/data-handling.md`).
