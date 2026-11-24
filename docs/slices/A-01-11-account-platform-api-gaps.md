# A-01-11 Account and platform API gaps: TOTP re-enrolment, pending owner's phone, owner card fields

Status: Built, in review (approved by the owner 2026-11-24 with OD-101 and the error code `owner_account_exists`; second-session critique waived by starting `/build-slice`, as for A-01-09) · Tier: T0 · Branch: `claude/dreamy-goldberg-xe9hg4` (the cloud session's branch; planned `feat/A-01-11-account-platform-api-gaps`)
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) criteria 3, 11, 12, 13, 14 and the screens "My account" and "Clinic detail" (criteria to add or change: Plan 0 of this slice) · Requirements: PLT-01, PLT-10, PLT-19, PLT-47 · Decisions: ADR-0046, OD-93, OD-98, OD-99, OD-100

After the approved drawings of [A-01-10](A-01-10-ui-account-settings-admin-web.md) checkpoint 1 (2026-11-24). Before A-01-10 checkpoint 2. It changes contracts, the auth path and the platform path: T0, with `reviewer` and `security-reviewer`.

## Goal
The API gives the approved A-01-10 drawings everything they use, so the client needs no workarounds. A person moves their own TOTP to a new phone. The super admin sees whom an owner action is for, corrects a pending owner's phone, and sees whether the owner's link has expired. Owner actions that would do nothing answer an error, not a success. Every status the routes answer is declared.

## Owner decisions this slice builds
- **OD-98** (owner, 2026-11-24): a self re-enrolment of TOTP from My account, confirmed by a current code from the old app. The old secret stays until the new one is confirmed. The replay and lock rules of criterion 12 apply. Audited.
- **OD-99** (owner, 2026-11-24): the super admin edits a pending owner's phone. The earlier link is invalidated and a new one is shown once. The edit is refused once the owner has an account. Audited.
- **OD-100** (owner, 2026-11-24): a clinic may still be created in any of the three statuses; nothing to build.

## Rows from the A-01-10 analysis (approved by the owner 2026-11-24)
| A-01-10 row | What the API gains |
|---|---|
| API gap 1: self re-enrolment (OD-98) | A re-enrolment start confirmed by a current code, and its confirm, which answers ten new recovery codes; named error codes |
| API gap 2: owner phone on clinic detail | `ClinicOwner.phoneMasked` (country code and last three digits) |
| API gap 3: pending owner's phone (OD-99) | Owner phone edit for a pending owner, answering a new `SetupLinkIssued`; a named 409 once the owner has an account; 400 on an invalid phone; the `owner_setup_pending` rule of OD-85 holds for the new phone |
| API gap 4: link expiry | `ClinicOwner.linkExpiresAt` (null when no link is open) |
| API gap 5: owner status in the list | `ClinicSummary.ownerStatus` |
| API gap 6: no-op owner actions | `reset-mfa` and `end-sessions` on a pending owner answer 409 `owner_setup_pending` |
| API gap 7: undeclared statuses | 400 on `platformCreateClinic` and `platformUpdateClinic`; 400 and 403 on `clinicUpdateSettings`; the new routes' statuses |

## Owner decision on this plan
- **OD-101** (owner, 2026-11-24): a self re-enrolment of TOTP does not end the person's other sessions. The person proved the old factor and the password; this session is not rotated (the second factor is unchanged in kind). A change of password (OD-92) and the resets by the owner or the super admin keep ending sessions.

## What the code showed (2026-11-24, planning)
- `two_factor` holds one secret per person, and `enrolStart` overwrites it: keeping the old secret until the new one is confirmed (OD-98) needs a second, sealed column. **One expand-only migration**, so this slice changes the schema.
- `lastUsedStep` is a time step shared by every secret: a code from the old app at step N would make the new app's code at step N look like a replay at confirm. The new secret gets its own replay state until it is confirmed.
- `shifa_platform` writes `membership` only inside `clinic.created`; `setup_link` inserts and replacements only for `clinic.created` and `owner.link_issued`. The phone edit (OD-99) needs a column grant and policies for a new action `owner.phone_changed`.
- `setup_link_invited_phone_fk` (tenant, membership, invited phone) has no `ON UPDATE` action: changing a pending owner's phone fails when an earlier invitation link names the old phone. The constraint becomes `ON UPDATE CASCADE` (only replaced links follow the new phone; RI actions run as the table owner, checked by a test).
- `shifa_platform` already reads `membership.phone_e164` and `setup_link.expires_at` (never a token hash): `phoneMasked`, `linkExpiresAt` and `ownerStatus` need no grant.
- `ownerAction('reset-mfa' | 'end-sessions')` skips the work when `owner.userId` is null and answers 204: gap 6.
- `owner_setup_pending`'s message names "a clinic not set up"; reused for gap 6 as approved, its message reworded to cover both uses ("The clinic’s owner has not set up their account yet").

## Plan
### Checkpoint 1 — spec and contracts
0. **Spec** (owner-approved with this plan; written first, on the branch). A-01a:
   - criterion 11 adds the self re-enrolment (OD-98): an enrolled person starts it with a current code from the old app (replay and lock rules of criterion 12), scans a new key, confirms with a code from the new app; the old secret works until then; ten new recovery codes, the old set gone; other sessions kept (OD-101); audited;
   - criterion 3 adds the owner's status in the clinics list; criterion 13 adds the owner card (masked phone, status, the open link's expiry), the phone edit of a pending owner (OD-99: earlier link replaced, new link shown once, refused once the owner has an account, `owner_setup_pending` for a phone that owns another clinic not set up, audited), and 409 for MFA reset and end sessions on an owner without an account;
   - criterion 14 adds `auth.mfa_reenrolled` and `owner.phone_changed`; the verification table gets rows for both.
1. **Contracts** (`packages/contracts`):
   - a. `authMfaReenrolStart` `POST /auth/mfa/re-enrol/start` `{ code }` (old app) → 200 `TotpEnrolStart` (a new key; replaces an earlier unconfirmed re-enrolment); 400 `invalid_code`; 409 `mfa_not_enrolled`; 429 `mfa_locked`. After MFA.
   - b. `authMfaReenrolConfirm` `POST /auth/mfa/re-enrol/confirm` `{ code }` (new app) → 200 `RecoveryCodes` (ten, shown once); 400 `invalid_code`, `clock_skew`; 409 `mfa_not_enrolled`, `mfa_not_started` (no re-enrolment started); 429 `mfa_locked`. Wrong codes on either route count toward the one MFA lock.
   - c. `ClinicOwner` gains `phoneMasked` (as `SetupLinkView`: country code and last three digits) and `linkExpiresAt` (the owner's latest unused, unreplaced link, past or future, so the page can say it expired; null when there is none).
   - d. `ClinicSummary.ownerStatus: MembershipStatus | null` (null: no owner row).
   - e. `platformOwnerPhone` `PATCH /platform/clinics/:id/owner` `{ phone }` (as typed, normalised by the server) → 200 `SetupLinkIssued` (purpose `owner_setup`, or `invitation` when the new phone has an account); 400 `validation_failed` on `body.phone`; 404; 409 `owner_account_exists` (new: the owner has an account), `owner_setup_pending` (the new phone owns another clinic not set up, OD-85).
   - f. `platformOwnerResetMfa`, `platformOwnerEndSessions` declare 409 `owner_setup_pending` (owner without an account).
   - g. Declared statuses: 400 on `platformCreateClinic`, `platformUpdateClinic`; 400 and 403 on `clinicUpdateSettings`; the new routes as above.
   - New error code `owner_account_exists` with its message; `api-client-ts`, `api-client-dart`, OpenAPI and the i18n key list regenerated.
2. **Database** (`/db-migration`, `/rls-policy`), one expand-only migration:
   - `two_factor.pending_secret` (sealed, nullable) and `two_factor.pending_last_used_step` (nullable); `shifa_auth` keeps its table grant; `shifa_app`'s column grant on `two_factor` does not gain them (privileges test).
   - `GRANT UPDATE (phone_e164, updated_at) ON membership TO shifa_platform`; a permissive and a restrictive `FOR UPDATE` policy: the clinic's owner membership only, `user_id IS NULL`, status `pending`, `app.admin_reason = 'owner.phone_changed'`; `WITH CHECK` keeps `user_id IS NULL` and `pending`.
   - `setup_link_platform_issue_only` and `setup_link_platform_replace_only` also allow `owner.phone_changed` (dropped and created again, reasons updated in `classification.ts`).
   - `setup_link_invited_phone_fk` recreated `ON UPDATE CASCADE`.
   - Rollback: the columns are unused by older code; the policies and the FK revert in a later migration if ever needed.

### Checkpoint 2 — self re-enrolment of TOTP
3. `MfaService.reenrolStart`: row `FOR UPDATE`; not verified → 409 `mfa_not_enrolled`; lock → 429; the old-app code through `#useTotp` (replay rule, failures through `#failure()`); a new sealed secret into `pending_secret`, `pending_last_used_step` cleared. `reenrolConfirm`: no `pending_secret` → 409 `mfa_not_started`; the code against the pending secret (±1 step, skew hint, its own replay state); on success in one transaction `secret` ← pending, `lastUsedStep` ← the step, new recovery-code hashes, failures cleared, `enrolledAt` ← now, pending columns cleared, `auth.mfa_reenrolled` written; other sessions kept (OD-101). The challenge keeps using the old secret while a re-enrolment is pending; a reset by the owner or the super admin deletes the row, pending included. The leak test covers both bodies (codes, keys).

### Checkpoint 3 — owner card, list and no-op actions
4. `clinicDetail()` reads the owner's phone (masked with the shared `maskPhone`, moved where both modules use it) and the latest open link's `expiresAt`; `list()` returns `ownerStatus`; `ownerAction` answers 409 `owner_setup_pending` for `reset-mfa` and `end-sessions` when the owner has no account (no audit row of a done action: the platform transaction rolls back).

### Checkpoint 4 — pending owner's phone
5. `ClinicsService.changeOwnerPhone` (through `/add-endpoint`, `@PlatformAdmin`): phone normalised (400 on `body.phone`); in one `withPlatformAdmin({ event: 'owner.phone_changed', data: { clinicId, linkPurpose } })`: the owner row (404); `userId` set → 409 `owner_account_exists`; another pending owner membership with the new phone → 409 `owner_setup_pending`; the phone updated; `issueOwnerLink` replaces every earlier link and issues the new one (`invitation` when the phone has an account). The phone never enters the audit row, logs or errors.

### Checkpoint 5 — matrix, isolation, review
6. Route matrix rows (`POST /auth/mfa/re-enrol/start`, `…/confirm`: signed in after MFA; `PATCH /platform/clinics/:id/owner`: super admin); isolation: one person's re-enrolment never touches another's row; `shifa_platform` cannot change a phone of an active owner, of a non-owner membership or outside `owner.phone_changed` (db test); OpenAPI and clients regenerated. `reviewer` and `security-reviewer`.
7. **Web, Flutter:** none (A-01-10 checkpoints 2 and 3 use the routes).

## Tests written first (mapped to criteria)
- Contracts: schemas and examples of the two re-enrolment routes, `ClinicOwner.phoneMasked` and `linkExpiresAt`, `ClinicSummary.ownerStatus`, `platformOwnerPhone`; every status listed in 1e–1g declared.
- Database: the new columns are not readable by `shifa_app`; `shifa_platform` updates the phone of a pending owner only in `owner.phone_changed`, never an active owner's, a member's, `user_id` or `status`; the FK cascade on a replaced invitation link; the policy-count and classification checks.
- A-01a 11, OD-98: start refused without enrolment (409), with a wrong code (counted; the fifth locks, 429 with `until`), with a replayed code; start twice replaces the pending key; while pending the old secret still passes the challenge and the new one does not; confirm without a start (409 `mfa_not_started`), with a wrong code (counted), with a code 2–10 steps off (`clock_skew`); a confirm in the same time step as the start's code is accepted; after confirm the old secret refused, the new one accepted once, the old recovery codes refused, the new ones accepted once, `enrolledAt` moved; the owner's reset during a pending re-enrolment removes both; audit row; other sessions still valid (OD-101).
- A-01a 3, 13: `ownerStatus` for pending, active and no owner; `phoneMasked` on the detail (the full phone never in the body); `linkExpiresAt` for a fresh link, an expired one (past date), none after the link is used, a re-issued link's new date; reset MFA and end sessions on a pending owner → 409 `owner_setup_pending` and no `owner.*` audit row.
- A-01a 13, OD-99: phone edit → new link works, the earlier link answers `link_invalid`, `phoneMasked` shows the new phone, audit row without the phone; to a phone with an account → `invitation`, accepted by that person; invalid phone → 400 on `body.phone`; owner with an account → 409 `owner_account_exists`; a phone owning another pending clinic → 409 `owner_setup_pending`; unknown clinic → 404; a clinic user → 403.
- `clinicUpdateSettings`: 400 for an invalid value and 403 for a non-owner, both now declared.
- Leak test rows (codes, keys, phones through the new bodies and the phone edit).

## Estimate
Hand-written lines: ~3,300 (spec and docs ~200; contracts and error code ~250; migration, policies, classification and db tests ~650; re-enrolment service and tests ~1,000; owner card, list and no-op 409s ~400; phone edit ~550; matrix, isolation, leak ~250; generated clients and OpenAPI not counted). One PR within ADR-0032's budget; the checkpoints above are its stopping points.

Critique: T0, a second session critiques this plan before building, unless the owner waives it as for A-01-01 to A-01-05 and A-01-09. Model and effort: Opus 5.5 at `high` (T0).

## Stopped at
Built (spec → contracts → db → API); reviewed; PR open. Web: A-01-10 checkpoints 2 and 3 use the routes.

## Build notes
- **Migrations** (expand only): `20261124162309_a01_reenrol_and_owner_phone` (generated: `two_factor.pending_secret`, `two_factor.pending_last_used_step`, `setup_link_invited_phone_fk` re-created `ON UPDATE CASCADE`, validated under a short lock of two small tables) and `20261124162320_a01_owner_phone_policies` (custom: `GRANT UPDATE (phone_e164, updated_at) ON membership TO shifa_platform`, `membership_platform_phone_change` and the restrictive `membership_platform_phone_only`, the two `setup_link_platform_*` restrictive policies re-created with `owner.phone_changed`). The plan's one migration became two folders because the policies are hand-written SQL. Rollback: drop the columns (unused by older code), the two policies and the grant; re-create the FK without `ON UPDATE` and the setup_link policies as in `20261123205528`.
- **DB helpers:** `changeOwnerPhone()` and `ownerLinkExpiry()` in `packages/db/src/clinic.ts` (setup_link rows are read under the clinic's tenant context, `expires_at` only).
- `maskPhone` moved to `@shifa/contracts` (`phone.ts`), used by the setup page and the owner card.
- `two_factor.pending_last_used_step` is always null today (the one accepted code moves its step to `last_used_step` as the secret is swapped); kept as the plan's own replay state of the new secret (reviewer finding 2).
- The route matrix gained `ctx.ownedClinicId()` (reset MFA and end sessions now need an owner with an account) and the TOTP state `reenrolling`.
- **Security review M1 (fixed):** an owner can invite a co-owner (owner role, pending until accepted), so a set-up clinic can hold a pending owner membership. The phone policies now also require that no other owner role exists in the clinic, `changeOwnerPhone` answers 409 `owner_account_exists` when the clinic has more than one owner membership, and the list, card and support actions name one owner per clinic (the one with an account first, then the lowest id; the list no longer repeats a clinic per owner). Tests: `packages/db/test/owner-phone-coowner.test.ts`, `apps/api/test/platform/owner-coowner.test.ts`. L1 (a pending re-enrolment never expires) is in `docs/backlog.md` for the owner; L2 (the FK cascade also rewrites dead invitation links' phone) is accepted and documented in the migration.
- **Locked tests:** the owner allowed two timing-only fixes in `owner-card.test.ts` (2026-11-24): a 73 h clock jump outlived the super admin's 12 h session (the admin signs in again after it) and a 1 h jump its 15 min idle limit (now 60 s); no assertion changed. The formatter reordered one import in `packages/contracts/test/account-platform.test.ts` (Biome's import order; no assertion changed).

## Evidence
- Red phase: the five locked test files failed for the expected reasons first (missing routes, columns, event, schemas): 24 API cases, 7 DB cases, 8 contract cases.
- `pnpm verify:full` (2026-11-24, cloud session, Docker in the session, after the review fixes): all 15 steps PASS, `all green`, `typecheck+lint+test` 86/86 tasks (format, instructions, lint-root, scripts-test, file-length, pub-get, drift with `api-client-dart`, typecheck+lint+test 281 s, build, boot, ui-browser, ui-storybook, ui-storybook-build, ui-screenshots, e2e). One earlier run failed once in `web-shell`'s idle countdown (`00:54` for `00:55` under load; untouched by this slice, green alone and in the next full run).
- Isolation and policies: `@shifa/db` 48 files green, with `owner-phone-policies.test.ts`, `owner-phone-coowner.test.ts`, the privileges pins and the RLS presence test (two new roleAccess reasons); API: `reenrol-isolation.test.ts`; route matrix with the three new rows (`POST /auth/mfa/re-enrol/start`, `…/confirm`: signed in; `PATCH /platform/clinics/:id/owner`: super admin).
- Leak test (`mfa-link-leak.test.ts`) extended with the re-enrolment and the phone edit: no phone, key, code or token in logs, spans, error events or audit rows.
- Reviewer findings fixed: staff reset during a pending re-enrolment tested (1), `pending_last_used_step` documented (2); deferred to backlog: the phone-edit/link-use deadlock (3), the OD-85 check-then-write race (4).
- Security review: M1 (a pending co-owner could be retargeted by the phone edit) fixed in the policies and the service, with tests; L1 (a pending re-enrolment never expires) to `docs/backlog.md` for the owner; L2 (the FK cascade rewrites dead invitation links' phone) accepted and documented.
