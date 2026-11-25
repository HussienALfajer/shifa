# A-02-05 Cities and areas, a branch's place

Status: Planned · Tier: T0 · Branch: `feat/A-02-05-cities-areas-branch-place`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) criteria 15, 18 (city and area events); criterion 10 (contract step) · Requirements: PLT-15 · Decisions: OD-113

After [A-02-04](A-02-04-support-access.md) (merged).

## Goal
The super admin manages the platform's cities and areas in Arabic; a branch gets an optional city and area; the first list (Aleppo with its neighbourhoods, Azaz) is drafted by us and reviewed by the owner in the PR.

## Plan
1. **Contracts** — `City` (id, Arabic name, archived, areas count), `Area` (id, city id, Arabic name, archived), create, rename, archive and restore requests; `Branch` and branch create/edit gain `cityId`, `areaId` (nullable, additive) and their names; codes `area_not_in_city`, `place_archived`, `name_taken`.
2. **Database** (`/db-migration`, `/rls-policy`)
   - Platform tables `city`, `area` (Arabic name, folded name for search, archived_at; unique folded name per city); `shifa_app` SELECT, `shifa_platform` writes; never deleted (no DELETE grant).
   - `branch.city_id`, `branch.area_id` nullable FKs; a composite FK or trigger keeps the area in the city.
   - Seed migration: Aleppo and its neighbourhoods, Azaz (the owner reviews the list in this PR).
   - **Contract** step of A-02-03: drop `tenant.idle_minutes` and its column grant (A-02-03 is deployed by then; before real data).
3. **API**
   - Platform: `GET /platform/cities?search=&archived=`, `POST /platform/cities`, `PATCH /platform/cities/:id` (rename), `POST …/archive|restore`; the same for `/platform/cities/:id/areas`; Arabic folded search (OD-40 folding in `@shifa/contracts` or the i18n folding helper).
   - Clinic: `GET /places/cities` and `/places/cities/:id/areas` (non-archived, for branch forms; `branches.manage`); branch create and edit accept city and area, refuse an archived one unless the branch already holds it, refuse an area of another city.
   - Audit: `city.created`, `city.renamed`, `city.archived`, `city.restored`, and the same for areas (platform events); `branch.place_changed` (tenant event, ids only).
4. **Web, Flutter** — none (A-02-08 admin, A-02-09 branch form).
5. **End-to-end** — none.

Tests written first: add, rename, archive, restore; no delete route and no DELETE grant (15); folded Arabic search (15); branch with city and area, area of another city refused, archived not offered but kept on a branch that holds it (15); audit rows (18); idle setting still read from the cascade after the column drop (10); `shifa_app` cannot write `city` or `area`.
Estimated hand-written lines: ~2,500 (contracts ~250, database ~400, seed list ~250, platform routes ~500, branch changes ~250, tests ~850).

## Stopped at
Planned.

## Evidence
- `verify` (full): —
- Isolation suite: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- The seed list is synthetic reference data (place names, no people); mark it for the owner's review in the PR body.
