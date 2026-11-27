# ADR-0050: Support access as a grant, a one-time hand-off and a separate read-only support session

Status: Accepted (by Claude under the owner's delegation, 2026-11-27; pending owner confirmation) · Date: 2026-11-27 · Deciders: Claude under the owner's overnight delegation (OD-124) · Amends: [ADR-0043](0043-database-roles-auth-and-platform.md) (the side roles' rows on `support_access_grant`), [ADR-0044](0044-better-auth-as-library-behind-nest-routes.md) (a second session cookie)

## Context
A super admin must read one clinic's clinic web as its owner sees it, for a reasoned, time-boxed grant the owner sees and can end, every request audited and every write refused twice ([A-02](../specs/platform/A-02-settings-entitlements-console.md) criteria 11–14, OD-111, OD-112). Admin web and clinic web are separate origins, each with its own `/api` proxy and its own `__Host-shifa.sid` cookie (no `Domain`), so the admin's session cannot simply be reused in clinic web, and it must not be: an admin session never acts in a tenant ([ADR-0043](0043-database-roles-auth-and-platform.md)).

## Decision
- **Grant.** `support_access_grant` (tenant table, FORCE RLS): admin, reason (10–500), opened, expires (30, 60, 120 or 240 min), ended at, ended by, end reason (`admin`, `owner`, `expiry`). A partial unique index allows one open grant per super admin per clinic (409 `support_active`). An expired grant is closed (`expiry`, ended at its expiry) by the first path that sees it, with one `support.expired` audit row. A suspended clinic can be opened.
- **Hand-off.** Opening the grant (and «فتح عيادة الويب» later) stores the SHA-256 of a fresh 256-bit token on the grant with a 2-minute expiry and answers `handoffUrl` = clinic web `/support#<token>` (fragment: no server log). Clinic web posts the token to `POST /auth/support/session` (public: the token is the credential); the auth path finds the grant by hash, clears it in the same statement (single use), and creates a **support session**.
- **Support session.** A `session` row with `support_grant_id`, the clinic as active tenant, expiry at the grant's end, MFA passed (only an MFA-verified super admin can issue a hand-off), the admin's 15-minute idle limit; its own cookie `__Host-shifa.support`, read before `__Host-shifa.sid`. A new exchange ends the grant's earlier support sessions (one tab).
- **Principal.** `support: { grantId, expiresAt }`, only with `platformAdmin` and a tenant; roles are a synthesised tenant-wide `owner`, so reads are exactly an owner's. Every request reads the grant: once it ended or expired the answer is 401 `session_expired`, reason `support_ended`, with `supportEnded` (`endedBy`, `endedAt`, the owner's name).
- **Read-only twice.** The guard answers 403 `support_read_only` to every non-GET/HEAD route in a support session before the handler (`@SignedIn` routes too), except `POST /auth/support/end` (ends its own grant only), and 403 to `@PlatformAdmin` routes. `TenantDb.run()` opens the transaction `READ ONLY` for a support scope.
- **Audit.** `support.opened` (minutes; the reason only on the grant row), `support.ended` (by whom), `support.expired`, `support.handoff_issued`, and one `support.request` row per request of a support session (method, route template, target id, grant id; no body, no query), written in the clinic before the handler. Logs and spans carry the grant id, never the reason.
- **Roles.** `shifa_app`: reads its clinic's grants (as it reads setup links, the hash of a single-use token included; the API never selects it), ends an open one as the owner by themselves (`UPDATE (ended_at, ended_by, ended_by_name, end_reason)`); `shifa_platform`: reads grants without the hash, opens, issues hand-offs, ends its own and closes expired grants in support actions only; `shifa_auth`: reads the grant of its hash or of the signed-in admin, clears the hash once, closes an expired grant. Each by column grant and restrictive policy. The admin's name (and the ending owner's) is stored on the grant, so no path reads another person's account.

## Consequences
+ The admin session never enters a tenant; a leaked hand-off is useless after one use or 2 minutes.
+ Writes are refused by the guard and by the database, so a route the guard misses still fails.
− Local development serves both apps on `localhost`, where cookies ignore the port: while a support session is open, admin web on the same host also sees `__Host-shifa.support` and acts as the support session. Use `127.0.0.1` for one app, or end the grant.
− One audit row per request in a support session (small, bounded by the grant).

## Alternatives considered
- Reuse the admin session in clinic web (shared parent domain cookie): the admin session would reach tenant data; refused by ADR-0043.
- Token in the query string: reaches proxy logs and history.
- A signed, stateless hand-off (JWT): cannot be single-use without a store.
- Hand-off rows in Better Auth's `verification` table: written on the auth path only, so the grant and its hand-off could not commit together.

## Sources
[A-02 spec](../specs/platform/A-02-settings-entitlements-console.md) criteria 11–14, 26; [screen contract](../specs/platform/A-02-screen-contract.md); OD-111, OD-112
