# Spec A-02: settings, entitlements and limits, flags, basic super-admin console

Status: Approved by the owner 2026-11-25; amended from the A-02-01 drawings (owner, 2026-11-27: criteria 3, 5, 7, 9, 11–13, 15, 16, 19–26) · Date: 2026-11-25 · Risk tier: T0 (entitlements, support access, tenancy/RLS, audit) · Owner: product owner
Builds on [A-01a](A-01a-clinic-owner-sign-in.md) and [A-01b](A-01b-team-roles-branches-switcher.md) (order: OD-75). Decisions: ADR-0004, ADR-0007, ADR-0042, ADR-0046, ADR-0047; OD-108 to OD-117. One spec by the owner's choice (OD-108), above the usual size. Screens: inventory below; drawn in the design slice A-02-01 before the API, with the screen-to-API contract in [A-02-screen-contract.md](A-02-screen-contract.md) (ADR-0047, OD-117).

## Goal
The platform decides per clinic what it may use and how it behaves, without code per customer: a plan per clinic type with per-clinic overrides (entitlements and limits), short-lived engineering flags, and a settings cascade that shows where each value comes from. The super admin gets the console a pilot needs: time-boxed read-only support access the owner can see and end, cities and areas, announcements and daily usage. Later specs only register their keys.

Requirements: PLT-13, PLT-14 (read-only; write elevation later), PLT-15 (cities and areas only), PLT-16 (mechanism + sign-ins and team counts), PLT-18, PLT-20, PLT-21, PLT-22, PLT-23, PLT-24, PLT-25, PLT-29 (keys and overrides), PLT-46 (support elevation key reserved), PLT-47 (console events).

## User stories
- Super admin → raises «عيادة الشفاء» from 10 to 15 doctors until 31/12 with a reason → the owner can add three more doctors.
- Super admin → opens support access (دخول الدعم) for one hour, reason «مشكلة في الفروع» → reads the clinic web as the owner sees it; the owner sees a banner and ends it.
- Super admin → posts an announcement (إعلان) «صيانة الليلة ١١–١٢» to all clinics → every member sees the banner and dismisses it.
- Owner → opens «الاشتراك» in clinic settings → sees the plan, «٣ من ١٠ أطباء», «١ من ١ فروع».

## Acceptance criteria
Entitlements and limits (OD-109, OD-110)
1. Three plans without prices, one per clinic type (`solo`, `multi_doctor`, `multi_branch`), seeded with limit defaults `limits.practitioners` 1 / 10 / 30, `limits.branches` 1 / 1 / 5 and `limits.custom_fields` 20 for all. A clinic's plan is its type; changing the type moves the clinic to that plan at once, after a preview of the new limits against current use. `addon` exists (replace / increment) with no screen.
2. Resolution per key (PLT-21): unexpired tenant override → highest replacing add-on → plan value plus incremental add-ons → deny. A key outside the catalogue is refused at start-up and at the call (as `PERMISSION_CATALOGUE`). The result is cached per tenant; a change is in force on every API instance within 60 s and at once on the instance that made it.
3. The super admin sets or removes a clinic's override for any catalogue key (value per the key's type, mandatory reason, optional expiry); an expired override stops counting at its expiry. Audited with before and after values. The expiry is a date, in force to the end of that Damascus day; today or a past date is refused. An override survives a change of the clinic's type, and the type preview shows it kept. A-02 registers no feature entitlement: the catalogue holds the three limits, and later specs add features.
4. Limits count non-deactivated members holding a doctor role (pending included) and non-archived branches. Adding a doctor role (new member, edit, reactivation) and creating or restoring a branch beyond the limit answer 409 `limit_reached` with key, limit and used; nothing is written. A limit lowered below use keeps what exists. Two concurrent requests at the limit never both succeed.
5. `GET /clinic/capabilities` gives the active clinic's entitlements, limits with use, and evaluated flags; clinic web hides what is off (PLT-20), never showing it disabled, while a limit shows with its use and, when full, is named where it stops an add («وصلت العيادة إلى حد الأطباء في خطتها، تواصل مع الإدارة»). The server checks every gated route itself.
6. The owner sees a «الاشتراك» card in clinic settings: plan, status, end date, each limit with use, enabled features. Owner only.

Feature flags (OD-114)
7. Flags are declared in code (key, description, default) behind an OpenFeature-compatible interface with an in-house provider. The super admin sets each flag off for all, on for all, or on for selected clinics, with a reason; off for all is the kill switch and wins. A row for a flag no longer in code is ignored; a flag without a row takes its code default. Same cache rule as criterion 2. Audited. The flags list shows, for each flag, who changed it last and when.

Settings cascade (PLT-22 to PLT-24)
8. Setting definitions live in code: key, JSON Schema, default, `overridable_by` (scopes), lockable, sensitivity. Scopes, nearest wins: platform → plan → specialty pack → organization → branch → practitioner → user. A write is validated against the schema and refused for a scope not in `overridable_by` or under a lock; a stored value that no longer validates is skipped and the next scope used.
9. The super admin may set and lock a clinic's value («مقفل من الإدارة»), always together («قفل بقيمة»), and unlock it; the super admin never sets a clinic value without a lock. Below a lock nobody overrides. Every read for an admin screen returns the effective value and its source («موروث من: الإعداد الافتراضي»).
10. The clinic's idle sign-out (A-01a criterion 9) becomes the first key, `session.idle_minutes` (organization; 15, 30, 60; default 30); existing values keep working.

Support access (OD-111, OD-112)
11. The super admin opens access to one clinic with a mandatory reason (10–500 characters) and a duration of 30 min, 1, 2 or 4 h; one open grant per super admin per clinic (409 `support_active`). It opens clinic web in a new tab, as the super admin, with the clinic's owner view and a fixed banner (reason, end time, «إنهاء»). While the grant is open the super admin can open that tab again («فتح عيادة الويب»), each time with a new single-use hand-off.
12. In a support session every write route answers 403 `support_read_only` and the database transaction is read-only; reads are those an owner may make. It ends at its expiry, when the super admin ends it, or when an owner ends it; the next request then answers 401 `session_expired` with reason `support_ended`. That answer says who ended it (expiry, the owner with their name, or the super admin) and when, and the tab shows a full page with the cause and a way back to admin web.
13. While a grant is open, every owner of that clinic sees a banner naming the super admin, reason, end time and time left, with «إنهاء الدخول». Banners sit above the top bar on every page: the support session's strip, then the owner's support notice, then announcements; neither support banner can be hidden while the grant is open. Clinic settings lists every grant (who, reason, start, end, ended by whom).
14. Audit: grant opened (reason, duration), ended (by whom) or expired, and every request in a support session (route template, target id, no body). A suspended clinic can still be opened.

Console
15. Cities and areas (OD-113): platform tables with Arabic names; the super admin adds, renames and archives (never deletes; ids stay). Seeded with a list drafted by us (Aleppo and its neighbourhoods, Azaz) that the owner reviews in the PR. A branch gets an optional city and area (the area belongs to the city); archived ones are not offered but stay on branches that hold them. An archived city or area can be restored (audited); it is then offered again.
16. Announcements (OD-115): plain-text body (≤ 280 characters, no links or markup), level information or warning, start, optional end, all clinics or selected ones. Every member of a targeted clinic sees the active ones in clinic web until they dismiss each; a dismissal is kept per person across devices. The super admin edits, ends early and lists them (scheduled, active, ended). Audited. Cancelling a scheduled announcement is ending it before its start. A dismissal holds for the version a person hid: an edited announcement shows to them again. Several show one at a time with «1 من 3», previous and next, warnings first, then newest.
17. Usage (OD-116): a daily counter table per clinic (Damascus day) that later specs add keys to; A-02 counts sign-ins, members signed in that day, active members and active branches, and keeps each clinic's last activity. The clinics list shows last activity and sign-ins in the last 7 days; the clinic page shows 30 days.
18. Audit (A-01a criterion 14) also records type and plan change, override set and removed, flag changed, setting set, locked and unlocked, city and area changes, announcement created, edited and ended.

Added from the A-02-01 drawings (improvements accepted by the owner, 2026-11-27)
19. The clinic page's 30-day usage chart switches between sign-ins and members signed in per day, and shows the total, the daily average (also as a line on the chart), the highest day, the days without activity and the change of the total against the previous 30 days; each day's figure shows in a tooltip.
20. Each limit on «الاشتراك والحدود» has «السجل»: every change of that key for the clinic, newest first (override set, changed, removed or expired, and type changes that moved its plan value), with who, when, the values before and after, and the reason, read from the audit log.
21. The clinics list has a quick filter «بلا نشاط منذ 7 أيام (n)»: the clinics where nobody signed in during the last seven Damascus days (sign-ins in 7 days = 0), combined with the status filter and the search; when none, the list says every clinic was active.
22. Each active or ended announcement shows how many of its targeted members dismissed it («أغلقه 31 من 118 عضوًا»); the targeted members are the non-deactivated members of its clinics, counted when it is read.
23. The announcement form shows a preview of the banner as members will see it, updated as the body and level change.
25. The owner's «الاشتراك» card warns when the subscription ends within 14 days («ينتهي اشتراكك خلال 9 أيام»), with the date and who to contact.
26. The owner's support banner shows the time left, counting down each minute from the server's time.
24. Each city and area shows how many non-archived branches hold it, in how many clinics, and how many doctors work there (non-deactivated members holding a doctor role in one of those branches or clinic-wide in one of those clinics, each counted once); the rename and archive questions name the branches and clinics affected. The figures are counts only, never names, and archived places show the branches that still hold them.

## Edge cases and offline
- A multi-branch clinic with three branches changed to solo keeps them; the preview says new branches are refused.
- An override expires during a session: the next request resolves without it.
- A grant on a clinic without an active owner: nobody sees the banner; the log shows it later.
- Offline: clinic web keeps the last capabilities for display; every gated write is checked on the server.

## Permissions
| Action | Super admin | Owner | Other staff | Support session |
|---|---|---|---|---|
| Overrides, flags, plan through type, locks | ✓ | – | – | – |
| Subscription card, support log, end a grant | – | ✓ | – | – |
| Clinic settings (`clinic.settings.manage`) | lock only | ✓ | – | read |
| Announcement banner | – | ✓ | ✓ | ✓ |
| Cities, areas, announcements, usage | ✓ | – | – | – |
`support.elevate` is reserved in the catalogue and grants nothing in Release 1.

## Money, abuse and privacy
No money (no prices, OD-07). Abuse: a super admin reading a clinic unseen (13, 14); writing through support (12, enforced twice); a stale cache granting more (2); overrun by racing adds (4); phishing through announcements (16, plain text). Tenant scoping: `tenant_override`, `setting_value` (tenant scopes), `support_access_grant`, announcement targets and `usage_daily` carry `tenant_id` with FORCE RLS; `shifa_app` reads only its own and changes only an owner's end of a grant (a column grant, approved at `/db-migration`); plans, flags, cities and announcements are platform tables. Never in logs, spans or errors: support reasons, override reasons, announcement text, phones, tokens. The support grant mechanism is recorded as an ADR in its slice.

## Verification contract
| Criteria | Proof |
|---|---|
| 1–3 | Table-driven resolution tests (plan, add-ons, override, expiry, deny); catalogue start-up test; API tests for type change and override audit |
| 2, 7 | Cache test: change on instance A seen by instance B within the window (fake clock) |
| 4 | API tests per limit and path (add, edit, reactivate, create, restore); concurrent-add test at the limit |
| 5, 6 | Capabilities contract test; route matrix with gated routes off and on; owner-only card |
| 7 | Flag evaluation tests (kill switch, selected, unknown row, missing row) |
| 8–10 | Cascade tests: precedence, locks, `overridable_by`, schema refusal, invalid stored value, source; idle-setting regression |
| 11–14 | API tests: grant rules, every write route 403 (matrix in a support session), read-only transaction, three ways to end, owner banner data and log, audit rows; isolation cases for the new tables |
| 15–18 | API tests for cities, areas, branch city, announcements targeting and dismissal, usage counters against seeded sign-ins, one audit row per event |
| 19–26 | Contract tests of the usage series (30 zero-filled days, previous-period totals) and of the override history (every event kind, before and after values, newest first); browser screenshot against the drawing |
| Screens | Design slice A-02-01: drawings, screen-to-API contract and analysis approved by the owner; API slices: each contract row proven by a contract test; UI code slices: browser screenshot compared with the approved drawing; Playwright journeys against the real backend (override raises a limit; support opened, banner, owner ends it; announcement dismissed) |

## Screens (inventory, ADR-0042; drawn before the API, ADR-0047)
Admin web (desktop, tablet), Arabic RTL, light and dark:
- **Clinic page, «الاشتراك والحدود»**: plan from type, each key with plan value, override (value, reason, expiry) and effective value; set or remove an override; type change with the preview. States: loading, error, expired override shown as such.
- **Clinic page, «الإعدادات»**: keys with effective value and source; set and lock or unlock. State: no keys.
- **Clinic page, «دخول الدعم»**: open (reason, duration), the open grant with time left and «إنهاء», past grants. States: one already open, suspended clinic note.
- **Clinic page, «الاستخدام»**: today's counters, 30-day chart, last activity. State: no data yet.
- **Clinics list**: adds last activity and sign-ins in 7 days.
- **Flags**: each flag with description, mode, selected clinics, reason; change confirmed. State: none declared.
- **Announcements**: list by status; create and edit (body, level, start, end, targets with clinic search); end early. States: empty.
- **Cities and areas**: cities with their areas; add, rename, archive, show archived; Arabic search. State: empty.
Clinic web (desktop, tablet, phone):
- **Support session frame**: the owner view with a fixed banner (reason, end time, «إنهاء»); disabled write actions with «للقراءة فقط». State: ended (back to admin web).
- **Owner support banner** and **support log** card in clinic settings.
- **Announcement banner**: level, text, dismiss; several in turn.
- **«الاشتراك» card** in clinic settings; **limit reached** message in the team and branch forms.
- **Branch form and card**: city and area pickers (Arabic search), shown on the card.
- **Idle setting**: source shown, locked state.

Drawing: all screens in the design slice A-02-01 (checkpoint 1 admin web, checkpoint 2 clinic web), before any API. UI code, after the API: (1) admin web clinic page tabs and clinics list; (2) admin web flags, announcements, cities; (3) clinic web items.

## Out of scope
Prices and billing of plans (OD-07); add-on and plan editing screens; support write elevation; doctor verification, specialty assignment and specialty packs' values (A-11); drug, diagnosis, procedure and template catalogues (A-07, A-08, Phase B and C); WhatsApp session health (A-09); usage counters of later features (their specs); custom-field limit enforcement (A-03); automatic action at the subscription end date; percentage rollouts.

## Open questions
None.
