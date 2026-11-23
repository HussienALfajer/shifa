# A-01-05 Branches and the clinic switcher

Status: Planned · Tier: T0 · Branch: `feat/A-01-05-branches-and-switcher`
Spec: [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) criteria 4 (archived branch), 9–11, 12 (branch and switch events), 13 (HEAD before GET) · Requirements: PLT-03, PLT-04, PLT-05, PLT-47 · Decisions: OD-76

After [A-01-04](A-01-04-members-roles-toggles-scope.md) (merged). Last backend slice of A-01.

## Goal
The owner manages branches; a person in several clinics chooses one after sign-in and switches clinic and branch from the header, checked on the server; a suspended clinic cannot be chosen and its signed-in members are stopped.

## Plan
1. **Contracts** — `Branch`, `CreateBranchRequest`, `UpdateBranchRequest`, `ArchiveBranchPreview` (members whose sessions end), `MyClinics` (clinics last used first with role, last sign-in, status, selectable flag; pending invitations; branches the person holds a role in; `solo` flag hiding branch screens), `SwitchRequest`; codes `clinic_suspended`, `no_clinic`, `last_branch`.
2. **Database** — no schema change expected (`membership.last_active_at` and `session.active_*` exist).
3. **API**
   - `modules/branches` (`branches.manage`): list (active and archived), create, rename and edit, archive preview, archive (refused for the last active branch; members left without an active branch in their roles lose their sessions in this tenant).
   - `modules/switcher`: `GET /me/clinics` through `withUser(userId)` (`createAuthDb()`) (own memberships across tenants, `shifa_auth` self-read policy); `POST /me/switch` (tenant and optional branch; refused for a clinic without an active membership, a suspended clinic, or a branch the person holds no role in, even when called directly); updates the session scope, rotates nothing else, audits the switch.
   - Guard: a suspended active tenant → 403 `clinic_suspended` on the next request; a person with no active clinic gets `no_clinic` from `/me/clinics`.
   - `routeList()` keeps an explicit HEAD declared before GET (backlog L8).
4. **Web, Flutter** — none (screens in A-01-08).
5. **End-to-end** — API journey: doctor in two clinics signs in → `/me/clinics` lists both, last used first → switch clinic → switch branch → refused switch to an unheld branch.

Tests written first: archive rules and last active branch (9); archived branch absent from switcher and role picker data (9); `solo` flag for one active branch (9, PLT-03); chooser order and branch list for branch and tenant-wide roles (10); switch refused for unheld branch, inactive membership, suspended clinic (10, 11); suspended → 403 next request, data kept (11); archive ends sessions of affected members (4); one audit row per branch event and switch (12); HEAD-before-GET matrix row (13).
Estimated hand-written lines: ~2,600 (branches ~600, switcher ~600, guard ~150, contracts ~250, tests ~1,000).

## Stopped at
Not started.

## Evidence
- `verify` (full): —
- Reviewer and security-reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
—
