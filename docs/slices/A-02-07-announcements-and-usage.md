# A-02-07 Announcements and daily usage

Status: Planned · Tier: T0 · Branch: `feat/A-02-07-announcements-and-usage`
Spec: [A-02](../specs/platform/A-02-settings-entitlements-console.md) criteria 16–18 · Requirements: PLT-16, PLT-18, PLT-47 · Decisions: OD-115, OD-116 · From A-02-01: criteria 16 (amended), 19, 22

After [A-02-06](A-02-06-cities-areas-branch-place.md) (merged). Last API slice of A-02.
Contract: delivers the rows of the [A-02 screen contract](../specs/platform/A-02-screen-contract.md) that name this slice, each proven by a contract test (ADR-0047); a change forced during the build updates the row and its drawing here and is reported to the owner.

## Goal
The super admin posts plain-text announcements to all or selected clinics and every targeted member sees and dismisses them; the platform keeps a daily counter per clinic and the clinics list shows last activity and sign-ins.

## Plan
1. **Contracts** — `Announcement` (body ≤ 280 plain text, level `info | warning`, starts_at, ends_at, target `all | selected` with clinic ids, status `scheduled | active | ended`), create, edit and end requests; `ActiveAnnouncements` for clinic web; `UsageDay` (day, key → value), `ClinicUsage` (today, 30 days, last activity); `ClinicSummary` gains `lastActivityAt` and `signIns7d` (additive); codes `announcement_body_invalid`, `announcement_ended`.
2. **Database** (`/db-migration`, `/rls-policy`; expand only)
   - `announcement` (platform table) and `announcement_target` (tenant_id, FORCE RLS; `shifa_app` reads its own); `announcement_dismissal` (user id, announcement id; per person across devices and clinics; `shifa_app` inserts and reads only the current user's rows).
   - `usage_daily` (tenant_id, day in Asia/Damascus, key, value; unique per tenant, day, key): FORCE RLS; written by an upsert on the paths that count; `shifa_platform` reads all for the console.
   - `tenant.last_activity_at` (or a `usage_daily` read; the slice picks the cheaper and says why).
3. **API**
   - Announcements: platform `GET /platform/announcements?status=`, `POST`, `PATCH /:id`, `POST /:id/end`; the body refuses links (URL and domain patterns) and markup, stored and returned as plain text; clinic `GET /announcements/active` (`@SignedIn` with an active clinic, support sessions included) and `POST /announcements/:id/dismiss` (allowed for the person, never in a support session: 403 as every write).
   - Usage keys in code (`USAGE_KEYS`, later specs add theirs): `sign_ins`, `members_signed_in` (distinct per day, no list of people kept beyond the day), `active_members`, `active_branches`; counted on sign-in (auth path, the sign-in's clinic) and when members or branches change; last activity on the principal's request touch (at most once a minute, as `membership.last_active_at`).
   - Platform: `GET /platform/clinics/:id/usage` (30 days); clinics list gains the two columns.
   - Audit: `announcement.created`, `announcement.edited`, `announcement.ended` (ids, level, target count; never the body).
4. **Web, Flutter** — none (UI code slices A-02-08, A-02-09, A-02-10).
5. **End-to-end** — none.

Tests written first: body rules (length, a link, markup refused) (16); targeting all and selected, scheduled not shown, ended not shown (16); dismissal per person across two sessions and kept across clinics (16); end early and edit (16); usage counters against seeded sign-ins, the Damascus day boundary on a fake clock, distinct members (17); clinics list columns and 30-day series (17); audit rows without the body (18); isolation cases for `announcement_target`, `announcement_dismissal`, `usage_daily`.
Estimated hand-written lines: ~3,550 (contracts ~320, database ~520, announcements ~900, usage ~660, tests ~1,100). Re-estimated at A-02-01 checkpoint 3 (owner, 2026-11-27).

## From A-02-01 (re-plan approved by the owner, 2026-11-27)
The [screen contract](../specs/platform/A-02-screen-contract.md) is the reference: where this file's earlier plan names a route or field differently, the contract wins. Rows owned by this slice:
Names in the earlier plan above that the contract replaces: the body refusals are `validation_failed` and 400 `announcement_link` (not `announcement_body_invalid`); the clinic route is `GET /me/announcements` (not `/announcements/active`).
- Announcements: `GET /platform/announcements?status=` with `counts`, `dismissedCount`, `targetedMembers` (criterion 22); `POST`, `PATCH`, `POST …/end` (cancel a scheduled one = end it); 400 `announcement_link`, 409 `announcement_ended`.
- Clinic web: `GET /me/announcements` (with `version`; warnings first, then newest), `POST /me/announcements/:id/dismiss` with `version` (an edited announcement shows again, criterion 16).
- Usage: `GET /platform/clinics/:id/usage` (`todayCounts`, `members`, `branches`, `lastActivityAt`, 30 zero-filled `days` with both series, `previousTotals`; criteria 17, 19); `lastActivityAt` and `signIns7d` on `GET /platform/clinics`.
- `dismissedCount` and `targetedMembers` use the integers-only function mechanism of A-02-06 (its ADR). ~50 lines more.

## Stopped at
Planned.

## Evidence
- `verify` (full): —
- Isolation suite: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- After this slice every A-02 route exists: the three UI code slices can start; their drawings are already approved (A-02-01).
