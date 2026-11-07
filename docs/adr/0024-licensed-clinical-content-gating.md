# ADR-0024: Licensed clinical content (PROMs, AO/OTA) is gated per tenant until licences are signed

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
The owner wants validated outcome questionnaires (Oxford scores, QuickDASH, etc.) and AO/OTA fracture classification in Release 1. Most of these require commercial licences with unpublished or significant fees, and AO/OTA forbids commercial use without written permission [RN-13 §2–§3]. CDT dental codes are licensed for the US only [RN-07 §3]. Details in [licensing](../compliance/licensing-clinical-content.md).

## Decision
- Build the engines in Release 1 regardless of licences:
  - a PROM engine (`PROMInstrument`, versioned items, scoring algorithms, languages; administration on tablet or via link; score trends);
  - a classification registry (`ClassificationSystem` with owner and licence status; `ClassificationCode`; assignments).
- Each licensed instrument or classification carries licence metadata, and a `TenantInstrumentLicence` (or platform licence) must exist before content is shown. Without it, content is hidden and cannot be enabled by entitlements alone.
- Enabled at launch only after written confirmation from the owners: SPADI, FAAM, ASES, KOOS JR / HOOS JR, IKDC, plus the pain NRS.
- Enabled when contracts close: Oxford (knee, hip, shoulder, elbow), QuickDASH/DASH, ODI, KOOS/HOOS/FAOS, EQ-5D, NDI, PROMIS; AO/OTA guided picker with official wording and illustrations; PCCF and AO Spine separately.
- Until AO/OTA permission: an AO/OTA code field with syntax validation only, no AO text or images.
- Eponymous classifications (Gustilo-Anderson, Tscherne, Salter-Harris, Garden, Weber, Neer, Schatzker, Frykman, Mason) ship with definitions and drawings written by us.
- AOFAS is excluded. Dental procedures use our own catalogue (no CDT).
- Licence costs feed the business model (OD-07); contacting licensors is OD-04.

## Consequences
+ Release 1 ships complete engines; licensed content switches on per tenant without a deployment.
− Some promised instruments may launch later than the engines.

## Alternatives considered
- Embedding licensed instruments without licences: legal and reputational risk; rejected.
- Dropping PROMs/AO entirely: contradicts the owner's scope.

## Sources
[RN-13 §2–§3, §12], [RN-08 §3], [RN-07 §3], [RN-04 §3]
