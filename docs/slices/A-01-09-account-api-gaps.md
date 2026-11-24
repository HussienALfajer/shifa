# A-01-09 Account API gaps: profile, password change, recovery codes

Status: Planned (rows added 2026-11-24, re-plan due) · Tier: T0 · Branch: `feat/A-01-09-account-api-gaps`
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) screens "My account" and "TOTP challenge", criteria 8, 10–12, 14 (criteria added by this slice, see Plan 0) · Requirements: PLT-10, PLT-19, PLT-47, PLT-48 · Decisions: ADR-0042, ADR-0044, ADR-0045

After [A-01-05](A-01-05-branches-and-switcher.md) (merged) and the approved drawings of [A-01-07](A-01-07-ui-sign-in-screens.md) checkpoint 1, whose analysis may add rows here. Before A-01-07 checkpoint 2 and [A-01-10](A-01-10-ui-account-settings-admin-web.md). Changes contracts: serialised with every other contract change.

## Goal
The API gives the clinic-web screens what the A-01a inventory needs and the A-01-07 re-plan found missing: who is signed in, how to change one's own password, how many recovery codes are left and a way to make new ones.

## Rows added by the A-01-07 analysis (approved by the owner 2026-11-24)
From [A-01-07 Drawings and analysis](A-01-07-ui-sign-in-screens.md#api-gaps-confirmed-and-extended-closed-in-a-01-09-never-worked-around-in-the-client): declare the undeclared statuses (`authMfaEnrolConfirm`, `authMfaChallenge` 400; `meSwitch` 403; 401 on authenticated routes); `MyClinic.tenantWide` and 400 `branch_required`; `reason` on 401 `session_expired`; a staff TOTP reset by the owner (or the owner's decision against it); named MFA 409 codes; the recovery-code challenge answering the codes left; `SetupLinkView.phoneMasked` (improvement h, accepted). Staff TOTP reset: the owner resets a member's TOTP (OD-95). `/slice-plan` folds these into the plan below and re-estimates the lines.

## Plan
0. **Spec** (owner-approved with this plan): A-01a gets criteria for 10a own profile, 10b change of password, 12a recovery codes left and renewal; the verification table gets their rows; the screen inventory names the counts.
1. **Contracts** (`packages/contracts`):
   - `meProfile` `GET /me` → `MyProfile { userId, name, phoneE164 }` (@SignedIn, before MFA: the challenge screen greets by name). The phone goes to its owner only and stays out of logs, spans and errors.
   - `authChangePassword` `POST /auth/password` `{ currentPassword, newPassword }` → 204; 400 password rules (as setup links); 401 `invalid_credentials` for a wrong current password, counted in the phone lock (criterion 7) and answering 429 `phone_locked` when locked. Ends the person's other sessions and rotates this one (proposed, OD-92).
   - `authMfaStatus` `GET /auth/mfa` → `{ enrolled, enrolledAt, recoveryCodesLeft }`.
   - `authMfaRecoveryCodes` `POST /auth/mfa/recovery-codes` `{ code }` (a current TOTP code) → `{ recoveryCodes }` (ten, shown once; the old set gone); 400 `invalid_code`, 429 `mfa_locked`.
   - `authSetupLinkConsume` declares its 400 (the password-rule codes).
   - New error code only if a state needs one (the existing codes cover these routes).
2. **Database:** no table change expected (`two_factor` holds the codes, `account` the hash); if a column is needed, `/db-migration` and `/rls-policy` and this tier stays T0 with high effort.
3. **API:** `MeController.profile`; `IdentityController.changePassword` through `checkPasswordRules()` and Better Auth's hash (scrypt), the sign-in lock counters and a timing floor; `MfaService.status` and `MfaService.renewRecoveryCodes` (TOTP window and replay rules of criterion 12). Audit events `auth.password_changed`, `auth.recovery_codes_renewed`; the leak test extended to the new bodies (passwords, codes, phones).
4. **Route matrix, OpenAPI, isolation:** every new route through `/add-endpoint` (access annotation, matrix row with a sample body, contract); a second person's session never reads or changes the first's profile, codes or password.
5. **Web, Flutter:** none (A-01-07 and A-01-10 use the routes).

Tests written first: contract tests for the four schemas; API integration tests (Testcontainers): profile of self only; change of password with each rule, wrong current password counted toward the lock, other sessions ended (→ 401 next request), this session rotated; MFA status before and after a recovery-code sign-in; renewal refused without a valid code and with a replayed one, old codes refused after renewal; audit rows for each; leak test rows; route matrix and isolation rows.
Estimated hand-written lines: ~1,800.

Critique: a second session critiques this plan before building (T0), unless the owner waives it as for A-01-01 to A-01-05.

## Stopped at
Not started.

## Evidence
- `verify` (full): —
- Isolation suite: —
- Reviewer findings fixed: —; deferred to backlog: —
