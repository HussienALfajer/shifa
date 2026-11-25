# A-02-03 Settings cascade with locks

Status: Planned · Tier: T0 · Branch: `feat/A-02-03-settings-cascade`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) criteria 8–10, 18 (setting events) · Requirements: PLT-22, PLT-23, PLT-24 · Decisions: ADR-0007; A-01a criterion 9, OD-77, OD-87

After [A-02-02](A-02-02-limits-flags-capabilities.md) (merged).

## Goal
Settings are declared in code and resolved nearest-scope-wins with locks and schema checks; every admin read says where a value comes from; the clinic's idle sign-out is the first key, `session.idle_minutes`, and keeps working.

## Plan
1. **Contracts** — `SettingView` (key, effective value, source scope and label, locked, lockedBy scope, overridable here), `ClinicSettingsView` (list), `SetSettingRequest`, `LockSettingRequest`; codes `setting_locked`, `setting_scope_refused`, `setting_value_invalid`. `GET|PATCH /clinic/settings` keep their shape for `idleMinutes` and add `source` and `locked` (additive).
2. **Database** (`/db-migration`, `/rls-policy`; **expand + migrate**)
   - `setting_value` (tenant_id, scope `organization | branch | practitioner | user`, scope id, key, value jsonb, locked, set_by, set_at): FORCE RLS; `shifa_app` writes its own tenant's non-locked rows of the scopes a route allows; lock columns written by `shifa_platform` only (column grant, approved at `/db-migration`).
   - `platform_setting_value` (scope `platform | plan`, plan id, key, value, locked): platform table, `shifa_app` SELECT.
   - Migrate: backfill `session.idle_minutes` from `tenant.idle_minutes` for every clinic. The auth path (`shifa_auth`) reads the effective idle value (SELECT of that key only, restrictive policy). The **contract** step (drop `tenant.idle_minutes`) is in A-02-05's migration, after this one is deployed.
3. **API** (`modules/settings`)
   - `SETTING_DEFINITIONS` in code: key, JSON Schema (from zod), default, `overridable_by`, lockable, sensitivity; start-up check (unknown key, default not valid, scope unknown).
   - Resolver: platform → plan → specialty pack (empty source until A-11) → organization → branch → practitioner → user; a stored value that no longer validates is skipped; a lock stops every scope below; returns value and source.
   - Writes validated against the schema, refused outside `overridable_by` or under a lock.
   - `/clinic/settings` reads and writes through the cascade (owner, `clinic.settings.manage`); the session's idle limit comes from the resolver (sessions service and `tenantView`).
   - Platform: `GET /platform/clinics/:id/settings`, `PUT /platform/clinics/:id/settings/:key` (value), `POST …/:key/lock` and `/unlock`; audit `setting.set`, `setting.locked`, `setting.unlocked` (key, scope, before, after); the tenant event `clinic.settings_changed` keeps writing for the owner's change.
4. **Web, Flutter** — none (A-02-07, A-02-09).
5. **End-to-end** — the A-01 idle journey stays green unchanged.

Tests written first: precedence across every scope with a test catalogue (8); lock at organization stops branch and user (9); `overridable_by` refusal (8); schema refusal on write and invalid stored value skipped (8); source label for each scope, including the default (9); idle regression: existing 15/30/60 values after the backfill, owner change applied on the next request, super-admin lock refuses the owner (10); audit rows (18); isolation case for `setting_value`; `shifa_app` cannot write lock columns.
Estimated hand-written lines: ~3,300 (contracts ~250, database ~500, definitions and resolver ~700, routes and auth-path read ~550, tests ~1,300).

## Stopped at
Planned.

## Evidence
- `verify` (full): —
- Isolation suite: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- Keep `tenant.idle_minutes` in place (unread) until A-02-05 drops it.
