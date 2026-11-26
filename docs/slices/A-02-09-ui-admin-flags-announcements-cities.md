# A-02-09 UI code 2: admin web flags, announcements, cities and areas

Status: Planned · Tier: T1 · Branch: `feat/A-02-09-ui-admin-flags-announcements-cities`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) screens "Flags", "Announcements", "Cities and areas"; criteria 7, 15, 16 as seen by the super admin · Requirements: PLT-15, PLT-18, PLT-25 · Decisions: ADR-0040, ADR-0046, ADR-0047, OD-113 to OD-115

After A-02-02 to A-02-07 (merged). It may run beside A-02-08 in its own worktree, since neither changes schema or contracts; an API fix found by either is serialised. Drawings, contract rows and missing components were approved in [A-02-01](A-02-01-design-and-screen-contract.md) checkpoint 1.

## Goal
The super admin switches engineering flags, posts and manages announcements, and keeps the list of cities and areas.

## API used
The rows of the [A-02 screen contract](../specs/platform/A-02-screen-contract.md) for these screens, expected to include:
- flags: `GET /platform/flags`, `PUT /platform/flags/:key`;
- announcements: `GET /platform/announcements?status=`, `POST`, `PATCH /:id`, `POST /:id/end`, with `GET /platform/clinics?search=` for the target picker;
- cities: `GET|POST /platform/cities`, `PATCH /:id`, `POST /:id/archive|restore`, and the same under `/:id/areas`.

## Plan
### Checkpoint 1 — contract check and components
- **Contract check:** every contract row of these screens against the built API. A mismatch is fixed in the API on this branch, never in the client. Any design-system release since A-02-01 is applied to the drawings and noted.
- **Components:** the approved ones these screens need (for example the multi-select clinic picker and the character counter) are built with `/ui-component` and synced before use.
### Checkpoint 2 — flags and announcements
- Flags list; mode change confirmed with a reason; selected clinics picker.
- Announcements by status; create and edit (body with counter and link refusal, level, start, end, targets); end early.
### Checkpoint 3 — cities and areas
- Cities with their areas; add, rename, archive and restore; show archived; Arabic search.
### Checkpoint 4 — journeys, screenshots, review
- Playwright against the real backend:
  - the kill switch is confirmed and shown;
  - an announcement for selected clinics is created, edited and ended early;
  - a city gets two areas, one is archived and shown under "archived".
- Screenshots, light and dark, compared with the approved drawings; axe clean; `reviewer` agent.

Tests written first: component tests per state in the drawings; the three journeys; screenshot comparisons.
Estimated hand-written lines: ~4,050 (MultiCombobox ~700, PageBanner ~400, flags ~560, announcements ~980, cities ~720, i18n ~260, journeys ~430). Re-estimated at A-02-01 checkpoint 3 (owner, 2026-11-27).

## From A-02-01 (re-plan approved by the owner, 2026-11-27)
The [screen contract](../specs/platform/A-02-screen-contract.md) is the reference: where this file's earlier plan names a route or field differently, the contract wins. Rows owned by this slice:
- Screens: `A02Flags`, `A02Announcements` (dismissal counts, the banner preview), `A02Cities` (branch, clinic and doctor counts, restore) on "Shifa Screens · Admin web", page "Proposals"; improvements 1, 2, 3, 4, 8 (criteria 15, 22–24).
- Components built here first, then synced: **MultiCombobox** (`A02SheetMultiCombobox`) and **PageBanner** (`A02cSheetPageBanner` on the clinic web canvas; its first user is the announcement preview, and A-02-10 reuses it).
- Budget: ~4,050 with the components, at the guide; the owner kept ten slices (2026-11-27).

## Stopped at
Planned.

## Evidence
- Contract check: —
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- The drawings are named in A-02-01 (links not committed, ADR-0040).
