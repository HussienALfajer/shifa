# A-01-10 UI batch 2: My account, automatic sign-out and admin-web clinics

Status: In progress (checkpoint 1 approved 2026-11-24; checkpoint 2 merged #153; re-enrolment drawing approved 2026-11-24; checkpoint 3 merged #155; checkpoint 4 built 2026-11-24) · Tier: T1 · Branch: `feat/A-01-10-ui-account-settings-admin-web`
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

## Checkpoint 2 — built (2026-11-24)
Clinic web, all in `packages/web-shell/src/account/`: `/account` and `/settings` (router), the app frame (`app-frame.tsx`), My account (`account-page.tsx`, `password-dialog.tsx`, `mfa-card.tsx`, `codes-dialog.tsx`, `devices-card.tsx`), the owner's automatic sign-out (`settings-page.tsx`); reads in `data.ts`. Improvements a–d built. The home placeholder links to «حسابي» until A-01-08 draws home in the frame.

- **Own rotation:** a change of password (OD-92) and a staff enrolment from My account rotate the session. `session.ts` `expectOwnRotation(sessionId)` marks it; the router keeps the page and the cache through that one rotation (same person, clinic and branch); any other new session id still clears the cache and goes home.
- **Owner decision 2026-11-24:** the self re-enrolment of TOTP (OD-98) was accepted after checkpoint 1 and was never drawn. It is drawn on `Account10` for the owner's approval and built after that (checkpoint 3 or 4), not in this checkpoint.
- **Order changed:** CopyField and the copy and share icons are only used on admin web, so they move to the start of checkpoint 3.
- **Locked tests:** with the owner's consent (2026-11-24), two locked tests were corrected: their 429 fixtures sent `until` as a number, but the contract sends an ISO date. No assertion changed.

### Differences from the drawing (`Account10`)
- The bar names the clinic as text; the switcher button and «الفريق» come with A-01-08.
- The password dialog's submit button reads «حفظ كلمة المرور» rather than repeating its title «تغيير كلمة المرور», so the two buttons are not confused.
- The sign-in phone is shown as stored (`+963990030294`), not grouped (`+963 99 003 0294`); grouping per country is left for a shared phone formatter.
- The role line joins several roles in words («مالك العيادة وطبيب»), not with a comma.
- This device is listed first whatever order the server answers in, as drawn.
- Not drawn and added: «حفظ» shows the server error (not only no connection) and names the value still in force.

## Checkpoint 3 — built (2026-11-24)
- **CopyField** (`packages/ui/src/copy-field/`, `/ui-component`): the sheet's states (default, focus selects, copied for three seconds, copy refused selects the value, multiline, icon-only, disabled, loading, LTR English, dark), stories with baselines, README and preview for the design system. Icons `copy` and `share` (Solar Broken) added and synced (`icons:sync`); the icon gallery baseline updated. The design-system sync to the Shifa Design System is the owner's to start (`docs/process/ui-screenshots.md`).
- **Moving TOTP to a new phone** (`packages/web-shell/src/account/reenrol-dialog.tsx`; OD-98, OD-101): «نقل التحقق إلى هاتف جديد» on the MFA card of an enrolled person; the code from the old phone, the new key (QR and key, shared `totp-key.tsx`), the code from the new phone, the ten codes once (shared `codes-once.tsx`); no rotation, the notice says the other devices stay signed in.
- **Admin web** (`packages/web-shell/src/admin/`): `/` the clinics list (DataTable with a link cell, server search after a pause, the status filter with counts, «ينتهي خلال 5 أيام», «لم يُكمل الإعداد»); `/clinics/new` the create form and the owner's link once (`link-shown.tsx`: CopyField, WhatsApp, expiry, QR; leaving before a copy or share asks first, never for `/sign-in`); `/clinics/$id` status and end date, the owner card (masked phone, status, the open link's expiry, new setup link, reset MFA, end sessions, a pending owner's phone corrected). Improvements e–h built.
- **Test harness:** `packages/web-shell/test/setup-layout.ts` gives the DataTable's scroll box a size in happy-dom (no layout there, so its virtual rows drew none).

### Differences from the drawings (`Main`, `Account10`)
- The form fields carry no required asterisk: every field of the form is needed, the form says which one is missing, and the locked tests name the fields by their bare label.
- «أُنشئت» starts hidden in «الأعمدة»: six columns pass the card at 1280 × 800 and squeezed the owner's name; the list is newest first.
- «إنشاء عيادة» and the 404 page's way back are links drawn with Button's look (`admin/button-link.tsx`): @shifa/ui has no link button (backlog).
- The «حفظ» of the clinic page and the error words were not all drawn: a server error and a lost answer have their own words (review 3, 7).

## Checkpoint 4 — built (2026-11-24)
- **Journeys** (`e2e/tests/account-clinics.spec.ts`), against the built API, a real database and the built apps, in order: (1) a third seeded super admin enrols, then on admin web: the clinics list, «إنشاء العيادة» refused before sending, the clinic created, the link copied with «نسخ» (read back from the clipboard, checked as a boolean), «فتح صفحة العيادة» without the leave question, the owner card «بانتظار الإعداد»; the owner opens the copied link, sets the password and enrols; the card then reads «أكمل الإعداد». (2) The owner signs in on a second device (a phone), My account lists both devices with this one first; a wrong current password is a field error, never a sign-out; the change says «أخرجنا أجهزتك الأخرى (1)», the list keeps this device, the other device's next request answers 401 and it lands on sign-in. (3) New recovery codes with a TOTP code: ten new codes, none of the old, «تم» only after «حفظتُ الرموز»; signed out, an old code is refused and a new one signs in («بقي لديك 9 رموز»). (4) A doctor added through the API reads 30 minutes and has no «إعدادات العيادة»; the owner chooses 15 minutes («حفظ» disabled until then), «حُفظ: 15 دقيقة», and the doctor's next request reads 15. (5) The super admin finds the clinic by search, resets the owner's MFA with its confirmation; the owner's session answers 401, the owner signs in, is sent to enrolment and enrols with a new key.
- **Screens** (`e2e/support/look.ts`): each screen on the way is axe clean in light and dark (14 screens, 28 runs). With `E2E_SHOTS=<folder>` each is captured full page; the one-time link, its QR code, the TOTP key and the recovery codes are masked. The seed has a third super admin (`accountAdmin`) so these journeys share no person with A-01-07's.
- No product code changed: the screens were built in checkpoints 2 and 3. The journeys therefore passed on their first run; there was no red phase to see fail.

### Differences from the drawings (screenshots)
The 28 screenshots (14 screens, light and dark) were compared with what checkpoints 2 and 3 recorded against `Account10` and `Main`; nothing new beyond the differences listed there. The drawings themselves could not be opened from this session: the owner compares the screenshots with them. In a full-page capture with a dialog open, the overlay covers only the first 800 px (a capture artefact, not the page).

## Stopped at
Checkpoint 4 built, reviewed and verified (this PR). The slice is done when it merges and the owner has compared the screenshots with `Account10` and `Main`.

## Evidence
- Red phase: the four locked test files failed for the expected reason (no `/account` or `/settings` route: «الصفحة غير موجودة.», no radios).
- `@shifa/web-shell`: 22 files, 193 tests passed (31 new: 11 in `account.test.tsx`, 10 in `account-password.test.tsx`, 6 in `account-sessions.test.tsx`, 4 in `clinic-settings.test.tsx`).
- `pnpm verify` (fast, affected): all green (format, instructions, lint-root, scripts-test, file-length, pub-get, drift, typecheck+lint+test, e2e).
- Real backend (`e2e` harness, a throwaway Playwright walk, not committed; synthetic seed): the first seeded owner through the setup link and enrolment, a second signed-in device (Android user agent), then My account desktop 1280 × 800 light and dark, password dialog with a wrong current password (401 shown under the field, still signed in), renewal code step and the ten codes, renewed notice, end-one confirmation, clinic settings and saved 15 minutes, My account on a phone 390 × 844 (full page and the menu), end-others confirmation and the only-this-device state; axe clean on My account, the password dialog, the codes and the settings page and the phone menu. 26 screenshots, compared with `Account10`: layout, card anatomy, badges, callout tones, dialogs and texts match, differences above. Two fixed on the way: this device first; the phone menu reached past the screen (it is now pinned under the bar with «خروج» in view).
- Reviewer (checkpoint 2): no blocking finding. Fixed, with tests in `account-review.test.tsx` (6): 2 a staff enrolment's rotated session keeps the page and the codes; 3 a failed read of the MFA status, the devices or the setting shows «تعذّر التحميل» with a retry, not an endless skeleton; 4 a failed enrolment start is retried in the dialog; 5 a new password over the contract's 128 characters is refused before sending; 6 the neutral success words when the device list never loaded. Deferred to `docs/backlog.md`: 1 and 7 (a session read racing a rotation, the same pattern as the `/mfa` page of A-01-07), and the ungrouped phone. `@shifa/web-shell` 199 tests after the fixes; `pnpm verify` all green.
- Drawing: the self re-enrolment of TOTP (OD-98) added to `Account10` on 2026-11-24 for the owner's approval: «نقل التحقق إلى هاتف جديد» on the MFA card; step 1 a code from the old phone, step 2 the new key (QR, key, code from the new phone), then the ten codes once; answers ok, 400 `invalid_code`, `clock_skew`, 429 `mfa_locked`, no connection; the notice says the other devices stay signed in (OD-101). **Approved by the owner on 2026-11-24**; built in checkpoint 3 with its tests first (POST /auth/mfa/re-enrol/start with the old code, then /confirm with the new one; 409 `mfa_not_enrolled` re-reads the status, `mfa_not_started` returns to step 1).

### Checkpoint 3
- Red phase: five locked test files failed for the expected reason (`copy-field.test.tsx`: no module; `account-reenrol.test.tsx`: no «نقل التحقق إلى هاتف جديد»; `admin-clinics`, `admin-create`, `admin-clinic`: admin web's `/` was the placeholder home, no `/clinics/*` route).
- `@shifa/ui`: CopyField 27 browser tests (26 locked, both directions, axe light and dark; 1 review), 10 story tests; node tests 316 passed; `ui:screenshots` 283 stories, 9 new CopyField baselines and the icon gallery updated, the rest unchanged.
- `@shifa/web-shell`: 29 files, 243 tests passed (44 new: 9 re-enrolment, 9 list, 7 create, 12 clinic page, 7 review fixes).
- `pnpm verify` (fast, affected): all green on the final tree (one run lost `@shifa/api`'s route-matrix hook to a 60 s Testcontainers timeout and one `idle-dialog` timing flake under load; both passed alone and on the next run; neither file is touched here).
- Real backend (`e2e` harness, a throwaway Playwright walk, not committed; synthetic seed), 1280 × 800, light and dark, 23 screens: the first seeded owner enrols, then on My account moves TOTP (wrong old code, step 2 with the new key, the ten codes, the notice; the session kept); the first seeded super admin enrols, then the clinics list, no match, create refused before sending, 400 on the phone, created with the link once, the leave question, the pending owner's clinic, the new-link confirmation for a pending owner, the phone corrected with the new link, the suspend warning and save, an active owner's clinic, its new-link and reset-MFA confirmations, sessions ended, the 404 page. axe clean on seven of them (move steps 1 and 2, list, create refused, created link, pending owner's clinic). The drawings could not be opened from this session: the owner compares the screenshots with `Main` and `Account10`; differences known are listed above. Fixed on the way: the owner and end-date cells wrapped out of their 48 px row; the table passed the card.
- Reviewer (checkpoint 3): one blocking finding, fixed with tests in `checkpoint3-fixes.test.tsx` and `copy-field.review.test.tsx`: 1 closing the re-enrolment dialog (or the renewal) while the confirm was with the server lost the new codes; now neither closes while a code is in flight. Also fixed: 2 a replaced link kept the last one's «نُسخ» and skipped the leave question; 3 a lost answer said "nothing changed" (now: unknown, the card read again); 4 a 409 `owner_setup_pending` on an owner action closed with no word; 5 `mfa_not_started` went back to step 1 with no word; 6 a status with no clinic said «لا عيادة بهذا الاسم»; 7 a server error on save showed the no-connection icon; 8 the router's own navigations (another session behind the page, a session ended) now pass the leave guard; 9 CopyField's status region stays mounted; 10 inputs keep the contract's lengths. Deferred to `docs/backlog.md`: a lost create answer can make a duplicate clinic on retry, and a lost re-enrolment confirm leaves the person unsure which phone works.
