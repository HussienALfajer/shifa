# A-01-07 UI batch 1: sign-in screens

Status: Planned · Tier: T1 · Branch: `feat/A-01-07-ui-sign-in-screens`
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) screen inventory, verification rows "Flows" and "Screens"; criteria 6, 7, 9–13 as seen by the user · Requirements: PLT-01, PLT-10, PLT-19, PLT-48 · Decisions: ADR-0040, ADR-0042, OD-79, OD-80

After [A-01-06](A-01-06-web-shells-and-e2e-harness.md) (merged).

## Goal
The super admin creates a clinic and shares the owner's link from admin-web; the owner opens it, sets a password and TOTP and signs in on clinic-web; anyone gets the idle warning and is signed out; a person manages their sessions and MFA; the owner sets the clinic's automatic sign-out.

## Plan
### Checkpoint 1 — draw, analyse, owner approval (ADR-0042, OD-80); no code before approval
- Read the **Shifa Design System** README first; keep the **Shifa Guide** rules. Clinic web in "Shifa Screens · Clinic web" (review and update the 2026-11-23 drafts on page "A-01 Foundation"); admin web in a new "Shifa Screens · Admin web" canvas; both install the system (`tokens.json`, `tokens.css`, component bundle, fonts, `designSystems` record).
- Screens: clinic web — Sign in (desktop, tablet, phone), Setup link (phone, desktop), TOTP enrol and TOTP challenge (desktop, phone), Idle warning (all sizes), My account (desktop, phone), Clinic settings · automatic sign-out (desktop); admin web — Clinics list, Create clinic with the link shown once, Clinic detail with owner actions.
- Working prototype in Play: every artboard interactive; flows super admin create → owner link → password → TOTP enrol → recovery codes → signed in, and sign in → TOTP challenge → recovery code; every inventory state reachable (wrong credentials, phone locked with end time, IP blocked, server unreachable, password refused with the rule, invalid link, wrong or replayed code, MFA locked, clock-skew hint, empty and loading lists); light and dark and the sizes switchable; Arabic RTL; synthetic names and phones from `@shifa/testing` only.
- Checked before showing: no literal colour, no unknown `--shifa-` name, no hand-drawn copy of an existing component; result written here.
- Analysis written here and shown with the drawings: API gaps (fixed here or in a small slice before coding, never in the client), spec gaps (added to the spec), creative improvements each with its cost (owner accepts or declines; declined ones listed here), design-system gaps. Likely gaps to check: a QR code display, a recovery-code grid with print, a countdown in the idle dialog; each missing component goes through `/ui-component` (sheet and owner approval, then the design-system sync) before this batch codes it.

### Checkpoint 2 — sign-in, setup link, TOTP (clinic web)
Routes and forms on `@shifa/ui` (Form, Field, Input, Password Input, OTP Input, Button, Alert Dialog), phone typed in any digit form and normalised with `normalisePhone()`, error codes mapped to Arabic texts in `@shifa/i18n` (one message for wrong phone or password), lock end times in the clinic's time format.

### Checkpoint 3 — idle warning, My account, automatic sign-out setting
Idle dialog from the shell's timer (countdown 1:00, «متابعة العمل», «خروج الآن»), any 401 → sign-in; My account: change password, MFA status and actions, sessions with end one and end all others; owner-only settings page.

### Checkpoint 4 — admin web
Clinics list (search, empty, loading), create clinic (link once, copy, WhatsApp share), clinic detail (status, end date, owner actions each confirmed).

### Checkpoint 5 — journeys, screenshots, review
Playwright against the real backend: the full owner journey (TOTP codes from the test's own authenticator), idle warning and sign-out with a short idle setting, recovery-code sign-in. Browser screenshots against the real backend, light and dark, at the listed sizes, compared with the approved drawings; every difference fixed or explained here. axe clean; keyboard path for sign-in. `reviewer` agent; `security-reviewer` on the session and link handling in the client.

Tests written first: component tests per screen state (mocks typed from contracts allowed); the three Playwright journeys (Flows row); screenshot comparisons (Screens row).
Estimated hand-written lines: ~3,800 (clinic web ~2,000, admin web ~900, journeys ~500, i18n texts ~400); missing components are separate `/ui-component` work, not counted here.

## Drawings and analysis
Not drawn.

## Stopped at
Not started.

## Evidence
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —
