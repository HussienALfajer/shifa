# A-02-01 Entitlements, plans and overrides

Status: Planned · Tier: T0 · Branch: `feat/A-02-01-entitlements-and-overrides`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) criteria 1–3, 18 (type, plan and override events) · Requirements: PLT-13, PLT-21, PLT-29 · Decisions: ADR-0007, OD-109, OD-110

First slice of A-02; after A-01 (done). Schema changes of A-02 are serialised: A-02-01 → 02 → 03 → 04 → 05 → 06.

## Goal
Every clinic has a plan (its type) and the API resolves any entitlement key for it, with the super admin's overrides, add-ons and expiry; the super admin changes a clinic's type after a preview and sets or removes overrides, all audited.

## Plan
1. **Contracts** — `EntitlementKey` view (key, type `boolean | limit`, plan value, add-ons, override, effective value), `ClinicEntitlements`, `SetOverrideRequest` (value per key type, `reason` 10–500, `expiresAt` optional), `TypeChangePreview` (each limit: new value, used, over), `ChangeTypeRequest`; codes `entitlement_unknown`, `override_value_invalid`.
2. **Database** (`/db-migration`, `/rls-policy`; expand only)
   - Platform tables `plan` (one per clinic type), `plan_feature` (plan, key, value), `addon` (key, mode `replace | increment`, value; no screen): no `tenant_id`, readable by `shifa_app` (no clinic data), written by `shifa_platform` only.
   - `tenant_override` (tenant_id, key, value jsonb, reason, expires_at, set_by, set_at): ENABLE + FORCE RLS, `shifa_app` SELECT of its own tenant only, `shifa_platform` INSERT/UPDATE/DELETE, classification entries, isolation case.
   - Seed: the three plans with `limits.practitioners` 1 / 10 / 30, `limits.branches` 1 / 1 / 5, `limits.custom_fields` 20.
   - A clinic's plan is `tenant.type` (no plan column: one source of truth).
3. **API** (`modules/entitlements`)
   - `ENTITLEMENT_CATALOGUE` injected at start-up (key, type, description), like `PERMISSION_CATALOGUE`: an unknown key in plans, add-ons or a call stops the start or throws.
   - Resolver (PLT-21): unexpired override → highest replacing add-on → plan value + incremental add-ons → deny; pure function, table-driven.
   - Per-tenant cache behind an `EntitlementsPort`: TTL ≤ 60 s, cleared at once on the instance that wrote; injected `Clock`. The same cache shape is reused by flags (A-02-02).
   - Platform routes (`@PlatformAdmin`, `withPlatformAdmin`): `GET /platform/clinics/:id/entitlements`, `PUT|DELETE /platform/clinics/:id/overrides/:key`, `GET /platform/clinics/:id/type-preview?type=`, `POST /platform/clinics/:id/type` (preview counts read in the clinic's tenant context; type change in one transaction).
   - Audit (platform events): `clinic.type_changed` (before, after), `entitlement.override_set` / `_removed` (key, before, after; no reason text in audit data, it stays on the row).
4. **Web, Flutter** — none (UI batch A-02-07).
5. **End-to-end** — none; API journeys only.

Tests written first: resolution table (plan only, increment add-ons summed, highest replace wins, override beats all, expired override ignored at the instant of expiry, unknown key denied) (2); catalogue start-up refusal and call refusal (2); cache: change on instance A seen by instance B within 60 s on a fake clock, at once on A (2); override set and removed with value validation per key type and mandatory reason (3); type change preview with over-limit counts and the move to the new plan (1); audit row per event with before and after, no reason text (3, 18); isolation case for `tenant_override`; `shifa_app` cannot write plan tables or overrides.
Estimated hand-written lines: ~3,500 (contracts ~300, database ~550, resolver and cache ~600, platform routes ~650, tests ~1,400).

## Stopped at
Planned.

## Evidence
- `verify` (full): —
- Isolation suite: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- Use counts for the preview are what A-02-02 enforces; keep the counting query in one place (`entitlements/usage-counts.ts`) for both.
