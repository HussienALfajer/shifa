# ADR-0022: Deployment with Docker Compose + Kamal on portable hosting; hosting location pending legal opinion

Status: Proposed (blocked by OD-01, OD-02, OD-03) · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
Syria's Law No. 12 of 2024 on electronic personal data protection reportedly restricts storing or processing personal data abroad without authorization (Art. 15); its status after the transition is under review (secondary sources) — see [syria data law](../compliance/syria-data-law.md). Moadna markets "data hosted inside Syria" and holds Ministry of Health approval [RN-11 §1]. Payment for hosting must go through an entity outside Syria (OD-03). The team is small.

## Decision (proposed)
- Everything runs as containers with Docker Compose on 2–4 VMs, deployed with Kamal 2; infrastructure and configuration as code; no managed-only database features, so the whole stack can move to any provider, including a data centre inside Syria.
- Backups: pgBackRest with point-in-time recovery to a different provider, encrypted; object storage and Orthanc storage backed up separately; quarterly restore drills.
- Observability: OpenTelemetry → Prometheus/Grafana/Loki(/Tempo); GlitchTip for errors. Secrets in self-hosted Infisical. CI on GitHub Actions with pinned actions, secret scanning, dependency audit, image scanning.
- Environments: development (local/WSL2, synthetic data), staging (synthetic or de-identified data), production.
- Hosting location: not decided. Candidates: a Turkish data centre (latency to Aleppo/Azaz, payment via a Türkiye entity), an EU provider (Hetzner/OVH), or a primary inside Syria with encrypted off-site backup. Decision after a legal opinion on Art. 15 and the MoH/NAITS approval path. A pilot with real patients starts only where the legal opinion allows.

## Consequences
+ Hosting can follow the law without re-architecture.
− Self-operating Postgres, storage and monitoring requires runbooks and drills from Phase 0.

## Alternatives considered
- Kubernetes (k3s): overhead for a small team.
- Coolify v4: runner-up if a UI is preferred; keep its dashboard private.
- Managed cloud databases: portability and payment risks.

## Sources
[RN-16 §2, §14], [RN-03 §2–§3], [RN-11 §1], [RN-20 §4]
