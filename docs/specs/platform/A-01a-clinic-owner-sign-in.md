# Spec A-01a: clinic, owner and sign-in

Status: Approved (owner, 2026-11-23) · Date: 2026-11-23 · Risk tier: T0 (auth, tenancy/RLS, audit) · Owner: product owner
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
3. The super admin creates a clinic (name, type solo / multi-doctor / multi-branch, status trial / active / suspended, subscription end date) and its owner (name, phone), edits status and end date, and receives the owner's setup link. The end date has no automatic effect in A-01.
4. A setup link is one-time, valid 72 h, at least 128 bits, stored hashed, shown once with copy and WhatsApp-share buttons (a `wa.me` link carrying no phone and no patient data). Re-issuing invalidates the earlier link. A used, expired or replaced link shows one message and no clinic name.
5. Opening an owner's link sets the password and then enrols TOTP before anything else.

Sign-in
6. Sign-in is phone + password. The phone is normalised to E.164 (+963, +90; Arabic-Indic digits, spaces and a leading 0 accepted); one account per phone. A wrong phone or password gives one message («رقم الهاتف أو كلمة المرور غير صحيحة»), with the same status and comparable timing whether or not the phone exists.
7. Five failures for one phone within 15 min lock that phone for 15 min; 30 failures from one IP within 15 min block that IP for 15 min. Both answer 429 with the lock's end time.
8. Passwords: at least 10 characters, refused when on the bundled common-password list or containing the phone's digits; no composition rules; hashed by Better Auth (scrypt).

Sessions (OD-77)
9. Sessions are server-side; the cookie is `__Host-` prefixed, `Secure`, `HttpOnly`, `SameSite=Lax`, rotated at sign-in and after MFA. Idle limit: the active clinic's setting (15, 30 or 60 min, default 30; set by the owner); super admins 15 min; absolute limit 12 h. A warning dialog appears one minute before the idle limit; any request after a limit is 401 and the client returns to sign-in.
10. A person lists their own sessions (device, browser, last active) and ends one or all others.

MFA (OD-77)
11. Owners and super admins reach no route other than enrolment until TOTP is enrolled (QR + manual key, one code to confirm, 10 single-use recovery codes shown once). Other staff may enrol from their account page.
12. A TOTP code is accepted within ±1 step and never twice; five wrong codes lock MFA for 15 min; a used recovery code is gone.

Recovery and support (PLT-19)
13. The super admin can, for an owner: issue a new setup link (resets the password), reset MFA (enrol again at next sign-in) and end all sessions. Each ends the owner's sessions. Super admins see no clinic data (support access is A-02). Super admin accounts are created by a seed command only.

Audit (PLT-47)
14. `audit_event` is append-only (`shifa_app` has no UPDATE or DELETE, `appendOnly` class in the isolation suite). It records sign-in success and failure, lockouts, MFA enrol and reset, recovery-code use, link issued and used, clinic created and status changes, session ends and every super-admin action: actor id, tenant, target id, event, time, request id. Platform events have a null tenant and are invisible to `shifa_app` tenant queries.

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
| 15, 16 | Contract and Zod tests; the named route, sampling, request-id, meta-schema and matrix tests |
| Privacy | Leak test with synthetic phones and passwords through sign-in, failure, link and MFA flows: absent from logs, spans, error events and audit rows |
| Flows | Playwright against the real backend: super admin creates a clinic → owner opens the link → password → TOTP → signed in; idle warning and sign-out |
| Screens | UI batch slice: drawings and analysis approved by the owner at its first checkpoint (ADR-0042); browser screenshots against the real backend compared with them, light and dark, at the listed sizes |

## Screens (inventory, ADR-0042)
Clinic web, Arabic RTL, light and dark:
- **Sign in** (desktop, tablet, phone): phone, password, «دخول», recovery hint. States: default; wrong credentials (one message under the password); phone locked (end time, inputs disabled); IP blocked; server unreachable.
- **Setup link** (phone, desktop): clinic name, person's name and role, link expiry; new password twice with the rules as a hint. States: valid; password refused (rule named); link invalid (one message, no clinic name).
- **TOTP enrol** (desktop, phone): why, app hint, QR + manual key, one code, then 10 recovery codes with print and copy, confirm before continuing. States: wrong code; clock-skew hint.
- **TOTP challenge** (desktop, phone): six-digit code, «استخدام رمز استرداد». States: wrong or replayed code; MFA locked (end time).
- **Idle warning** (all sizes): countdown from 1:00, «متابعة العمل», «خروج الآن».
- **My account** (desktop, phone): phone (read-only), change password, MFA status and actions, sessions (device, browser, last active, this device) with end one and end all others.
- **Clinic settings · automatic sign-out** (desktop): 15 / 30 / 60 minutes, owner only.
Admin web, light and dark:
- **Clinics list** (desktop): name, type, status, end date, owner name; search; «إنشاء عيادة». States: empty, loading.
- **Create clinic** (desktop): clinic fields and owner name and phone → the owner's setup link shown once with copy and WhatsApp share.
- **Clinic detail** (desktop): status and end date edit; owner card with new setup link, reset MFA, end sessions (each confirmed, each audited); no clinic data.

## Out of scope
Members, roles, branches and the switcher (A-01b); entitlements, limits, settings cascade, support access, cities (A-02); passkeys; self-service recovery over WhatsApp (A-09 at the earliest); patient accounts (A-09/A-11); audit viewer UI; automatic action at the end date.

## Open questions
None.
