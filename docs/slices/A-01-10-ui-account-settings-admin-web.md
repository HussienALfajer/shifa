# A-01-10 UI batch 2: My account, automatic sign-out and admin-web clinics

Status: Planned · Tier: T1 · Branch: `feat/A-01-10-ui-account-settings-admin-web`
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) screens "My account", "Clinic settings · automatic sign-out", "Clinics list", "Create clinic", "Clinic detail"; criteria 3, 4, 9, 10, 10a, 10b, 12a, 13 as seen by the user; verification rows "Flows" and "Screens" · Requirements: PLT-01, PLT-10, PLT-19, PLT-48 · Decisions: ADR-0040, ADR-0042, OD-79, OD-80

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

## Plan
### Checkpoint 1 — draw, analyse, owner approval (ADR-0042, OD-80); no code before approval
- Shifa Design System README read first; Shifa Guide rules kept. Clinic web on "Shifa Screens · Clinic web", page "A-01 Foundation"; admin web on a new "Shifa Screens · Admin web" canvas with the system installed.
- Screens: My account (desktop, phone): profile, password, MFA with codes left and renewal, sessions with this device marked; Automatic sign-out (desktop); Clinics list, Create clinic with the link shown once, Clinic detail with the owner card (desktop).
- Prototype in Play with every state reachable (password rules, wrong current password, phone locked, two or fewer codes left, no other session, ending all others, settings saved, empty and loading lists, link shown once, each owner action confirmed); light and dark; Arabic RTL; synthetic data from `@shifa/testing` only.
- Analysis: API gaps, spec gaps, creative improvements with costs, missing components (likely: **Copy field** with WhatsApp share for the one-time link, a **status chip** pairing for clinic status in words) through `/ui-component` first.

### Checkpoint 2 — My account and automatic sign-out (clinic web)
### Checkpoint 3 — admin web: clinics list, create, detail
### Checkpoint 4 — journeys, screenshots, review
Playwright against the real backend: super admin creates a clinic in admin-web → copies the link → the owner journey of A-01-07 runs from that link; owner changes the password and the other session ends; owner renews the recovery codes and an old one is refused; owner sets 15 minutes and a second member's next request reads it; super admin resets the owner's MFA and the owner enrols again. Screenshots against the real backend, light and dark, compared with the approved drawings; axe clean; `reviewer` agent; `security-reviewer` on the one-time link and code handling in the client.

Tests written first: component tests per screen state; the five journeys; screenshot comparisons.
Estimated hand-written lines: ~3,400 (My account ~1,000, settings ~200, admin web ~1,100, i18n ~400, journeys ~700); missing components are separate `/ui-component` work.

## Drawings and analysis
Not drawn.

## Stopped at
Not started.

## Evidence
- `verify` (full): —
- Screenshots: —
- Reviewer findings fixed: —; deferred to backlog: —
