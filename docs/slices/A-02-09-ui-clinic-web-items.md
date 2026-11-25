# A-02-09 UI batch 3: clinic web support frame, banners, subscription, limits and places

Status: Planned · Tier: T1 · Branch: `feat/A-02-09-ui-clinic-web-items`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) clinic web screens; criteria 4–6, 9, 10, 11–13, 15, 16 as seen in the clinic; the three Playwright journeys of the verification contract · Requirements: PLT-14, PLT-18, PLT-20, PLT-24 · Decisions: ADR-0040, ADR-0042, ADR-0046, OD-80, OD-110, OD-111

After A-02-07 and A-02-08 (merged), since its journeys start in admin web. API gaps go to a T0 gap slice before checkpoint 2.

## Goal
In clinic web: the super admin reads as the owner under a fixed support banner; owners see and end support access and read its log; every member sees and dismisses announcements; the owner reads the subscription card and is told when a limit is reached; branches get a city and area; the idle setting shows its source and lock; what is off is hidden.

## API used
`GET /clinic/capabilities`, `GET /clinic/subscription`, `GET /clinic/support-access`, `POST /clinic/support-access/:id/end`, the hand-off exchange, 403 `support_read_only`, 401 `session_expired` reason `support_ended`; `GET /announcements/active`, `POST /announcements/:id/dismiss`; 409 `limit_reached` on team and branch forms; `GET /places/cities`, `…/:id/areas`, branch `cityId`, `areaId`; `GET|PATCH /clinic/settings` (`source`, `locked`).

## Plan
### Checkpoint 1 — draw, analyse, owner approval (ADR-0042, ADR-0046, OD-80); no code before approval
- Shifa Design System README read first; Shifa Guide rules kept; real components, `--shifa-*` tokens for every colour, space, radius, shadow and size, its type styles, no literal values (checked before showing).
- On "Shifa Screens · Clinic web", page "A-02 Clinic items": one working prototype in Play, desktop, tablet and phone, Arabic RTL, light and dark, synthetic names from `@shifa/testing` only.
- Every state reachable: support frame (banner with reason, end time, «إنهاء»; write actions disabled «للقراءة فقط»; ended → back to admin web); owner support banner and «إنهاء الدخول»; support log card; announcement banner (information, warning, several in turn, dismissed); «الاشتراك» card; limit reached in team and branch forms; branch form with city and area pickers (Arabic search) and the card showing them; idle setting with source and locked.
- Analysis (Arabic board): the route, response field and error table for every route above (shown, driving a state, or named with the reason it is not); API gaps and unprofessional answers (fixed in the API); spec gaps; creative improvements with costs.
- Missing components (likely a **page banner** for support and announcements, fixed and stackable): own sheet with every state and on the screens; owner approves; built with `/ui-component` and synced before checkpoint 2 uses it.
### Checkpoint 2 — capabilities in the shell, support frame and owner side
Capabilities loaded with the session and kept for display offline; the support frame and read-only state; owner banner, end, support log.
### Checkpoint 3 — announcements, subscription card, limit reached, places, idle source
### Checkpoint 4 — journeys, screenshots, review
Playwright against the real backend across both apps: override raises a limit (owner refused at 1 of 1 doctors → super admin raises → owner adds); support opened in admin web → clinic web frame, a write disabled → owner sees the banner and ends it → the support tab gets `support_ended`; announcement posted → member sees and dismisses → stays dismissed on a second device. Screenshots light and dark compared with the drawings; axe clean; `reviewer` agent; `security-reviewer` on the hand-off exchange and the read-only frame.

Tests written first: component tests per state; the three journeys; screenshot comparisons.
Estimated hand-written lines: ~3,600 (shell and capabilities ~400, support frame and owner side ~900, announcements ~400, subscription and limits ~450, places ~350, idle source ~150, i18n ~300, journeys ~650); missing components are separate `/ui-component` work.

## Stopped at
Planned.

## Evidence
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- Drawings and analysis links are not committed (ADR-0040); record names and approval here.
