# A-02-10 UI code 3: clinic web support frame, banners, subscription, limits and places

Status: In review · Tier: T1 · Branch: `feat/A-02-10-ui-clinic-web-items`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) clinic web screens; criteria 4–6, 9, 10, 11–13, 15, 16 as seen in the clinic; the three Playwright journeys of the verification contract · Requirements: PLT-14, PLT-18, PLT-20, PLT-24 · Decisions: ADR-0040, ADR-0046, ADR-0047, OD-110, OD-111 · From A-02-01: criteria 25, 26

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
- **Components:** none to build; PageBanner (built in A-02-09) and the DataTable wrapping column (built in A-02-08) are used.
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
Estimated hand-written lines: ~3,570 (shell and capabilities ~400, support frame and owner side ~950, announcements ~400, subscription and limits ~480, places ~350, idle source ~150, i18n ~300, journeys ~540). Re-estimated at A-02-01 checkpoint 3 (owner, 2026-11-27).

## From A-02-01 (re-plan approved by the owner, 2026-11-27)
The [screen contract](../specs/platform/A-02-screen-contract.md) is the reference: where this file's earlier plan names a route or field differently, the contract wins. Rows owned by this slice:
Names in the earlier plan above that the contract replaces: the routes are the contract's.
- Screens: `A02cSettings` (idle source and lock, «الاشتراك» beside it with the ending warning, the support log, the owner's banner with time left), `A02cSupportSession`, `A02cAnnouncements`, `A02cLimits`, `A02cBranchPlace` on "Shifa Screens · Clinic web", page "Proposals"; improvements 9 and 10 (criteria 25, 26); spec gaps 9–15.
- Components: none new; PageBanner (from A-02-09) and the DataTable wrapping column (from A-02-08) are used.

## Stopped at
Built, reviewed and verified; PR open (cloud session, branch `claude/intelligent-heisenberg-gn2z8h`).

## Evidence
- **Contract check (checkpoint 1, 2026-11-27):** every row of "Contract: clinic web (checkpoint 2)" matches the built API (`packages/contracts/src/{capabilities,support,announcements,places,branches,team,identity,errors}.ts`, the controllers): routes, fields, statuses and error codes as listed. No API gap; nothing changed in the API or contracts. No design-system release since A-02-01. Notes, not mismatches: a support session is `platformAdmin: true` with `support` set, so clinic web's guard had to let it in (`isSupport()`); `GET /clinic/support-grants` and `GET /clinic/subscription` are refused to a support session (`@NotInSupportSession`), so neither is asked there.
- **Tests first:** `packages/web-shell/test/a02c-{support-session,owner-settings,announcements,limits,places}.test.tsx` (40 tests, fixtures in `a02c-support.ts`) written and run red for the right reasons («الصفحة غير موجودة», sent to `/admin-web`, missing fields and texts), then locked. Changed after locking, with the owner's consent (2026-11-27): ten `x as HTMLElement` written as `must(x)` for lint (as in A-02-09), and the fake `GET /me` phone taken from the synthetic generator (the data check refused a literal); no assertion changed.
- **Journeys** (`e2e/tests/clinic-web-a02.spec.ts`, a seventh seeded super admin): (1) the owner of a solo clinic is refused a second doctor at «1 من 1» (role disabled with the Callout; the API answers 409), the super admin sets an override of 2 on admin web, the owner adds the doctor («1 من 2»); (2) support access opened on admin web lands on clinic web home with the fragment gone, the support banner with the clinic, reason and «متبقٍّ 60 دقيقة», «إضافة موظف» disabled with «للقراءة فقط» (and a write answered 403), the owner sees the warning banner and the log on «إعدادات العيادة», ends it («أنهيت دخول الدعم», «أنهيته أنت»), and the support tab's reload shows «انتهى دخول الدعم» with «أنهاه مالك العيادة …»; (3) an announcement for this clinic is seen («تنبيه:») and hidden by the owner, and absent on a second device after sign-in and challenge. All axe clean in light and dark.
- **`verify` (fast):** all green (format, instructions, lint-root, scripts-test, file-length, pub-get, drift, typecheck+lint+test, e2e 33 passed). The slice touches no build, boot, DB harness, drift generator or CI: CI's `verify (full)` is the gate.
- **Screenshots** (`E2E_SHOTS`, outside the repository; Arabic RTL, 1440 px, light and dark): `a02c-team-at-limit`, `a02c-support-home`, `a02c-support-team`, `a02c-settings-banner`, `a02c-settings-ended`, `a02c-support-ended`, `a02c-announcement`. Compared with `A02cLimits`, `A02cSupportSession`, `A02cSettings`, `A02cAnnouncements` read from "Shifa Screens · Clinic web" (version 1795743866-2ba9). Fixed after the comparison: the owner's «من» column wider, so «… · فريق شفاء» shows whole. Remaining differences, explained:
  - Team form: the existing words of A-01-08 («إضافة موظف», «إضافة وإصدار الرابط»), where the drawing wrote «إضافة عضو».
  - Support session: the clinic in the bar is its name with the eye icon, not a menu (nothing to switch; its title says «لا تبديل في دخول الدعم»); page descriptions use the plain wording, since a support session has no `GET /me/clinics` entry for the clinic.
  - The ended page is the signed-out layout with the EmptyState, not the frame: the session is gone, so nothing of the clinic stays on screen. «العودة إلى إدارة شفاء» closes the tab (admin web's tab opened it); where a browser keeps it open, a line says to go back to that tab.
  - Settings: the idle and subscription cards side by side from 1280 px (stacked below); «الاشتراك» KPIs in three columns as drawn; a solo plan's «الفروع» card is absent (the plan allows one branch).
  - The meter is drawn inside the card (no Meter component exists): the drawing's `.meter` tokens (surface-raised track, brand fill, warning-solid when full).
- **Reviewer** (fresh context, 2026-11-27): three blocking findings, fixed with regression tests in `test/a02c-review.test.tsx` (4): B1 «خروج» and «خروج الآن» in a support session sent `POST /auth/sign-out` (403) and bounced home with the grant open; they now end the grant (`POST /auth/support/end`) and show the ended page, and idle in a support tab does the same; B2 a support session's member drawer never left its skeleton (no `GET /me/clinics` entry): the clinic's facts now come from the session and the plan (`src/clinic-facts.ts`), also for the settings and branches pages' names; B3 capabilities were not read again after a change, so a freed limit stayed «full» on the page: every branch and member change now re-reads them. Non-blocking, fixed: «حسابي» absent in a support session (its writes would all be refused; `/account` goes home); the owner's log card absent on 403; a 409 without `limitReached` says «وصلت العيادة إلى أحد حدود خطتها» (no «0 من 0»); the owner's banner goes when its time runs out on the page; docs and evidence. Deferred to `docs/backlog.md`: N5 (a failed places read), N8 (an in-page journey step).
- **Security reviewer** (2026-11-27, the hand-off and the read-only frame): the token handling is clean (fragment read once and removed, body only, no cache, storage or log). L1 was B1 above. L3 fixed: at the grant's expiry the tab reads the session once so the server clears the support cookie. M1 (medium) and L2 (low) need the API: the support cookie covers the browser profile and two support tabs share it; the client part of M1 is done (a support tab whose session turns into a member's goes to the ended page, never home); the server-side refusal is in `docs/backlog.md` for the owner to schedule.
- **Not drawn, decided here:** the subscription warning counts whole days from Damascus' today; a full limit on `limits.custom_fields` reads «وصلت العيادة إلى حد «…» في خطتها»; the support banner's time left counts down on the device's clock from the server's `now` (no request for it).

## Notes for the next session
- The drawings are named in A-02-01 (links not committed, ADR-0040).
