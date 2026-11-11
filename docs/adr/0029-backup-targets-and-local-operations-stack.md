# ADR-0029: Backup targets (RPO 5 min, RTO 4 h) and a local-first operations stack

Status: Accepted · Date: 2026-11-11 · Deciders: product owner (with Claude)

## Context
[ADR-0022](0022-deployment-portable-hosting.md) chose pgBackRest, OpenTelemetry and GlitchTip but stays Proposed until the hosting location is decided (OD-01). Phase 0.2 still needs backups and observability proven before any real data exists, and the backup scripts need concrete targets. On 2026-11-11 the owner answered the questions of the 0.2-09 specs.

## Decision
- Backup targets for PostgreSQL: data loss at most 5 minutes (RPO), restore within 4 hours (RTO). Continuous WAL archiving (`archive_timeout` 60 s), weekly full and daily differential backups, 30-day retention, encrypted by pgBackRest (AES-256).
- The pgBackRest repository is S3 on Garage ([ADR-0021](0021-supporting-services.md)), locally in Docker for development and CI; a second off-site repository is added when OD-01 is decided.
- A restore drill on synthetic data runs weekly in CI and fails when the restored data, migrations or RLS differ; the production drill stays quarterly.
- Observability runs locally first: OpenTelemetry Collector, a Grafana stack (logs, metrics, traces) and GlitchTip in Docker Compose bound to localhost. Staging and production deployment waits for OD-01.
- Development moves to WSL2 with Ubuntu 26.04 LTS as the primary environment (sandbox on); the Windows checkout stays supported without the sandbox.
- Slice 0.2-09 is split into 0.2-09a (WSL2), 0.2-09b (observability) and 0.2-09c (backups and drill).

## Consequences
+ Backups, restore and telemetry scrubbing are tested code before the first clinic, not a runbook written under pressure.
+ Nothing depends on the hosting decision; the same scripts move to production.
− A 4-hour RTO without a standby means a full outage during restore; a hot standby is later work if clinics need less.
− Windows and WSL2 must both keep working until the Windows fallback is dropped.

## Alternatives considered
- RPO 1 hour / RTO 1 day: cheaper but loses a morning of queue and cash records.
- RPO 1 minute / RTO 1 hour: needs a standby server; premature before hosting is decided.
- Local filesystem repository for the drill: simpler but does not exercise the S3 path used in production.
- Code-only telemetry (no local stack): cheaper but nobody would look at the data, and the scrubbing would be untested end to end.

## Sources
[RN-16 §2, §14], owner answers 2026-11-11 (specs [0.2-09a](../specs/foundation/0.2-09a-wsl2-move.md), [0.2-09b](../specs/foundation/0.2-09b-observability-skeleton.md), [0.2-09c](../specs/foundation/0.2-09c-backups-and-restore-drill.md))
