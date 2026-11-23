# A-01-04 Members, invitations, roles, toggles and scope binding

Status: Planned · Tier: T0 · Branch: `feat/A-01-04-members-roles-toggles-scope`
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
Not started.

## Evidence
- `verify` (full): —
- Reviewer and security-reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
—
