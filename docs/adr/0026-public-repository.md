# ADR-0026: Public GitHub repository; private notes stay local

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
The owner decided on 2026-11-08 to host Shifa on GitHub as a **public** repository (`HussienALfajer/shifa`). The research index had recommended a private repository because three research notes (RN-20 to RN-22) analyse the owner's other projects and describe weaknesses in their configuration. The repository will hold healthcare-related code, so anything published must be safe for anyone to read.

## Decision
- The repository is public at `github.com/HussienALfajer/shifa`, default branch `main`.
- RN-20, RN-21 and RN-22 (`docs/research/archive/2026-11-08-r4-claude-code-method/project_*.md`) stay on the owner's machine only and are git-ignored. Docs may cite their IDs; their lessons are summarised without security details in [development-workflow](../process/development-workflow.md).
- Nothing private is ever committed: no secrets or credentials, no real patient data ([ADR-0023](0023-no-real-patient-data-in-dev.md)), no production hostnames or IPs, no analyses of other private systems.
- Secret scanning runs in CI from Phase 0.2 (gitleaks), plus GitHub secret scanning and push protection.
- No licence is chosen yet, so all rights are reserved by default (OD-21).

## Consequences
+ Transparent history; free GitHub Actions minutes and security features for public repositories.
+ Forces good hygiene: secrets and data never live in the repo.
− Anyone, including competitors, can read the product strategy, scope and architecture.
− Mistakes are public immediately; a leaked secret must be rotated, not just deleted.
− Some research cannot be shared through the repository.

## Alternatives considered
- Private repository: recommended earlier; not chosen by the owner.
- Publishing RN-20 to RN-22 as is: rejected by the owner because they expose weaknesses in other public projects.
- Publishing redacted versions: possible later.

## Sources
[RN-18 §4.11], [ADR-0023](0023-no-real-patient-data-in-dev.md), [research index](../research/README.md)
