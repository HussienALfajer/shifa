# Shifa documentation

Status: Living · Last updated: 2026-11-08 · Owner: product owner

Map of the documentation. Each kind of information has exactly one home; link to it instead of repeating it.

| Need | Go to |
|---|---|
| What Shifa is and for whom | [product/vision.md](product/vision.md) |
| What Release 1 contains | [product/scope-release-1.md](product/scope-release-1.md) |
| Arabic ↔ English terms | [product/glossary.md](product/glossary.md) |
| Project status and phases | [roadmap.md](roadmap.md) |
| Questions waiting for the owner | [open-decisions.md](open-decisions.md) |
| How we build (Claude Code workflow, tiers, definition of done) | [process/development-workflow.md](process/development-workflow.md) |
| System shape and technology | [architecture/overview.md](architecture/overview.md) |
| Design system | [architecture/design-system.md](architecture/design-system.md) |
| Architecture decisions | [adr/README.md](adr/README.md) |
| Requirements per domain | [domain/](#domain-documents) below |
| Legal, licensing, data handling, platform access | [compliance/](#compliance) below |
| Feature specs (written per feature with `/spec`) | `specs/` (created with the first spec) |
| Slice plans and hand-over | [slices/README.md](slices/README.md) |
| Research evidence (read-only) | [research/README.md](research/README.md) |

## Domain documents

| Document | Requirement IDs | Phase |
|---|---|---|
| [platform-and-configuration](domain/platform-and-configuration.md) | PLT | A |
| [scheduling-queue](domain/scheduling-queue.md) | SCH | A |
| [voice-calling](domain/voice-calling.md) | VOX | A |
| [clinical-records](domain/clinical-records.md) | CLN | A |
| [billing-multicurrency](domain/billing-multicurrency.md) | BIL | A |
| [messaging-and-verification](domain/messaging-and-verification.md) | MSG | A |
| [patient-app](domain/patient-app.md) | PAT | A |
| [dental](domain/dental.md) | DEN | B |
| [orthopedics](domain/orthopedics.md) | ORT | C |
| [imaging](domain/imaging.md) | IMG | D |

## Compliance

- [syria-data-law](compliance/syria-data-law.md) — Law No. 12/2024 and approvals
- [licensing-clinical-content](compliance/licensing-clinical-content.md) — PROMs, AO/OTA, terminologies
- [data-handling](compliance/data-handling.md) — patient data rules, synthetic data, retention, audit
- [platform-access-syria](compliance/platform-access-syria.md) — sanctions and access to Google, Meta, Microsoft, Apple services

## Conventions

- English for all repository content; the product UI is Arabic-first.
- Every document starts with Title, Status line, Sources and a Purpose paragraph.
- Cite research as `[RN-xx §section]`, decisions as `ADR-NNNN`, open questions as `OD-NN`, requirements by their IDs (e.g. `SCH-07`).
- Requirements without a tag are in Release 1; `(Later)` means after Release 1; `(Gated: …)` means it ships behind a licence or decision.
