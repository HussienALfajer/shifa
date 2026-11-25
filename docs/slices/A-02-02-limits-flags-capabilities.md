# A-02-02 Limits enforced, feature flags and capabilities

Status: Planned · Tier: T0 · Branch: `feat/A-02-02-limits-flags-capabilities`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) criteria 4–7, 18 (flag events) · Requirements: PLT-13, PLT-20, PLT-25, PLT-29 · Decisions: ADR-0007, OD-110, OD-114

After [A-02-01](A-02-01-entitlements-and-overrides.md) (merged).

## Goal
The doctor and branch limits refuse new ones at the limit, even under racing requests; engineering flags are declared in code and switched by the super admin; clinic web learns from one route what the active clinic may use; the owner reads the subscription card's data.

## Plan
1. **Contracts** — `Capabilities` (entitlements on/off, limits `{ key, limit, used }`, evaluated flags), `Subscription` (plan, status, end date, limits with use, enabled features), `FlagView` (key, description, default, mode `off | on | selected`, tenant ids, reason, changed by and at), `SetFlagRequest`; error `limit_reached` with `{ key, limit, used }` (409).
2. **Database** (`/db-migration`, `/rls-policy`; expand only)
   - Platform tables `feature_flag` (key, mode, reason, changed_by, changed_at) and `feature_flag_tenant` (flag, tenant_id): readable by `shifa_app` (only its own tenant's rows of `feature_flag_tenant`, FORCE RLS), written by `shifa_platform`.
3. **API**
   - Limits (OD-110): one counting module (from A-02-01) counts non-deactivated members holding a doctor role (pending included) and non-archived branches; checked inside the write transaction under a per-clinic advisory lock (`shifa.limits:` + tenant, as `shifa.owners:`) in team add, edit (doctor role added), reactivate, and branch create and restore; 409 `limit_reached`, nothing written; a lowered limit never removes.
   - Flags (OD-114): `FLAG_CATALOGUE` in code (key, description, default); an OpenFeature-compatible client interface (`getBooleanValue(key, default, { tenantId })`) over an in-house provider reading the two tables through the A-02-01 cache rule; off for all wins (kill switch); a row for a flag not in code is ignored; no row → code default.
   - Gates: `@RequireEntitlement(key)` and `@RequireFlag(key)` next to the one access annotation; checked by the guard after the permission; start-up check refuses unknown keys; proven with test-only probe keys (no production route is gated yet).
   - `GET /clinic/capabilities` (`@SignedIn` with an active clinic; every member) and `GET /clinic/subscription` (`clinic.settings.manage`, owner only).
   - Platform: `GET /platform/flags`, `PUT /platform/flags/:key` (mode, tenant ids, reason 10–500); audit `flag.changed` (before, after mode and count of clinics).
4. **Web, Flutter** — none (A-02-07, A-02-08, A-02-09).
5. **End-to-end** — none.

Tests written first: per limit and path — add, edit adding a doctor role, reactivate, branch create, restore — at the limit 409 with key, limit, used and no row written; lowered limit keeps existing (4); concurrent adds at the limit: exactly one succeeds (4); flag evaluation — kill switch, on for all, selected in and out, unknown row, missing row (7); cache window across two instances on a fake clock for flags (7); capabilities contract test and route matrix with probe-gated routes off and on (5); subscription owner-only in the matrix (6); flag audit row (18); isolation case for `feature_flag_tenant`.
Estimated hand-written lines: ~3,600 (contracts ~300, database ~300, limits ~550, flags and provider ~650, gates ~300, capabilities and subscription ~300, tests ~1,200).

## Stopped at
Planned.

## Evidence
- `verify` (full): —
- Isolation suite: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- A-02-04 (support) must see `limit_reached` routes as write routes; nothing special needed if writes are recognised by method.
