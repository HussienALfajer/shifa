# A-01-04 Members, invitations, roles, toggles and scope binding

Status: Built, in review · Tier: T0 · Branch: `feat/A-01-04-members-roles-toggles-scope` (built on the cloud session branch `claude/trusting-lovelace-ywznf7`, [cloud sessions](../process/cloud-sessions.md) §4)
Spec: [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) criteria 2–8, 12 (team events); [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) criterion 9 (the owner's idle setting) · Requirements: PLT-05, PLT-06, PLT-42, PLT-43, PLT-45, PLT-46, PLT-47 · Decisions: OD-76, OD-78

After [A-01-03](A-01-03-mfa-setup-links-and-super-admin-api.md) (merged).

## Goal
The owner builds the team: adds members with roles per clinic or branch, toggles sensitive permissions per member, deactivates and re-links members; a person with an account accepts a second clinic's invitation. Every request is bound to the scope the guard checked, so later specs only add keys and routes.

## Plan
1. **Contracts** — `MemberSummary` (name, phone, role assignments with scope, status active / pending / deactivated, last activity), `MemberDetail` (+ toggles with the role default), `AddMemberRequest`, `UpdateMemberRequest`, `InvitationView`, `ClinicSettings` (`idleMinutes`); codes `last_owner` (with the reason), `phone_in_team`.
2. **Database** — no schema change expected.
3. **API**
   - Permissions: `PERMISSION_CATALOGUE` injected at start-up (key, sensitive flag); A-01 keys `members.view`, `members.manage`, `branches.manage`, `clinic.settings.manage` (owner) and sensitive `clinical.notes.view` (doctor, assistant on; receptionist, accountant off); `PRODUCTION_GRANTS` filled; `AccessCheck` and grants refuse unknown keys; effective grants = role grants ± the member's overrides, overrides allowed for sensitive keys only; read per request.
   - Scope binding (backlog M1): the guard stores `{ principal, scope }` on the request; `@CurrentScope()`; `withTenant()` takes its tenant only from a scope object; link-bound routes (invitation accept) build their scope from the verified link, the one documented exception; module table-access rule added to `module-imports.test.ts`.
   - `modules/team`: list, detail, add (membership pending + assignments + member setup link or invitation link; the owner's view is identical either way), edit roles and toggles, deactivate and reactivate, re-issue link (ends the member's sessions); last-owner refusal for remove, demote and deactivate; deactivation or last role removed → the member's sessions in this tenant end at the next request.
   - Invitations: `GET /invitations/:token` (clinic, role, scope), accept (signed in as the invited phone; new phones go through the setup link), decline; pending clinics absent from the person's clinics until accepted.
   - `PATCH /clinic/settings` (`clinic.settings.manage`): idle 15 / 30 / 60.
   - Audit: member added, invitation accepted and declined, role and toggle changes, deactivation and reactivation, link re-issued, idle setting changed; no phones.
4. **Web, Flutter** — none (screens in A-01-08 and A-01-07 for the idle setting).
5. **End-to-end** — API journey: owner adds a receptionist for a branch → link → password → signed in with the branch role; a doctor of clinic A accepts clinic B's invitation.

Tests written first: identical owner view for new and existing phones (2); re-issue and deactivation end sessions → 401/403 next request (3, 4); last-owner refusal for all three actions (5); route matrix with every role and with `clinical.notes.view` on and off (6, 7); unknown key refused at start-up and in grants (7); override refused for a non-sensitive key (7); scope-binding test (handler tenant ≠ checked scope fails) and module table-access test (8); one audit row per event without phones (12); idle setting owner-only and applied on the next request (A-01a 9).
Estimated hand-written lines: ~3,900 (permissions ~400, scope binding ~350, team ~1,000, invitations ~450, settings ~100, contracts ~350, tests ~1,250).

## Stopped at
All layers built and green; reviews next.

## As built (differences from the plan)
- **Owner decisions this session:** OD-86 (a member link resets only a one-clinic account; a shared one answers 409 `account_shared` and its sessions in the clinic end) and OD-87 (column grant for the idle setting).
- **Permissions:** `PRODUCTION_PERMISSIONS` (`src/access/permissions.ts`) with a sensitive flag; `PermissionCatalogue` injected as `PERMISSION_CATALOGUE`; `AccessCheck` refuses at start-up a `@RequirePermission` key or a grant outside it. The owner holds the four management keys but not `clinical.notes.view` (the spec lists it for doctor and assistant only); an owner who also treats patients adds a doctor role or switches the key on. `isGranted()` = role grants, then the member's override of a sensitive key where they hold a role in the scope; an override of any other key counts for nothing. The principal carries `overrides` (read per request) and `ownsClinic`.
- **Scope binding:** `src/access/scope.ts` (`bindScope` by the guard, `@CurrentScope()`, `linkScope()` for link-bound routes, frozen and registered objects) and `TenantDb.run(scope, fn)` / `withScope()`; `@CurrentScope()` on a route without `@RequirePermission` stops the start (contract check). The module table-access rule is its own file, `test/architecture/table-access.test.ts`, next to `module-imports.test.ts`: each module's tables and its reads of others' with a reason.
- **Routes:** `GET|POST /team/members`, `GET|PATCH /team/members/:id`, `POST /team/members/:id/{deactivate,reactivate,setup-link}`, `GET|PATCH /clinic/settings`, `POST /invitations/{view,accept,decline}`. Invitations take the token in the body (as setup links since A-01-03), not `GET /invitations/:token`. A member's link carries no purpose (`MemberLinkIssued`), so the owner cannot tell a new phone from an account (criterion 2). `last_owner` has no reason field: `MemberDetail.isLastOwner` gives the screen its disabled state and reason. Unknown override keys answer 400 `validation_failed`; known non-sensitive ones 400 `permission_not_sensitive`.
- **Sessions:** deactivation, removing the last role and a new link end the member's sessions in the clinic at once (auth path, `auth.session_ended` reason `member`), so the next request is 401; a member left without a role gets no clinic in the principal either. Invitation decline marks the link used; the member stays pending for the owner.
- **Database** (`/db-migration`): `20261123223448_a01_team_invitations_and_settings` (custom, **expand** plus one narrowing): `shifa_app` loses table UPDATE on `membership` and keeps `display_name, status, last_active_at, updated_at`; `membership_auth_link_accept` and `membership_auth_accept_only` admit an invitation link, binding only to `current_user_id()` with the invited phone (new `withUserLink()` in `@shifa/db`); `tenant_app_settings` and the column grant of OD-87; `role_assignment_auth_own_read` / `_only_own` (the MFA gate before a clinic is chosen). Rollback before real data: restore table UPDATE on `membership` to `shifa_app`, recreate the two accept policies with `('owner_setup', 'member_setup')`, drop the three new policies and the two column grants; after real data, roll forward only. The isolation runner learns `updatable` for tables `shifa_app` updates by column only (membership).
- **Backlog closed:** scope binding (0.2-06c M1), MFA gate for an owner without an active clinic (A-01-03 review 2), `shifa_app` UPDATE of `membership.user_id` (A-01-01 L4, UPDATE part; INSERT part stays in the backlog for A-01-05).

## Locked tests
One locked-test edit, approved by the owner on 2026-11-23: lint and format auto-fixes in `catalogue.test.ts` (import order, braces on two arrow functions, an unused type import), `scope-binding.test.ts` (two unneeded type assertions), `table-access.test.ts` (`endsWith`) and `team-policies.test.ts` (import order); no assertion changed.

## Evidence
- Red phase: 10 test files written first and locked; they failed for the right reasons (missing modules and routes: 34 API tests 404, 6 database tests on the missing wrapper, grants and policies).
- `@shifa/db` (Testcontainers, this cloud session): 43 files, 305 tests pass (new `team-policies`; `privileges`, `privileges-columns`, the membership isolation case, `identity-policies` and `owner-links-security` updated for the new grants).
- `@shifa/api`: 69 files pass (new: team members, lifecycle, invitations, settings, audit, journey; catalogue, scope binding, table access; route matrix with 15 new rows).
- `pnpm verify`: —
- Reviewer and security-reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- **A-01-05:** the chooser can read a person's own roles across clinics on the auth path (`role_assignment_auth_own_read`); branches routes extend `test/architecture/table-access.test.ts` (team reads `branch` today); refuse a bound membership INSERT by `shifa_app` (backlog).
- **A-01-07/08:** screens use `MemberDetail.isLastOwner`, `permissions[].roleDefault`, and the codes `last_owner`, `phone_in_team`, `account_shared`, `permission_not_sensitive` (Arabic texts in `@shifa/i18n`).
