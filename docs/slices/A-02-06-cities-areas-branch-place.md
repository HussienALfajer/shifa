# A-02-06 Cities and areas, a branch's place

Status: Planned · Tier: T0 · Branch: `feat/A-02-06-cities-areas-branch-place`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) criteria 15, 18 (city and area events); criterion 10 (contract step) · Requirements: PLT-15 · Decisions: OD-113 · From A-02-01: criteria 15 (amended), 24

After [A-02-05](A-02-05-support-access.md) (merged).
Contract: delivers the rows of the [A-02 screen contract](../specs/platform/A-02-screen-contract.md) that name this slice, each proven by a contract test (ADR-0047); a change forced during the build updates the row and its drawing here and is reported to the owner.

## Goal
The super admin manages the platform's cities and areas in Arabic; a branch gets an optional city and area; the first list (Aleppo with its neighbourhoods, Azaz) is drafted by us and reviewed by the owner in the PR.

## Plan
1. **Contracts** — `City` (id, Arabic name, archived, areas count), `Area` (id, city id, Arabic name, archived), create, rename, archive and restore requests; `Branch` and branch create/edit gain `cityId`, `areaId` (nullable, additive) and their names; codes `area_not_in_city`, `place_archived`, `name_taken`.
2. **Database** (`/db-migration`, `/rls-policy`)
   - Platform tables `city`, `area` (Arabic name, folded name for search, archived_at; unique folded name per city); `shifa_app` SELECT, `shifa_platform` writes; never deleted (no DELETE grant).
   - `branch.city_id`, `branch.area_id` nullable FKs; a composite FK or trigger keeps the area in the city.
   - Seed migration: Aleppo and its neighbourhoods, Azaz (the owner reviews the list in this PR).
   - **Contract** step of A-02-04: drop `tenant.idle_minutes` with its check constraint `tenant_idle_minutes_check`, its column grant to shifa_app (`UPDATE (idle_minutes, updated_at)`; keep `updated_at` if still needed) and the policy `tenant_app_settings` (shifa_app's UPDATE of its own tenant row, which exists only for the idle setting); remove `idleMinutes` from the tenant schema and `IDLE_MINUTES` export, and the raw-insert check test in `packages/db/test/create-clinic.test.ts` (`NewClinic.idleMinutes` is already gone since A-02-04). A-02-04 is deployed by then; before real data.
3. **API**
   - Platform: `GET /platform/cities?search=&archived=`, `POST /platform/cities`, `PATCH /platform/cities/:id` (rename), `POST …/archive|restore`; the same for `/platform/cities/:id/areas`; Arabic folded search (OD-40 folding in `@shifa/contracts` or the i18n folding helper).
   - Clinic: `GET /places/cities` and `/places/cities/:id/areas` (non-archived, for branch forms; `branches.manage`); branch create and edit accept city and area, refuse an archived one unless the branch already holds it, refuse an area of another city.
   - Audit: `city.created`, `city.renamed`, `city.archived`, `city.restored`, and the same for areas (platform events); `branch.place_changed` (tenant event, ids only).
4. **Web, Flutter** — none (UI code slices A-02-09 admin, A-02-10 branch form).
5. **End-to-end** — none.

Tests written first: add, rename, archive, restore; no delete route and no DELETE grant (15); folded Arabic search (15); branch with city and area, area of another city refused, archived not offered but kept on a branch that holds it (15); audit rows (18); idle setting still read from the cascade after the column drop (10); `shifa_app` cannot write `city` or `area`.
Estimated hand-written lines: ~2,950 (contracts ~280, database ~420, seed list ~250, platform routes ~600, counts ~150, branch changes ~300, tests ~850). Re-estimated at A-02-01 checkpoint 3 (owner, 2026-11-27).

## From A-02-01 (re-plan approved by the owner, 2026-11-27)
The [screen contract](../specs/platform/A-02-screen-contract.md) is the reference: where this file's earlier plan names a route or field differently, the contract wins. Rows owned by this slice:
Names in the earlier plan above that the contract replaces: 409 `place_name_taken` (not `name_taken`); `?includeArchived=` (not `?search=&archived=`; search runs on the client); the clinic route is `GET /clinic/places` (not `/places/cities`).
- `GET /platform/cities?includeArchived=` with `branchCount`, `clinicCount`, `doctorCount` per city and area (criterion 24: counts only, across clinics under the platform role; this slice's security review checks that nothing but numbers leaves); add, rename, archive and restore cities and areas (criterion 15); 409 `place_name_taken`, `place_archived`, `place_not_archived`.
- Clinic web: `GET /clinic/places`; `cityId` and `areaId` on `POST` and `PATCH /branches` (`area_not_in_city`, 409 `place_archived`; an archived place a branch holds is kept); `city` and `area` on `GET /branches`.
- Counts across clinics (review of A-02-01, owner 2026-11-27): `branchCount`, `clinicCount`, `doctorCount` come from database functions that return integers only, listed in `classification.ts` and pinned in the privilege test; a new ADR amends ADR-0043 (platform roles stay off clinic rows) and is approved at `/db-migration`. A-02-07 reuses the mechanism. ~100 lines more.

## Stopped at
Planned.

## Evidence
- `verify` (full): —
- Isolation suite: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- The seed list is synthetic reference data (place names, no people); mark it for the owner's review in the PR body.
