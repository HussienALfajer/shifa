# A-02-09 UI code 2: admin web flags, announcements, cities and areas

Status: Planned · Tier: T1 · Branch: `feat/A-02-09-ui-admin-flags-announcements-cities`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) screens "Flags", "Announcements", "Cities and areas"; criteria 7, 15, 16 as seen by the super admin · Requirements: PLT-15, PLT-18, PLT-25 · Decisions: ADR-0040, ADR-0046, ADR-0047, OD-113 to OD-115 · From A-02-01: criteria 22–24

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
- **Components: delivered** ahead of this slice by the component PR (branch `feat/A-02-components`, 2026-11-27, owner's request): MultiCombobox and PageBanner, synced to the Shifa Design System (`1795743045-04ed`) and drawn on "Shifa Components". This checkpoint is now the contract check alone; see "Components (delivered ahead)" below.
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
Estimated hand-written lines: ~2,950 without the components (flags ~560, announcements ~980, cities ~720, i18n ~260, journeys ~430). Re-estimated at A-02-01 checkpoint 3 (owner, 2026-11-27: ~4,050 with MultiCombobox ~700 and PageBanner ~400, which the component PR delivered).

## From A-02-01 (re-plan approved by the owner, 2026-11-27)
The [screen contract](../specs/platform/A-02-screen-contract.md) is the reference: where this file's earlier plan names a route or field differently, the contract wins. Rows owned by this slice:
Names in the earlier plan above that the contract replaces: the routes are the contract's.
- Screens: `A02Flags`, `A02Announcements` (dismissal counts, the banner preview), `A02Cities` (branch, clinic and doctor counts, restore) on "Shifa Screens · Admin web", page "Proposals"; improvements 1, 2, 3, 4, 8 (criteria 15, 22–24).
- Components: **MultiCombobox** (`A02SheetMultiCombobox`) and **PageBanner** (`A02cSheetPageBanner`; its first user is the announcement preview, and A-02-10 reuses it), delivered ahead by the component PR (`feat/A-02-components`); the screens import them from `@shifa/ui`.
- Budget: ~2,950 without the components (was ~4,050 with them; the owner kept ten slices, 2026-11-27, then had the components built ahead).

## Components (delivered ahead, 2026-11-27)
Built with `/ui-component` in the component PR (`feat/A-02-components`), synced to the Shifa Design System (`1795743045-04ed`), each with its sheet on "Shifa Components"; the proposal sheets were removed from "Proposals". Compared with the approved sheets:
- **MultiCombobox:** as the sheet: chips in the selection colour with a remove button named «إزالة …», Combobox's folded word-start matching with the typed part in bold, the list open after each pick with a tick on the chosen, Backspace in the empty field removes the last chip, «لا عيادة بهذا الاسم» when nothing matches, error and disabled from FieldShell. On UI SDK's Combobox with `multiple`. No difference beyond chips wrapping to a new line when the field is narrower than two of them.
- **PageBanner:** as the sheet: `info`, `warning` and the solid `support` tone, icon and word, the text, at most one action, the pager «1 من 3», a named close only where it can be hidden, a region named by its word, the buttons under the text on a phone. Differences: previous uses `caret-back` and next `caret-forward`, as Pagination does (the sheet drew `caret-forward` for previous); previous and next are disabled at the ends (the sheet showed only the middle one); the phone layout starts under 430 px of the banner's own width (Pagination's container breakpoint). The text is a polite live region, so paging is read; a banner already there when the page loads is not announced by itself: A-02-10 decides how a newly arrived announcement is announced once (backlog).

## Stopped at
Planned.

## Evidence
- Contract check: —
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- The drawings are named in A-02-01 (links not committed, ADR-0040).
