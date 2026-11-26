# A-02-01 Design slice: every A-02 screen and the screen-to-API contract

Status: Planned · Tier: T1 (it fixes the API contract; no product code) · Branch: `docs/A-02-01-design-and-screen-contract`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md), section "Screens" (all of it), criteria 1–18 as seen on screen · Requirements: PLT-13 to PLT-25, PLT-29, PLT-46, PLT-47 · Decisions: ADR-0040, ADR-0046, ADR-0047, OD-80, OD-117

First slice of A-02 (ADR-0047): nothing of A-02 is built before its drawings, contract and improvements are approved.

## Goal
The owner tests every A-02 screen in Play, decides each proposed improvement knowing its cost, and approves a written screen-to-API contract. The six API slices then build and test against that contract, and the three UI code slices build the screens on top of it.

## Plan
### Checkpoint 1 — admin web (owner approval)
- Shifa Design System found by name, its README read first, installed on "Shifa Screens · Admin web" (canvas copy refreshed); Shifa Guide rules kept. Real components from the bundle, `--shifa-*` tokens for every colour, space, radius, shadow and size, its type styles, no literal values. Every artboard is checked for literal colours, unknown `--shifa-` names and hand-drawn copies of existing components before showing, and the result is written here.
- Page "Proposals" of "Shifa Screens · Admin web" (its "Admin Web Screens" page shows the coded screens, rebuilt from the code; OD-120): one working prototype (interactive artboards, flow between pages, tabs and dialogs), desktop and tablet, Arabic RTL, light and dark, synthetic names from `@shifa/testing` only. Screens:
  - clinic page tabs «الاشتراك والحدود», «الإعدادات», «دخول الدعم», «الاستخدام»;
  - clinics list with last activity and sign-ins in 7 days;
  - Flags; Announcements; Cities and areas.
- Every state of the spec reachable, by its action or a labelled state switcher outside the frame: loading, error, expired override, type-change preview with rows over the limit, no keys, a grant already open, suspended-clinic note, time left and ended, no usage data, no flags declared, announcements empty or scheduled, active and ended, a refused link in the body, empty cities, archived shown.
### Checkpoint 2 — clinic web (owner approval)
- On "Shifa Screens · Clinic web", page "A-02 Clinic", with the same rules, desktop, tablet and phone:
  - support session frame (banner, «للقراءة فقط» on writes, ended);
  - owner support banner with «إنهاء الدخول», and the support log card;
  - announcement banner (information, warning, several in turn, dismissed);
  - «الاشتراك» card;
  - limit reached in the team and branch forms;
  - branch form and card with city and area (Arabic search);
  - idle setting with its source and the locked state;
  - what is hidden when off (capabilities).
### Analysis (both checkpoints; Arabic board for the owner, English in the repository)
1. **Screen-to-API contract** in `docs/specs/platform/A-02-screen-contract.md`, a companion of the spec:
   - one row per screen and state: route (method, path, existing or planned), request fields, response fields with what each drives, every error code and status with the screen's behaviour, permission or access annotation, and the API slice that owns the row (A-02-02 to A-02-07);
   - every route the spec implies is listed, or named with the reason no screen uses it.
2. **Existing API met by these screens** (A-01 routes, for example `GET /platform/clinics`, branch and team forms): anything unprofessional, assigned to an API slice.
3. **Spec gaps:** each added to the spec.
4. **Improvements:** each with what it adds (API, component, screens), its estimated lines and the slice that would carry it. The owner accepts or declines each one. Accepted ones are drawn and added to the spec as numbered criteria. Declined ones are listed here.
5. **Missing components** (candidates: 30-day chart, countdown, multi-select clinic picker, character counter, page banner): each on its own sheet beside the screens with every state, light and dark, RTL and LTR, both densities, and at once on its screens; approved or changed with them (ADR-0046).
### Checkpoint 3 — re-plan
`/slice-plan` re-estimates A-02-02 to A-02-10 with the contract and the accepted improvements. Each slice file gains its contract rows and its components. The roadmap shows the final count, and the owner approves it before A-02-02 starts.

Tests written first: none (no code). The proof is the owner's approval of both prototypes, the contract file reviewed with the spec, and the re-plan.
Estimated hand-written lines: ~900 in the repository (contract ~600, spec amendments ~150, slice and roadmap updates ~150); the drawings are in the design project.

## Stopped at
Planned.

## Evidence
- Token and component check of the artboards: —
- Owner approvals (dates): checkpoint 1 —, checkpoint 2 —, re-plan —
- Improvements accepted / declined: —

## Notes for the next session
- Drawing and artifact links are not committed (public repository, ADR-0040); record the page and artboard names and the approval dates here.
