# Backlog

Status: Living · Last updated: 2026-11-08 · Owner: product owner

Non-blocking findings from reviews and small follow-ups. Each item names its source; remove it when done.

- **CI pub cache** (0.2-04 review): cache `~/.pub-cache` in the `verify` job, keyed on `pubspec.lock`, with a SHA-pinned `actions/cache`. Speed only.
- **Dart vulnerability scanning** (0.2-04 security review): nothing scans `pubspec.lock` for advisories; Dependabot alerts are off. Turn on Dependabot alerts (owner, repo settings) or add a checksum-pinned OSV-Scanner step to the `audit` job.
- **pub minimum release age** (0.2-04 security review): pub has no 24-hour guard like pnpm; add a CI check that fails when a `pubspec.lock` entry changed against the base was published on pub.dev less than 24 hours ago.
- **Lint: dynamic `@shifa/db/testing`** (0.2-05 review): `no-restricted-syntax` blocks `import()`/`require()` of raw drivers but not of `@shifa/db/testing`; static imports of it are already blocked outside test files.
- **Dart format scope** (0.2-04 review): package `lint` scripts check `lib test`; use `.` once a package has `bin/`, `tool/` or `integration_test/`.
