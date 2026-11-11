# WSL2 development setup

Status: Accepted (spec 0.2-09a) · Last updated: 2026-11-11 · Owner: product owner
Sources: [spec 0.2-09a](../specs/foundation/0.2-09a-wsl2-move.md), ADR-0023, ADR-0025, ADR-0027, ADR-0028

Purpose: the one guide to set up the primary development environment, Ubuntu 26.04 LTS in WSL2, with Node 24, pnpm 12, FVM Flutter, Docker and the Claude Code sandbox. Linux matches CI, and the Claude Code sandbox (filesystem and network isolation) only runs there. The Windows checkout (`D:\shifa`) stays supported as a fallback without the sandbox. Run every command in a plain Ubuntu terminal unless a step says PowerShell; do the setup outside a Claude session, since the sandbox allowlist does not cover installers.

When you finish, `pnpm env:check` prints `ok` on every line. Each `fail` it can print has a fix in [Troubleshooting](#troubleshooting).

## 1. Install Ubuntu in WSL2 (PowerShell, as administrator)

```powershell
wsl --install -d Ubuntu-26.04
```

Restart when asked, open "Ubuntu 26.04" from the Start menu and create your Linux user. Then limit the memory WSL2 may take, in `%UserProfile%\.wslconfig` (create the file):

```ini
[wsl2]
memory=8GB
```

Pick about half your RAM. Apply it with `wsl --shutdown` in PowerShell and open Ubuntu again.

## 2. WSL settings (Ubuntu)

Edit `/etc/wsl.conf` with `sudo nano /etc/wsl.conf`:

```ini
[boot]
systemd=true

[interop]
appendWindowsPath=false
```

`appendWindowsPath=false` keeps the Windows `node`, `pnpm` and `flutter` off the Linux PATH, so they cannot shadow the Linux ones. The cost: `code .` and `explorer.exe` no longer work from Ubuntu (open folders from VS Code instead, step 9), `gh auth login` and the Claude login print a URL to open in the Windows browser, and Docker's Windows credential helper is out of reach (see the `docker pull` row in [Troubleshooting](#troubleshooting)). Apply with `wsl --shutdown` in PowerShell.

## 3. System packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl zip unzip xz-utils bubblewrap socat
```

`bubblewrap` (`bwrap`) and `socat` are what the Claude Code sandbox needs on Linux.

## 4. Docker (Docker Desktop on Windows)

Docker Engine is not installed inside Ubuntu; Docker Desktop provides it. In Docker Desktop: **Settings → General → Use the WSL 2 based engine** on, then **Settings → Resources → WSL integration** → enable **Ubuntu-26.04** → Apply & restart. Check in Ubuntu:

```bash
docker info --format '{{.ServerVersion}}'
```

Database tests (Testcontainers) use this daemon.

## 5. Node 24 and pnpm 12

The repository pins Node in `.nvmrc` and pnpm in `package.json` (`packageManager`). Install [fnm](https://github.com/Schniz/fnm) and let it follow `.nvmrc`:

```bash
curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
```

Add these lines to the end of **both** `~/.bashrc` and `~/.profile` (the second makes `node` visible to non-interactive shells, which the Claude Code hooks use):

```bash
FNM_PATH="$HOME/.local/share/fnm"
export PATH="$FNM_PATH:$PATH"
eval "$(fnm env --use-on-cd --shell bash)"
```

Open a new terminal, then:

```bash
fnm install 24
fnm default 24
corepack enable
bash -lc 'command -v node && node --version'
```

Corepack (shipped with Node 24) reads `packageManager` and runs exactly that pnpm version inside the repository.

## 6. Dart and FVM Flutter

FVM itself needs a Dart SDK. Install Dart from Google's apt repository (dart.dev, "Install using apt-get"):

```bash
sudo apt install -y apt-transport-https gpg
wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/dart.gpg
echo 'deb [signed-by=/usr/share/keyrings/dart.gpg arch=amd64] https://storage.googleapis.com/download.dartlang.org/linux/debian stable main' | sudo tee /etc/apt/sources.list.d/dart_stable.list
sudo apt update && sudo apt install -y dart
```

Then the pinned FVM, and its bin folder on PATH (append to `~/.bashrc` and `~/.profile`):

```bash
dart pub global activate fvm 4.3.2
export PATH="$PATH:$HOME/.pub-cache/bin"
```

`fvm install` runs after the clone (step 8). Never use a global Flutter: Dart tools run through `node scripts/dart.mjs` (`.claude/rules/dart.md`).

## 7. Git and GitHub

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global core.autocrlf false
git config --global init.defaultBranch main
```

Use the same name and email as on Windows. `core.autocrlf` must not be `true`: the repository stores LF (`.gitattributes`) and a Linux checkout must not convert it. Install the GitHub CLI (cli.github.com, "Linux → Debian/Ubuntu"), then:

Sign in with a **fine-grained token limited to this repository** (OD-26), not the default browser login, whose token can also write gists in any account repository. On github.com: Settings → Developer settings → Fine-grained tokens → Generate; Repository access: only `shifa`; permissions: Contents, Pull requests and Workflows read and write, Actions, Checks and Commit statuses read; no account permissions. Then:

```bash
gh auth login --with-token   # paste the token, then Ctrl+D
gh auth setup-git
```

In WSL there is usually no keyring, so gh stores the token in `~/.config/gh/hosts.yml` in plain text; the narrow scope is what limits the damage if it leaks.

## 8. Clone into the Linux filesystem

```bash
mkdir -p ~/src
git clone https://github.com/HussienALfajer/shifa.git ~/src/shifa
cd ~/src/shifa
fvm install
pnpm install
```

Clone into `~/src/shifa`, never under `/mnt/c` or `/mnt/d`: Windows drives are slow from Linux, file watching does not work there and file permissions are wrong. `env:check` fails if the repository is under `/mnt/`.

**`.env` files:** none is copied from Windows. Where a package has a `.env.example`, create its `.env` from it (`cp .env.example .env`) and fill in development values only; never production values (ADR-0023, `docs/compliance/data-handling.md`). No `.env.example` is tracked yet.

**Two checkouts:** `D:\shifa` and `~/src/shifa` are independent clones. Move work between them through GitHub only (push from one, pull in the other). Never open one working tree from both sides, never point WSL at `D:\shifa`.

## 9. Editors and Claude Code

- **VS Code:** install the "WSL" extension (Remote - WSL) on Windows, then **F1 → WSL: Open Folder in WSL...** → `~/src/shifa`. Extensions run inside Ubuntu.
- **Claude desktop app:** open the folder `\\wsl.localhost\Ubuntu-26.04\home\<user>\src\shifa` as the project. If the app cannot run a session there, use the CLI below.
- **Claude Code CLI (fallback, and always valid):** install it inside Ubuntu (`curl -fsSL https://claude.ai/install.sh | bash`), then `cd ~/src/shifa && claude`.

The project settings (`.claude/settings.json`) keep `sandbox.enabled: true` with an exact-domain network allowlist, ignore unsandboxed retries (`allowUnsandboxedCommands: false`, OD-24) and deny sandboxed reads of `~/.ssh`, the Claude credentials file and the Windows drives (OD-26). WebFetch is not covered by the sandbox (accepted risk, OD-25). The hooks run `node`, so `bash -lc 'command -v node'` (step 5) must print a path.

Two settings only work from your user settings, because they would break the Windows fallback or are ignored in project settings. Create `~/.claude/settings.json` **inside Ubuntu** (not on Windows):

```json
{
  "sandbox": {
    "failIfUnavailable": true,
    "network": { "strictAllowlist": true }
  }
}
```

`failIfUnavailable` stops a session from silently running unsandboxed when `bwrap` or `socat` is broken; `strictAllowlist` refuses unlisted hosts instead of asking.

**Database tests and the sandbox:** the sandbox blocks the Docker socket, so Docker-backed tests (Testcontainers) cannot run inside a sandboxed session (OD-24). CI runs them in `verify:full` on every PR; run `pnpm verify:full` yourself in a plain Ubuntu terminal when you need them locally. The Stop hook runs outside the sandbox.

**Caches outside the repository:** sandboxed commands may write only inside the project, while `pnpm install` (store under `~/.local/share/pnpm`), `fvm install` (`~/fvm`), `pub get` (`~/.pub-cache`) and Corepack (`~/.cache/node/corepack`) write to the home folder. Run installs in the plain terminal. The acceptance run records which of them fail inside a session; a `sandbox.filesystem.allowWrite` entry is added only for a path proven necessary, with the reason in the commit.

## 10. Check

```bash
cd ~/src/shifa
pnpm env:check
pnpm verify:full
node scripts/run-script-tests.mjs
git status
```

`env:check` must show `ok` on every line, `verify:full` must end with `all green`, and `git status` must be clean afterwards. Run these in the plain terminal (outside Claude). Then, inside a Claude session in `~/src/shifa`, in the client you will use day to day, check the sandbox:

| Command (ask Claude to run it) | Expected |
|---|---|
| `curl https://example.com` | refused |
| the same, asking Claude to retry with the sandbox disabled | still refused |
| `touch ~/outside-shifa.txt` | refused |
| `cat ~/.ssh/known_hosts` (or any file in `~/.ssh`) | refused |
| `ls /mnt/c/Users` | refused |
| `/mnt/c/Windows/System32/cmd.exe /c ver` | refused |
| `pnpm view zod version` | works |
| `docker info` | record what happens (expected: refused) |

## Troubleshooting

| `env:check` line | Cause | Fix |
|---|---|---|
| `node fail` | Node other than 24 on PATH | `fnm install 24 && fnm default 24`; check `~/.bashrc` and `~/.profile` (step 5); `appendWindowsPath=false` (step 2) |
| `pnpm fail` (not found or other version) | Corepack off, or a global pnpm shadows it | `corepack enable`; remove other pnpm installs (`npm rm -g pnpm`) |
| `flutter fail` (no FVM SDK) | `fvm install` not run, or FVM missing | Step 6, then `fvm install` in `~/src/shifa` |
| `flutter fail` (other version) | `.fvmrc` changed since the last install | `fvm install && fvm use` in `~/src/shifa` |
| `docker fail` | Docker Desktop stopped, or WSL integration off | Start Docker Desktop; Settings → Resources → WSL integration → Ubuntu-26.04 on (step 4) |
| `git autocrlf fail` | `core.autocrlf=true` | `git config --global core.autocrlf false` (and without `--global` inside the repository if set there) |
| `git autocrlf warn` (Windows only) | Git for Windows sets `true` system-wide; `.gitattributes` overrides it here | Optional: `git config --global core.autocrlf false` in Git Bash |
| `line endings fail` | A tracked file was committed with CRLF | `git add --renormalize .`, commit the listed files on a branch |
| `repo location fail` | Repository under `/mnt/` | Clone again into `~/src/shifa` (step 8); delete the `/mnt/` copy after pushing its work |
| `bwrap fail` / `socat fail` | Sandbox packages missing | `sudo apt install bubblewrap socat` |
| (not an `env:check` line) `docker pull` fails: `docker-credential-desktop.exe` not found | `appendWindowsPath=false` hides Docker Desktop's credential helper named in `~/.docker/config.json` | Remove the `"credsStore": "desktop.exe"` line from `~/.docker/config.json` (public images need no login) |
| `sandbox warn` (Windows only) | Running in `D:\shifa` | Expected on the Windows fallback: hooks apply, the sandbox does not; use WSL2 for sandboxed sessions |

On the Windows fallback (`D:\shifa`, Git Bash), `pnpm verify` and the script tests keep working; data rules are the same (synthetic data only).
