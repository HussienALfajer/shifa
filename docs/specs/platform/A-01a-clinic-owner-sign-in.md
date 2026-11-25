# Spec A-01a: clinic, owner and sign-in

Status: Done (accepted by the owner 2026-11-25; approved 2026-11-23) · Date: 2026-11-23 · Risk tier: T0 (auth, tenancy/RLS, audit) · Owner: product owner
First Phase A spec (order: OD-75); continued by [A-01b](A-01b-team-roles-branches-switcher.md). Decisions: ADR-0004, ADR-0006, ADR-0016, ADR-0030; OD-76, OD-77. Screens: inventory below; drawn at the start of the UI batch slices (ADR-0042); the clinic-web drawings of 2026-11-23 ("Shifa Screens · Clinic web", page "A-01 Foundation") are drafts for those batches.

## Goal
A clinic can exist and its owner can get in safely: the super admin creates the clinic and its owner, the owner opens a one-time setup link, sets a password and TOTP, and signs in with phone and password from then on. Sessions expire on idle, every identity event is audited, and the API's guard gets a real principal from Better Auth instead of `NoAuthAdapter`.

Requirements: PLT-01, PLT-02, PLT-03 (one implicit branch), PLT-10, PLT-19 (owner password and MFA reset, session revoke), PLT-47 (identity events), PLT-48.

## User stories
- Super admin → creates «عيادة الشفاء التخصصية» (multi-doctor), the owner's name and phone → gets the owner's setup link (رابط الإعداد).
- Owner → opens the link on their phone, sets a password, scans the TOTP QR, saves the recovery codes (رموز الاسترداد) → lands in the clinic.
- Receptionist away from the desk → is signed out after the clinic's idle time, with a warning one minute before.
- Owner who lost their phone → signs in with a recovery code, or the super admin resets MFA and sends a new link.

## Acceptance criteria
Data
1. Tables `tenant`, `organization`, `branch`, `deployment_route` (PLT-02), `setup_link`, `audit_event`, plus Better Auth's `user`, `session`, `account`, `two_factor` through the Drizzle adapter. Tenant tables carry `tenant_id` with ENABLE + FORCE RLS and an isolation case; global tables holding personal data (user, session, two_factor) have a policy on `app.user_id`. Keys are UUIDs; no shared sequence.
2. Creating a clinic creates one tenant, one organization, one active branch («الفرع الرئيسي») and a deployment route, in one transaction.

Clinic and owner (OD-76)
3. The super admin creates a clinic (name, type solo / multi-doctor / multi-branch, status trial / active / suspended, subscription end date) and its owner (name, phone), edits status and end date, and receives the owner's setup link. The end date has no automatic effect in A-01. The clinics list shows each owner's status (pending, active, deactivated; none without an owner row) (A-01-11).
4. A setup link is one-time, valid 72 h, at least 128 bits, stored hashed, shown once with copy and WhatsApp-share buttons (a `wa.me` link carrying no phone and no patient data). Re-issuing invalidates the earlier link. A used, expired or replaced link shows one message and no clinic name.
5. Opening an owner's link sets the password and then enrols TOTP before anything else.

Sign-in
6. Sign-in is phone + password. The phone is normalised to E.164 (+963, +90; Arabic-Indic digits, spaces and a leading 0 accepted); one account per phone. A wrong phone or password gives one message («رقم الهاتف أو كلمة المرور غير صحيحة»), with the same status and comparable timing whether or not the phone exists.
7. Five failures for one phone within 15 min lock that phone for 15 min; 30 failures from one IP within 15 min block that IP for 15 min. Both answer 429 with the lock's end time.
8. Passwords (set through a link or changed on My account): at least 10 characters, refused when on the bundled common-password list or containing the phone's digits; no composition rules; hashed by Better Auth (scrypt).

Sessions (OD-77)
9. Sessions are server-side; the cookie is `__Host-` prefixed, `Secure`, `HttpOnly`, `SameSite=Lax`, rotated at sign-in and after MFA. Idle limit: the active clinic's setting (15, 30 or 60 min, default 30; set by the owner); super admins 15 min; absolute limit 12 h. A warning dialog appears one minute before the idle limit; any request after a limit is 401 `session_expired` with the reason (`idle`, `absolute`, or `ended`: the session was ended elsewhere, on another device, by the owner, by the super admin or by a change of password) and the client returns to sign-in; a missing or forged cookie is 401 `unauthorized` without a reason (A-01-09).
10. A person lists their own sessions (device, browser, last active) and ends one or all others.
10a. A signed-in person reads their own profile (name, phone), before the second factor too (the challenge greets by name); the phone goes to that person only and never into logs, spans or errors (A-01-09).
10b. A person changes their own password with the current one: a wrong current password is 401 `invalid_credentials`, counted toward the phone lock of criterion 7 (429 `phone_locked` with the end time; the lock also blocks sign-in); the new one follows criterion 8 and differs from the current one (`password_unchanged`); on success every other session of the person ends, this one is rotated, and it is audited (OD-92, A-01-09).

MFA (OD-77)
11. Owners and super admins reach no route other than enrolment until TOTP is enrolled (QR + manual key, one code to confirm, 10 single-use recovery codes shown once). Other staff may enrol from their account page. No one turns their own TOTP off: the owner resets a member's (A-01b criterion 3), the super admin an owner's (criterion 13; OD-93). An enrolled person moves their TOTP to a new phone from My account (OD-98, A-01-11): they start with a current code from the old app (the replay and lock rules of criterion 12 apply), scan a new key and confirm it with a code from the new app; the old secret keeps working until then, and a reset by the owner or the super admin removes both; on confirmation they get ten new recovery codes, shown once, and the old set is gone; their other sessions are kept and this one is not rotated (OD-101); audited.
12. A TOTP code is accepted within ±1 step and never twice; five wrong codes lock MFA for 15 min; a used recovery code is gone.
12a. A person with TOTP sees how many recovery codes are left (in the answer of a recovery sign-in and on My account) and gets a new set of ten, shown once, by confirming a current TOTP code (the replay and lock rules of criterion 12 apply); the old set is gone; audited (A-01-09).

Recovery and support (PLT-19)
13. The super admin can, for an owner: issue a new setup link (resets the password), reset MFA (enrol again at next sign-in) and end all sessions. Each ends the owner's sessions; MFA reset and ending sessions answer 409 `owner_setup_pending` for an owner who has no account yet (A-01-11). The owner card shows the owner's masked phone (country code and last three digits), status and the expiry of the owner's open link (past or future; none once used). The super admin corrects a pending owner's phone (OD-99): the earlier link stops working and a new one is shown once (an invitation when the new phone has an account); refused with 409 `owner_account_exists` once the owner has an account, and with `owner_setup_pending` for a phone that owns another clinic not set up (OD-85); audited without the phone. Super admins see no clinic data (support access is A-02). Super admin accounts are created by a seed command only.

Audit (PLT-47)
14. `audit_event` is append-only (`shifa_app` has no UPDATE or DELETE, `appendOnly` class in the isolation suite). It records sign-in success and failure, lockouts, MFA enrol and reset, recovery-code use, link issued and used, clinic created and status changes, session ends, change of password and its failures, renewal of recovery codes, the owner's reset of a member's TOTP, a self re-enrolment of TOTP (`auth.mfa_reenrolled`), and every super-admin action (a pending owner's phone corrected: `owner.phone_changed`): actor id, tenant, target id, event, time, request id. Platform events have a null tenant and are invisible to `shifa_app` tenant queries.

Guard and harness (backlog, "before Phase A routes")
15. A Better Auth adapter replaces `NoAuthAdapter`; the `AuthPort` contract is documented and the principal validated with Zod; adapter errors never carry tokens or phones.
16. Sign-in is the first public route: an untrusted `traceparent` no longer decides sampling, and a client `x-request-id` is never exported; raw Fastify routes outside the guard fail a test; the OpenAPI document passes a 3.1 meta-schema check; the route matrix sends a sample body per POST route.

## Edge cases and offline
- Two clinics name the same owner phone: the second creation gives an invitation to accept (A-01b), not a second account.
- Clock skew on the owner's phone beyond one TOTP step: the enrolment screen says to set the phone's time automatically.
- Offline: sign-in and setup need the server; keeping today's work under an existing session is A-05.

## Permissions
| Action | Super admin | Owner | Other staff |
|---|---|---|---|
| Create clinic, set status and end date, reset owner | ✓ (admin web) | – | – |
| Sign in, own sessions, own MFA | ✓ | ✓ | ✓ |
| Idle setting of the clinic | – | ✓ | – |

## Money, abuse and privacy
No money. Abuse: credential stuffing (7), link guessing (4), account enumeration (4, 6), MFA brute force (12). Never in logs, spans, errors or audit rows: passwords, setup tokens, TOTP secrets and codes, recovery codes, cookies, phone numbers (rate-limit keys use an HMAC of the phone).

## Verification contract
| Criteria | Proof |
|---|---|
| 1, 2, 14 | `packages/db` tests: isolation cases for every new tenant table, `app.user_id` policy test on global tables, append-only test, no-sequence check, one-transaction creation test |
| 3–5, 13 | `apps/api` integration tests (Testcontainers): link single use, expiry, re-issue, hashed storage, owner forced to TOTP, super-admin resets end sessions |
| 6–8 | API tests: normaliser vectors (TS unit), same status for unknown phone, lockouts with a fake clock, password rules |
| 9, 10 | API tests with a fake clock: idle and absolute expiry, cookie attributes, rotation, ending sessions → 401 next request |
| 11, 12 | API tests on the real Better Auth flow: gate before enrolment, ±1 step window, replay refused, lockout, recovery code single use |
| 10a, 10b, 12a | API tests (A-01-09): profile of self only, before MFA; change of password rules, lock, other sessions ended and this one rotated, audit; codes left after enrolment and a recovery sign-in, renewal with a current code, old set refused, replay and lock |
| 3, 11, 13, 14 (A-01-11) | API tests: re-enrolment start and confirm (replay, one lock across both routes, clock skew, old secret until confirmed, new recovery codes, other sessions kept, audit, reset during a pending one); owner status in the list, masked phone and link expiry on the card, 409 for MFA reset and end sessions on a pending owner; phone edit (new link, earlier link invalid, invitation for an existing account, `owner_account_exists`, `owner_setup_pending`, audit without the phone). `packages/db` tests: the pending secret readable by `shifa_auth` only; `shifa_platform` changes only a pending owner's phone, only in `owner.phone_changed`; the invitation link follows the new phone |
| 15, 16 | Contract and Zod tests; the named route, sampling, request-id, meta-schema and matrix tests |
| Privacy | Leak test with synthetic phones and passwords through sign-in, failure, link and MFA flows: absent from logs, spans, error events and audit rows |
| Flows | Playwright against the real backend: super admin creates a clinic → owner opens the link → password → TOTP → signed in; idle warning and sign-out |
| Screens | UI batch slice: drawings and analysis approved by the owner at its first checkpoint (ADR-0042); browser screenshots against the real backend compared with them, light and dark, at the listed sizes |

## Screens (inventory, ADR-0042)
Clinic web, Arabic RTL, light and dark:
- **Sign in** (desktop, tablet, phone): phone, password, «دخول», recovery hint. States: default; wrong credentials (one message under the password); phone locked (end time, inputs disabled); IP blocked; server unreachable.
- **Setup link** (phone, desktop): clinic name, person's name and role, the masked phone (country code and last three digits), link expiry; new password twice with the rules as a hint. States: valid; password refused (rule named); link invalid (one message, no clinic name).
- **TOTP enrol** (desktop, phone): why, app hint, QR + manual key, one code, then 10 recovery codes with print and copy, confirm before continuing. States: wrong code; clock-skew hint.
- **TOTP challenge** (desktop, phone): greeting by name, six-digit code, «استخدام رمز استرداد». States: wrong or replayed code; MFA locked (end time).
- **Idle warning** (all sizes): countdown from 1:00, «متابعة العمل», «خروج الآن».
- **My account** (desktop, phone): phone (read-only), change password, MFA status (enrolled since, recovery codes left) and actions (enrol; new recovery codes), sessions (device, browser, last active, this device) with end one and end all others. On a phone: one column, navigation behind a menu button. Staff without TOTP enrol here with the steps of TOTP enrol; an enrolled person moves TOTP to a new phone here, confirmed by a current code (OD-98).
- **Clinic settings · automatic sign-out** (desktop): 15 / 30 / 60 minutes, owner only; a non-owner has no navigation item for it.
Admin web, light and dark:
- **Clinics list** (desktop): name, type, status, end date, owner name; search; «إنشاء عيادة». States: empty, loading.
- **Create clinic** (desktop): clinic fields and owner name and phone → the owner's setup link shown once with copy and WhatsApp share.
- **Clinic detail** (desktop): status and end date edit; owner card with the masked phone, the status and a pending link's expiry; new setup link (its confirmation says that an active owner's password is cleared and every session ends), reset MFA, end sessions (each confirmed, each audited; the last two for an owner with an account only); a pending owner's phone corrected (OD-99); no clinic data.

## Out of scope
Members, roles, branches and the switcher (A-01b); entitlements, limits, settings cascade, support access, cities (A-02); passkeys; self-service recovery over WhatsApp (A-09 at the earliest); patient accounts (A-09/A-11); audit viewer UI; automatic action at the end date.

## Open questions
None.
