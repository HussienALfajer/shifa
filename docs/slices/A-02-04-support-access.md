# A-02-04 Read-only support access

Status: Planned · Tier: T0 · Branch: `feat/A-02-04-support-access`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) criteria 11–14 · Requirements: PLT-14, PLT-46 (`support.elevate` reserved), PLT-47 · Decisions: OD-111, OD-112, ADR-0043, ADR-0044; new ADR (support grant mechanism)

After [A-02-03](A-02-03-settings-cascade.md) (merged), so every A-02 write route is in the support matrix.

## Goal
A super admin opens time-boxed, reasoned, read-only access to one clinic and reads clinic web as its owner sees it; every owner sees it happening and can end it; every request is audited.

## Plan
### Checkpoint 1 — ADR and schema
- **ADR** (support grant mechanism): admin web and clinic web are different hosts and the session cookie is `__Host-` (no Domain), so opening clinic web needs a hand-off. Recommended: `POST /platform/clinics/:id/support` creates the grant and a one-time hand-off token (hashed, ~2 min, like setup links); the new tab opens clinic web with it; clinic web exchanges it for a separate **support session** (its own cookie, `support_grant_id`, expiry = grant end, the super admin's MFA state carried); the admin session is never reused in a tenant. Alternatives and threats (token leak, replay, fixation, cross-tab) in the ADR.
- **Database** (`/db-migration`, `/rls-policy`; expand only): `support_access_grant` (tenant_id, admin user id, reason, opened_at, expires_at, ended_at, ended_by, end_reason `admin | owner | expired`): FORCE RLS; `shifa_app` SELECT of its own tenant and UPDATE of `ended_at, ended_by, end_reason` only on an open row (column grant + restrictive policy, approved at `/db-migration`); `shifa_platform` INSERT and end; `shifa_auth` reads the grant behind a support session. Partial unique index: one open grant per super admin per clinic. Hand-off token table or columns. Isolation case.
### Checkpoint 2 — support principal and read-only enforcement
- Principal gains `support: { grantId, expiresAt } | undefined` (PrincipalSchema, refine: only with `platformAdmin` and a tenant); its roles are a synthesised tenant-wide `owner` for reads; `support.elevate` added to `PERMISSION_CATALOGUE`, granted to nobody.
- Guard: in a support session every route that is not GET/HEAD answers 403 `support_read_only` (before the handler), `@SignedIn` account writes included; `TenantDb.run()` opens the transaction `READ ONLY` for a support scope (second wall); suspended clinic still readable (criterion 14).
- Ends: expiry, the admin (`POST /platform/clinics/:id/support/end`), an owner (`POST /clinic/support-access/:id/end`); the next request answers 401 `session_expired` reason `support_ended`.
### Checkpoint 3 — owner side, console data, audit
- `GET /clinic/support-access` (owner, `clinic.settings.manage`): the open grant (admin's name, reason, end) for the banner, and every grant for the log. `GET /platform/clinics/:id/support` for admin web: open grant with time left and past grants; 409 `support_active`.
- Audit: `support.opened` (duration; reason only on the grant row), `support.ended` (by whom), `support.expired`, and one `support.request` row per request in a support session (route template, target id, no body, no query).
- Logs and spans carry the grant id only; reasons never.
4. **Web, Flutter** — none (admin side A-02-07; clinic web frame and banner A-02-09).
5. **End-to-end** — API journey: open → hand-off → owner read 200 → a write 403 → owner ends → 401 `support_ended`.

Tests written first: reason 10–500 and durations 30 min, 1, 2, 4 h only; second open grant 409 `support_active` (11); route matrix in a support session: every non-GET route 403 `support_read_only`, every owner GET 200 (12); a write forced past the guard fails on the read-only transaction (12); three ways to end, then 401 `support_ended` (12); owner banner and log data, another clinic's owner sees nothing (13); audit rows per event and per request without bodies (14); suspended clinic opens (14); hand-off token single-use and expiring; isolation case; leak test (no reason in logs).
Estimated hand-written lines: ~3,900 (ADR ~150, database ~500, principal and guard ~600, grants and hand-off ~700, owner and console routes ~350, contracts ~200, tests ~1,400).

## Stopped at
Planned.

## Evidence
- `verify` (full): —
- Isolation suite: —
- Reviewer and security-reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- Backlog "audit rows readable by the platform" stays open: the support log reads the grant table, not audit rows.
