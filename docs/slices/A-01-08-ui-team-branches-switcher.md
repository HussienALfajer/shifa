# A-01-08 UI batch 3: team, branches and switcher screens

Status: Planned · Tier: T1 · Branch: `feat/A-01-08-ui-team-branches-switcher`
Spec: [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) screen inventory, verification rows for criteria 9–11 (Playwright) and "Screens" · Requirements: PLT-03, PLT-04, PLT-05, PLT-06, PLT-43, PLT-45 · Decisions: ADR-0040, ADR-0042, ADR-0046, OD-79, OD-80, OD-94

After [A-01-07](A-01-07-ui-sign-in-screens.md) (merged); may run beside [A-01-10](A-01-10-ui-account-settings-admin-web.md). The clinic chooser moved to A-01-07 in the 2026-11-24 re-plan. Last A-01 slice with A-01-10; A-01a and A-01b are done when it merges and the owner accepts.

## Goal
The owner manages the team and branches from clinic-web; a person in several clinics switches clinic and branch from the header; invitations are accepted or declined on their link.

## Added by A-01-07 checkpoint 1 (owner, 2026-11-24)
- The member detail gains «إعادة ضبط التحقق بخطوتين» for the owner (OD-95; route built in A-01-09): confirmed with an AlertDialog, ends the member's sessions, audited; a shared account answers `account_shared` (super admin). Drawn with this batch's screens.
- Use the approved Callout for page messages (A-01-07 sheet).

## Plan
### Checkpoint 1 — draw, analyse, owner approval (ADR-0042, OD-80); no code before approval
- Shifa Design System README read first; Shifa Guide rules kept; "Shifa Screens · Clinic web", page "A-01 Foundation" (drafts of 2026-11-23 reviewed and updated).
- Screens: Header switcher (menu on desktop and tablet, bottom sheet on phone), Accept invitation (phone, desktop), Team (desktop, tablet), Member drawer (desktop; bottom sheet on tablet), Branches (desktop).
- Working prototype in Play: flows clinic → switch branch → switch clinic; owner adds a receptionist for one branch → link shown once → shares; owner turns off «رؤية الملاحظات السريرية» for an assistant; deactivates a member (confirm); archives a branch (confirm naming the members whose sessions end); accepts and declines an invitation. Every state reachable: suspended clinic in the switcher, invalid link, last owner (disabled with the reason), phone already in the team, last active branch, empty and loading, solo clinic (no branch screens, no branch switcher), one clinic with one branch (switcher hidden). Light and dark, the sizes switchable, Arabic RTL, synthetic data from `@shifa/testing` only.
- Checked before showing (literal colours, unknown `--shifa-` names, look-alike components); result written here.
- Analysis written here (ADR-0046): the route, field and error table for the team, branch, switcher and invitation routes (A-01-04, A-01-05 contracts) against every state, API gaps and anything unprofessional in the API, spec gaps, creative improvements with costs.
- Missing components drawn in this checkpoint on their own sheet with every state and at once on their screens (likely: a scope chip "role · branch", a member row with status, a switcher menu with two groups); approved or changed by the owner, then built with `/ui-component` and synced before checkpoint 2.

### Checkpoint 2 — header switcher, invitation
Switching calls `POST /me/switch` and reloads the page data (Query cache cleared per scope); phone layout uses the bottom sheet.

### Checkpoint 3 — team and member drawer
Team table (`@shifa/ui` Data Table; search; statuses in words), member drawer (role assignments with scope, sensitive toggles with the role default named, link shown once with copy and WhatsApp share, re-issue, deactivate and reactivate confirmed), last-owner and duplicate-phone states from the API codes.

### Checkpoint 4 — branches
Cards, add and edit, archive with the preview of affected members, archived list, last active branch disabled with the reason; hidden for a solo clinic.

### Checkpoint 5 — journeys, screenshots, review
Playwright against the real backend: switch clinic and branch from the header; owner adds a member → member opens the link → signed in with the branch role; a doctor accepts a second clinic's invitation; deactivation signs the member out on their next request. Screenshots against the real backend, light and dark, listed sizes, compared with the approved drawings; axe clean; `reviewer` agent.

Tests written first: component tests per screen state; the four Playwright journeys; screenshot comparisons.
Estimated hand-written lines: ~3,100 (switcher ~400, invitation ~300, team and drawer ~1,300, branches ~500, journeys ~600); missing components are separate `/ui-component` work.

## Drawings and analysis
Not drawn.

## Stopped at
Not started.

## Evidence
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —
