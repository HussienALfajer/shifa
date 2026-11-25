# A-02-08 UI batch 2: admin web flags, announcements, cities and areas

Status: Planned · Tier: T1 · Branch: `feat/A-02-08-ui-admin-flags-announcements-cities`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) screens "Flags", "Announcements", "Cities and areas"; criteria 7, 15, 16 as seen by the super admin · Requirements: PLT-15, PLT-18, PLT-25 · Decisions: ADR-0040, ADR-0042, ADR-0046, OD-80, OD-113 to OD-115

After A-02-02, A-02-05, A-02-06 (merged); may run beside A-02-07 in its own worktree (no schema or contract change). API gaps go to a T0 gap slice before checkpoint 2.

## Goal
The super admin switches engineering flags, posts and manages announcements, and keeps the list of cities and areas.

## API used
`GET /platform/flags`, `PUT /platform/flags/:key`; `GET /platform/announcements?status=`, `POST`, `PATCH /:id`, `POST /:id/end`; `GET /platform/clinics?search=` (target picker); `GET|POST /platform/cities`, `PATCH /:id`, `POST /:id/archive|restore`, the same under `/:id/areas`.

## Plan
### Checkpoint 1 — draw, analyse, owner approval (ADR-0042, ADR-0046, OD-80); no code before approval
- Shifa Design System README read first; Shifa Guide rules kept; real components, `--shifa-*` tokens for every colour, space, radius, shadow and size, its type styles, no literal values (checked before showing).
- On "Shifa Screens · Admin web", page "A-02 Console": one working prototype in Play (navigation between the three pages, every dialog), desktop and tablet, Arabic RTL, light and dark, synthetic names from `@shifa/testing` only.
- Every state reachable: flags list, mode change confirmed with reason, selected clinics picker, none declared; announcements by status (scheduled, active, ended), create and edit (body with the 280 counter and refused link, level, start, end, targets with clinic search), end early, empty; cities with their areas, add, rename, archive, show archived, Arabic search, empty.
- Analysis (Arabic board): the route, response field and error table for every route above (shown, driving a state, or named with the reason it is not); API gaps and unprofessional answers (fixed in the API); spec gaps; creative improvements with costs.
- Missing components (likely a **multi-select clinic picker** with search, a **character counter** on Textarea): own sheet with every state and on the screens; owner approves; built with `/ui-component` and synced before checkpoint 2 uses them.
### Checkpoint 2 — flags and announcements
### Checkpoint 3 — cities and areas
### Checkpoint 4 — journeys, screenshots, review
Playwright against the real backend: kill switch confirmed and shown; announcement created for selected clinics, edited, ended early; city with two areas, one archived and shown under "archived". Screenshots light and dark compared with the drawings; axe clean; `reviewer` agent.

Tests written first: component tests per state; the three journeys; screenshot comparisons.
Estimated hand-written lines: ~2,900 (flags ~550, announcements ~900, cities ~650, i18n ~250, journeys ~550); missing components are separate `/ui-component` work.

## Stopped at
Planned.

## Evidence
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- Drawings and analysis links are not committed (ADR-0040); record names and approval here.
