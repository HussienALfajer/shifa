# A-01-07 UI batch 1: sign-in, MFA, setup link and clinic chooser screens

Status: Checkpoint 1 approved by the owner 2026-11-24; checkpoint 2 PR open 2026-11-24 · Tier: T1 · Branch: `feat/A-01-07-ui-sign-in-screens` (checkpoint 2 on the cloud session's branch `claude/zealous-goldberg-tcd580`, docs/process/cloud-sessions.md §4)
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) screen inventory (Sign in, Setup link, TOTP enrol, TOTP challenge, Idle warning), verification rows "Flows" and "Screens"; criteria 4–7, 9, 11, 12 as seen by the user; [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) screen "Clinic chooser", criterion 10 (after sign-in) · Requirements: PLT-01, PLT-05, PLT-10, PLT-19, PLT-48 · Decisions: ADR-0040, ADR-0042, ADR-0046, OD-79, OD-80, OD-91, OD-94

After [A-01-06](A-01-06-web-shells-and-e2e-harness.md) (merged). Checkpoint 1 (drawing and analysis) starts now; its approved API gaps are built in [A-01-09](A-01-09-account-api-gaps.md), and checkpoint 2 (code) starts after A-01-09 merges, so the batch codes against the whole API (ADR-0042). Re-planned 2026-11-24 against the merged API (A-01-02 to A-01-05): the entry path from the first link to the first clinic is one batch; the clinic chooser moved here from A-01-08 (it is the last step of signing in); My account, the automatic sign-out setting and the admin-web screens moved to [A-01-10](A-01-10-ui-account-settings-admin-web.md), after the account API gaps found in this re-plan are closed by [A-01-09](A-01-09-account-api-gaps.md).

## Goal
A person gets from a setup link or the sign-in page to their first clinic on clinic-web: sets a password, enrols TOTP and keeps the recovery codes, passes the challenge (or uses a recovery code), picks a clinic and branch when they have several, is warned before the idle limit and returned to sign-in after it. The same sign-in, setup-link and TOTP screens serve admin-web, so the super admin can get in before A-01-10 draws the clinics screens.

## API used (every route of the entry path)
| Screen | Routes | Answers drawn as states |
|---|---|---|
| Sign in | `POST /auth/sign-in`, `GET /auth/session` | 401 `invalid_credentials` (one message); 429 `phone_locked`, `ip_blocked` with `until`; network failure; `?reason=session_expired|idle|not_admin` from the shell guard |
| Setup link | `POST /auth/setup-link/view`, `POST /auth/setup-link/consume` | `SetupLinkView` by `purpose` (owner, member, admin) and `role`; 404 `link_invalid`; 400 `password_too_short`, `password_common`, `password_contains_phone`; 409 `owner_setup_pending`; `purpose: invitation` hands over to the invitation page (A-01-08) |
| TOTP enrol | `POST /auth/mfa/enrol/start`, `POST /auth/mfa/enrol/confirm` | QR from `otpauthUri`, `manualKey`; 400 `invalid_code`, `clock_skew`; 429 `mfa_locked` with `until`; 409 already enrolled; the ten `recoveryCodes` shown once |
| TOTP challenge | `POST /auth/mfa/challenge` (`method: totp | recovery`) | 400 `invalid_code` (wrong or replayed); 429 `mfa_locked` with `until`; 409 no challenge owed |
| Clinic chooser | `GET /me/clinics`, `POST /me/switch`, then `GET /auth/session` | clinics last used first with roles, last activity and branches; `selectable: false` (suspended); 404 `no_clinic`; open invitations listed (OD-91: answered on their link only); 403 `clinic_suspended`, `branch_not_held`; 409 `branch_archived` |
| Idle warning and sign-out | `GET /auth/session` (continue), `POST /auth/sign-out` | `idleExpiresAt`, `absoluteExpiresAt`; any 401 → sign-in with the reason |

The rest of the API is used by the later batches: own sessions, clinic settings and `/platform/clinics/*` by A-01-10; team, branches and invitations by A-01-08.

## API and spec gaps found while re-planning (for the owner, before drawing)
Gaps are closed in the API (A-01-09), never worked around in the client.
1. **No name for the signed-in person.** `SessionView` and `MyClinics` carry ids and roles only, so the chooser cannot greet the person and the header cannot show who is signed in. → A-01-09: `GET /me` (name, phone).
2. **No recovery codes left.** After a recovery-code sign-in the person cannot be told how many remain, and no route makes new ones. → A-01-09: `GET /auth/mfa` (enrolled, codes left) and `POST /auth/mfa/recovery-codes` (new set, confirmed with a TOTP code). This batch shows «بقي لديك N رموز» after a recovery sign-in, and a warning when two or fewer are left.
3. **No change of password** although My account lists it (A-01a screens). → A-01-09: `POST /auth/password`. Used in A-01-10.
4. **Contract mismatch:** `authSetupLinkConsume` answers 400 for the password rules but declares only 404 and 409; the client types the 400 codes from the contract. → A-01-09 declares the 400.
5. **Spec gap, phone-only setup:** the owner opens the link on their phone and cannot scan a QR shown on that same phone. → spec addition: on phone sizes the enrol screen leads with «فتح في تطبيق المصادقة» (the `otpauth://` link) and the manual key with copy; the QR leads on desktop and tablet.
6. **Spec gap, chooser invitations:** A-01b's chooser says "accept and decline", narrowed by OD-91 to "listed; answered on their link". → the spec text is updated; the card says to open the link the clinic sent.
7. **Spec gap, branch choice:** a person holding roles in two branches of one clinic must pick the branch; the inventory lists clinics only. → the chooser opens the clinic's branches as a second step (`MyClinic.branches`).

## Plan
### Checkpoint 1 — draw, analyse, owner approval (ADR-0042, OD-80); no code before approval
- Read the **Shifa Design System** README first; keep the **Shifa Guide** rules. Clinic web in "Shifa Screens · Clinic web" (review and replace the 2026-11-23 drafts on page "A-01 Foundation"); the system installed on the canvas (tokens, type styles, fonts, component bundle).
- Screens: Sign in (desktop, tablet, phone); Setup link (phone, desktop; owner, member and admin variants); TOTP enrol in three steps — app, key (QR on desktop, «فتح في تطبيق المصادقة» on phone), code — then recovery codes (desktop, phone); TOTP challenge with the recovery-code mode (desktop, phone); Clinic chooser with the branch step (desktop, tablet, phone); Idle warning (all sizes); signed-out notice on sign-in (expired, idle).
- Working prototype in Play: every artboard interactive; flows link → password → enrol → recovery codes → chooser → clinic; sign in → challenge → recovery code → «بقي لديك 9 رموز» → clinic; sign in → several clinics → clinic with two branches → branch; idle warning → continue, and → signed out. Every state in the table above reachable; light and dark and the sizes switchable; Arabic RTL; synthetic names and phones from `@shifa/testing` only.
- Creative improvements, each drawn and costed for the owner to accept or decline (declined ones listed here):
  a. Password hint that ticks the length rule as the person types and names the server's refusal in words (~60 lines).
  b. Lock countdown: the phone-locked and MFA-locked states count down to `until` and re-enable the form by themselves (~80 lines).
  c. Recovery codes: copy all, print sheet with the clinic name and date, and «حفظتُ الرموز» required before continuing (~120 lines, with the component).
  d. Paste-anywhere OTP: a six-digit code pasted or filled by the phone's keyboard submits at once (~40 lines; `OtpInput` already accepts paste).
  e. Chooser cards: clinic initials, role chips, «آخر نشاط» in relative words, suspended card with the reason; the last used clinic marked (~150 lines).
  f. Absolute-limit notice: ten minutes before the 12-hour limit a quiet banner says the session ends at a time (~70 lines).
  g. Caps-lock and Arabic-keyboard hint on the password field (~50 lines).
- Checked before showing: no literal colour, no unknown `--shifa-` name, no hand-drawn copy of an existing component; result written here.
- Analysis written here and shown with the drawings (ADR-0046): the route, field and error table (every field of `SessionView`, `SetupLinkView`, `TotpEnrolStart`, `MfaEnrolled`, `MyClinics` and `ErrorBody.until` shown, driving a state, or named with the reason it is not), the gaps above confirmed or extended, anything unprofessional in the API, creative improvements with costs.
- Missing components drawn in this checkpoint (ADR-0046): likely **Callout** (inline page message: locked, blocked, unreachable, expired, suspended), **QR code**, **Code list** (recovery codes with copy and print). Each is drawn on its own sheet with every state (light and dark, RTL and LTR, both densities) and at once on every screen that needs it; the owner approves it or asks for changes. After approval each is built with `/ui-component` from that sheet and synced to the Shifa Design System before checkpoint 2 uses it (in this PR if the budget allows, else its own PR first).

### Checkpoint 2 — shared auth screens and sign-in
The screens live in `packages/web-shell` (replacing the placeholder `ShellPages` for sign-in, setup, MFA) so clinic-web and admin-web share them. Forms on `@shifa/ui` (Form, Field, Input, Password Input, OTP Input, Button, Alert Dialog, Callout); the phone typed in any digit form and sent as typed (the server normalises); error codes mapped to Arabic texts in `@shifa/i18n` (one message for a wrong phone or password); lock end times in the clinic's time format; the guard's reasons shown as a notice.

### Checkpoint 3 — setup link and TOTP
Token read from the URL fragment and removed from history at once (`history.replaceState`), never sent in a URL or logged; view → password twice → consume; then enrol (start, QR or `otpauth://` link, manual key with copy, code, clock-skew hint) → recovery codes once (copy, print, confirm) → onward; challenge with the recovery-code mode. Routing after each step follows `SessionView` (`mfa`, `mfaRequired`, `tenantId`, `platformAdmin`) through the shell guard.

### Checkpoint 4 — clinic chooser, idle warning, sign-out
One clinic → straight in; several → chooser (last used first); a clinic with several held branches → branch step; `POST /me/switch` then the session re-read and the Query cache cleared; suspended and no-clinic states; invitations listed with "open the link the clinic sent you". Idle dialog from the shell's timer (countdown from 1:00, «متابعة العمل» re-reads the session, «خروج الآن» signs out), synchronised across tabs; any 401 → sign-in with the reason.

### Checkpoint 5 — journeys, screenshots, review
Playwright against the real backend: (1) super admin seeds a clinic through the API → owner opens the link in the page → password → TOTP with codes from the test's own authenticator → recovery codes → signed in to the clinic; (2) sign in → challenge → recovery code → in, and the same code refused the second time; (3) a person in two clinics → chooser → clinic → branch, and a suspended clinic not selectable; (4) idle warning and sign-out with a short idle setting; (5) the super admin's first sign-in on admin-web through the same screens to enrolment. Browser screenshots against the real backend, light and dark, at the listed sizes, compared with the approved drawings; every difference fixed or explained here. axe clean; keyboard path through sign-in, challenge and chooser. `reviewer` agent; `security-reviewer` on the token, code and session handling in the client.

Tests written first: component tests per screen state (mocks typed from contracts allowed), one per row of the API table; the five Playwright journeys (Flows row; criteria 4, 5, 6, 7, 9, 11, 12; A-01b 10); screenshot comparisons (Screens row).
Estimated hand-written lines: ~3,600 (sign-in ~450, setup link ~400, enrol and recovery codes ~650, challenge ~300, chooser ~550, idle and notices ~250, i18n texts ~400, journeys ~600); the approved new components are `/ui-component` work, not counted here.

## Drawings and analysis
Drawn 2026-11-24 in "Shifa Screens · Clinic web", page "A-01-07 Sign-in batch" (link not committed, ADR-0040): one interactive prototype (`Main`, marked interactive, Play), the analysis board (`Analysis`, Arabic, for the owner) and three component sheets (`CalloutSheet`, `QrCodeSheet`, `CodeListSheet`). The Shifa Design System installed on the canvas is current (its `tokens.json`, `tokens.css` and bundle hashes equal the system's version `1795473355-da6b`). The 2026-11-23 drafts of sign-in, setup link, MFA and switcher on page "A-01 Foundation" are kept there, marked superseded; the desktop sign-in draft (`Main`) became the prototype. **Approved by the owner on 2026-11-24: all screens, the three components, every improvement (a–j) and the gap list; staff MFA recovery by the owner (OD-95).**

### The prototype
One artboard keeps the whole entry path in one state (ADR-0042). A control panel outside the device frame switches theme (light, dark), size (desktop 1280 × 800, tablet 768 × 1024, phone 390 × 844) and app (clinic web, admin web); where to start (sign-in page; owner, member, admin, invitation or expired setup link); the account signing in (doctor with TOTP, owner not yet enrolled, staff without TOTP, super admin); the person's clinics (one, several, none); and the server's answer to the next press (per screen, every error code of the table below; it falls back to success after each press). Fields take typing (the password rules, Caps Lock and Arabic-letter hints read what is typed), a six-digit code submits itself, lock and idle countdowns run in real time (the idle limit is shortened to 75 s, with buttons to jump to the warning, to the 12-hour notice and to a session ended elsewhere), and a "go to" list reaches every screen directly. Each creative improvement has a checkbox, so the owner sees the screens with and without it.

Flows that run end to end: owner link → password → enrol (app, key, code) → recovery codes → clinic; member link → password → clinic; admin link → password → enrol → codes → admin home; sign-in → challenge → recovery code → «بقي لديك 9 رموز» (or the two-left warning) → chooser or clinic; sign-in → several clinics → clinic with two branches → branch → clinic; a suspended clinic not selectable, and suspended during the switch; idle warning → continue, → sign out now, → signed out by the timer with the notice; a non-admin on admin web → sign-in with «هذه صفحة إدارة شفاء».

### Route, field and error table (ADR-0046)
| Route | Fields: shown, driving a state, or not shown (why) | Errors and states drawn |
|---|---|---|
| `POST /auth/sign-in` | `SessionView` → routing (next row) | 401 `invalid_credentials`: one message under the password; 429 `phone_locked`, `ip_blocked` with `until`: Callout with countdown, inputs disabled; network/5xx: Callout with retry; 400 `validation_failed`: not reachable (both fields required before sending) |
| `GET /auth/session` | `platformAdmin` admin web or the not-admin notice; `mfa`, `mfaRequired` challenge or forced enrolment; `tenantId` straight in or chooser; `branchId` branch name in the bar (name from `/me/clinics`); `idleMinutes` text of the idle dialog and sign-out notice; `idleExpiresAt` when the warning opens and its countdown; `absoluteExpiresAt` 12-hour notice (improvement f). Not shown: `userId`, `sessionId` (ids; cross-tab sync and "this device" in A-01-10), `roles` (navigation and permissions, A-01-08) | 401 → sign-in with the reason |
| `POST /auth/sign-out` | 204 | sign-in with «خرجت من حسابك» |
| `POST /auth/setup-link/view` | `clinicName` title (null: «إدارة شفاء»); `personName` person card and print sheet; `role` role line; `purpose` variant (owner, member, admin), `invitation` hands over to the invitation page (A-01-08); `expiresAt` «صالح حتى … (بعد يومين)» | loading: Skeleton; 404 `link_invalid`: one message, no clinic name; a malformed fragment: the same message without a request |
| `POST /auth/setup-link/consume` | `SessionView` → owner and admin to enrolment, member to the clinic | 400 `password_too_short`, `password_common`, `password_contains_phone` under the field, rule named; 404 `link_invalid` (expired while typing); 409 `owner_setup_pending`: Callout; mismatch: checked before sending |
| `POST /auth/mfa/enrol/start` | `otpauthUri` QR code and «فتح في تطبيق المصادقة»; `manualKey` grouped by four, with copy | 429 `mfa_locked`; 409 already enrolled: re-read the session and route; network: Callout in the QR's place |
| `POST /auth/mfa/enrol/confirm` | `recoveryCodes` Code list, once; `session` routing after the codes | 400 `invalid_code`, `clock_skew` (set-the-clock hint); 429 `mfa_locked`; 409: restart enrolment |
| `POST /auth/mfa/challenge` | `SessionView` routing; `method` totp or recovery | 400 `invalid_code` (wrong or replayed, one message); 429 `mfa_locked`; 409 none owed: route by the session |
| `GET /me/clinics` | `name`; `roles` chips; `status` «تجريبية», «موقوفة»; `selectable` disabled card; `lastActiveAt` «آخر نشاط قبل 3 ساعات», «آخر استعمال» on the first; `solo` no branch step or branch line; `branches` branch line and branch step. Invitations: `clinicName`, `roles[].role` and `branchName`, `expiresAt`. Not shown: `tenantId`, invitation `id` (ids; an invitation is answered on its link, OD-91) | loading: Skeleton; 404 `no_clinic`: page with sign-out |
| `POST /me/switch` | `ActiveClinic`, then the session re-read and the query cache cleared | 403 `clinic_suspended` (card turns suspended); 403 `branch_not_held`; 409 `branch_archived` (branch leaves the list); 404: list reloaded |

Feature routes no screen of this batch uses: `/auth/sessions*`, `/clinic/settings`, `/platform/clinics/*` (A-01-10); team, branches and invitations (A-01-08); `/health/*` (operations, no screen).

### API gaps (confirmed and extended; closed in A-01-09, never worked around in the client)
1. **Signed-in person's name** (confirmed): chooser greeting, bar avatar, print sheet on the sign-in path → `GET /me`.
2. **Recovery codes left** (confirmed): «بقي لديك 9 رموز» and the two-left warning → `GET /auth/mfa`, `POST /auth/mfa/recovery-codes`; proposed: the recovery-code challenge answers the count too.
3. **Change of password** (confirmed; used in A-01-10).
4. **Undeclared statuses** (extended): `authSetupLinkConsume` 400; `authMfaEnrolConfirm` and `authMfaChallenge` 400 (`invalid_code`, `clock_skew`); `meSwitch` 403 (`clinic_suspended`, `branch_not_held`); no authenticated route declares 401. The client types errors from the contract.
5. **New · role scope unknown in `MyClinic`:** the client cannot tell a tenant-wide role from roles in branches, so it cannot decide on the branch step; a switch without `branchId` for a person holding roles in two branches lands on `branchId: null` (all branches) though they hold no tenant-wide role (`defaultBranch()`). → `tenantWide: boolean` on `MyClinic`; 400 `branch_required` for that switch.
6. **New · reason of an expired session:** one 401 `session_expired` for idle, the 12-hour limit and a session ended elsewhere (another device, the owner, the super admin); only the tab whose own timer fired knows it was idle. → `reason: idle | absolute | ended` on that error, so the sign-in notice names it.
7. **New · staff MFA recovery:** a member who lost phone and recovery codes has no way back: the owner's new link resets the password only, and MFA reset exists for owners only (super admin). → an owner action "reset this member's TOTP" (as OD-86's link), or the owner decides it stays with Shifa support.
8. **New · generic 409 `conflict` on the MFA routes** for three different states. → named codes (`mfa_already_enrolled`, `mfa_not_started`, `mfa_not_owed`). Not blocking: the screens re-read the session in all three.
9. **Optional, with improvement h:** `SetupLinkView` carries no phone, so the person does not learn which number they will sign in with → `phoneMasked`.
10. **Follow-up, not blocking:** every authenticated request extends the idle limit (`SessionsService.authenticate`), so the client never polls the session; the countdown comes from the last `idleExpiresAt` with cross-tab sync. Screens that refresh themselves later (the queue) need a background request that does not count as activity (backlog).

### Spec gaps (to add to A-01a and A-01b)
1. Phone-only setup: on phones «فتح في تطبيق المصادقة» and the key with copy lead, the QR is folded (drawn).
2. Chooser invitations are listed and answered on their link (OD-91; drawn).
3. Branch step after the clinic for a person with roles in two branches (drawn; needs gap 5).
4. New: the sign-in notices (signed out for inactivity, session ended, not an admin, signed out) and the codes-left notice after a recovery sign-in.
5. New: a lock's end time is shown in the device's time zone (the sign-in page knows no clinic; Syria and Türkiye are UTC+3 all year), `HH:mm`, Western digits.

### Creative improvements (each toggled in the prototype; the owner accepts or declines each)
| | Improvement | Cost |
|---|---|---|
| a (أ) | Password rules ticked while typing; server refusals named in words | ~60 lines |
| b (ب) | Lock countdowns that re-enable the form by themselves | ~80 lines |
| c (ج) | Recovery codes: copy all, print sheet with the person, clinic and date; «حفظتُ الرموز» required (the confirm is spec'd) | ~120 lines with Code list |
| d (د) | A complete six-digit code submits itself | ~40 lines |
| e (هـ) | Rich chooser cards: initials, role chips, trial and suspended badges, last activity in words, last-used mark | ~150 lines |
| f (و) | Quiet notice ten minutes before the 12-hour limit | ~70 lines |
| g (ز) | Caps Lock and Arabic-letters hint on the sign-in password | ~50 lines |
| h (ح) | Masked phone on the setup page | API field (A-01-09) + ~20 lines |
| i (ط) | Remember the last phone on this device, with «ليس رقمك؟» | ~40 lines; the owner may decline it for shared reception computers |
| j (ي) | Retry by itself when the connection returns | ~30 lines |

Accepted by the owner 2026-11-24: all ten. Declined: none.

### Design-system gaps
- **Callout** (inline page message: info, success, warning, danger; optional title and one action; `role` alert or status), **QrCode** (white plate in both themes, folded on phones; proposes semantic `color.scan.bg` and `color.scan.fg`), **CodeList** (ten codes, numbered, mono, LTR, copy all, print sheet): each drawn on its own sheet (every state, light and dark, RTL and LTR, both densities) and on its screens. After approval each is built with `/ui-component` and synced before checkpoint 2 uses it.
- **Selectable card:** Card is a link card only; the clinic and branch cards are frames from Card's tokens with the real Avatar and Badge. In code a `CardLink` (router link); no new component.
- **Idle dialog:** the system's AlertDialog draws with its own trigger and takes no live countdown, so its frame is built from the dialog tokens with real Buttons; in code the AlertDialog parts, opened by the timer.

### Checked before showing
The five artboards hold no literal colour (`#…`, `rgb()`, `hsl()`), every `--shifa-` name exists in the installed `tokens.css`, and no existing component is drawn by hand (buttons, fields, OTP, checkbox, badges, avatars, skeletons, spinner, empty states and icons are mounted from the bundle). The only px values are device and artboard sizes.

## Checkpoint 2 — built 2026-11-24
**Callout** (`packages/ui/src/callout`), from `CalloutSheet` with `/ui-component`: four tones on the status tokens, icon per tone (replaceable), optional title, one action at the end of the line, no close button, `role` alert (warning, danger) or status (info, success), compact density tighter; `data-*` hooks pass through. Stories (eight combinations), five screenshot baselines, design-system bundle entry (README, preview, types); the sync to the Shifa Design System waits for the owner (docs/process/ui-screenshots.md).

**Sign-in** (`packages/web-shell/src/auth`), shared by both apps (`shellPages.signIn`): brand panel on desktop, logo above the form on tablets and phones (`auth-layout.tsx`, reused by checkpoints 3 and 4); the phone sent as typed (Arabic-Indic digits included); improvements b (lock countdown, form off until `until`, on the server's clock from the `Date` header), g (Caps Lock and Arabic-letter hints), i (remembered phone, clinic web only), j (retry when the connection returns); notices for `?reason=` idle (with `minutes` from the page's own timer), absolute, ended, session_expired, not_admin, signed_out, sign_out_failed. The server's `reason` on 401 `session_expired` (A-01-09) now reaches `?reason=` through the guard and the mid-session rule; a deliberate sign-out lands on `?reason=signed_out`.

Differences from the drawing, explained:
- Lock text: the drawing's «بعد 5 محاولات خاطئة خلال 15 دقيقة» names the server's policy, which the answer does not carry; the page says «محاولات خاطئة كثيرة بهذا الرقم» and keeps the countdown and the end time.
- Notices for `absolute` and `ended` are new (gap 6, closed by A-01-09); the drawing had one «انتهت جلستك». The idle notice names the minutes only when this page's timer signed out; the server's idle reason has no minutes.
- A 5xx answer reads «تعذّر الدخول الآن · حدث خطأ في الخادم» (the drawing had the unreachable text for both); only a request with no answer says the connection is down. A 400 `validation_failed` (a phone the server cannot read) shows the one wrong-phone-or-password message.
- The top logo is the reverse lockup in dark on tablets and phones.
- Security review changes to the accepted improvements: j sends what the fields hold now, only within two minutes of the failure and on a visible page (never at an empty desk); i is not kept on admin web, is forgotten after 14 days and on a deliberate sign-out; the password field empties when a lock answers; the ticking countdown is hidden from screen readers, which hear the end time once.
- The locked test `sign-in.test.tsx` lost one `?? ''` for lint, with the owner's consent (2026-11-24).

Reviews: `reviewer` (blocking: a change of `idleMinutes` within a session re-created the idle tracker from the session's first expiry and signed an active person out; fixed with a ref, regression test `session-reasons.test.tsx`) and `security-reviewer` (M1 unattended replay of the stored attempt; L1 double sends; L2 remembered phone; L3 password kept through a lock; L4 the same idle finding): all fixed, tests in `sign-in-safety.test.tsx`. Non-blocking left: two items in `docs/backlog.md`.

## Stopped at
Checkpoint 2 built and reviewed (PR open). Next: checkpoint 3 — QrCode and CodeList with `/ui-component` from their sheets, then the setup link and TOTP screens.

## Evidence
- `pnpm verify` (fast, final tree): format, instructions, lint-root, scripts-test, file-length, pub-get, drift, typecheck+lint+test, e2e: all green.
- `@shifa/ui` Callout: `vitest --project browser src/callout` 34 passed (RTL and LTR, roles, token colours, icon, action side, density, axe light and dark); `--project storybook src/callout` 5 passed; `@shifa/ui` node tests 310 passed; `pnpm ui:screenshots --update` (Docker) wrote the five Callout baselines (other rewritten baselines restored, backlog item on `--update` noise).
- `@shifa/web-shell`: 73 tests passed (23 locked sign-in tests, 10 security-review tests, 2 session-reason tests, the A-01-06 suites).
- Real backend: `pnpm --filter @shifa/e2e e2e` 5 passed, (c) now `?reason=idle` with «خرجت تلقائياً». Browser screenshots against the real backend (desktop 1280, tablet 768, phone 390; light and dark; Arabic RTL): default, admin web, notices idle, signed out and not admin, remembered phone, invalid credentials, Arabic-letter hint, unreachable with retry, phone lock (reached by wrong passwords on the real API) on desktop and phone dark; compared with the prototype `Main`: layout, brand panel, widths, Callout placement and texts match, differences above. The `+` of the international example measured left of its digits in the page.
- `verify:full`: not needed (no build, boot, DB harness, drift generator, CI or verify change); CI runs it.
