# A-01-12 Team and branch API gaps: toggles on add, member corrections, invitation for another number, branch restore

Status: To plan (`/slice-plan` in plan mode, fresh session) · Tier: T0 · Branch: named by the planning session
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

## Plan
Written by `/slice-plan`: routes, contracts, migrations if any, audit events, isolation and route-matrix rows, tests first, checkpoints, estimate.

## Stopped at
Not started.

## Evidence
- `verify` (full): —
- Reviewer findings fixed: —; deferred to backlog: —
