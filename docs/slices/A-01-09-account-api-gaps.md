# A-01-09 Account API gaps: profile, password change, recovery codes, staff TOTP reset, contract fixes

Status: Planned (re-planned 2026-11-24 with the A-01-07 rows, OD-92, OD-93, OD-95) · Tier: T0 · Branch: `feat/A-01-09-account-api-gaps`
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) criteria 8–12, 14 and the screens "My account", "TOTP challenge", "Setup link"; [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) criteria 3, 10, 12 (criteria added or changed by this slice, see Plan 0) · Requirements: PLT-10, PLT-19, PLT-47, PLT-48 · Decisions: ADR-0042, ADR-0044, ADR-0045, ADR-0046; OD-86, OD-91, OD-92, OD-93, OD-95

After [A-01-05](A-01-05-branches-and-switcher.md) (merged) and the approved drawings of [A-01-07](A-01-07-ui-sign-in-screens.md) checkpoint 1. Before A-01-07 checkpoint 2, [A-01-10](A-01-10-ui-account-settings-admin-web.md) and [A-01-08](A-01-08-ui-team-branches-switcher.md). Changes contracts: serialised with every other contract change. No schema change.

## Goal
The API gives the clinic-web screens everything the approved A-01-07 drawings and the A-01a inventory use, without client workarounds: who is signed in; change of one's own password (ending the other sessions); recovery codes left and a new set; the codes left after a recovery sign-in; the owner's reset of a member's TOTP; whether a clinic role is tenant-wide; why a session ended; named MFA conflicts; the masked phone on the setup page; and every status a route answers declared in its contract.

## Owner decisions this plan builds
- **OD-92** (owner, 2026-11-24): a change of password ends every other session of the person and rotates this one; audited.
- **OD-93** (owner, 2026-11-24): staff who enrolled TOTP voluntarily cannot turn it off themselves in Release 1; the owner resets it (OD-95), or for an owner the super admin (criterion 13). No route is added for it.
- **OD-95** (owner, 2026-11-24): the owner resets a member's TOTP from the team screen: ends the member's sessions, audited, enrol again at the next sign-in; a shared account goes through the super admin (`account_shared`, as OD-86).

## Rows from the A-01-07 analysis (approved by the owner 2026-11-24) and where they land
| A-01-07 row | Plan item |
|---|---|
| Gap 1 name of the signed-in person | 1a `meProfile` |
| Gap 2 codes left and renewal; challenge answers the count | 1c, 1d, 1e |
| Gap 3 change of password | 1b |
| Gap 4 undeclared statuses (`authSetupLinkConsume`, `authMfaEnrolConfirm`, `authMfaChallenge` 400; `meSwitch` 403; 401 on authenticated routes) | 1h |
| Gap 5 `MyClinic.tenantWide`, 400 `branch_required` | 1f |
| Gap 6 `reason` on 401 `session_expired` | 1g |
| Gap 7 staff TOTP reset (OD-95) | 1i |
| Gap 8 named MFA 409 codes | 1j |
| Gap 9 / improvement h `SetupLinkView.phoneMasked` | 1k |
| Gap 10 background request that does not extend the idle limit | not here: backlog (the queue display needs it, not this batch) |

## Plan
### Checkpoint 1 — spec and contracts
0. **Spec** (owner-approved with this plan; written first, on the branch):
   - A-01a: criterion 8 also covers a change of password; new **10a** own profile (name, phone to its owner only); **10b** change of password (current password checked and counted toward the phone lock of criterion 7, the rules of criterion 8, every other session ended and this one rotated, audited; OD-92); criterion 9 adds the reason of an ended session (`idle`, `absolute`, `ended`); criterion 11 adds "no one turns their own TOTP off; the owner resets a member's, the super admin an owner's" (OD-93); new **12a** recovery codes left (after a recovery sign-in and on My account) and a new set confirmed with a current TOTP code (the old set gone, audited); criterion 14 lists the new audit events; the setup-link screen shows the masked phone; the verification table gets rows for 10a, 10b, 12a.
   - A-01b: criterion 3 adds the owner's reset of a member's TOTP (OD-95: not for an owner, a shared account refused with `account_shared` after its sessions here end, audited); criterion 10 adds the branch step: a person with roles in two or more branches and no tenant-wide role picks a branch (400 `branch_required` without one); criterion 12 lists `member.mfa_reset`; the member drawer in the screen inventory shows "TOTP on/off" and «إعادة ضبط التحقق بخطوتين»; the verification table gets the row.
   - OD-92, OD-93 closed in `docs/open-decisions.md` with the owner's answers.
1. **Contracts** (`packages/contracts`):
   - a. `meProfile` `GET /me` → `MyProfile { userId, name, phoneE164 }` (@SignedIn, before MFA: the challenge screen greets by name). The phone goes to its owner only and stays out of logs, spans and errors. 401.
   - b. `authChangePassword` `POST /auth/password` `{ currentPassword, newPassword }` → 200 `SessionView` (this session rotated, cookie set); 400 `password_too_short`, `password_common`, `password_contains_phone`, `password_unchanged` (new: the same password again); 401 `invalid_credentials` (wrong current password, counted in the phone lock); 429 `phone_locked` with `until`. After MFA.
   - c. `authMfaStatus` `GET /auth/mfa` → `MfaStatus { enrolled, enrolledAt, recoveryCodesLeft }` (`enrolledAt`, `recoveryCodesLeft` null when not enrolled).
   - d. `authMfaRecoveryCodes` `POST /auth/mfa/recovery-codes` `{ code }` (a current TOTP code, replay rules of criterion 12) → `RecoveryCodes { recoveryCodes }` (ten, shown once; the old set gone); 400 `invalid_code`; 409 `mfa_not_enrolled`; 429 `mfa_locked`. Wrong codes count toward the MFA lock.
   - e. `authMfaChallenge` 200 becomes `MfaPassed { session: SessionView, recoveryCodesLeft }` (the same shape as `MfaEnrolled`; only tests read it today: web-shell has no challenge page yet).
   - f. `MyClinic.tenantWide: boolean`; `meSwitch` 400 `branch_required` (new) when `branchId` is omitted and the person holds roles in two or more branches and none tenant-wide (`defaultBranch()` no longer lands on "all branches" for them).
   - g. `ErrorBody.reason?: 'idle' | 'absolute' | 'ended'`, only with `session_expired`. `ended`: the cookie's signature is valid but its session is gone (ended on another device, by the owner, by the super admin, or by a password change); no tombstone table, so a session cleaned after its limit also reads `ended` (documented; the tab whose timer fired knows `idle`).
   - h. Declared statuses: `authSetupLinkConsume` 400; `authMfaEnrolConfirm` and `authMfaChallenge` 400; `meSwitch` 400, 403; 401 on every authenticated contract (a `defineContract` default for non-public routes, checked by a contract lint so a new route cannot miss it).
   - i. `teamMemberResetMfa` `POST /team/members/:id/reset-mfa` → 200 `MemberDetail`; 404; 409 `account_shared` (its sessions in this clinic ended first, as OD-86), `mfa_not_enrolled`, `owner_mfa_platform` (new: an owner's TOTP is reset by the super admin; covers the owner's own account). `MemberDetail.mfaEnrolled: boolean` so the drawer shows the action.
   - j. Named MFA 409 codes replace `conflict`: `mfa_already_enrolled` (enrol start, enrol confirm), `mfa_not_started` (confirm with no key), `mfa_not_owed` (challenge when none is owed), `mfa_not_enrolled` (renewal, member reset).
   - k. `SetupLinkView.phoneMasked` (country code and last three digits, e.g. `+963 ••• ••• 123`; from the link's phone; never the full number before the password is set).
   - New error codes: `password_unchanged`, `branch_required`, `owner_mfa_platform`, `mfa_already_enrolled`, `mfa_not_started`, `mfa_not_owed`, `mfa_not_enrolled`, each with its fixed message; `pnpm` generators rerun for `api-client-ts` and the i18n key list.
2. **Database:** no table or migration. `two_factor.backupCodes` holds the hashes (count = codes left), `two_factor.createdAt` gives `enrolledAt`, `account` the hash, `user.twoFactorEnabled` gives `mfaEnrolled`. If building shows a column is needed, stop, `/db-migration` and `/rls-policy`, and tell the owner (the estimate grows).

### Checkpoint 2 — profile and change of password
3. `MeController.profile` (own row through `withUser`). `IdentityController.changePassword`: current password verified with Better Auth's scrypt under a timing floor (the same as sign-in); a failure counted in the phone lock of criterion 7 and audited as `auth.password_change_failed` (a lock reached here writes `auth.locked` as at sign-in); `checkPasswordRules()` on the new one; in one transaction the hash replaced, every other session ended (`auth.session_ended` with the new reason `password_changed`) and `auth.password_changed` written; then this session rotated. The leak test extended to both bodies.

### Checkpoint 3 — recovery codes and MFA codes
4. `MfaService.status`; `MfaService.renewRecoveryCodes` (row `FOR UPDATE`, TOTP window and last-step replay rule, failures through `#failure()` and the lock, new hashes, audit `auth.recovery_codes_renewed`); the challenge answers `recoveryCodesLeft`; the named 409 codes; the leak test extended to the new codes.

### Checkpoint 4 — switcher scope and the session-end reason
5. `clinicChoices()` marks `tenantWide`; `SwitcherService.switch` answers 400 `branch_required` for the case in 1f; first-clinic choice at sign-in follows the same rule (no branch for that person: the chooser's branch step). `SessionExpiredError(reason)` and `ApiError` carry `reason`; the exception filter writes it; `BetterAuthAdapter` answers 401 `session_expired` reason `ended` for a valid signature without a session, 401 `unauthorized` (no reason) for a missing or forged cookie. The e2e smoke test (c) keeps passing; web-shell's mapping of the reason is A-01-07 checkpoint 2.

### Checkpoint 5 — staff TOTP reset
6. `TeamService.resetMfa` (`@RequirePermission('members.manage')`, through `/add-endpoint`): the member read in the tenant; a holder of the owner role → 409 `owner_mfa_platform`; no account or no TOTP → 409 `mfa_not_enrolled`; a shared account → its sessions in this clinic ended, then 409 `account_shared`; else `MemberAccounts.resetMfa` in one transaction checks `sharedIn()` again (race, as security review N4 of A-01-04), deletes `two_factor`, clears `twoFactorEnabled`, ends every session of the person, writes `auth.mfa_reset` (identity) and `member.mfa_reset` (tenant audit). The next sign-in: `mfa: none`, and staff may enrol again from My account.

### Checkpoint 6 — matrix, OpenAPI, isolation, review
7. Every new or changed route through `/add-endpoint` (access annotation, matrix row with a sample body, contract); the OpenAPI document and the generated client regenerated; isolation: a second person's session never reads or changes the first's profile, codes or password; clinic B's owner cannot reset a member of clinic A (404), nor a shared account (409). `reviewer` and `security-reviewer`.
8. **Web, Flutter:** none (A-01-07, A-01-10 and A-01-08 use the routes).

## Tests written first (mapped to criteria)
- Contracts: schemas and examples of `MyProfile`, `MfaStatus`, `RecoveryCodes`, `MfaPassed`, `MyClinic.tenantWide`, `ErrorBody.reason`, `SetupLinkView.phoneMasked`, `MemberDetail.mfaEnrolled`; the lint that every non-public contract declares 401 (1h).
- A-01a 10a: profile of self only; before MFA allowed; phone absent from logs and spans.
- A-01a 10b, OD-92: each password rule and `password_unchanged`; wrong current password → 401 and counted (the fifth locks the phone; 429 with `until`; the lock also blocks sign-in); success → the other sessions answer 401 `session_expired` reason `ended`, this cookie rotated (the old token refused), the old password refused at sign-in, the new one accepted; audit rows; timing floor on both answers.
- A-01a 12a: status before enrolment, after enrolment (10), after a recovery sign-in (9 in the challenge answer and in status); renewal refused with a wrong code (counted, the fifth locks), with a replayed code, without enrolment (409); after renewal the old codes refused and the new ones accepted once; audit row.
- Named 409s: each MFA route answers its new code where it answered `conflict`.
- A-01b 10: `tenantWide` true for a tenant-wide role, false for branch roles only; switch without a branch → 400 `branch_required` for two branches, the branch for one; sign-in for that person lands without a branch.
- A-01a 9: idle → `reason: idle`, absolute → `absolute`, ended on another device, by the owner, by the super admin and by a password change → `ended`; forged or missing cookie → `unauthorized` without reason.
- A-01b 3, OD-95: reset ends the member's sessions, their next sign-in has `mfa: none`, both audit rows; owner target (and self) → `owner_mfa_platform`; pending member and member without TOTP → `mfa_not_enrolled`; shared account → sessions here ended, `account_shared`, TOTP kept; clinic B → 404; a receptionist → 403.
- Setup link: `phoneMasked` for owner, member and admin links; the full phone never in the view body.
- Leak test rows (passwords, codes, phones through the new bodies); route matrix and isolation rows.

## Estimate
Hand-written lines: ~3,050 (contracts and error codes ~350; spec and docs ~150; profile ~120; change of password ~450; MFA status, renewal, challenge count and named codes ~500; switcher scope ~200; session-end reason ~250; staff TOTP reset ~500; matrix, leak, isolation and lint ~350; the setup-link phone ~80; generated client and OpenAPI not counted). One PR, within ADR-0032's budget; the checkpoints above are its stopping points.

Critique: T0, a second session critiques this plan before building, unless the owner waives it as for A-01-01 to A-01-05. Model and effort: Opus 5.5 at `high` (T0).

## Stopped at
Re-planned 2026-11-24; awaiting the owner's approval. Not started.

## Evidence
- `verify` (full): —
- Isolation suite: —
- Reviewer findings fixed: —; deferred to backlog: —
