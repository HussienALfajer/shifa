# Spec A-01b: team, roles, branches and the clinic switcher

Status: Draft (awaiting owner approval) · Date: 2026-11-23 · Risk tier: T0 (permissions, tenancy/RLS, audit) · Owner: product owner
Builds on [A-01a](A-01a-clinic-owner-sign-in.md) (order: OD-75). Decisions: ADR-0004, ADR-0006, ADR-0016; OD-76, OD-78. Screens: inventory below; drawn at the start of the UI batch slice (ADR-0042); the drawings of 2026-11-23 are drafts.

## Goal
The owner builds the clinic's team: branches, members with roles per clinic or branch, and per-member toggles for sensitive actions. A person who works in several clinics signs in once and switches clinic and branch; the API binds every request to the scope it checked, so later specs only add permission keys and routes.

Requirements: PLT-03, PLT-04 (branch entity and switcher; hours, prices, cash boxes come with A-04/A-06), PLT-05 (one login, memberships; fees and schedules later), PLT-06, PLT-42, PLT-43 (key only), PLT-45, PLT-46 (mechanism), PLT-47 (team events).

## User stories
- Owner → adds a receptionist (موظف استقبال) with a role in «فرع الجميلية» → copies the setup link or shares it on WhatsApp.
- Owner → turns off «رؤية الملاحظات السريرية» for one assistant; deactivates a member who left → their sessions end at once.
- Doctor working in two clinics → accepts the second clinic's invitation → picks the clinic in the switcher (مبدّل العيادة), then the branch.

## Acceptance criteria
Members and invitations (OD-76)
1. Tables `membership`, `role_assignment`, `permission_override` with `tenant_id`, FORCE RLS and isolation cases (parent rows through `prepare()`).
2. The owner adds a member (name, phone, one or more role assignments) and gets a setup link as in A-01a criterion 4. A new phone sets a password; a phone with an account signs in and accepts. Until accepted the clinic is absent from that person's switcher; the owner sees «بانتظار القبول» in both cases and cannot tell which.
3. The owner edits roles and toggles, deactivates and reactivates a member, and issues a new link (staff recovery, ends the member's sessions).
4. Deactivating a member, removing their last role, or archiving the only branch of their roles ends their sessions in that tenant at the next request (401/403).
5. A tenant keeps at least one active owner: removing, demoting or deactivating the last owner is refused with a message.

Roles and permissions (OD-78)
6. Roles: owner, doctor, receptionist, assistant, accountant (PLT-42); each assignment is tenant-wide or for one branch (PLT-45). Default grants in `PRODUCTION_GRANTS`; A-01 keys: `members.view`, `members.manage`, `branches.manage`, `clinic.settings.manage` (owner) and the sensitive key `clinical.notes.view` (doctor and assistant on, receptionist and accountant off; PLT-43).
7. Only keys marked sensitive can be switched on or off per member; the result = role grants ± that member's overrides. The catalogue is injected at start-up (`PERMISSION_CATALOGUE`); `AccessCheck` and the grants refuse unknown keys.
8. The guard stores `{ principal, scope }` on the request; handlers read it with `@CurrentScope()`; `withTenant()` takes its tenant only from there; a test fails when a handler's tenant differs from the checked scope. Modules read and write only their own tables (`module-imports.test.ts`).

Branches and switcher
9. The owner creates, renames and archives branches (name, address, phone). An archived branch leaves switchers and role pickers; the last active branch cannot be archived. A solo clinic with one active branch shows no branch screens or branch switcher (PLT-03).
10. After sign-in: one clinic → straight in; several → the clinic chooser, last used first. The header switcher lists the person's clinics, then the branches they hold a role in (all, for a tenant-wide role). Switching is checked on the server, changes the session's scope and reloads the page data.
11. A suspended clinic cannot be chosen («حساب العيادة موقوف، تواصل مع الإدارة»); signed-in members get 403 on the next request; data stays. A person with no active clinic sees «لا توجد عيادة متاحة لحسابك».
12. Audit (A-01a criterion 14) also records member added, invitation accepted, role and toggle changes, deactivation, link re-issued, branch created, renamed and archived, and clinic switches.

Harness debts (backlog)
13. `routeList()` keeps an explicit HEAD before GET; the matrix test asserts `app.get(AUTH_PORT)` is the Better Auth adapter; policy coverage counts only policies for PUBLIC or `shifa_app`.

## Edge cases and offline
- One phone invited by two clinics at once: independent invitations.
- A branch-scoped doctor cannot select another branch, even by calling the switch route directly.
- A member edited while signed in: new grants apply on their next request.
- Offline: membership changes and switching need the server.

## Permissions
| Action | Owner | Doctor | Receptionist | Assistant | Accountant |
|---|---|---|---|---|---|
| Switch among own clinics and branches | ✓ | ✓ | ✓ | ✓ | ✓ |
| View team | ✓ | – | – | – | – |
| Add, edit, deactivate members; toggles; links | ✓ | – | – | – | – |
| Branches | ✓ | – | – | – | – |
Super admins have no access to a clinic's team (support access is A-02).

## Money, abuse and privacy
No money. Abuse: an owner linking any phone to their clinic (acceptance, criterion 2); enumeration of existing accounts (2); owner lock-out (5); privilege creep by a stale session (4, and grants read per request). Member phones show only to the owner. Never in logs, spans or audit: phones, setup tokens, cookies.

## Verification contract
| Criteria | Proof |
|---|---|
| 1 | `packages/db` isolation cases with `prepare()` parent rows |
| 2–5 | `apps/api` integration tests (Testcontainers): acceptance gate, identical owner view, re-issue, session end on deactivation, last-owner refusal |
| 6, 7 | Route permission matrix with every role and with the toggle on and off; catalogue start-up and unknown-key tests |
| 8 | Scope-binding test; module table-access test |
| 9–11 | API tests (archive rules, switch refusal for an unheld branch, suspended clinic) + Playwright against the real backend: sign-in → chooser → switch clinic and branch |
| 12 | API tests assert one audit row per event, without phones |
| 13 | The named route-matrix and policy tests |
| Screens | UI batch slice: drawings and analysis approved by the owner at its first checkpoint (ADR-0042); browser screenshots against the real backend compared with them, light and dark, at the listed sizes |

## Screens (inventory, ADR-0042)
Clinic web, Arabic RTL, light and dark:
- **Clinic chooser** (desktop, tablet, phone): the person's clinics, last used first, with role and last sign-in; pending invitations with accept and decline. States: suspended clinic (not selectable, message); no clinic available.
- **Header switcher** (desktop, tablet as a menu; phone as a bottom sheet): clinics, then the current clinic's branches the person holds a role in, current ones checked. Hidden for one clinic with one branch.
- **Accept invitation** (phone, desktop): clinic, role and scope; sign in to accept; decline. State: invalid link.
- **Team** (desktop, tablet): name, phone, roles with scope, status in words (active, pending acceptance, deactivated), last activity; search; «إضافة موظف». States: empty, loading.
- **Member drawer** (desktop; bottom sheet on tablet): name, phone, role assignments (role + scope, add, remove), sensitive toggles with the role default named; after save the setup link shown once with copy and WhatsApp share; for a member: new link, deactivate or reactivate (confirmed). States: last owner (role and deactivate disabled, reason shown); phone already in the team.
- **Branches** (desktop): cards with name, address, phone, people with a role; add, edit, archive (confirmed, naming members whose sessions end); archived list. States: last active branch (archive disabled, reason).

## Out of scope
Custom roles; "my patients only" (A-03); entitlement limits on members and branches (A-02); working hours, prices, cash boxes, rooms (A-04, A-06); a doctor's per-clinic fees, stamp and signature (A-04, A-08).

## Open questions
None.
