# Data handling policy

Status: Draft · Last updated: 2026-11-11 · Owner: product owner
Sources: [RN-04 §6–§7], [RN-18 §4.11], [RN-16 §14], [RN-03 §2], [RN-01]

Purpose: define how personal and health data is handled across development, AI-agent tooling, staging and production, and which defaults still need an owner decision. Decisions: [ADR-0023](../adr/0023-no-real-patient-data-in-dev.md), [ADR-0004](../adr/0004-postgresql-pooled-tenancy-rls.md), [ADR-0006](../adr/0006-one-organisation-model.md). Legal context: [Syrian data law](syria-data-law.md).

## 1. Environments
| Environment | Data allowed | Access |
|---|---|---|
| Development (WSL2, primary, sandboxed), CI, Claude Code sessions | Synthetic data only | Developers and agents |
| Development fallback (Windows `D:\shifa`, no sandbox) | Synthetic data only; development `.env` values only | Developers and agents |
| Staging | Synthetic, or de-identified via a reviewed pipeline | Owner and named staff |
| Production | Real data | Clinics by role; platform staff only via audited support access |

- Synthetic data generator (`packages/testing`): multiple tenants, branches and doctors; Syrian Arabic names and naming patterns; +963 and +90 phones; three currencies; dental charts, fractures, PROM answers; synthetic or public test DICOM. Built in stages: the core (tenancy, people, phones, money) in 0.2-08 ([spec](../specs/foundation/0.2-08-synthetic-data-generator.md)); clinical data with Phases B–D. Synthetic phones can belong to real people, so non-production sending is allowlisted (MSG-32, OD-23).
- Claude Code: may read and edit `.env*`, secrets, dumps and data-export paths (ADR-0028); `.gitignore` and the CI secret scan keep them out of git; sandbox enabled under WSL2; no production credentials on development machines.
- Logs, traces and error reports never contain personal or clinical data; a test fails if listed sensitive fields reach a logger. Telemetry is scrubbed twice, by an allowlist in the API and again in the Collector before storage (PLT-52, [observability](../process/observability.md)).

## 2. Production access
- Platform support access to a tenant: time-boxed, read-only by default, with a mandatory reason, visible to the clinic, fully audited.
- Database access: read-only roles by default; write access only through break-glass with second-person approval and audit. Never through an AI session.
- Tenant isolation: RLS on every tenant-scoped table, enforced and tested ([ADR-0004](../adr/0004-postgresql-pooled-tenancy-rls.md)).

## 3. Security controls
- Encryption in transit (TLS everywhere, including internal services where feasible) and at rest (disk, object storage, backups); application-level encryption for highly sensitive notes (e.g. psychotherapy notes in later packs).
- Audit log (append-only, enforced by database permissions): every create/update/delete on clinical and financial data, every read of a patient chart, every export, every support-access session.
- Patients can see who viewed their file (clinic, role, date) in the patient app.
- Signed clinical notes are immutable; corrections are addenda. Payments and completed procedures are voided with a reason, never deleted.
- Staff MFA (mandatory for owners and super admins), session timeouts, device sessions list.
- Backups: point-in-time recovery, encrypted, off-provider, restore drills quarterly ([ADR-0022](../adr/0022-deployment-portable-hosting.md)); RPO 5 min, RTO 4 h ([ADR-0029](../adr/0029-backup-targets-and-local-operations-stack.md)). How backups, restores and the weekly CI drill work: [backups and restore](../process/backup-restore.md).
- Verification target: OWASP ASVS 5.0 level appropriate to health data [RN-04 §6].

## 4. Patient rights and sharing
- Consent captured in the patient app and at the clinic (versioned consent texts).
- The clinic owns its clinical record. Cross-clinic sharing only with explicit, scoped, time-limited, revocable patient consent; sensitive categories excluded by default ([ADR-0006](../adr/0006-one-organisation-model.md)).
- Access, correction and export requests supported; deletion subject to the retention period.

## 5. Defaults awaiting owner decision
- OD-13 Retention: proposed configurable default of 10 years after the last visit for adults; for minors, until majority + 10 years. Not a Syrian legal requirement — a conservative design assumption [RN-03 §2].
- OD-14 Release to patient: proposed default — signed prescriptions, visit summaries and medical reports appear in the patient app automatically; other items only when the doctor releases them.
- OD-06 Tooling configuration: whether an Anthropic plan with a HIPAA-style configuration is needed. If this policy holds (no real data in agent environments), standard Claude Code configuration is sufficient; confirm with counsel.
