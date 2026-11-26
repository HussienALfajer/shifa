# A-02-02 Entitlements, plans and overrides

Status: Planned · Tier: T0 · Branch: `feat/A-02-02-entitlements-and-overrides`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) criteria 1–3, 18 (type, plan and override events) · Requirements: PLT-13, PLT-21, PLT-29 · Decisions: ADR-0007, OD-109, OD-110 · From A-02-01: criteria 20

First API slice of A-02, after the design slice [A-02-01](A-02-01-design-and-screen-contract.md) (approved). Schema changes of A-02 are serialised: A-02-02 → 03 → 04 → 05 → 06 → 07.
Contract: delivers the rows of the [A-02 screen contract](../specs/platform/A-02-screen-contract.md) that name this slice, each proven by a contract test (ADR-0047); a change forced during the build updates the row and its drawing here and is reported to the owner.

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
   - Per-tenant cache behind an `EntitlementsPort`: TTL ≤ 60 s, cleared at once on the instance that wrote; injected `Clock`. The same cache shape is reused by flags (A-02-03).
   - Platform routes (`@PlatformAdmin`, `withPlatformAdmin`): `GET /platform/clinics/:id/entitlements`, `PUT|DELETE /platform/clinics/:id/overrides/:key`, `GET /platform/clinics/:id/type-preview?type=`, `POST /platform/clinics/:id/type` (preview counts read in the clinic's tenant context; type change in one transaction).
   - Audit (platform events): `clinic.type_changed` (before, after), `entitlement.override_set` / `_removed` (key, before, after; no reason text in audit data, it stays on the row).
4. **Web, Flutter** — none (UI code slice A-02-08).
5. **End-to-end** — none; API journeys only.

Tests written first: resolution table (plan only, increment add-ons summed, highest replace wins, override beats all, expired override ignored at the instant of expiry, unknown key denied) (2); catalogue start-up refusal and call refusal (2); cache: change on instance A seen by instance B within 60 s on a fake clock, at once on A (2); override set and removed with value validation per key type and mandatory reason (3); type change preview with over-limit counts and the move to the new plan (1); audit row per event with before and after, no reason text (3, 18); isolation case for `tenant_override`; `shifa_app` cannot write plan tables or overrides.
Estimated hand-written lines: ~3,850 (contracts ~320, database ~550, resolver and cache ~600, platform routes ~750, history ~150, tests ~1,330). Re-estimated at A-02-01 checkpoint 3 (owner, 2026-11-27).

## From A-02-01 (re-plan approved by the owner, 2026-11-27)
The [screen contract](../specs/platform/A-02-screen-contract.md) is the reference: where this file's earlier plan names a route or field differently, the contract wins. Rows owned by this slice:
Names in the earlier plan above that the contract replaces: override `reason` 10–500; errors `validation_failed` and 404 `not_found` (not `entitlement_unknown` or `override_value_invalid`); the type change is `type` on `PATCH /platform/clinics/:id` (not `POST …/type`).
- Clinic page «الاشتراك والحدود»: `GET /platform/clinics/:id/entitlements` (all fields but `used`), `PUT` and `DELETE /platform/clinics/:id/overrides/:key`, `GET /platform/clinics/:id/overrides/:key/history` (criterion 20), `GET /platform/clinics/:id/type-preview`, `type` on `PATCH /platform/clinics/:id`.
- Spec additions: criterion 3 (expiry to the end of a Damascus day; an override survives a type change; no feature entitlement in A-02), criterion 20 (history from the audit log).
- History table (review of A-02-01, owner 2026-11-27): `tenant_override_event` (tenant_id, key, kind, before, after, reason, by, at; FORCE RLS; written in the same transaction as each override change, at expiry and on a type change), read by `GET …/overrides/:key/history`; the audit rows stay without reason text. ~150 lines more.

## Stopped at
Planned.

## Evidence
- `verify` (full): —
- Isolation suite: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- Use counts for the preview are what A-02-03 enforces; keep the counting query in one place (`entitlements/usage-counts.ts`) for both.
