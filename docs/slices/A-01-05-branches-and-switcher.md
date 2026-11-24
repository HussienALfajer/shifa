# A-01-05 Branches and the clinic switcher

Status: Planned · Tier: T0 · Branch: `feat/A-01-05-branches-and-switcher`
Spec: [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) criteria 4 (archived branch), 9–11, 12 (branch and switch events), 13 (HEAD before GET) · Requirements: PLT-03, PLT-04, PLT-05, PLT-47 · Decisions: OD-76, OD-89, OD-90

After [A-01-04](A-01-04-members-roles-toggles-scope.md) (merged). Last backend slice of A-01. Re-planned on 2026-11-23 against the merged A-01-01 to A-01-04 code: it now carries the backlog blocker "Membership binding on INSERT" (A-01-01 security review L4, A-01-04 security review L2), so it has a migration, and it extends `apps/api/test/architecture/table-access.test.ts` with branch ownership and a write rule.

## Goal
The owner manages branches; a person in several clinics chooses one after sign-in and switches clinic and branch from the header, checked on the server; a suspended clinic cannot be chosen and its signed-in members are stopped. No clinic can appear in a person's chooser unless that person accepted it: `shifa_app` cannot insert a membership already bound to an account.

## Plan

### Checkpoint 1: membership binding on INSERT (database, first)
1. **Migration** (`/db-migration`, `/rls-policy`; expand only, nothing merged is edited):
   - Restrictive policy `membership_insert_unbound` `FOR INSERT` `TO PUBLIC` `WITH CHECK (user_id IS NULL AND status = 'pending')`. PUBLIC, not only `shifa_app`: no role writes a bound membership by INSERT (team adds pending rows, `createClinic()` adds the pending owner as `shifa_platform`, `shifa_auth` binds by UPDATE only), so the stricter form breaks nothing. Closes "delete a pending one and re-insert it bound" too.
   - CHECK `membership_bound_unless_pending` (`status = 'pending' OR user_id IS NOT NULL`), added `NOT VALID` then `VALIDATE`: `shifa_app` holds `UPDATE (status)`, and an unbound row set to `active` must be impossible.
   - Restrictive policy for `shifa_app` `FOR UPDATE` `WITH CHECK (status <> 'pending' OR user_id IS NULL)`: a bound member cannot be put back to `pending` (the accept policies match pending rows).
2. **Fixtures:** `insertMembership()` in `packages/db/test-harness/fixtures.ts` writes a bound member as the owner/superuser connection (no tenant path), pending ones stay on `shifa_app`; the bound fixtures in `apps/api/test/identity/support.ts` and `packages/db/test/*` move to it. Isolation case `membership.ts` gains a refused bound INSERT.
3. **Chooser status:** the `shifa_auth` own-read policies ignore status by design (they also serve sign-in); `/me/clinics` filters `status = 'active'` in code, pinned by a test with a deactivated membership.

### Checkpoint 2: branches
1. **Contracts** — `Branch`, `CreateBranchRequest`, `UpdateBranchRequest` (name, address, phone), `ArchiveBranchPreview` (members whose sessions end), `BranchList` (active and archived); codes `last_branch`, `branch_archived`.
2. **API** — new module `modules/branches` (`branches.manage`, `@CurrentScope()`, `TenantDb`): list, create, edit, archive preview, archive. Archive is refused for the last active branch (409 `last_branch`, row lock on the tenant's active branches); members left with no active branch in their roles lose their sessions in this tenant (through the identity port, as deactivation does in A-01-04). Audit `branch.created`, `branch.renamed`, `branch.archived`. Team's role picker refuses an archived branch (`branch_archived`).
3. **Table access** (`table-access.test.ts`): `OWNED.branches = ['branch', 'auditEvent']`; team's and identity's `branch` exceptions stay read-only with updated reasons. New rule: a table a module reaches through `EXCEPTIONS` may only be read; writes (`.insert(x)`, `.update(x)`, `.delete(x)`) on it fail unless listed in a new `WRITES` map with a reason (identity → `membership`: binds on accept, `last_active_at`; platform → `tenant`: clinic edit). Red cases: team writing `branch`, a module writing an unlisted exception table.

### Checkpoint 3: switcher and suspended clinic
1. **Contracts** — `MyClinics` (active clinics last used first, with role, last sign-in, status and `selectable`; per clinic the branches the person holds a role in, all active ones for a tenant-wide role; `solo` when the clinic has one active branch), `SwitchRequest` (tenant, optional branch); codes `clinic_suspended`, `no_clinic`, `branch_not_held`.
2. **API** (identity module, since it owns `session`; no new table reach beyond its listed reads):
   - `GET /me/clinics` through `withUser(userId)` (`shifa_auth` own-read policies, `role_assignment_auth_own_read`); `no_clinic` when nothing is active.
   - `POST /me/switch`: refused for a clinic without an active membership and role, a suspended clinic, an archived branch, or a branch the person holds no role in, even when called directly; sets `session.active_tenant_id`/`active_branch_id`, keeps the token, audits `clinic.switched`. Sign-in with exactly one selectable clinic sets it (existing issuer); several leave it empty for the chooser.
   - Suspended clinic: `#tenantView` reads `tenant.status`; the principal carries the suspension and the guard answers 403 `clinic_suspended` to every tenant route on the next request; `/me/*` and sign-out still work; data stays.
3. **Pending invitations in the chooser (OD-90, closed: the recommended option):** the spec's chooser lists pending invitations with accept and decline, but invitations are link-based today (token in `/invitations/view|accept|decline`) and `shifa_auth` sees memberships by `user_id` only. Recommended: a read policy for pending, unbound memberships whose `phone_e164` is the signed-in account's phone (clinic name and roles only), and accept/decline by membership id with the same phone and super-admin checks as the link path, closing the clinic's open link (~+450 lines, all T0). Alternative: invitations open only from the link; the chooser shows none (spec change). The owner chose the recommendation (2026-11-23); `MyClinics` gains `invitations`, and the routes are `POST /me/invitations/:id/accept|decline`.
4. **`routeList()`** keeps an explicit HEAD declared before GET (backlog L8), with its matrix row; confirm the remaining parts of criterion 13 are in place.
5. **Web, Flutter** — none (screens in A-01-08).
6. **End-to-end** — API journey: doctor in two clinics signs in → `/me/clinics` lists both, last used first → switch clinic → switch branch → refused switch to an unheld branch → clinic suspended → 403 → `/me/clinics` shows it not selectable.

Tests written first:
- Binding (backlog L4/L2): `shifa_app` INSERT with a `user_id`, or with status `active`/`deactivated`, is refused; delete + re-insert bound is refused; pending → active on an unbound row fails the CHECK; bound → pending is refused; `shifa_platform` cannot insert a bound owner; a deactivated membership never shows in `/me/clinics`.
- Table access: `branches` owns `branch`; a write by `team` to `branch` and to an unlisted exception table fails; the `WRITES` entries exist and are used.
- Criterion 9: archive rules, last active branch refused; archived branch absent from switcher data and refused by the role picker; `solo` for one active branch (PLT-03).
- Criterion 10: chooser order and branch list for branch and tenant-wide roles; one clinic → session scoped at sign-in.
- Criteria 10, 11: switch refused for an unheld branch, an archived branch, an inactive membership, a suspended clinic, another person's clinic.
- Criterion 11: suspended → 403 `clinic_suspended` on the next request, data kept; `no_clinic`.
- Criterion 4: archive ends the sessions of affected members only.
- Criterion 12: one audit row per branch event and per switch.
- Criterion 13: HEAD-before-GET matrix row; route matrix and isolation suite rows for every new route and the new policies.

Estimated hand-written lines: ~3,750 with OD-90 (binding migration, fixtures and tests ~450; table-access ~150; branches ~650; switcher and suspension ~800; contracts ~250; other tests ~1,000; OD-90 ~450). Under the 4,000 budget; three checkpoints above.

Plan approved by the owner (2026-11-23) with OD-90's recommendation; the owner waived the second-session critique of this T0 plan.

## Stopped at
Checkpoint 1 done (membership binding on INSERT): migrations `20261123235315_a01_membership_active_is_bound` and `20261123235324_a01_membership_binding_policies`, fixtures, isolation case; `pnpm verify` green.
Checkpoint 2 done (branches): `modules/branches` (5 routes, `branches.manage`), contracts, `last_branch`/`branch_archived`, team's role picker refuses archived branches, table-access write rule; `pnpm verify` green.
Checkpoint 3 built (switcher, suspended clinic, invitations in the chooser, HEAD before GET): every test passes; `verify:full` fails only on lint in the locked `apps/api/test/identity/switcher.test.ts` (two `expect.any(String)` lines typed `any`); the two-line fix (`expect.any(String) as unknown`, same assertion) awaits the owner, since a locked test may not be edited. PR not opened yet.

## Deviations from the plan
- **CHECK `membership_active_is_bound`** (`status <> 'active' OR user_id IS NOT NULL`) instead of the planned `membership_bound_unless_pending` (`status = 'pending' OR user_id IS NOT NULL`): the planned form also refuses an unbound `deactivated` row, which A-01-04 writes when the owner deactivates a pending invitation (`POST /team/members/:id/deactivate`, reactivated back to `pending`). The stated intent, "an unbound row set to `active` must be impossible", holds; with the shifa_app UPDATE policy a bound row never returns to `pending`, and an unbound one only moves between `pending` and `deactivated`.
- The shifa_app UPDATE policy is named `membership_app_never_unbind` and has `USING (true)`, so it restricts only the new row.
- **`WRITES` entries:** the plan listed "platform → `tenant`: clinic edit", but platform owns `tenant`; the exception-table writes that exist are identity → `membership` (binding, `last_active_at`), identity → `setupLink` (marking a link used) and team → `tenant` (the idle setting). The test also fails when a `WRITES` entry is unused.
- **Branch routes:** `GET /branches` (active and archived lists), `POST /branches`, `PATCH /branches/:id`, `GET /branches/:id/archive-preview` (`lastBranch`, members whose sessions end), `POST /branches/:id/archive`. Archiving an archived branch or editing one answers 409 `branch_archived`; the team's role picker answers the same for an archived branch (an unknown one stays 400). Edits of the address or phone are audited as `branch.renamed` too (data: which fields changed).
- **Dart client budget** raised to 185 files and 6,900 lines (`scripts/drift.config.mjs`; output now 122 files, 4,568 lines) for the branch and switcher schemas.
- **Invitations in the chooser (OD-90), database:** a `membership` policy reading `setup_link` plus a `setup_link` policy reading `membership` would make PostgreSQL stop with "infinite recursion in policy". So an invitation link carries its member's phone (`setup_link.invited_phone`, migration `20261124001605_a01_invited_phone`; a composite foreign key to `membership (tenant_id, id, phone_e164)` makes it the member's own phone; CHECK: invitations only). Migration `20261124001611_a01_invitations_in_chooser` adds `current_user_phone()` (shifa_auth only), `membership_auth_invited_read`, `membership_auth_invited_accept` (bind while the link is open, to the signed-in person, never a super admin), `setup_link_auth_invited_read`, `setup_link_auth_invited_use` (only `used_at`), and recreates `membership_auth_only_own`, `membership_auth_accept_only` and `setup_link_auth_only_link` with the by-phone path added (link paths unchanged). The clinic name and roles of an invitation are read in its clinic (`linkScope`, as the link page does), not through new `tenant`/`role_assignment` policies, so fewer auth-path policies exist than the plan's sketch. The team, `createClinic()` and `issueOwnerLink()` fill `invited_phone` on invitation links.
- **Switch answers:** a clinic that is not the person's (or has no active membership with a role) 404; suspended 403 `clinic_suspended`; an archived branch 409 `branch_archived`; a branch without a role 403 `branch_not_held`. Without a branch the session takes the only branch the person holds there, else none. Response `ActiveClinic { tenantId, branchId }`; the token is kept. `GET /me/clinics` answers 404 `no_clinic` only when the person has neither a clinic nor an invitation.
- **Selectable clinic:** not suspended, and a tenant-wide role or a role in an active branch. Sign-in enters the clinic only when exactly one is selectable (a membership without roles no longer counts as a second clinic: `test/identity/adapter.test.ts` gives the second membership a role). Roles in archived branches no longer reach the principal (criterion 4).
- **HEAD before GET:** `routeList()` now drops a HEAD only when a GET has the same URL and handler. Contracts have no HEAD method, so no production or probe route can declare one today; the rule is covered by unit tests in `test/access/test-support.test.ts`.
- `sessions.service.ts` was at 397 lines: the per-request tenant view moved to `identity/tenant-view.ts`, and sign-in's clinic choice to `identity/clinic-choices.ts`.

## Evidence
- `pnpm verify` after checkpoints 1 and 2: `all green` (format, instructions, lint-root, scripts-test, file-length, pub-get, drift, typecheck+lint+test).
- `pnpm verify:full` after checkpoint 3 (cloud session, Docker available): 13 of 14 steps pass (format, instructions, lint-root, scripts-test, file-length, pub-get, drift, build, boot, ui-browser, ui-storybook, ui-storybook-build, ui-screenshots); `typecheck+lint+test` fails only on `@shifa/api:lint` in the locked `test/identity/switcher.test.ts` (lines 104, 106: `@typescript-eslint/no-unsafe-assignment` on `expect.any(String)`).
- Tests: `@shifa/db` 46 files, 337 tests (isolation suite direct and pooled, with the new refused inserts); `apps/api` 73 files, 486 tests, all pass.
- Reviewer and security-reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- Bound memberships in tests are written as the owner/superuser after checkpoint 1; any new fixture that needs an active member uses `insertMembership()` with a `userId`.
