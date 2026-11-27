# A-02-08 UI code 1: admin web clinic page tabs and clinics list

Status: Planned · Tier: T1 · Branch: `feat/A-02-08-ui-admin-clinic-tabs`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) screens "Clinic page" (الاشتراك والحدود، الإعدادات، دخول الدعم، الاستخدام) and "Clinics list"; criteria 1, 3, 9, 11, 17 as seen by the super admin · Requirements: PLT-13, PLT-14, PLT-16, PLT-24 · Decisions: ADR-0040, ADR-0046, ADR-0047 · From A-02-01: criteria 19–21

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
- **Components: delivered** ahead of this slice by the component PR (branch `feat/A-02-components`, 2026-11-27, owner's request): UsageChart and the DataTable wrapping column, built with `/ui-component` from their sheets, synced to the Shifa Design System (version `1795743045-04ed`) and drawn on "Shifa Components". This checkpoint is now the contract check alone; see "Components (delivered ahead)" below.
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
Estimated hand-written lines: ~3,570 without the components (subscription and history ~950, settings ~420, support ~620, usage, chart figures and list ~610, i18n ~320, journeys ~650). Re-estimated at A-02-01 checkpoint 3 (owner, 2026-11-27: ~4,370 with UsageChart ~600 and DataTable wrap ~200, which the component PR delivered).

## From A-02-01 (re-plan approved by the owner, 2026-11-27)
The [screen contract](../specs/platform/A-02-screen-contract.md) is the reference: where this file's earlier plan names a route or field differently, the contract wins. Rows owned by this slice:
Names in the earlier plan above that the contract replaces: the routes are the contract's; the settings tab only locks with a value and unlocks (criterion 9).
- Screens: `A02Clinic` (tabs «الاشتراك والحدود» with the override history drawer, «الإعدادات», «دخول الدعم», «الاستخدام» with the series switch and the dashboard chart) and `A02Clinics` (usage columns, «بلا نشاط منذ 7 أيام»), on "Shifa Screens · Admin web", page "Proposals"; improvements 5, 6, 7 (criteria 19, 20, 21).
- Components: **UsageChart** (`A02SheetUsageChart`) and the **DataTable wrapping column** (`A02SheetDataTableWrap`), delivered ahead by the component PR (`feat/A-02-components`); the screens import them from `@shifa/ui`. The countdown named earlier is not a component (a Badge whose text the screen updates).
- Budget: ~3,570 without the components, under the ~4,000 guide (was ~4,370 with them; the owner kept ten slices, 2026-11-27, then had the components built ahead).

## Components (delivered ahead, 2026-11-27)
Built with `/ui-component` in the component PR (`feat/A-02-components`), synced to the Shifa Design System (`1795743045-04ed`), each with its sheet on "Shifa Components"; the proposal sheets were removed from "Proposals". Compared with the approved sheets:
- **DataTable `wrap: true`:** as the sheet: the whole text on as many lines as it needs, the row grows (each drawn row is measured), the other cells at its top, 48 px rows at least (32 compact), sorting, selection, the pinned column and the keyboard unchanged; a table with a wrapping column is as wide as its box and the wrapped text never widens it. Difference: the wrapping column takes three shares from a 128 px minimum and the other columns keep their minimum (128 px, the first 240 px unless `width` says otherwise), so in a box narrower than those minimums the table scrolls sideways and a date may be cut at its minimum; the sheet's narrow specimen shrank every column instead. On the support log, give «من» `width: 'md'`.
- **UsageChart:** as the sheet: quarter axis of whole numbers (top = 4 × ⌈highest ÷ 4⌉), dashed gold average named at the oldest days, today gold, empty days a thin line, each bar the system's Tooltip («14 تسجيل دخول · 26/11»), one Tab stop, a summary for screen readers, the empty state «لا بيانات بعد» and a loading placeholder; the series switch and the figures stay on the screen. Differences: the x-axis labels sit under their own bars (every seventh day from the oldest, then «اليوم») rather than spread evenly; Left and Right follow the drawing (Left is the older day) in both directions, since time runs left to right.

## Stopped at
Checkpoints 1–3 built (2026-11-27, cloud session): contract check, the four tabs and the list columns, page tests green; checkpoint 4 (journeys, screenshots, review) next.

## Built (2026-11-27)
- `packages/web-shell/src/admin/`: `clinic-page.tsx` gains the five tabs (`Tabs` of `@shifa/ui`; «العيادة» keeps the A-01-10 cards; the chosen tab is page state, not in the URL); `limits-tab.tsx` with `override-dialog.tsx`, `override-history.tsx` (Drawer) and `type-dialog.tsx`; `settings-tab.tsx`; `support-tab.tsx` with `support-log.tsx` (DataTable, «السبب» `wrap: true`, «من» `width: 'md'`) and `support-handoff.ts`; `usage-tab.tsx` (UsageChart); `clinic-data.ts` (reads keyed `['platform', 'clinic', id, …]`, key and source words, Damascus today, last activity in words); `tab-parts.tsx`. `clinics-page.tsx` gains «آخر نشاط», «الدخول (7 أيام)» (both sortable) and the Switch «بلا نشاط منذ 7 أيام (n)», combined with the status filter and the search.
- Hand-off handling (for `security-reviewer`): the new tab is opened empty inside the click (`window.open('', '_blank')`), its `opener` is cut, and it is sent with `location.replace` only to an `http:`/`https:` address; anything else closes it. The hand-off is never logged, stored or put in the query cache; a refused pop-up says so.
- Time left on the open grant runs on the server's clock (`now` of the last answer minus the time it was read), re-drawn every 15 s.
- i18n: one block of keys in `common.json`, after `clinicUnknownText`, so the parallel A-02-09 branch merges cleanly; no shared router, navigation or layout file changed.
- e2e: a fifth seeded super admin (`tabsAdmin`, `e2e/scripts/seed.ts`, `e2e/support/run.ts`) and `e2e/tests/admin-clinic-tabs.spec.ts` (the five journeys; journey 1 also runs the contract check).

## Locked tests changed with the owner's approval (2026-11-27)
After the red phase, four mechanical fixes, none removing or weakening an assertion: the reason field found by role (`getByRole('textbox', { name: 'السبب' })`, the label text carries the required «*»), the support journey waits for the clinic web address before reading it (the tab opens empty first), an `import()` type annotation made a named import (lint), Biome's import order.

## Differences from the approved drawings (A02Clinic, A02Clinics)
1. The override reason's hint and the history drawer say the reason is kept in the limit's own history («سجل هذا الحد»), not «سجل التدقيق»: criterion 20 and the contract keep reasons out of the audit log. The removal question says «يُسجَّل في سجل الحد» for the same reason.
2. Type change: the current type is listed with «(الحالي)» but disabled (the contract: "not offered"); the first other type is chosen and previewed at once.
3. Support log: a grant the super admin ended reads «أنهاه: <name>» instead of «أنهيته», since a grant carries no account id to recognise one's own.
4. Usage: the chart is the real UsageChart (x-axis labels under their bars, as its sheet), not the board's hand-drawn bars. The empty state says the first figures appear after the first sign-in (the counters fill the same Damascus day), not «غدًا».
5. The lock dialog's Select starts at the current value (the board showed 60 as a sample choice).
6. Tablet (1024 px): the limits grid keeps the «المستخدم» column (the board hides it); the stats and figures fall to two columns below 1280 px.

## Evidence
- Contract check (checkpoint 1): every admin-web row of «الاشتراك والحدود», «الإعدادات», «دخول الدعم», «الاستخدام» and the clinics list against `@shifa/contracts`, the generated client and the API handlers: routes, fields and error codes as the contract lists them (`body.expiresAt` today or past answers `too_small`; `query.type` of the current type 400; `support_active`, `support_ended`, `setting_not_lockable` 409). Real calls in journey 1 against the built API: entitlements (fields of each item), type preview (fields; the current type 400), override history (empty), settings (fields), support grants (`now`, `mine: null`), usage (30 days, `hasData`), clinics list (`lastActivityAt: null`, `signIns7d: 0` for a new clinic). No gap found; no API or contract change.
- Page tests: `admin-limits.test.tsx` (8), `admin-settings-support.test.tsx` (12), `admin-usage.test.tsx` (7) — 27 written first, failing for the right reason (no tabs), then green; the A-01-10 admin tests still green.
- Journeys: `pnpm --filter @shifa/e2e exec playwright test tests/admin-clinic-tabs.spec.ts` — 5 passed, every screen axe clean in light and dark.
- `verify` (fast): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- The drawings are named in A-02-01 (links not committed, ADR-0040).
