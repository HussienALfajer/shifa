# Backlog

Status: Living · Last updated: 2026-11-08 · Owner: product owner

Non-blocking findings from reviews and small follow-ups. Each item names its source; remove it when done.

- **CI pub cache** (0.2-04 review): cache `~/.pub-cache` in the `verify` job, keyed on `pubspec.lock`, with a SHA-pinned `actions/cache`. Speed only.
- **Dart vulnerability scanning** (0.2-04 security review): nothing scans `pubspec.lock` for advisories; Dependabot alerts are off. Turn on Dependabot alerts (owner, repo settings) or add a checksum-pinned OSV-Scanner step to the `audit` job.
- **pub minimum release age** (0.2-04 security review): pub has no 24-hour guard like pnpm; add a CI check that fails when a `pubspec.lock` entry changed against the base was published on pub.dev less than 24 hours ago.
- **Dart format scope** (0.2-04 review): package `lint` scripts check `lib test`; use `.` once a package has `bin/`, `tool/` or `integration_test/`.
- **Health probe off the admin path** (0.2-06a security review L2): `/health/ready` and the startup check use `withPlatformAdmin('health-check', …)`. Before the audit slice gives that path its own role and audit rows, add `db.ping()` to `@shifa/db` (role check kept, no admin context) and switch both callers; also keep `/health/*` off the public route at the proxy.
- **Client-chosen request ids** (0.2-06a security review L7): any client may pick its `x-request-id` (strictly formatted). Once the reverse proxy exists, accept it only from the proxy or log the client's value under a separate key.
- **Bundled driver version** (0.2-06a review): the API bundles `@shifa/db` but resolves `pg` and `drizzle-orm` from its own pins. Add a check that `apps/api` and `packages/db` pin the same versions.
- **tsdown's `yuku` dependency** (0.2-06a security review): `rolldown-plugin-dts` pulls `yuku` (single maintainer, native binaries) though `dts: false` never loads it; watch it at each tsdown upgrade.
