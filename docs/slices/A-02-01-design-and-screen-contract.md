# A-02-01 Design slice: every A-02 screen and the screen-to-API contract

Status: In progress (checkpoint 1 drawn, awaiting the owner) · Tier: T1 (it fixes the API contract; no product code) · Branch: `docs/A-02-01-design-and-screen-contract`
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

### Missing components
- **UsageChart** (30 daily counts; sheet `A02SheetUsageChart`): needed by «الاستخدام»; built in `packages/ui` without a charting library.
- **MultiCombobox** (several clinics by search; sheet `A02SheetMultiCombobox`): needed by flags and announcements.
- Not needed: a countdown (the open grant's time left is a Badge whose text the screen updates each minute), a character counter (Textarea's `maxLength` shows it). The page banner is drawn at checkpoint 2.

## Evidence
- Token and component check of the artboards: checkpoint 1, 0 literal colours, 0 unknown tokens; every state rendered light and dark, 0 errors (2026-11-26)
- Owner approvals (dates): checkpoint 1 —, checkpoint 2 —, re-plan —
- Improvements accepted / declined: —

## Notes for the next session
- Drawing and artifact links are not committed (public repository, ADR-0040); record the page and artboard names and the approval dates here.
