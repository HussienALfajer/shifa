# ADR-0023: No real patient data in development or AI-agent environments; synthetic data only

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
Shifa is built almost entirely by Claude Code. Claude Code's HIPAA configuration requires an Enterprise plan with a BAA, direct API access and local sessions only, and disables cloud sessions, WebFetch and managed Code Review [RN-18 §4.11]. Syrian law restricts where personal data may be stored ([syria data law](../compliance/syria-data-law.md)). Keeping real patient data out of every development surface keeps the code and the tooling outside that scope.

## Decision
- No real patient data (or real staff personal data) in the repository, local machines, CI, staging, logs, screenshots, issues, prompts or any Claude Code / AI session — ever.
- A synthetic data generator in `packages/testing` produces realistic multi-clinic data: Arabic names (Syrian naming patterns), +963/+90 phones, three currencies, dental charts, fractures, images (synthetic or public test DICOM).
- Claude Code settings deny reading `.env*`, secrets, dumps and any data-export folders; hooks block such writes; the sandbox runs under WSL2.
- No production credentials on development machines. Production access is read-only by default, via break-glass with reason and audit, and never through an AI session.
- If staging needs realistic data, only de-identified data, produced by a reviewed pipeline.
- Logs and error reports are scrubbed of personal data; a test fails if known sensitive fields are logged.
- Details in [data handling](../compliance/data-handling.md). The Anthropic plan/configuration question is OD-06.

## Consequences
+ Development, CI and AI tooling are outside personal-health-data scope; compliance stays a production concern.
+ Synthetic data covers edge cases real data rarely shows.
− Production-only bugs need careful, audited investigation.

## Alternatives considered
- Copying production snapshots into staging: rejected.
- Running Claude Code under a HIPAA configuration with real data: unnecessary if this ADR holds; revisit only through OD-06.

## Sources
[RN-18 §4.11], [RN-04 §6], [RN-16 §14]
