# A-01-10 UI batch 2: My account, automatic sign-out and admin-web clinics

Status: In progress (checkpoint 1 approved 2026-11-24; waiting for A-01-11) · Tier: T1 · Branch: `feat/A-01-10-ui-account-settings-admin-web`
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) screens "My account", "Clinic settings · automatic sign-out", "Clinics list", "Create clinic", "Clinic detail"; criteria 3, 4, 9, 10, 10a, 10b, 12a, 13 as seen by the user; verification rows "Flows" and "Screens" · Requirements: PLT-01, PLT-10, PLT-19, PLT-48 · Decisions: ADR-0040, ADR-0042, ADR-0046, OD-79, OD-80, OD-94

After [A-01-07](A-01-07-ui-sign-in-screens.md) and [A-01-09](A-01-09-account-api-gaps.md) (merged). Split from the first A-01-07 plan in the 2026-11-24 re-plan.

## Goal
A person manages their own account on clinic-web (password, MFA and recovery codes, sessions); the owner sets the clinic's automatic sign-out; the super admin lists, creates and edits clinics on admin-web and resets an owner.

## API used
| Screen | Routes |
|---|---|
| My account | `GET /me`, `POST /auth/password`, `GET /auth/mfa`, `POST /auth/mfa/recovery-codes`, `POST /auth/mfa/enrol/start|confirm` (staff who enrol from here), `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/sessions/end-others` |
| Automatic sign-out | `GET /clinic/settings`, `PATCH /clinic/settings` (owner only, `clinic.settings.manage`) |
| Clinics list | `GET /platform/clinics?search=` |
| Create clinic | `POST /platform/clinics` → `SetupLinkIssued` (url, `whatsappUrl`, `expiresAt`) once; 409 states |
| Clinic detail | `GET /platform/clinics/:id`, `PATCH /platform/clinics/:id`, `POST …/owner/setup-link`, `POST …/owner/reset-mfa`, `POST …/owner/end-sessions` |

A wrong current password on `POST /auth/password` answers 401 `invalid_credentials`: a field error on the form, never a sign-out (the web shell ends the session only on 401 `unauthorized` or `session_expired`, A-01-09). Its success rotates the cookie and ends the other sessions (OD-92); 429 `phone_locked` carries `until`.

## Plan
### Checkpoint 1 — draw, analyse, owner approval (ADR-0042, OD-80); no code before approval
- Shifa Design System README read first; Shifa Guide rules kept. Clinic web on "Shifa Screens · Clinic web", page "A-01 Foundation"; admin web on a new "Shifa Screens · Admin web" canvas with the system installed.
- Screens: My account (desktop, phone): profile, password, MFA with codes left and renewal, sessions with this device marked; Automatic sign-out (desktop); Clinics list, Create clinic with the link shown once, Clinic detail with the owner card (desktop).
- Prototype in Play with every state reachable (password rules, wrong current password, phone locked, two or fewer codes left, no other session, ending all others, settings saved, empty and loading lists, link shown once, each owner action confirmed); light and dark; Arabic RTL; synthetic data from `@shifa/testing` only.
- Analysis (ADR-0046): the route, field and error table for every route above, API gaps and anything unprofessional in the API, spec gaps, creative improvements with costs.
- Missing components drawn in this checkpoint on their own sheet with every state and at once on their screens (likely: **Copy field** with WhatsApp share for the one-time link, a **status chip** for clinic status in words); approved or changed by the owner, then built with `/ui-component` and synced before checkpoint 2.

### Checkpoint 2 — My account and automatic sign-out (clinic web)
### Checkpoint 3 — admin web: clinics list, create, detail
### Checkpoint 4 — journeys, screenshots, review
Playwright against the real backend: super admin creates a clinic in admin-web → copies the link → the owner journey of A-01-07 runs from that link; owner changes the password and the other session ends; owner renews the recovery codes and an old one is refused; owner sets 15 minutes and a second member's next request reads it; super admin resets the owner's MFA and the owner enrols again. Screenshots against the real backend, light and dark, compared with the approved drawings; axe clean; `reviewer` agent; `security-reviewer` on the one-time link and code handling in the client.

Tests written first: component tests per screen state; the five journeys; screenshot comparisons.
Estimated hand-written lines: ~3,400 (My account ~1,000, settings ~200, admin web ~1,100, i18n ~400, journeys ~700); missing components are separate `/ui-component` work.

## Drawings and analysis
Drawn 2026-11-24 (links not committed, ADR-0040). On "Shifa Screens · Clinic web", new page "A-01-10 Account batch": one interactive prototype (`Account10`, marked interactive, Play), the analysis board (`Analysis10`, Arabic, for the owner) and the sheet of the one missing component (`CopyFieldSheet`). On "Shifa Screens · Admin web", new page "A-01-10 Clinics": one interactive prototype (`Main`); the Shifa Design System was installed there for the first time (version `1795473355-da6b`, tokens, component bundle and fonts copied from the system, logos copied from the clinic-web canvas). The clinic-web canvas's installed copy has the same `tokens.css`, `tokens.json` and bundle hashes as that version. The 2026-11-23 draft `Account` on page "A-01 Foundation" stays there as a draft; `Account10` supersedes it. Colours, spaces, radii, shadows and sizes are `--shifa-*` tokens and type uses the named styles; both prototypes were checked for unknown `--shifa-` names before showing (one, a component-level input token, was replaced with `--shifa-color-bg-surface`). Callout, QrCode and CodeList (built in A-01-07) are not yet in the synced bundle, so they are drawn by hand from their approved sheets. **Approved by the owner on 2026-11-24: all screens of both prototypes, the CopyField component, every improvement (a–h) and the gap list; API gaps 1 and 3 accepted (OD-98, OD-99); all three statuses at creation kept (OD-100).** API gaps 1–7 are closed in the T0 slice [A-01-11](A-01-11-account-platform-api-gaps.md) before checkpoint 2.

### The prototypes
**Clinic web (`Account10`).** A control panel outside the device frame switches theme (light, dark), size (desktop 1280 × 800, phone 390 × 844), the person (owner with mandatory TOTP; doctor with TOTP; receptionist without TOTP), recovery codes left (9, 2, 0), the sessions (four devices, one with unknown device and browser; this device only), a loading state, and the server's answer to the next press (per context, every error code of the table below; it falls back to success after each press). Flows that run end to end: change password → wrong current password, each refused rule, unchanged, phone locked with a live countdown, no connection, success (other devices signed out, the list keeps this device only); new recovery codes → TOTP code → wrong code, MFA locked, success → ten codes shown once, copy, print, «حفظتُ الرموز» required → «بقيت 10 رموز»; a receptionist enrols from My account (QR, key with copy, code, clock-skew hint, codes); end one device (confirm naming it; 404 "already signed out" refreshes the list); end all others (confirm with the count; no-other-device state); owner → clinic settings → 15 / 30 / 60 with a description each → save (success, no connection). Non-owners have no "Clinic settings" item. Each creative improvement has a checkbox.

**Admin web (`Main`).** Theme, list (five clinics, none, loading), server answers and a "go to" list (list, create, active clinic, owner not set up, suspended clinic). Flows: list → search (no-match state) → status filter with counts → clinic; create → empty name or owner refused before sending, invalid phone (400 on `body.ownerPhone`), `owner_setup_pending` with what to do, no connection (input kept) → success with the link shown once (copy, WhatsApp, expiry; a phone ending in 2876 has an account, so the link is an invitation and the wording changes) → leave before copying asks first; detail → status and end date (a warning when choosing suspended) → save; owner card → new setup link (confirm worded for a pending or an active owner) → link shown once; reset MFA and end sessions (active owner only, each confirmed); 404 page.

### Route, field and error table (ADR-0046)
| Route | Fields: shown, driving a state, or not shown (why) | Errors and states drawn |
|---|---|---|
| `GET /me` | `name` card and avatar; `phoneE164` «رقم الدخول», read-only, with who to ask to change it. Not shown: `userId` (id) | loading: Skeleton |
| `POST /auth/password` | current, new, repeat; the `SessionView` answer re-reads the session (cookie rotated) | 401 `invalid_credentials` under the current password, never a sign-out; 400 `password_too_short`, `password_common`, `password_contains_phone`, `password_unchanged` under the new one, rule named; 429 `phone_locked` with `until`: Callout with countdown, fields disabled; mismatch checked before sending; no connection. Success: «أخرجنا أجهزتك الأخرى (3)», list keeps this device |
| `GET /auth/mfa` | `enrolled` badge and which actions show; `enrolledAt` «مفعّل منذ …»; `recoveryCodesLeft` info (3+), warning (1–2), danger (0) | loading |
| `POST /auth/mfa/recovery-codes` | TOTP code, then `recoveryCodes` once (copy, print, saved check) | 400 `invalid_code`; 429 `mfa_locked` with countdown; 409 `mfa_not_enrolled` not reachable (button only when enrolled); no connection |
| `POST /auth/mfa/enrol/start`, `confirm` | staff without TOTP: `otpauthUri` QR, `manualKey` with copy; then `recoveryCodes` | 400 `invalid_code`, `clock_skew`; 429 `mfa_locked`; 409 `mfa_already_enrolled`, `mfa_not_started`: re-read the status |
| `GET /auth/sessions` | `device` · `browser` (null: «جهاز غير معروف»); `createdAt` «دخل …»; `lastActiveAt` «آخر نشاط قبل …»; `current` «هذا الجهاز», no end button. Not shown: `id` | loading; no other session |
| `DELETE /auth/sessions/:id` | confirm naming the device; 204 | 404: «كان هذا الجهاز قد خرج», list refreshed; no connection |
| `POST /auth/sessions/end-others` | `ended` in the success message | no connection |
| `GET`, `PATCH /clinic/settings` | `idleMinutes` 15 / 30 / 60, each with a use; owner only (no nav item for others) | loading; saved («يسري من الطلب التالي»); no connection (old value named); 403 not reachable |
| `GET /platform/clinics?search=` | `name` (link), `type` in words, `status` Badge, `subscriptionEnd`, `ownerName`, `createdAt`. Not shown: `id` | loading; empty; no match; no connection |
| `POST /platform/clinics` | all fields; `ownerLink.url`, `whatsappUrl`, `expiresAt` once; `purpose` setup or invitation wording; `clinic` opens its page | 400 `validation_failed` on `body.ownerPhone` under the phone; 409 `owner_setup_pending` Callout with what to do; no connection, input kept |
| `GET`, `PATCH /platform/clinics/:id` | status and end date editable; `owner.name`; `owner.status` (pending, active, deactivated) drives the owner actions. Not shown: `owner.membershipId` | 404 page; no connection; suspend warning |
| `POST …/owner/setup-link` | confirm worded for pending or active owner; link once | 404; no connection |
| `POST …/owner/reset-mfa`, `…/owner/end-sessions` | active owner only, each confirmed | 404; no connection |

### API gaps (to close in the API before or in this slice, never worked around in the client)
1. **Moving TOTP to a new phone oneself:** no route; `enrol/start` answers 409 to an enrolled person, so someone who changes phone while still holding the old one needs the owner (staff) or the super admin (owner). Proposal: a re-enrolment confirmed by a current code (the old secret stays until the new one is confirmed). Or it stays with the owner and the super admin by decision. **Accepted (OD-98).**
2. **Owner phone missing on clinic detail:** the super admin sends a reset link without seeing whom it is for. Proposal: `owner.phoneMasked` (country code and last three digits, as the setup page).
3. **Wrong owner phone cannot be corrected:** a typo at creation leaves a clinic whose link is for the wrong number. Proposal: edit the owner's phone while the owner is pending. **Accepted (OD-99).**
4. **Pending owner's link expiry not returned:** proposal `owner.linkExpiresAt`, so the page says «انتهى الرابط» and offers a new one.
5. **Owner status not in the list:** `ClinicSummary` has no `ownerStatus`; proposal: add it, so a row can say «لم يُكمل الإعداد».
6. **No-op actions answer success:** `reset-mfa` and `end-sessions` for a pending owner answer 204 and do nothing. Proposal: 409 `owner_setup_pending`. The client hides both anyway.
7. **Undeclared statuses:** 400 on `platformCreateClinic` and `platformUpdateClinic`; 400 and 403 on `clinicUpdateSettings`.
8. **Not gaps for Release 1:** no paging or status filter on `/platform/clinics` (few clinics; filtered in the client); no "password last changed" and no "settings changed by" (the audit log holds them).

### Spec gaps (to add to A-01a)
1. A non-owner has no "Clinic settings" item.
2. My account on a phone: one column, navigation behind a menu button.
3. Staff enrol from My account with the same steps as A-01-07 (QR, key, code, codes).
4. Status at creation: the spec allows suspended; all three are drawn. All three kept (OD-100).
5. The new-setup-link confirmation says what happens: for an active owner the password is cleared and every session ends.

### Creative improvements (each toggled in a prototype; the owner accepts or declines each)
| | Improvement | Cost |
|---|---|---|
| a (أ) | Password rules ticked while typing (as on the setup page) | ~40 lines, reuses A-01-07 |
| b (ب) | Header badge when two or fewer recovery codes are left | ~40 lines |
| c (ج) | «حفظ» disabled until the sign-out time changes | ~10 lines |
| d (د) | Hide «إخراج كل الأجهزة الأخرى» when there is no other device | ~5 lines |
| e (هـ) | QR code of the link beside it on admin web, for an owner who is present | ~20 lines with QrCode |
| f (و) | Clinics filtered by status with counts | ~50 lines |
| g (ز) | «ينتهي خلال 5 أيام» badge near the subscription end | ~25 lines |
| h (ح) | Ask before leaving the link page without copying the link | ~30 lines |

Accepted by the owner 2026-11-24: all eight. Declined: none.

### Components
- **New: CopyField** (sheet `CopyFieldSheet`): a value shown once to copy or send, read-only, LTR monospace, copy inside at the logical end, optional WhatsApp share and expiry line; states default, focus (text selected), copied, copy refused (text selected, copy by hand), multiline and icon-only copy on a phone, disabled (replaced link), loading, LTR English, dark. Used here and for the member link in A-01-08. Built with `/ui-component` after approval.
- **No new status chip:** Badge's locked tones carry clinic status in words with their icon (trial info, active success, suspended warning).
- **Missing icons:** copy and share (Solar Broken), added in `packages/ui` and synced; drawn meanwhile with `file-text` and `arrow-forward`.
- Callout, QrCode and CodeList await the design-system sync (the owner starts it). DataTable in the bundle takes no row press, so the clinics table is drawn by hand at its sizes; in code it is DataTable with a link cell (Enter opens the row).

### Not done in this checkpoint
Tests and code: the plan's tests are written after the approval (no code before it, OD-80).

## Stopped at
Checkpoint 1 approved by the owner (2026-11-24). Next: the API gaps in [A-01-11](A-01-11-account-platform-api-gaps.md) (T0), then CopyField with `/ui-component` and the copy and share icons, synced, then checkpoint 2 with its tests first.

## Evidence
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —
