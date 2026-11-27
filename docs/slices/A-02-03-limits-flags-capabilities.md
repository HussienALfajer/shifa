# A-02-03 Limits enforced, feature flags and capabilities

Status: Built, in review · Tier: T0 · Branch: `claude/zen-heisenberg-xkeqjf` (cloud session; planned as `feat/A-02-03-limits-flags-capabilities`)
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) criteria 4–7, 18 (flag events) · Requirements: PLT-13, PLT-20, PLT-25, PLT-29 · Decisions: ADR-0007, OD-110, OD-114 · From A-02-01: criteria 4, 5, 7 (amended)

After [A-02-02](A-02-02-entitlements-and-overrides.md) (merged).
Contract: delivers the rows of the [A-02 screen contract](../specs/platform/A-02-screen-contract.md) that name this slice, each proven by a contract test (ADR-0047); a change forced during the build updates the row and its drawing here and is reported to the owner.

## Goal
The doctor and branch limits refuse new ones at the limit, even under racing requests; engineering flags are declared in code and switched by the super admin; clinic web learns from one route what the active clinic may use; the owner reads the subscription card's data.

## Plan
1. **Contracts** — `Capabilities` (entitlements on/off, limits `{ key, limit, used }`, evaluated flags), `Subscription` (plan, status, end date, limits with use, enabled features), `FlagView` (key, description, default, mode `off | on | selected`, tenant ids, reason, changed by and at), `SetFlagRequest`; error `limit_reached` with `{ key, limit, used }` (409).
2. **Database** (`/db-migration`, `/rls-policy`; expand only)
   - Platform tables `feature_flag` (key, mode, reason, changed_by, changed_at) and `feature_flag_tenant` (flag, tenant_id): readable by `shifa_app` (only its own tenant's rows of `feature_flag_tenant`, FORCE RLS), written by `shifa_platform`.
3. **API**
   - Limits (OD-110): one counting module (from A-02-02) counts non-deactivated members holding a doctor role (pending included) and non-archived branches; checked inside the write transaction under a per-clinic advisory lock (`shifa.limits:` + tenant, as `shifa.owners:`) in team add, edit (doctor role added), reactivate, and branch create and restore; 409 `limit_reached`, nothing written; a lowered limit never removes.
   - Flags (OD-114): `FLAG_CATALOGUE` in code (key, description, default); an OpenFeature-compatible client interface (`getBooleanValue(key, default, { tenantId })`) over an in-house provider reading the two tables through the A-02-02 cache rule; off for all wins (kill switch); a row for a flag not in code is ignored; no row → code default.
   - Gates: `@RequireEntitlement(key)` and `@RequireFlag(key)` next to the one access annotation; checked by the guard after the permission; start-up check refuses unknown keys; proven with test-only probe keys (no production route is gated yet).
   - `GET /clinic/capabilities` (`@SignedIn` with an active clinic; every member) and `GET /clinic/subscription` (`clinic.settings.manage`, owner only).
   - Platform: `GET /platform/flags`, `PUT /platform/flags/:key` (mode, tenant ids, reason 10–500); audit `flag.changed` (before, after mode and count of clinics).
4. **Web, Flutter** — none (UI code slices A-02-08, A-02-09, A-02-10).
5. **End-to-end** — none.

Tests written first: per limit and path — add, edit adding a doctor role, reactivate, branch create, restore — at the limit 409 with key, limit, used and no row written; lowered limit keeps existing (4); concurrent adds at the limit: exactly one succeeds (4); flag evaluation — kill switch, on for all, selected in and out, unknown row, missing row (7); cache window across two instances on a fake clock for flags (7); capabilities contract test and route matrix with probe-gated routes off and on (5); subscription owner-only in the matrix (6); flag audit row (18); isolation case for `feature_flag_tenant`.
Estimated hand-written lines: ~3,800 (contracts ~320, database ~300, limits ~550, flags and provider ~680, gates ~300, capabilities and subscription ~300, search fold ~150, tests ~1,200). Re-estimated at A-02-01 checkpoint 3 (owner, 2026-11-27).

## From A-02-01 (re-plan approved by the owner, 2026-11-27)
The [screen contract](../specs/platform/A-02-screen-contract.md) is the reference: where this file's earlier plan names a route or field differently, the contract wins. Rows owned by this slice:
Names in the earlier plan above that the contract replaces: flag `reason` 10–500.
- `GET /clinic/capabilities`, `GET /clinic/subscription`; 409 `limit_reached` (`details`: `key`, `limit`, `used`) on `POST` and `PATCH /team/members`, `POST /team/members/:id/reactivate`, `POST /branches`, `POST /branches/:id/restore`; `used` in the entitlements answer.
- Flags: `GET /platform/flags` (with `updatedByName`, `updatedAt`), `PUT /platform/flags/:key`.
- Existing API fix: `GET /platform/clinics?search=` on a folded name at the start of a word (alef forms, taa marbuta, alef maqsura, diacritics), one fold function shared with the cities search.
- Spec additions: criteria 4 and 5 (a full limit shown before sending; what the plan does not allow is absent, never disabled), criterion 7 (who changed a flag last).

## Stopped at
Built: contracts, database (two migrations), API (`modules/flags`, `modules/capabilities`, `ClinicLimits` in `modules/entitlements`, the gates in `src/access/`, the folded clinic search). In review.

## As built (changes from the plan, reported to the owner)
- **Branch:** `claude/zen-heisenberg-xkeqjf` (cloud session; planned as `feat/A-02-03-limits-flags-capabilities`).
- **`GET /clinic/capabilities` access:** a new non-sensitive permission `clinic.capabilities.view`, granted to every clinic role (owner, doctor, receptionist, assistant, accountant), never to a super admin, instead of `@SignedIn`: `@SignedIn` routes get no checked scope and never read tenant data (`.claude/rules/api.md`). Matrix row `clinicMember`.
- **`limit_reached` body:** the limit is in `error.limitReached` (`key`, `limit`, `used`; schema `LimitReached`), not `details`, which stays the list of field issues of `validation_failed` (one shape per field, for both clients). Contract row `add409` updated; no drawing change (the Callout names the limit either way).
- **Gate answer:** a gated route whose feature or flag is off answers 403 `feature_unavailable` (new code). Gates sit on `@RequirePermission` routes only (the start-up check refuses one elsewhere, and a key outside the catalogues). The guard finds the `GatePort` (`modules/capabilities/gates.ts`) through `ModuleRef`, so `src/access/` imports no module; without a provider every gated route stops the start.
- **Flag client:** `getBooleanValue(key, defaultValue, scope)`: the evaluation context is the scope the guard checked (the provider reads through `TenantDb`), not a bare tenant id. As in OpenFeature, `defaultValue` answers only a failed read (gates pass `false`); a key outside the catalogue throws. `PRODUCTION_FLAGS` is empty: no flag is declared yet (the flags screen shows its `none` state).
- **Selection kept:** `PUT /platform/flags/:key` without `clinicIds` keeps the stored selection; with `clinicIds` it replaces it; the list and the answer return the kept selection while the flag is on or off for all (ignored then). Audit `flag.changed` data: `key`, `before`, `after` (modes) and `clinics` (count); `flag.listed` for the list. No reason text in audit data.
- **`feature_flag_tenant`** has a uuid `id` with `(tenant_id, flag_key)` unique (`test/schema-keys.test.ts`), and a foreign key to `feature_flag.key`. shifa_platform reads every clinic's selections in flag actions only (tenant ids; clinic names from `tenant`, which it reads anyway).
- **Limits read fresh:** the check resolves the limit from the rows in the write transaction, not the 60 s cache, so a lowered limit is never passed by a stale entry. Lock order: owners → `shifa.limits:` → phone → rows; branch restore takes the limits lock before the branch's row lock.
- **Counts:** `clinicUsageCounts(tx)` (shifa_app, the clinic's context) beside `tenant_usage_counts()` in `packages/db/src/entitlements.ts`; `entitlements/usage-counts.ts` maps both to keys. The platform function now also answers in `entitlement.viewed`, `entitlement.override_set` and `entitlement.override_removed` (for `used` on «الاشتراك والحدود»); `used` is null for `limits.custom_fields`.
- **One fold:** `foldArabic` and `matchesWordStart` moved from `@shifa/ui` to `@shifa/contracts/fold-arabic` (no imports); `@shifa/ui` re-exports them (no behaviour or look change) and gained `@shifa/contracts` as a dependency. The clinic search filters the listed clinics with `matchesWordStart` (the list already reads every clinic).
- **Test worlds:** `teamWorld()` takes `clinicType`; the branch tests and the archived-roles tests use `multi_branch` (a multi-doctor clinic now holds one branch). The route matrix gives TENANT_A overrides (`test.feature` on, both limits 100,000).
- **Dart client budget** raised to 280 files and 10,500 lines (188 and 6,991 now).
- **Locked tests:** two fixes with the owner's approval (2026-11-27), no assertion changed: `add`'s parameter in `test/limits/limits.test.ts` typed `RoleScope[]` (tsc); the repeated flag in `test/flags/evaluate.test.ts` written as a literal instead of `FLAGS[0] as FlagDefinition` (lint).
- **Migrations:** `20261127010323_a02_feature_flags` (expand: two tables) and `20261127010325_a02_flag_policies` (expand: RLS, grants, policies, `tenant_usage_counts` widened). Rollback notes in the SQL header.

## Evidence
- `verify` (full): —
- Isolation suite: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- A-02-05 (support) must see `limit_reached` routes as write routes; nothing special needed if writes are recognised by method.
