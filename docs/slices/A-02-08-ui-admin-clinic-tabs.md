# A-02-08 UI code 1: admin web clinic page tabs and clinics list

Status: Planned · Tier: T1 · Branch: `feat/A-02-08-ui-admin-clinic-tabs`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) screens "Clinic page" (الاشتراك والحدود، الإعدادات، دخول الدعم، الاستخدام) and "Clinics list"; criteria 1, 3, 9, 11, 17 as seen by the super admin · Requirements: PLT-13, PLT-14, PLT-16, PLT-24 · Decisions: ADR-0040, ADR-0046, ADR-0047

After A-02-02 to A-02-07 (merged). Drawings, contract rows and missing components approved in [A-02-01](A-02-01-design-and-screen-contract.md) checkpoint 1.

## Goal
On the clinic page the super admin sees and changes the plan, overrides, settings and locks, opens and ends support access, and reads usage; the clinics list shows last activity and sign-ins in 7 days.

## API used
The rows of the [A-02 screen contract](../specs/platform/A-02-screen-contract.md) for these screens, expected to include:
- entitlements: `GET /platform/clinics/:id/entitlements`, `PUT|DELETE …/overrides/:key`, `GET …/type-preview`, `POST …/type`;
- settings: `GET …/settings`, `PUT …/settings/:key`, `POST …/lock|unlock`;
- support: `GET|POST …/support`, `POST …/support/end`, with the hand-off URL opened in a new tab;
- usage: `GET …/usage`, and `GET /platform/clinics` (`lastActivityAt`, `signIns7d`).

## Plan
### Checkpoint 1 — contract check and components
- **Contract check:** every contract row of these screens against the built API (OpenAPI and a real call each): fields, errors, statuses. A mismatch is fixed in the API on this branch (its own commit, T0 review if it touches access or schema) and never worked around in the client. Any design-system release since A-02-01 is applied to the drawings and noted.
- **Components:** the components approved in A-02-01 that these screens need (for example the 30-day chart and the countdown) are built with `/ui-component` from their sheets and synced to the Shifa Design System before the screens use them. Each is its own PR if the line budget needs it (ADR-0032).
### Checkpoint 2 — subscription and limits tab, settings tab
- Override dialog (value by key type, reason, expiry), remove confirmation, type change with its preview.
- Settings list with source labels, set value, lock and unlock.
### Checkpoint 3 — support tab, usage tab, clinics list columns
- Open form (reason 10–500 characters, durations); clinic web opened in a new tab with the hand-off URL; the open grant with time left and «إنهاء»; past grants.
- Usage counters and the 30-day chart; the two list columns.
### Checkpoint 4 — journeys, screenshots, review
- Playwright against the real backend:
  - an override raises a limit and the tab shows the new effective value;
  - a type change after its preview;
  - a setting is locked;
  - support access is opened, the grant shown and then ended;
  - usage appears after seeded sign-ins.
- Screenshots, light and dark, compared with the approved drawings (every difference fixed or explained); axe clean; `reviewer` agent; `security-reviewer` on the hand-off URL handling in the client.

Tests written first: component tests per state in the drawings; the five journeys; screenshot comparisons.
Estimated hand-written lines: ~3,200 (subscription ~800, settings ~450, support ~600, usage and list ~450, i18n ~300, journeys ~600); components are `/ui-component` work. Re-estimated at A-02-01 checkpoint 3.

## Stopped at
Planned.

## Evidence
- Contract check: —
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- The drawings are named in A-02-01 (links not committed, ADR-0040).
