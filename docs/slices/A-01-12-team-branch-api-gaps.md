# A-01-12 Team and branch API gaps: toggles on add, member corrections, invitation for another number, branch restore

Status: Done (#160) (approved by the owner 2026-11-24 with the three proposals; second-session critique waived by starting `/build-slice`, as for A-01-09 and A-01-11) · Tier: T0 · Branch: `claude/serene-gates-0m7f1l` (cloud session)
Spec: [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) criteria 2, 3, 4, 7, 9, 12 and the screens "Accept invitation", "Team", "Member drawer" and "Branches" (criteria to add or change: Plan 0 of this slice) · Requirements: PLT-03, PLT-04, PLT-05, PLT-43, PLT-45, PLT-47 · Decisions: ADR-0046, OD-76, OD-78, OD-86, OD-91, OD-99, OD-102, OD-103, OD-104, OD-105, OD-106

After the approved drawings of [A-01-08](A-01-08-ui-team-branches-switcher.md) checkpoint 1 (2026-11-24). Before A-01-08 checkpoint 2. It changes contracts, the team and branch modules, the invitation path on the auth pool and possibly the schema (a member's phone edit, branch restore): T0, with `reviewer` and `security-reviewer`.

## Goal
The API gives the approved A-01-08 drawings everything they use, so the client needs no workarounds. The owner sets a new member's sensitive toggles before the link is sent, corrects a typed name or a pending member's phone, sees when a pending link has expired and which row is themselves, and restores an archived branch. A person who opens an invitation while signed in with another number is told so. Actions on oneself that would lock the owner out are refused. Every status the routes answer is named and declared.

## Owner decisions this slice builds
- **OD-102** (owner, 2026-11-24): a catalogue route with the sensitive keys and each role's default, and `permissions` on add, as on edit.
- **OD-103** (owner, 2026-11-24): the owner edits any member's name, and the phone while the member is pending. The earlier link is invalidated and a new one is shown once. The edit is refused once the member has accepted; `phone_in_team` holds. Audited.
- **OD-104** (owner, 2026-11-24): `InvitationView.phoneMasked`, and a named error `invitation_other_phone` for a signed-in person with another number; every other invalid link keeps the one 404 `link_invalid`.
- **OD-105** (owner, 2026-11-24): the owner restores an archived branch. It returns to switchers and role pickers, and roles that pointed at it stand again. Audited.
- **OD-106** (owner, 2026-11-24): the owner role keeps not granting `clinical.notes.view`; nothing to build.

## Rows from the A-01-08 analysis (approved by the owner 2026-11-24)
| A-01-08 row | What the API gains |
|---|---|
| API gap 1: toggles on add (OD-102) | A route listing the sensitive keys with each role's default; `permissions` on `AddMemberRequest` (400 `permission_not_sensitive` as on edit) |
| API gap 2: bare 409s | Named codes for deactivating a deactivated member, reactivating one who is not, a link for a deactivated member (proposal `member_deactivated`, `member_not_deactivated`) |
| API gap 3: undeclared statuses | 400 on `teamAddMember`, `teamUpdateMember`, `branchesCreate`, `branchesUpdate`; `branch_archived` named on `teamAddMember`; the new routes' statuses |
| API gap 4: pending link expiry | `linkExpiresAt` on `MemberSummary` (null when no link is open) |
| API gap 5: name and pending phone (OD-103) | Name edit for any member; phone edit for a pending member answering a new `MemberLinkIssued`; a named 409 once accepted; 400 on an invalid phone; 409 `phone_in_team` |
| API gap 6: invitation for another number (OD-104) | `InvitationView.phoneMasked`; `invitation_other_phone` on accept and decline for a signed-in person with another phone |
| API gap 7: "you" in the team | `isSelf` on `MemberSummary`; deactivate, new link and TOTP reset on oneself refused (proposal `self_action`) |
| API gap 8: branch restore (OD-105) | A restore route; 409 when the branch is not archived; audit event `branch.restored` |

## What the code showed (2026-11-24, planning)
- `shifa_app` holds `UPDATE (display_name, status, last_active_at, updated_at)` on `membership` (migration `20261123223448`), not `phone_e164`: the name edit needs no grant; **the pending phone edit needs one expand-only migration** (column grant and a database guard).
- An RLS policy cannot compare the old and new row, and a restrictive `FOR UPDATE` policy limited to pending rows would also block the name edit of an active member. The guard is a `BEFORE UPDATE OF phone_e164` trigger: a changed phone is refused unless the old row is `user_id IS NULL` and `pending` (every role; A-01-11's `shifa_platform` owner-phone edit already meets it).
- `setup_link_invited_phone_fk` is `ON UPDATE CASCADE` since A-01-11: a pending member's earlier invitation links follow the new phone (they are replaced in the same transaction).
- `membership_tenant_id_phone_e164_key` is unique: `phone_in_team` stays the add's check under the same advisory lock, and a race still answers 409, never 500.
- Archiving a branch sets `archived_at` and never deletes `role_assignment` rows: restore clears `archived_at`, and the roles that pointed at it stand again with no data move. `shifa_app` already updates `branch`; **restore needs no migration**. Sessions ended by the archive stay ended.
- `deactivate`, `reactivate` and `newLink` throw a bare `ConflictException` (code `conflict`): gap 2.
- `InvitationsService.#bind` answers `link_invalid` when the signed-in person's phone is not the invited one, before the link's use is checked: gap 6 needs the order "link valid (unused, unreplaced, unexpired) → then the phone", so the new code never says anything about a dead link.
- `memberDetail` already computes each sensitive key's role default per member; the catalogue route reuses `PermissionCatalogue.sensitiveKeys()` and `PRODUCTION_GRANTS` per role.
- `team.service.ts` is 422 lines: the new corrections (name, phone) go to a new `member-corrections.ts` and the shared helpers (`audit`, `replaceLinks`, `validRoles`, `writeRoles`, `lockOwners`) to `team.writes.ts`, so no file passes the 400-line lint.

## Plan
### Checkpoint 1 — spec and contracts
0. **Spec** (owner-approved with this plan; written first, on the branch). A-01b:
   - criterion 2: the owner sets a new member's sensitive toggles when adding them, from each role's default (OD-102); the team list shows the open link's expiry, and «أنت» on the owner's own row;
   - criterion 3: the owner corrects any member's name, and a pending member's phone (OD-103: earlier link replaced, a new one shown once, refused once accepted, `phone_in_team` holds); deactivate, new link and TOTP reset on oneself are refused (`self_action`); deactivate twice, reactivate an active member and a link for a deactivated member answer named 409s;
   - criterion 2 (invitation): the page shows the invited phone masked; a person signed in with another number is told so (`invitation_other_phone`, OD-104); any other invalid link keeps `link_invalid`;
   - criterion 9: the owner restores an archived branch (OD-105); it returns to switchers and role pickers and its roles stand again;
   - criterion 12 adds `member.renamed`, `member.phone_changed`, `branch.restored`; the verification table gets rows for each.
1. **Contracts** (`packages/contracts`):
   - a. `teamPermissions` `GET /team/permissions` → 200 `PermissionDefaults { keys: [{ key, roles: SessionRole[] }] }`: every sensitive key with the roles that grant it by default (`members.view`).
   - b. `AddMemberRequest.permissions?: { key, granted: boolean }[]` (max 50); 400 `permission_not_sensitive` and `validation_failed` on `body.permissions.N.key`, as on edit. Only a switch that differs from the default of the given roles is stored as an override, so a later role change still moves the untouched keys.
   - c. `MemberSummary.linkExpiresAt` (the member's latest unused, unreplaced link, past or future; null when none) and `MemberSummary.isSelf` (the row of the signed-in person). `MemberDetail` inherits both.
   - d. `UpdateMemberRequest.name?` (any member; audited `member.renamed`, the name never in the row).
   - e. `teamMemberPhone` `PATCH /team/members/:id/phone` `{ phone }` (as typed) → 200 `MemberLinkIssued`; 400 `validation_failed` on `body.phone`; 404; 409 `member_account_exists` (new: the member has accepted), `member_deactivated`, `phone_in_team`.
   - f. New error codes `member_deactivated`, `member_not_deactivated`, `member_account_exists`, `self_action`, `invitation_other_phone`, `branch_not_archived`, with messages; i18n keys.
   - g. `InvitationView.phoneMasked` (country code and last three digits, shared `maskPhone`); `invitationAccept`, `invitationDecline` declare 403 `invitation_other_phone`.
   - h. `branchesRestore` `POST /branches/:id/restore` → 200 `Branch`; 404; 409 `branch_not_archived`.
   - i. Declared statuses: 400 on `teamAddMember`, `teamUpdateMember`, `branchesCreate`, `branchesUpdate`; 409 `branch_archived` named on `teamAddMember` and `teamUpdateMember`; 409 `self_action`, `member_deactivated`, `member_not_deactivated` on deactivate, reactivate, link and TOTP reset as they apply.
   - `api-client-ts`, `api-client-dart`, OpenAPI and the i18n key list regenerated.
2. **Database** (`/db-migration`), one expand-only migration, hand-written SQL:
   - `GRANT UPDATE (phone_e164) ON membership TO shifa_app`;
   - function and trigger `membership_phone_unbound_only` (`BEFORE UPDATE OF phone_e164`, `WHEN (OLD.phone_e164 IS DISTINCT FROM NEW.phone_e164)`): raises unless `OLD.user_id IS NULL AND OLD.status = 'pending'`;
   - privileges pins and `classification.ts` updated; rollback: drop the trigger and function, revoke the column.

### Checkpoint 2 — catalogue, toggles on add, `isSelf`, link expiry, named 409s
3. `TeamController.permissions` (through `/add-endpoint`) answering from the injected catalogue and `PRODUCTION_GRANTS`. `add` validates `permissions` before the transaction and writes the overrides with the member, each audited `member.permissions_changed` as on edit. `listMembers` and `memberDetail` gain `isSelf` (`userId === scope.userId`) and `linkExpiresAt` (one query for the list, no N+1). `deactivate`, `reactivate`, `newLink`, `resetMfa`: `self_action` first (before `last_owner` and `owner_mfa_platform`), then `member_deactivated` / `member_not_deactivated` in place of the bare 409s.

### Checkpoint 3 — name and pending phone (OD-103)
4. `member-corrections.ts`: name in `update` (trimmed, `member.renamed`). Phone: normalised (400); in one transaction under the member-phone advisory lock: the row `FOR UPDATE` (404); `userId` set → 409 `member_account_exists`; deactivated → 409 `member_deactivated`; the new phone taken in this clinic → 409 `phone_in_team`; the phone updated; every earlier link replaced; a new link issued (`invitation` when the new phone has an account, else `member_setup`, as on add; the owner sees no difference, OD-76); audited `member.phone_changed` with `{ linkPurpose }` only, never a phone. The same phone again: 200 with a new link (the owner meant to resend).

### Checkpoint 4 — invitation for another number (OD-104), branch restore (OD-105)
5. `InvitationsService`: `view` adds `phoneMasked`; `#bind` checks the link (unused, unreplaced, unexpired; a super admin keeps `link_invalid`) before the phone, then answers 403 `invitation_other_phone`; nothing is written and the link stays usable for the invited person. The answer goes only to a signed-in person holding the link's token.
6. `BranchesService.restore`: the row `FOR UPDATE` (404); not archived → 409 `branch_not_archived`; `archived_at` cleared; audited `branch.restored`; answers the branch with its member count. The switcher and the role pickers already read `archived_at`.

### Checkpoint 5 — matrix, isolation, leak, review
7. Route matrix rows (`GET /team/permissions`: `members.view`; `PATCH /team/members/:id/phone`: `members.manage`; `POST /branches/:id/restore`: `branches.manage`); isolation: clinic A's owner cannot edit a phone, rename or restore in clinic B (404); db test: the trigger refuses a phone change of an active or bound row for `shifa_app` and `shifa_platform`, allows a pending one, and leaves the name edit of an active member working; the leak test covers the phone edit and the invitation's other-phone answer (no phone, token or code in logs, spans, error events or audit rows). `reviewer` and `security-reviewer`.
8. **Web, Flutter:** none (A-01-08 checkpoint 2 uses the routes).

## Tests written first (mapped to criteria)
- Contracts: `teamPermissions`, `PermissionDefaults`, `AddMemberRequest.permissions`, `MemberSummary.linkExpiresAt` and `isSelf`, `UpdateMemberRequest.name`, `teamMemberPhone`, `InvitationView.phoneMasked`, `branchesRestore`; every status of 1e–1i declared; the six new error codes have messages.
- Database: the trigger as in step 7; the column-grant pin; the FK cascade moves a replaced invitation link with the phone.
- A-01b 2, 7, OD-102: the catalogue lists `clinical.notes.view` with `doctor` and `assistant`; add with a switch off for a doctor → detail shows `granted: false, overridden: true`; a switch equal to the default stores nothing (`overridden: false`); a non-sensitive key → 400 `permission_not_sensitive`; an unknown key → 400 on `body.permissions.0.key`; the add fails whole (no member, no link) when a switch is refused.
- A-01b 2: `linkExpiresAt` for a fresh link, an expired one (past date), null after acceptance, a new date after a new link; `isSelf` true only on the caller's row, in list and detail.
- A-01b 3, OD-103: rename any member (active, pending, deactivated) → audit row without the name; phone edit of a pending member → new link works, the earlier link answers `link_invalid`, the list shows the new phone, audit row without a phone; to a phone with an account → that person accepts; accepted member → 409 `member_account_exists`; deactivated → 409 `member_deactivated`; a phone already in the team → 409 `phone_in_team`; invalid → 400 on `body.phone`; unknown id → 404; a receptionist → 403.
- A-01b 3, gap 7: deactivate, new link, TOTP reset on oneself → 409 `self_action` and no audit row; the last-owner rule unchanged for another owner. Gap 2: deactivate twice → `member_deactivated`, reactivate an active one → `member_not_deactivated`, a link for a deactivated one → `member_deactivated`.
- A-01b 2, OD-104: view shows `phoneMasked`; accept and decline by another signed-in number → 403 `invitation_other_phone`, nothing bound, then the invited person accepts the same link; a used, replaced or expired link by another number → 404 `link_invalid`; a super admin → 404 `link_invalid`.
- A-01b 9, OD-105: restore → the branch is in `active`, in the switcher and the role picker, a member whose only role was there switches into it again; restore of an active branch → 409 `branch_not_archived`; another clinic's branch → 404; audit row `branch.restored`.
- 400 now declared on add, update, branch create and branch update (an invalid phone and an empty name each).

## Estimate
Hand-written lines: ~3,000 (spec and docs ~200; contracts and error codes ~300; migration, trigger and db tests ~300; catalogue, toggles on add, `isSelf`, link expiry, named 409s with tests ~900; name and phone with tests ~600; invitation and restore with tests ~450; matrix, isolation, leak ~250; generated clients and OpenAPI not counted). One PR within ADR-0032's budget; the checkpoints above are its stopping points.

Critique: T0, a second session critiques this plan before building, unless the owner waives it as for A-01-09 and A-01-11. Model and effort: Opus 5.5 at `high` (T0).

## Proposals in this plan (approved by the owner 2026-11-24)
- **Status of `invitation_other_phone`:** 403 (the link is valid, the person is not the one it was sent to), not 404, so the client tells it apart without reading the code.
- **Toggles on add:** only the switches that differ from the role default are stored, so a later role change still moves the untouched ones.
- **Phone edit to the same phone:** answers a new link, as a resend; the earlier one stops.

## Stopped at
Checkpoints 1–5 built and committed; `pnpm verify` green; `reviewer` and `security-reviewer` run, real findings fixed (below); PR opened. Next: A-01-08 checkpoint 2.

## As built
- **Routes:** `GET /team/permissions` (`members.view`, `TeamPermissionsController`), `PATCH /team/members/:id/phone` (`members.manage`), `POST /branches/:id/restore` (`branches.manage`); matrix rows owner-only for all three. `ctx.branchId('archived')` added to the matrix sample context.
- **Files:** `team.writes.ts` (shared helpers moved out of `team.service.ts`), `member-corrections.ts` (`rename()` used by `update`, `MemberCorrections.changePhone`), `members.read.ts` (`isSelf`, `linkExpiresAt` in one grouped query per list), `invitations.service.ts` (admin → link open → phone order), `branches.service.ts` (`restore`).
- **Order of checks:** deactivate `self_action` → `member_deactivated` → `last_owner`; new link `self_action` → `member_deactivated` → `account_shared`; TOTP reset `self_action` → `owner_mfa_platform` → `mfa_not_enrolled`.
- **Migration** `20261124211632_a01_member_phone_guard` (expand only, hand-written): `GRANT UPDATE (phone_e164) ON membership TO shifa_app`; function and trigger `membership_phone_unbound_only` (`BEFORE UPDATE OF phone_e164 … WHEN (OLD.phone_e164 IS DISTINCT FROM NEW.phone_e164)`, raises 42501 unless the old row is unbound and pending). Rollback: `DROP TRIGGER membership_phone_unbound_only ON membership; DROP FUNCTION public.membership_phone_unbound_only(); REVOKE UPDATE (phone_e164) ON membership FROM shifa_app;`. `classification.ts` needed no change (no new policy or table); the privileges pins gained the column.
- **Audit events:** `member.renamed`, `member.phone_changed` (`{ linkPurpose }`), `branch.restored` in `TENANT_EVENTS`.
- **Changed existing tests (spec change, not weakened):** `lifecycle` (self-deactivation → `self_action`; stepping down is now a role change, then 403), `reset-mfa` (own → `self_action`, another owner's → `owner_mfa_platform`), `review` (`member_deactivated`), `invitations` (other number → 403 `invitation_other_phone`; the view's `phoneMasked`), `openapi` (route list).
- **Locked tests, owner-approved fixes (2026-11-24):** `member-phone-guard.test.ts` case 5 runs as the superuser (FORCE RLS hid the row from the owner, so the trigger never fired); `team-branch-gaps.test.ts` three lint-only lines (unused destructured names), assertions unchanged.

## Evidence
- Red phase: the six locked files failed for the expected reasons (30 API cases, 8 database cases, 15 contract cases); the already-passing cases were the dead-link answers that hold before and after.
- `pnpm --filter @shifa/db test`: 49 files, 360 tests pass (Docker in the session).
- `apps/api` vitest: 89 files, 595 tests pass, then the leak test `team-corrections-leak.test.ts`.
- `pnpm verify` (fast, affected): format, instructions, lint-root, scripts-test, file-length, pub-get, drift, typecheck+lint+test, e2e: **all green**. A first run failed `web-shell` `idle-dialog` once on a timing assertion (`00:55`) under load; it passed alone and in the next full run (untouched by this slice).
- Dart client size: 149 files, 5,604 lines (budget 185 / 6,900).
- Reviewer findings fixed: reviewer 1 and security L1 (lock order: a phone edit locks the member's open links before the membership, and deactivation replaces links before the status, so every path takes link then membership; the security reviewer reproduced both 40P01 cycles in PostgreSQL 18 and the fix); reviewer 3 (`linkExpiresAt` for pending members only); security L3 (the leak test asserts every path it covers). Deferred to backlog: security M1 (phone edit as an account probe, extends OD-88; owner decision), reviewer 2 / security L2 (`linkPurpose` in the clinic audit row; owner decision), security I1 (dead invitation rows follow a corrected phone), I2 (no restore preview or count). No critical or high findings.
