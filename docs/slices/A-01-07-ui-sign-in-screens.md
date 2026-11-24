# A-01-07 UI batch 1: sign-in, MFA, setup link and clinic chooser screens

Status: Planned (re-planned 2026-11-24) · Tier: T1 · Branch: `feat/A-01-07-ui-sign-in-screens`
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
Not drawn.

## Stopped at
Re-plan approved by the owner 2026-11-24 (with ADR-0046); next: checkpoint 1, drawing and analysis.

## Evidence
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —
