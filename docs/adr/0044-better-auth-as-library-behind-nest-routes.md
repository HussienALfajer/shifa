# ADR-0044: Better Auth as a library behind Nest routes; memberships in our own tables

Status: Accepted (owner, 2026-11-23, with specs A-01a and A-01b and the A-01 slice plan) · Date: 2026-11-23 · Deciders: product owner (with Claude) · Amends: [ADR-0016](0016-identity-better-auth-reverse-whatsapp.md)

## Context
ADR-0016 chose Better Auth with its organization, phone-number, two-factor, passkey, multi-session and admin plugins. The A-01 specs ([A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md), [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md)) put clinics, memberships, role assignments and branches in our own tenant tables under FORCE RLS (built in A-01-01), and require every route, sign-in included, to pass the Nest guard, the contract check and the route matrix (A-01a criterion 16). Better Auth's catch-all handler would add routes outside all three. The identity tables live on the `shifa_auth` role, reachable only through `withAuth()` ([ADR-0043](0043-database-roles-auth-and-platform.md)), which hands out a transaction, never a pool. The A-01-02 gate ran Better Auth 1.7.27 this way (results in the [slice](../slices/A-01-02-better-auth-sign-in-and-sessions.md)).

## Decision
- Better Auth is a **library**: the API calls `auth.api.*` from Nest controllers; its handler is never mounted. Identity routes are ordinary contract routes (`@Public` for sign-in, `@SignedIn` for a person's own session routes).
- **No organization plugin.** Memberships, roles and branches are our tables; the principal's roles are read inside the active tenant (`withTenant()`), never from Better Auth.
- Plugins now: **phone number** (sign-in with phone and password) and **two factor** (TOTP and backup codes, used from A-01-03). Passkeys, multi-session and admin plugins are not used; ADR-0016's other decisions stand.
- The Drizzle adapter runs on `createAuthDb()`: each adapter call opens its own `withAuth()` transaction, or joins the current one (AsyncLocalStorage); ids are UUIDs.
- Sessions: database sessions in the `__Host-shifa.sid` cookie (Secure, HttpOnly, SameSite=Lax, 12 h), the absolute limit fixed at sign-in, the idle limit and last activity checked by our session service on every request with an injected clock; no cookie cache, no IP stored.
- Locks, password rules, audit rows and the equal answer for unknown phones are ours, not Better Auth's rate limiter.

## Consequences
+ One access model for every route; the matrix and OpenAPI cover sign-in.
+ Tenant data never depends on a library's schema; RLS and the isolation suite cover memberships.
− Better Auth features that assume its handler (OAuth callbacks, its client SDK) need a Nest route each when adopted.
− Upgrades must re-run the gate test (`apps/api/test/identity/better-auth.gate.test.ts`).

## Alternatives considered
- Mounting the handler under `/api/auth/*`: routes outside the guard and the matrix; refused by criterion 16.
- Organization plugin for memberships: a second membership model beside the RLS tables of A-01-01.
- Own sessions and password hashing without Better Auth: more code to secure; ADR-0016's choice stands.

## Sources
[A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) criteria 6–16, [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) criterion 13, [ADR-0043](0043-database-roles-auth-and-platform.md), gate test of slice A-01-02
