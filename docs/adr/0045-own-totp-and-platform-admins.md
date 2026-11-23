# ADR-0045: Own TOTP instead of Better Auth's two-factor plugin; super admins in `platform_admin`

Status: Proposed (slice A-01-03, 2026-11-23; for the owner's acceptance with its PR) · Date: 2026-11-23 · Deciders: product owner (with Claude) · Amends: [ADR-0044](0044-better-auth-as-library-behind-nest-routes.md)

## Context
ADR-0044 kept Better Auth's two-factor plugin for A-01-03. Building the MFA rules of [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) criteria 11 and 12 on it showed three gaps: the plugin keeps no last accepted time step (a code could pass twice within its window), it cannot tell a phone whose clock is off from a wrong code (the enrolment hint), and its sign-in answers a second-factor redirect without a session, so "owners reach nothing but enrolment" and "a pending session reaches nothing but the challenge" would need its own cookie and verification rows beside our sessions. Super admins also needed a mark the principal can read; `role_assignment` is per tenant and a super admin has none.

## Decision
- **TOTP is ours** (`apps/api/src/modules/identity/totp.ts`, `mfa.service.ts`): RFC 6238 (SHA-1, 6 digits, 30 s), ±1 step, the last accepted step stored (`two_factor.last_used_step`; nothing at or before it passes), five wrong codes lock for 15 minutes, a code 2–10 steps off at enrolment answers `clock_skew`. Better Auth's `two_factor` table holds it: the key sealed with AES-256-GCM (HKDF of `BETTER_AUTH_SECRET`), ten recovery codes as HMAC-SHA-256 with `AUTH_HMAC_KEY` (no offline search from a dump). The two-factor plugin is removed; the phone-number plugin stays.
- **Sign-in always gives a session**; `session.mfa_verified_at` makes the principal's `mfa` `none`, `pending` or `verified`. The guard refuses every route not marked `@BeforeMfa()` with 403 `mfa_enrolment_required` (owners and super admins without TOTP) or `mfa_challenge_required` (anyone enrolled whose session has not passed). The session is rotated after enrolment and after the challenge.
- **Super admins** are rows of a global `platform_admin` table (user ids), read by `shifa_auth` and written by `shifa_platform` only in a `platform.admin_created` transaction, which only the seed command opens. `@PlatformAdmin()` is the fourth access annotation.
- **A super admin's setup link** is a Better Auth `verification` row (`shifa-admin-setup:<user id>`, value = SHA-256 of the token): `setup_link` belongs to a tenant membership, and a super admin has neither.

## Consequences
+ Replay, lockout, skew hint and the MFA gate are tested in our code (`apps/api/test/identity/mfa.test.ts`) and do not depend on a plugin's internals.
+ One session model: the guard, the route matrix and OpenAPI (`x-before-mfa`) cover the MFA state.
− About 300 lines of security code are ours to keep correct; the algorithm is checked against an independent implementation in the tests.
− A Better Auth upgrade that changes the `two_factor` table needs a migration of ours.

## Alternatives considered
- The plugin plus a side table for the last step: two writers of one row, and still the redirect flow outside our sessions.
- A `platform_admin` flag on `user`: `shifa_auth` writes `user`, so the sign-in path could set it.

## Sources
[A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) criteria 9, 11–13; [slice A-01-03](../slices/A-01-03-mfa-setup-links-and-super-admin-api.md); [ADR-0043](0043-database-roles-auth-and-platform.md); RFC 4226, RFC 6238
