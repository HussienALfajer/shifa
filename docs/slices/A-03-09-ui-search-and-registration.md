# A-03-09 UI code 1, reception: search, registration and the chart

Status: Planned · Tier: T1 · Branch: `feat/A-03-09-ui-search-and-registration`
Spec: [A-03](../specs/patients/A-03-patients.md) screens «المرضى», «مريض جديد» / edit and «ملف المريض»; criteria 1–4, 7, 9–13, 16 and 21–33 as seen on screen · Requirements: CLN-01 (identity), CLN-39 to CLN-44 · Decisions: ADR-0040, ADR-0046, ADR-0047

First UI code slice of A-03, after every API slice (A-03-02 to A-03-08) and the component slice A-03-12 are merged. Re-planned at A-03-01 checkpoint 3 (owner, 2026-11-27): two UI slices instead of three, each above the ~4,000-line budget by the owner's choice (ADR-0032: CI warns, never fails); the components were moved to A-03-12.

## Goal
Reception finds a patient from one box, registers a new one in seconds (warned of duplicates, shown the family on the phone) and opens the chart summary; the owner archives and restores a chart; exactly as the approved drawings show.

## Plan
1. **Contract check** — every row of `A03Search`, `A03Register` and `A03Chart` in the [contract](../specs/patients/A-03-screen-contract.md) against the built API (fields, errors, statuses); a mismatch is fixed in the API on its own commit, never worked around in the client.
2. **Web** (`apps/clinic-web`; «المرضى» in the navigation for `patients.view`), with the components of A-03-12 (RecordList, RecordHeader, DescriptionList, Drawer «wide»):
   - Search page: the box (term in the body), results with why each matched (improvement 1), «فتحتها مؤخرًا» under the empty box (improvement 2), arrows and Enter (improvement 4), the owner's archived switch, «مريض جديد» from `permissions[]`, every empty, loading, rate-limited and error state, "my patients only".
   - Registration and edit in the wide Drawer (full page on a phone): name parts and the displayed name, phone with the family and relation (asked only with a holder), sex, date of birth or age with «~», second phone, previous number, treating doctors, custom fields by section with the shared validator; the duplicate box (open one, or acknowledge and register anyway, archived candidates included), hidden candidates, the stale edit, every 409 and 403 by its row, offline (never saves silently), failed (safe retry with the same id), saved with the file number and «فرد آخر من العائلة» (improvement 3).
   - Chart summary: RecordHeader (file number, estimated age, facts, created and last edited), family with «إضافة فرد من العائلة», treating doctors («غير نشط»), the clinic's fields by section (DescriptionList, «حساس»), the owner's read-log card (DataTable), actions from `allowed` (edit, the owner's menu: merge, archive), archive and restore with their questions; states archived, merged (link to the kept chart), not found or hidden (one page), loading, error, support read-only. The card frame is the one later specs add their cards to.
   - i18n keys in Arabic; no name, phone or term in a URL, a log or the service worker cache.
3. **Flutter** — none.
4. **End-to-end** (Playwright against the real backend) — register with a family phone and a relation; duplicate warning, then open the existing chart; search by a variant spelling from the vectors; the owner archives and restores a chart. Screenshots of every state, light and dark, desktop, tablet and phone, compared with the approved drawings; axe on each screen.

Tests written first: the four journeys; a form test per contract error; chart states from the contract rows.
Estimated hand-written lines: ~4,450 (search ~900, form ~1,380, chart summary ~1,250, journeys and tests ~920).

## From A-03-01 (re-plan, 2026-11-27)
- Contract rows: every row of `A03Search`, `A03Register`, `A03Chart`.
- Criteria added on screen: 21–33.
- Components: none built here; RecordList, RecordHeader, DescriptionList and the Drawer «wide» come from A-03-12.
- Drawings: `A03Search`, `A03Register`, `A03Chart` and their tablet and phone boards (approved 2026-11-27).
- New estimate: ~4,450, about 450 over the budget (owner's choice).

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Screenshots compared with the drawings: <paths>
- Reviewer findings fixed: <list>

## Notes for the next session
- <only what is needed to resume>
