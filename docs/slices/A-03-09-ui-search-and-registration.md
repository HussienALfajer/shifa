# A-03-09 UI code 1: patient search and registration

Status: Planned · Tier: T1 · Branch: `feat/A-03-09-ui-search-and-registration`
Spec: [A-03](../specs/patients/A-03-patients.md) screens «المرضى» and «مريض جديد» / edit; criteria 1–4, 7, 9, 10, 11 and 16 as seen on screen · Requirements: CLN-39 to CLN-43 · Decisions: ADR-0040, ADR-0046, ADR-0047

First UI code slice of A-03, after every API slice (A-03-02 to A-03-08) is merged.

## Goal
Reception finds a patient from one box and registers a new one in seconds, warned of duplicates and shown the family on the phone, exactly as the approved drawings show.

## Plan
1. **Contract check** — every row of the A-03 screen contract for these screens against the built API (fields, errors, statuses); a mismatch is fixed in the API on its own commit, never worked around in the client.
2. **Components** — the approved missing components these screens need (named by A-03-01), each with `/ui-component`, from its approved sheet, with RTL, axe, stories and screenshots, then synced to the Shifa Design System (ADR-0040).
3. **Web** (`apps/clinic-web`, route «المرضى» in the navigation for `patients.view`)
   - Search page: the box (term sent in the body), results, the owner's «المؤرشفة» filter, «مريض جديد» hidden without `patients.manage`, every empty, loading and error state, "my patients only" on.
   - Registration and edit: Drawer on desktop and tablet, full page on phone; name parts, phone with the family and relation, sex, date of birth or age with «~», second phone, previous number, treating doctors, custom fields by section with the shared validator; the duplicate panel (open one, register anyway with the acknowledged ids), the hidden candidates, every 409 and 403 by its contract row, offline state (never saves silently), saved state with the file number.
   - i18n keys in Arabic (English optional); no name, phone or term in a URL, a log or the service worker cache.
4. **Flutter** — none (clinic web only).
5. **End-to-end** (Playwright against the real backend) — register with a family phone and a relation; duplicate warning, then open the existing chart; search by a variant spelling from the vectors. Screenshots of every state, light and dark, desktop, tablet and phone, compared with the approved drawings; axe on each screen.

Tests written first: the three journeys; component tests from each sheet's states; a form test per contract error.
Estimated hand-written lines: ~3,800 (components ~900 until A-03-01 names them, search ~700, form ~1,300, journeys and tests ~900). Re-estimated at A-03-01 checkpoint 3.

## From A-03-01 (re-plan, 2026-11-27)
- Contract rows ([contract](../specs/patients/A-03-screen-contract.md)): every row of `A03Search` and `A03Register`; checked against the built API first.
- Criteria added on screen: 21, 22, 24–31.
- Components first, each with `/ui-component` from its approved sheet: RecordList (`A03SheetRecordList`), Drawer `size="wide"` (`A03SheetDrawerWide`); synced to the design system after they pass.
- Drawings: `A03Search`, `A03Register` and their tablet and phone boards (approved 2026-11-27).
- New estimate: ~3,750 (components ~570: RecordList ~450, Drawer «wide» ~120; search ~900 with improvements 1, 2 and 4; form ~1,380 with the stale edit and improvement 3; journeys and tests ~900).

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Screenshots compared with the drawings: <paths>
- Reviewer findings fixed: <list>

## Notes for the next session
- <only what is needed to resume>
