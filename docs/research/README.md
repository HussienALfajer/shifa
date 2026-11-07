# Research archive

Status: Frozen evidence · Last updated: 2026-11-08 · Owner: product owner

The archive holds the research behind Shifa's scope and technical decisions. Files are **read-only evidence**: never edit them. Decisions live in [ADRs](../adr/README.md); product scope lives in [docs/product](../product/). When research and an ADR disagree, the ADR wins (research may be outdated or was overridden by the owner).

Cite research as `[RN-xx §section]`, for example `[RN-12 §Q2]`.

## Index

| ID | File | Date | Topic |
|---|---|---|---|
| RN-01 | [r1/final-report-ar.md](archive/2026-11-07-r1-market-and-platform/final-report-ar.md) | 2026-11-07 | First synthesis report (Arabic, owner-facing): market, Syria, architecture, roadmap |
| RN-02 | [r1/competitors_benchmark.md](archive/2026-11-07-r1-market-and-platform/competitors_benchmark.md) | 2026-11-07 | Global, MENA and Syrian competitors; pricing; no-show evidence |
| RN-03 | [r1/syria_operating_environment.md](archive/2026-11-07-r1-market-and-platform/syria_operating_environment.md) | 2026-11-07 | Syria: health sector, sanctions, payments, telecom, power, competitors |
| RN-04 | [r1/clinical_standards_templates.md](archive/2026-11-07-r1-market-and-platform/clinical_standards_templates.md) | 2026-11-07 | FHIR, terminologies, specialty templates, record integrity |
| RN-05 | [r1/saas_architecture_configurability.md](archive/2026-11-07-r1-market-and-platform/saas_architecture_configurability.md) | 2026-11-07 | Multi-tenancy, RLS, entitlements, custom fields, custom domains, white-label |
| RN-06 | [r1/scheduling_queue_notifications_offline.md](archive/2026-11-07-r1-market-and-platform/scheduling_queue_notifications_offline.md) | 2026-11-07 | Slot engine, double booking, queues, notifications, offline sync |
| RN-07 | [r2/dental_mvp.md](archive/2026-11-07-r2-release1-scope/dental_mvp.md) | 2026-11-07 | Dental core scope and data model |
| RN-08 | [r2/orthopedics_mvp.md](archive/2026-11-07-r2-release1-scope/orthopedics_mvp.md) | 2026-11-07 | Orthopedics core scope |
| RN-09 | [r2/multi_currency_billing.md](archive/2026-11-07-r2-release1-scope/multi_currency_billing.md) | 2026-11-07 | SYP/TRY/USD billing, rates, cash sessions |
| RN-10 | [r2/whatsapp_otp_push.md](archive/2026-11-07-r2-release1-scope/whatsapp_otp_push.md) | 2026-11-07 | Unofficial WhatsApp gateways, SMS-free verification, FCM reliability |
| RN-11 | [r2/mvp_scope_benchmark.md](archive/2026-11-07-r2-release1-scope/mvp_scope_benchmark.md) | 2026-11-07 | Syrian competitor parity, MVP scope per surface |
| RN-12 | [r3/dental_full_scope.md](archive/2026-11-07-r3-full-scope-and-stack/dental_full_scope.md) | 2026-11-07 | Full dental scope: odontogram UX, perio, ortho, endo, implants |
| RN-13 | [r3/orthopedics_full_scope.md](archive/2026-11-07-r3-full-scope-and-stack/orthopedics_full_scope.md) | 2026-11-07 | Full orthopedics scope, AO/OTA and PROM licensing |
| RN-14 | [r3/imaging_dicom.md](archive/2026-11-07-r3-full-scope-and-stack/imaging_dicom.md) | 2026-11-07 | OHIF, Orthanc, licensing, ingest, slow links |
| RN-15 | [r3/voice_calling.md](archive/2026-11-07-r3-full-scope-and-stack/voice_calling.md) | 2026-11-07 | Waiting-room voice calling, Arabic TTS, kiosk displays |
| RN-16 | [r3/backend_infra_stack.md](archive/2026-11-07-r3-full-scope-and-stack/backend_infra_stack.md) | 2026-11-07 | Backend, data and infrastructure stack; Syria Law 12/2024 |
| RN-17 | [r3/web_mobile_printing_stack.md](archive/2026-11-07-r3-full-scope-and-stack/web_mobile_printing_stack.md) | 2026-11-07 | Web, mobile, charts, printing, display stack |
| RN-18 | [r4/anthropic_agentic_coding_methodology.md](archive/2026-11-08-r4-claude-code-method/anthropic_agentic_coding_methodology.md) | 2026-11-08 | Anthropic guidance on agentic coding with Claude Code |
| RN-19 | [r4/base_ui_design_system_and_flutter.md](archive/2026-11-08-r4-claude-code-method/base_ui_design_system_and_flutter.md) | 2026-11-08 | Base UI design system and Flutter architecture |
| RN-20 | r4/project_vertex_digital.md (local only) | 2026-11-08 | Lessons from the owner's vertex-digital project |
| RN-21 | r4/project_vertex_hub.md (local only) | 2026-11-08 | Lessons from the owner's vertex-hub project |
| RN-22 | r4/project_fox_drop.md (local only) | 2026-11-08 | Lessons from the owner's fox-drop project (TS + Flutter) |

Folder names: `r1` = `2026-11-07-r1-market-and-platform`, `r2` = `2026-11-07-r2-release1-scope`, `r3` = `2026-11-07-r3-full-scope-and-stack`, `r4` = `2026-11-08-r4-claude-code-method`.

## Known corrections and overrides

| Research says | Current position | Where |
|---|---|---|
| RN-01, RN-03: Syria has no personal-data-protection law | Law No. 12 of 2024 exists; Art. 15 restricts storing personal data abroad (status under review) | [syria-data-law](../compliance/syria-data-law.md), OD-01 |
| RN-01: patient app in Flutter; RN-17: React Native + Expo | Owner decided Flutter | ADR-0012 |
| RN-17: shadcn/ui for web components | Owner decided a custom design system on Base UI | ADR-0011 |
| RN-01, RN-16: PowerSync for offline | Spike decides PowerSync vs custom outbox (PowerSync Flutter/drift integration and self-hosted edition still beta per RN-19) | ADR-0014, OD-05 |
| RN-14: MinIO for object storage | MinIO community edition discontinued; Garage chosen | ADR-0021 |
| RN-15/RN-17: Lost Pixel for visual tests | Archived 2026-04-22; use Playwright screenshots or Chromatic | [design system](../architecture/design-system.md) |
| RN-10, RN-11: SMS as a channel | Owner decided no SMS at all | ADR-0016, ADR-0017 |
| RN-07/RN-08: perio, ortho tracking, DICOM, PROMs, AO deferred | Owner moved them into Release 1 | [scope](../product/scope-release-1.md) |

## Sensitivity note

This repository is public ([ADR-0026](../adr/0026-public-repository.md)). RN-20 to RN-22 describe the owner's other projects, including weaknesses in their configuration, so they stay on the owner's machine (git-ignored) and are not published. Their lessons appear without security details in [development-workflow](../process/development-workflow.md).
