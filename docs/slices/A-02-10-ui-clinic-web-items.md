# A-02-10 UI code 3: clinic web support frame, banners, subscription, limits and places

Status: Planned · Tier: T1 · Branch: `feat/A-02-10-ui-clinic-web-items`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) clinic web screens; criteria 4–6, 9, 10, 11–13, 15, 16 as seen in the clinic; the three Playwright journeys of the verification contract · Requirements: PLT-14, PLT-18, PLT-20, PLT-24 · Decisions: ADR-0040, ADR-0046, ADR-0047, OD-110, OD-111

Last slice of A-02, after A-02-08 and A-02-09 (merged), because its journeys start in admin web. Drawings, contract rows and missing components were approved in [A-02-01](A-02-01-design-and-screen-contract.md) checkpoint 2.

## Goal
In clinic web:
- the super admin reads as the owner under a fixed support banner;
- owners see support access, end it and read its log;
- every member sees and dismisses announcements;
- the owner reads the subscription card and is told when a limit is reached;
- branches get a city and area;
- the idle setting shows its source and lock;
- what is off is hidden.

## API used
The rows of the [A-02 screen contract](../specs/platform/A-02-screen-contract.md) for these screens, expected to include:
- capabilities: `GET /clinic/capabilities`, `GET /clinic/subscription`;
- support: `GET /clinic/support-access`, `POST /clinic/support-access/:id/end`, the hand-off exchange, 403 `support_read_only`, 401 `session_expired` with reason `support_ended`;
- announcements: `GET /announcements/active`, `POST /announcements/:id/dismiss`;
- limits: 409 `limit_reached` on the team and branch forms;
- places: `GET /places/cities`, `…/:id/areas`, and branch `cityId` and `areaId`;
- settings: `GET|PATCH /clinic/settings` (`source`, `locked`).

## Plan
### Checkpoint 1 — contract check and components
- **Contract check:** every contract row of these screens against the built API. A mismatch is fixed in the API on this branch, never in the client. Any design-system release since A-02-01 is applied to the drawings and noted.
- **Components:** the approved ones these screens need (for example the fixed, stackable page banner) are built with `/ui-component` and synced before use.
### Checkpoint 2 — capabilities in the shell, support frame and owner side
- Capabilities loaded with the session and kept for display offline.
- The support frame and its read-only state.
- The owner's banner, «إنهاء الدخول» and the support log.
### Checkpoint 3 — announcements, subscription card, limit reached, places, idle source
### Checkpoint 4 — journeys, screenshots, review
- Playwright against the real backend, across both apps:
  - **override raises a limit:** the owner is refused at 1 of 1 doctors, the super admin raises the limit, and the owner then adds the doctor;
  - **support access:** opened in admin web, the clinic web frame shows a write disabled, the owner sees the banner and ends it, and the support tab gets `support_ended`;
  - **announcement:** posted, seen and dismissed by a member, and still dismissed on a second device.
- Screenshots, light and dark, compared with the approved drawings; axe clean; `reviewer` agent; `security-reviewer` on the hand-off exchange and the read-only frame.

Tests written first: component tests per state in the drawings; the three journeys; screenshot comparisons.
Estimated hand-written lines: ~3,500 (shell and capabilities ~400, support frame and owner side ~900, announcements ~400, subscription and limits ~450, places ~350, idle source ~150, i18n ~300, journeys ~550); components are `/ui-component` work. Re-estimated at A-02-01 checkpoint 3.

## Stopped at
Planned.

## Evidence
- Contract check: —
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- The drawings are named in A-02-01 (links not committed, ADR-0040).
