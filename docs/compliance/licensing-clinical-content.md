# Licensing of clinical content and terminologies

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: [RN-13 §1–§3, §9, §12], [RN-08 §3], [RN-04 §3], [RN-07 §3], [RN-12 §1]

Purpose: list every third-party clinical content Shifa wants to use, its licence position for a commercial SaaS used in Syria, and what must be signed before it is switched on. Mechanism: [ADR-0024](../adr/0024-licensed-clinical-content-gating.md). Owner action: OD-04.

## Outcome questionnaires (PROMs)
| Instrument | Owner | Commercial SaaS position | Arabic / Turkish |
|---|---|---|---|
| Oxford Knee / Hip / Shoulder / Elbow | Oxford University Innovation | Licence with royalty required; fee not published (a UK platform lists £7,000/year — reference only) | Arabic OKS validated (Egypt 2019; JBJS 2020 post-arthroplasty) |
| QuickDASH / DASH | Institute for Work & Health | Published: CAD 1,250 first year, then CAD 650/year, plus user fees from CAD 625 | Arabic (Kuwait) and Turkish exist |
| KOOS / HOOS / FAOS | Mapi Research Trust (since 2023) | Paid for commercial users and healthcare organisations; fee not published | — |
| ODI 2.1a | Mapi Research Trust | Free for clinical use, paid for commercial | Arabic exists |
| EQ-5D | EuroQol | Paid for commercial and digital use | Arabic validated (2024) |
| PROMIS | HealthMeasures | EHR integration requires licence fees | — |
| NDI | Copyright holder | Protected; no validated Arabic version found | — |
| SPADI, FAAM, ASES, KOOS JR / HOOS JR, IKDC | Developers | Free per secondary sources — written confirmation required before use | to check |
| AOFAS | — | Excluded: the owning society recommends against its use | — |
| Pain NRS/VAS | Public | Free | — |

No licensor publishes a low-income-country discount; ask explicitly and check each licensor's position on Syria-linked customers (UK, Canada, Netherlands/France, Switzerland, US jurisdictions) [RN-13 §3, §12].

## Fracture classifications
- **AO/OTA Fracture and Dislocation Classification (2018 compendium)**: use for research, education and medical purposes without permission; **not for commercial use or profit without permission** — written permission from AO Foundation and OTA required (text from two identical snippets; the OTA PDF returned 404) [RN-13 §2]. Paediatric (PCCF) and AO Spine classifications are permissioned separately; some AO Spine documents are CC BY-NC-ND (no commercial use).
- Until permission: an AO/OTA code field with syntax validation only — no AO wording or illustrations.
- **Eponymous classifications** (Gustilo-Anderson, Tscherne, Salter-Harris, Garden, Weber, Neer, Schatzker, Frykman, Mason): commercial EHRs use them; a system is not protected by copyright (US 17 U.S.C. §102(b)), but original text and arrangement can be (ADA v. Delta Dental). Shifa writes its own definitions and drawings [RN-13 §2].

## Terminologies and codes
| Content | Position | Use in Shifa |
|---|---|---|
| ICD-11 (WHO) | CC BY-ND 3.0 IGO; Arabic is an official language; offline ICD-API Docker container | Diagnosis coding; ICD-10 (WHO) kept for legacy/reporting; side recorded separately [RN-04 §3] [RN-08 §9] |
| LOINC | Free commercial use; Arabic variant added in 2.81 (Aug 2025) | Lab/observation codes later [RN-04 §3] |
| SNOMED CT | Fee exemption for low-income countries (Syria classified low-income FY2026 per secondary report) but web applications need special permission | Use the free SNOMED IPS Terminology (CC BY 4.0) subset only [RN-04 §3] |
| ATC (WHO) | No commercial redistribution without WHOCC permission | Do not ship the ATC index; internal mapping only after permission [RN-04 §3] |
| CDT (ADA dental codes) | Licence limited to US territory, annual fees | Not used; tenant-editable internal procedure catalogue [RN-07 §3] |
| FDI tooth notation (ISO 3950) | Notation is a standard convention | Used for the odontogram [RN-12 §1] |
| Drug interactions (DDInter 2.0) | Open access, licence unclear | Not used until clarified; curated list of major interactions instead [RN-04 §3] |
| Syrian drug list | National list available as PDF only | Curated catalogue built from it (OD-10) |

## Images and illustrations
- Skeleton art: Wikimedia Commons "Human skeleton" (LadyofHats) is public domain worldwide — usable as a base; Servier Medical Art (CC BY 4.0) usable with attribution [RN-13 §1] [RN-17 §16].
- Dermatome maps found are CC BY-SA (share-alike) — redraw our own instead [RN-13 §1].
- Odontogram: built in-house; react-odontogram (MIT) as reference only; GPL dental projects (OpenMolar, DinoDent) are not used [RN-12 §1].
- Exercise libraries (Physitrack, Medbridge): no published pricing; Release 1 uses our own Arabic exercise library [RN-13 §9].

## Actions (OD-04)
1. Request licences/quotes: AO Foundation + OTA, Oxford University Innovation, IWH, Mapi (KOOS/HOOS/FAOS, ODI), EuroQol, PROMIS (only if needed).
2. Obtain written confirmation for SPADI, FAAM, ASES, KOOS JR/HOOS JR, IKDC.
3. Ask each licensor for low-income pricing and its position on Syria-linked customers.
4. Record each signed licence in the platform (licence ref, scope, validity, user cap) before enabling content.
