# A-02-07 UI batch 1: admin web clinic page tabs and clinics list

Status: Planned · Tier: T1 · Branch: `feat/A-02-07-ui-admin-clinic-tabs`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) screens "Clinic page" (الاشتراك والحدود، الإعدادات، دخول الدعم، الاستخدام) and "Clinics list"; criteria 1, 3, 9, 11, 17 as seen by the super admin · Requirements: PLT-13, PLT-14, PLT-16, PLT-24 · Decisions: ADR-0040, ADR-0042, ADR-0046, OD-80

After A-02-01 to A-02-06 (merged). API gaps found here go to a T0 gap slice (next free number) before checkpoint 2, as A-01-09 and A-01-11 did.

## Goal
On the clinic page the super admin sees and changes the plan, overrides, settings and locks, opens and ends support access, and reads usage; the clinics list shows last activity and sign-ins in 7 days.

## API used
`GET /platform/clinics/:id/entitlements`, `PUT|DELETE …/overrides/:key`, `GET …/type-preview`, `POST …/type`; `GET …/settings`, `PUT …/settings/:key`, `POST …/lock|unlock`; `GET|POST …/support`, `POST …/support/end` (hand-off URL opened in a new tab); `GET …/usage`; `GET /platform/clinics` (`lastActivityAt`, `signIns7d`).

## Plan
### Checkpoint 1 — draw, analyse, owner approval (ADR-0042, ADR-0046, OD-80); no code before approval
- Shifa Design System README read first; Shifa Guide rules kept; its real components, `--shifa-*` tokens for every colour, space, radius, shadow and size, its type styles, no literal values (checked for unknown token names before showing).
- On "Shifa Screens · Admin web", page "A-02 Clinic tabs": one working prototype the owner tests in Play (interactive artboards, flow from tab to tab and into each dialog), desktop and tablet, Arabic RTL, light and dark, synthetic names from `@shifa/testing` only.
- Every state of the spec reachable: subscription loading, error, expired override shown as such, set and remove override, type change with the preview (over-limit rows); settings with source and lock, no keys; support open form, one already open (409), time left, ended, suspended-clinic note, past grants; usage today, 30-day chart, no data yet; list columns.
- Analysis (Arabic board): opens with a table of every route, response field and error above — shown, driving a state, or named with the reason it is not; API gaps and anything unprofessional in the API (fixed in the API, never in the client); spec gaps; creative improvements each with its cost, for the owner to accept or decline.
- Missing components (likely a **bar or line chart** for 30 days, a **countdown** for time left): each on its own sheet with every state and at once on the screens; approved or changed by the owner; then built with `/ui-component` and synced to the design system before checkpoint 3 uses them.
### Checkpoint 2 — subscription and limits tab, settings tab
Override dialog (value by key type, reason, expiry), remove confirmation, type change with preview; settings list with source labels, set value, lock and unlock.
### Checkpoint 3 — support tab, usage tab, clinics list columns
Open form (reason 10–500, durations), opening clinic web in a new tab with the hand-off URL, the open grant with time left and «إنهاء», past grants; usage counters and chart; two list columns.
### Checkpoint 4 — journeys, screenshots, review
Playwright against the real backend: override raises a limit and the tab shows the new effective value; type change with preview; lock a setting; open support and see the grant, end it; usage after seeded sign-ins. Screenshots light and dark compared with the approved drawings; axe clean; `reviewer` agent; `security-reviewer` on the hand-off URL handling in the client.

Tests written first: component tests per state; the five journeys; screenshot comparisons.
Estimated hand-written lines: ~3,400 (subscription ~800, settings ~450, support ~600, usage and list ~450, i18n ~350, journeys ~750); missing components are separate `/ui-component` work.

## Stopped at
Planned.

## Evidence
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- Drawings and analysis links are not committed (ADR-0040); record names and approval here.
