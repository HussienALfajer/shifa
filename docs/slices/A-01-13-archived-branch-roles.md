# A-01-13 Roles held in an archived branch

Status: Built (in the A-01-08 checkpoint 4 branch, its own commit) · Tier: T0 · Branch: `feat/A-01-08-checkpoint-4`
Spec: [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) criteria 3, 9 · Requirements: PLT-04, PLT-05 · Decisions: OD-105, OD-107

Found by the A-01-08 checkpoint 3 review (B2). Built first in the A-01-08 checkpoint 4 session (owner, 2026-11-25).

## Goal
Archiving a branch keeps the role assignments that point at it, so a restore gives them back (OD-105). The owner's edit of such a member's roles sends the full list back, so `PATCH /team/members/:id` must keep an archived-branch assignment the member already holds and refuse only a new one (OD-107).

## Plan
- `validRoles()` (`apps/api/src/modules/team/team.writes.ts`) takes the member's held assignments: an archived branch passes only for a (role, branch) pair already held; any other pair in an archived branch answers 409 `branch_archived`. Another clinic's branch stays unknown (400) through RLS.
- `TeamService.update()` reads the held assignments after `lockOwners()` (every role edit of the clinic is serialised), then validates.
- The branch read in `validRoles()` takes `FOR SHARE`, so an archive running at the same time (it locks the branch `FOR UPDATE`) waits for the write and never lands between the check and the new assignment.
- Adding a member has nothing held: an archived branch is always refused there.
- No schema, contract shape or route change (the contract's comment names the rule). Clinic web: the member drawer drops its «أزل علامة ذلك الفرع» note; a held archived role is still named «… · مؤرشف» and removable.

## Tests (written first, locked)
`apps/api/test/team/archived-roles.test.ts` (11): kept when sent back with a new role, with a rename, for a member whose only role is there, and standing again after a restore; dropped when left out and not brought back by a restore; refused for another role in the same archived branch, a role another member holds there, a held role dropped in an earlier save, and on add; another clinic's archived branch 400; one `member.roles_changed` row without a phone. Red first: the five "kept" cases failed with 409 `branch_archived`.

Web: `packages/web-shell/test/team-review.test.tsx` B2 cases changed with the owner's decision (OD-107): the save sends the held archived role back with the new one; a 409 `branch_archived` is the plain «أُغلق أحد الفروع المختارة».

## Stopped at
Built and verified; `security-reviewer` run (see Evidence). Ships in the A-01-08 checkpoint 4 PR.

## Evidence
- `pnpm exec vitest run test/team test/branches` (apps/api): 15 files, 105 tests passed.
- `pnpm exec vitest run test/team-review.test.tsx test/member-drawer.test.tsx` (web-shell): 24 passed.
