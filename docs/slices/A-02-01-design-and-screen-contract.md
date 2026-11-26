# A-02-01 Design slice: every A-02 screen and the screen-to-API contract

Status: In progress (checkpoint 1 approved 2026-11-27; checkpoint 2 drawn 2026-11-27, awaiting the owner) · Tier: T1 (it fixes the API contract; no product code) · Branch: `docs/A-02-01-design-and-screen-contract`
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
Checkpoint 1 drawn (2026-11-26): admin web boards on "Shifa Screens · Admin web", page "Proposals", and the admin rows of `docs/specs/platform/A-02-screen-contract.md`; waiting for the owner's approval, the answers on the spec gaps and the improvements accepted or declined. Next: checkpoint 2 (clinic web).

## Checkpoint 1 (admin web)
### What is drawn
Page "Proposals" of "Shifa Screens · Admin web". Each board is a working prototype: admin web's frame (top bar, navigation with the three new pages), the page, and a state panel outside the window (every state below, light and dark). A tablet board (1024 px) beside each desktop board (1440 px) shows the same prototype.
- `A02Clinic`: the clinic page with tabs «العيادة» (the A-01-10 cards, unchanged), «الاشتراك والحدود», «الإعدادات», «دخول الدعم», «الاستخدام»; 25 states (limits loaded with an active and an expired override, loading, failed, override dialog, missing reason, saved, remove question, type change preview with a limit under use, type changed; settings inherited, set by the clinic, lock dialog, locked, unlock question, none; support form and log, short reason, 409 open elsewhere, open with time left, ended, suspended clinic; usage figures and 30 days, loading, no data).
- `A02Clinics`: «آخر نشاط» and «الدخول (7 أيام)» columns, sorted by sign-ins, loading.
- `A02Flags`: list (on for all, off as a kill switch, off by default), loading, failed, none declared; change dialog with the clinic picker (typing, none chosen, refused without a clinic), off for all with its warning, missing reason, confirmation, saved.
- `A02Announcements`: active, scheduled, ended, none scheduled, none at all; new (all clinics, selected clinics), a link refused in the body, scheduled, edit, end early.
- `A02Cities`: Aleppo and its areas, a city without areas, archived shown, none yet; Arabic search («الشهبا» finds «الشهباء»), no match; rename, archive question, a name that exists.
- Sheets of the two missing components: `A02SheetUsageChart`, `A02SheetMultiCombobox` (every state, light and dark, Arabic RTL and English LTR, comfortable and compact).

In Play the buttons, tabs, filters, dialogs and the city list work. A choice inside a bundle component (a Select option, a Menu item such as «إعادة التسمية») cannot tell the board, since the bundle's components are islands; those states are reached from the state panel.

### Design system check
- Shifa Design System found by name, README read, installed on the canvas (copy refreshed to version `1795722141-5d60`, 2026-11-26).
- Real components from the bundle for every control, badge, callout, table, field, empty state, skeleton and question (`Shifa.*`). Drawn from tokens where the bundle cannot hold components: the admin frame and navigation (as `admin-frame.tsx` draws them in code), surfaces with the Card's tokens and dialogs with the Dialog's tokens that hold real fields (the bundle's Card and Dialog take text only), list rows, and the two proposed components.
- Check of every A-02 artboard and `a02/a02.css` (script in the session's scratchpad): 0 literal colours, 0 unknown `--shifa-` names; the only literal lengths are the board and device sizes (1440, 1024, 1368, 1784, 960).
- Every state of every board rendered in Chromium in light and dark with a local copy of the canvas runtime (the bundle, tokens, `support.js` behaviour imitated): 0 page errors, 0 missing values, nothing wider than its window. The canvas itself sits behind a bot check the session cannot pass, so Play is for the owner to test.

### Spec gaps (answers go into the spec after approval)
1. Settings: the super admin's actions are «قفل بقيمة» (set and lock at once) and «فتح القفل», never a plain set (permissions table: "lock only"). Drawn so.
2. An override survives a change of the clinic's type; the preview shows it as «35 (يبقى التجاوز)». Drawn so.
3. A-02 registers no feature entitlement: the catalogue holds the three limits only, so the owner's «الاشتراك» card lists no feature until a later spec adds one. Drawn so.
4. An override's expiry is a date, effective to the end of that Damascus day; a past or today's date is refused.
5. Archived cities and areas cannot be restored in the spec. Drawn without restore (see improvement 3).
6. A flag shows who changed it last and when, read from its row; needed to know who turned a feature off.
7. Cancelling a scheduled announcement is ending it before its start (same route, «إلغاء» on a scheduled row).
8. The super admin can open the clinic tab again for a grant that is still open («فتح عيادة الويب», a new single-use hand-off).

### Improvements (each accepted or declined by the owner; estimates are hand-written lines)
| # | Improvement | Adds (API · component · screens) | Lines | Slices |
|---|---|---|---|---|
| 1 | Dismissals per announcement («أغلقه 31 من 118») | count per announcement and members targeted · none · a line per row | ~150 | A-02-07, A-02-09 |
| 2 | Branches per city and area, named in the rename and archive questions | counts in `GET /platform/cities` · none · captions and question text | ~120 | A-02-06, A-02-09 |
| 3 | Restore an archived city or area | `POST …/restore`, audit · none · «استعادة» on archived rows | ~150 | A-02-06, A-02-09 |
| 4 | Preview of the banner inside the announcement form | none · the banner of checkpoint 2 · form | ~80 | A-02-09 |
| 5 | Usage chart series: sign-ins or members signed in | none (already in `days[]`) · SegmentedControl · usage tab | ~60 | A-02-08 |
| 6 | Override history per key (who, when, before and after) | `GET …/overrides/:key/history` from audit · Drawer · limits rows | ~350 | A-02-02, A-02-08 |
| 7 | Clinics list filter «بلا نشاط منذ 7 أيام» | none · Toolbar filter · clinics list | ~60 | A-02-08 |

### Owner review, clinic page (2026-11-27)
- Spec gaps 1, 2, 3, 4 and 8 accepted as drawn and written into the spec (criteria 3, 9, 11). Gaps 5, 6 and 7 wait for their screens.
- Improvements 5 (chart series) and 6 (override history, criterion 20) accepted; drawn on `A02Clinic` (states `useMembers`, `history`) and added to the spec as criteria 19 and 20 and to the contract.
- Fixed on the drawing, since the approved drawing is what the UI code is compared with (ADR-0040, ADR-0047):
  - every list's columns now line up with their headers (the action column had an `auto` width, sized by the buttons in the rows and by nothing in the header; it is now a fixed token width on all A-02 boards);
  - «سجل دخول الدعم» must show each reason whole. A first fix drew the log as rows by hand; the owner refused it (2026-11-27): the log uses the real DataTable, and the DataTable is changed so a column can wrap (component change 1 below). Until that change is drawn and approved, the board shows today's DataTable, which cuts the reason to one line;
  - the usage chart (owner's request for a professional dashboard): each bar is the system's Tooltip trigger (the figure, then the day), a y-axis with quarter lines, the daily average as a dashed gold line, a strip of figures (total with the change against the previous 30 days, daily average, highest day, days without activity), yesterday under each of today's figures, and the series switch. The UsageChart sheet is redrawn to match.

### Owner review, clinics list (2026-11-27)
- Improvement 7 accepted: the quick filter «بلا نشاط منذ 7 أيام (n)», a Switch beside the status filter, combined with it and the search (criterion 21; states `inactive`, `inactiveNone`).
- The first drawing had left out the coded toolbar's status filter with its counts; it is drawn again, as `clinics-page.tsx` renders it.

### Owner review, flags (2026-11-27)
- Spec gap 6 accepted (criterion 7: who changed a flag last and when). The sample flag keys are drawing examples only; A-02 declares no real flag.
- MultiCombobox approved as drawn (sheet `A02SheetMultiCombobox`); built with `/ui-component` before the flags screen.

### Owner review, announcements (2026-11-27)
- Spec gap 7 accepted (criterion 16: cancelling a scheduled announcement ends it before its start).
- Improvements 1 (dismissals per announcement, criterion 22) and 4 (banner preview in the form, criterion 23) accepted and drawn. The preview is drawn with a Callout for now; the page banner drawn at checkpoint 2 replaces it there, on its approval.

### Owner review, cities and areas (2026-11-27)
- Improvements 2 (branches per place, named in the rename and archive questions) and 3 (restore) accepted and drawn; spec gap 5 is closed by improvement 3 (criterion 15).
- Owner's addition, improvement 8: clinics and doctors per place beside the branches («5 فروع · 4 عيادات · 11 طبيبًا»), criterion 24. Counts only, over all clinics, read under the platform role; a doctor counts once per place (a branch role there, or a clinic-wide role in a clinic with a branch there). Estimate ~100 lines more on top of improvement 2, in A-02-06 and A-02-09. Its counting query crosses tenants, so A-02-06's security review checks it returns numbers only.

### Component changes (accepted by the owner)
1. **DataTable: a wrapping column** (owner, 2026-11-27). A column may declare `wrap: true`: its cells show their whole text on as many lines as it needs, never cut, and the row grows to fit; the other cells of the row stay at the top of the row. Rows keep the 48 px minimum (32 compact); sorting, selection, the pinned first column, keyboard and virtualisation behave as today (a virtualised row's height is measured). A column without `wrap` keeps today's one line with an ellipsis and the tooltip. First user: «السبب» of «سجل دخول الدعم»; later users: any free-text column (notes, reasons). Its sheet `A02SheetDataTableWrap` (approved 2026-11-27) shows the real DataTable with the wrap laid out by `a02.css` until it is coded: long and short reasons, sorted, a selected row, a narrow width, compact, dark, English LTR, and a column without `wrap` as today; the wrapping column takes the widest share of the row (dates and status keep their room). The support log on `A02Clinic` is drawn the same way. It is approved with the screens (ADR-0046); it is then built with `/ui-component` in A-02-08 before the support tab, and synced. Estimate ~200 hand-written lines (component, story, tests, screenshots).

### Missing components
- **UsageChart** (30 daily counts; sheet `A02SheetUsageChart`): needed by «الاستخدام»; built in `packages/ui` without a charting library.
- **MultiCombobox** (several clinics by search; sheet `A02SheetMultiCombobox`): needed by flags and announcements. Approved by the owner 2026-11-27.
- Not needed: a countdown (the open grant's time left is a Badge whose text the screen updates each minute), a character counter (Textarea's `maxLength` shows it). The page banner is drawn at checkpoint 2.

## Checkpoint 2 (clinic web)
### What is drawn
"Shifa Screens · Clinic web", new page "Proposals" (ADR-0049): each row a desktop board (1440) with its state panel, a tablet (1024) and a phone (390); clinic web's frame as `app-frame.tsx` draws it; the design system's copy on that canvas refreshed to `1795722141-5d60`.
- `A02cSettings` (owner): the idle setting with its source (chosen by the clinic, inherited default, locked by the admin), «الاشتراك» (plan, status, end date, each limit with its use and a meter, a full limit, loading), «سجل دخول الدعم» (DataTable with the wrapping reason, empty), the owner's support banner, the end question and the ended note.
- `A02cSupportSession` (super admin in clinic web): the support banner over every page, the owner's view with write buttons disabled and «للقراءة فقط», a refused write (403), the end question, and the ended page for each cause (expiry, owner, self).
- `A02cAnnouncements`: the banner for a warning, an information, several in turn, hidden; under the owner's support banner.
- `A02cLimits`: the team form at the doctor limit (role disabled, named), refused after sending (409), reactivating a doctor at the limit; branches at their limit and a refused restore; what the plan does not allow is absent (a solo clinic without «الفروع»).
- `A02cBranchPlace`: branch cards with city and area (and an archived area kept), the dialog with city and area Comboboxes (area waits for the city, Arabic search, no match, an archived area kept on edit).
- Sheet `A02cSheetPageBanner`: the proposed PageBanner (information, warning, several, the owner's support notice, the support session strip, two at once, phone, dark, compact, English).

Check: 0 literal colours and 0 unknown tokens on every board and `a02.css`; every state rendered in light and dark on the three sizes with the local runtime copy, 0 errors.

### Spec gaps (answers go into the spec after approval)
9. Banners sit above the top bar on every page: the support session's strip, then the owner's support notice, then announcements. Neither support banner can be hidden while the grant is open.
10. An announcement that is edited after a person hid it shows to that person again (dismissal is kept per version). The alternative is that a hidden announcement stays hidden whatever its edits.
11. Several announcements show one at a time with «1 من 3» and previous and next, warnings first, then newest.
12. A full limit is shown before sending: the doctor role and «إضافة فرع» are disabled and the limit named; the server's 409 `limit_reached` still answers a race.
13. What the plan does not allow is absent, never shown disabled (criterion 5, PLT-20); limits are the one exception (shown, disabled and named, criterion 5).
14. When a support session ends, the tab shows a full page with its cause (expired, ended by the owner with their name, ended by the super admin) and a link back to admin web; the 401 carries who ended it.
15. A branch keeps an archived city or area it already holds; the dialog shows it, marked archived, and it cannot be chosen anew.

### Improvements (checkpoint 2)
| # | Improvement | Adds (API · component · screens) | Lines | Slices |
|---|---|---|---|---|
| 9 | «الاشتراك» warns when the subscription ends within 14 days («ينتهي اشتراكك خلال 9 أيام») | none (`subscriptionEnd` is served) · Callout · subscription card | ~40 | A-02-10 |
| 10 | The owner's support banner counts down («متبقٍّ 42 دقيقة») like the admin's card | `now` in `GET /clinic/support-grants` · none · banner | ~40 | A-02-05, A-02-10 |

### Owner review, clinic settings (2026-11-27)
- Spec gaps 9 and 13 accepted (criteria 13 and 5). Improvements 9 (subscription ending within 14 days, criterion 25; state `subEnding`) and 10 (time left in the owner's banner, criterion 26) accepted and drawn.
- The owner moved «الاشتراك» beside «الخروج التلقائي»: two columns on a desktop, one under the other on a tablet and a phone; «سجل دخول الدعم» stays full width below.
- A `position: relative` on the page's `main` appeared in a version saved from the canvas page; nobody wrote it (most likely the canvas editor while the board was open), it changed nothing visible, and it was removed (owner, 2026-11-27).

### Owner review, support session (2026-11-27)
- Spec gap 14 accepted (criterion 12: the 401 after a support session ends carries who ended it and when; the tab shows the cause and the way back). No improvement on this screen.

### Owner review, announcement banner (2026-11-27)
- Spec gaps 10 (an edited announcement shows again to whoever hid it) and 11 (one at a time, warnings first, then newest) accepted as drawn (criterion 16).
- PageBanner approved as drawn (sheet `A02cSheetPageBanner`); the admin form's preview (improvement 4) uses it.

### Owner review, limits (2026-11-27)
- Spec gap 12 accepted (criterion 4: a full limit shown before sending; 409 for a race). No improvement on this screen.

### Missing component
- **PageBanner** (sheet `A02cSheetPageBanner`): announcements, the owner's support notice and the support session strip. Approved by the owner 2026-11-27.

## Evidence
- Token and component check of the artboards: checkpoint 1, 0 literal colours, 0 unknown tokens; every state rendered light and dark, 0 errors (2026-11-26)
- Owner approvals (dates): checkpoint 1 2026-11-27 (every admin screen, the UsageChart, MultiCombobox and DataTable wrap sheets), checkpoint 2 —, re-plan —
- Improvements accepted / declined: 1–8 accepted (2026-11-27; 8 asked by the owner); none declined

## Notes for the next session
- Drawing and artifact links are not committed (public repository, ADR-0040); record the page and artboard names and the approval dates here.
