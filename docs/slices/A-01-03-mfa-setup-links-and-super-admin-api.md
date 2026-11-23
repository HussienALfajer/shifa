# A-01-03 MFA, setup links and the super-admin API

Status: Planned · Tier: T0 · Branch: `feat/A-01-03-mfa-setup-links-super-admin-api`
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) criteria 2–5, 11–14; edge case "same owner phone in two clinics" (issues the invitation; acceptance in A-01-04) · Requirements: PLT-01, PLT-19, PLT-47, PLT-48 · Decisions: OD-76, OD-77, OD-82

After [A-01-02](A-01-02-better-auth-sign-in-and-sessions.md) (merged).

## Goal
The super admin creates a clinic and its owner and gets the owner's one-time setup link; the owner sets a password and enrols TOTP before anything else; TOTP and recovery codes protect owners and super admins; the super admin can reset an owner's password, MFA and sessions, all audited.

## Plan
1. **Contracts** — `CreateClinicRequest`, `ClinicSummary`, `ClinicDetail`, `UpdateClinicRequest`, `SetupLinkIssued` (URL shown once), `SetupLinkView` (clinic name, person's name and role, expiry; one `link_invalid` code for used, expired or replaced), `SetPasswordRequest`, `TotpEnrolStart` (otpauth URI + manual key), `TotpEnrolConfirm`, `RecoveryCodes`, `TotpChallenge`; codes `mfa_enrolment_required`, `mfa_locked` (`until`), `invalid_code`.
2. **Database** — no schema change expected (tables from A-01-01); if the gate in A-01-02 changed the two-factor table, a new migration here.
3. **API**
   - Access: a fourth annotation `@PlatformAdmin()` (exactly one of `@Public`, `@SignedIn` (A-01-02), `@RequirePermission`, `@PlatformAdmin`; `AccessCheck`, the guard, OpenAPI and the matrix learn it); the principal carries `mfa: 'none' | 'pending' | 'verified'`; the guard refuses every route but those marked `@BeforeMfa()` with 403 `mfa_enrolment_required` for owners and platform admins until enrolled, and until the challenge is passed in a session.
   - `modules/identity/setup-links`: issue (256-bit token, sha-256 stored, 72 h, re-issue replaces the earlier link), view and consume through `withSetupLink(tokenHashHex)` (`shifa_auth` reads that one link and may only set `used_at` on an unused link; issuing and re-issuing, which sets `replaced_at`, run in `withTenant()`; setting `membership.user_id` on consumption needs a privilege this slice adds, see A-01-01 notes); consuming an owner link sets the password (rules from A-01-02), signs in and leaves the session at `mfa: 'none'`; `wa.me` share URL carries only the link text.
   - `modules/identity/mfa`: enrol start and confirm (±1 step, never the same code twice: last accepted step stored), 10 single-use recovery codes shown once, challenge with code or recovery code, 5 wrong codes → 15 min lock; clock-skew hint code when a code matches outside ±1 but within ±10 steps (enrolment only). Session rotated after MFA.
   - `modules/platform/clinics` (`@PlatformAdmin`, `withPlatformAdmin({ actorId, event, requestId }, …)` on `createPlatformDb()`; the owner membership, role assignment and setup link need `shifa_platform` INSERT grants and the existing-phone check needs a way to look up `user`, both added by this slice's migration with `roleAccess` reasons, see A-01-01 notes): list (search by name), create (tenant + organization + main branch + route via `createClinic`, owner membership pending + `owner_role` assignment + owner setup link, one transaction; an existing phone gets an invitation link instead of a second account), detail (no clinic data), update status and end date, owner reset: new setup link (password reset), reset MFA, end all sessions; each ends the owner's sessions and writes one audit row.
   - Seed command `pnpm --filter @shifa/api seed:super-admin` (phone from an argument, prints a setup link once; refuses in `NODE_ENV=production` without an explicit flag); no route creates super admins.
4. **Web, Flutter** — none (screens in A-01-07).
5. **End-to-end** — API journey test: seed super admin → enrol → create clinic → owner link → password → TOTP → principal with owner role.

Tests written first: link single use, 72 h expiry with fake clock, re-issue invalidates, stored hashed, ≥ 128 bits, one message for used/expired/replaced with no clinic name (4); one-transaction creation with owner (2, 3); status and end date edits audited, end date with no effect (3); owner forced to TOTP before any other route (5, 11); ±1 step, replay refused, 5 wrong → lock, recovery code single use (12); each owner reset ends sessions and is audited; super admin sees no tenant rows (13); platform rows invisible to `shifa_app` (14); leak test over link and MFA flows (no token, secret, code or phone).
Estimated hand-written lines: ~3,700 (access ~300, links ~550, MFA ~650, platform clinics ~650, seed ~150, contracts ~300, tests ~1,100).

## Stopped at
Not started.

## Evidence
- `verify` (full): —
- Reviewer and security-reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
—
