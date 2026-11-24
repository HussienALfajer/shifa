# A-01-11 Account and platform API gaps: TOTP re-enrolment, pending owner's phone, owner card fields

Status: To plan (`/slice-plan` in plan mode, fresh session) · Tier: T0 · Branch: named by the planning session
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) criteria 3, 11, 12, 13, 14 and the screens "My account" and "Clinic detail" (criteria to add or change: Plan 0 of this slice) · Requirements: PLT-01, PLT-10, PLT-19, PLT-47 · Decisions: ADR-0046, OD-93, OD-98, OD-99, OD-100

After the approved drawings of [A-01-10](A-01-10-ui-account-settings-admin-web.md) checkpoint 1 (2026-11-24). Before A-01-10 checkpoint 2. It changes contracts, the auth path and the platform path: T0, with `reviewer` and `security-reviewer`.

## Goal
The API gives the approved A-01-10 drawings everything they use, so the client needs no workarounds. A person moves their own TOTP to a new phone. The super admin sees whom an owner action is for, corrects a pending owner's phone, and sees whether the owner's link has expired. Owner actions that would do nothing answer an error, not a success. Every status the routes answer is declared.

## Owner decisions this slice builds
- **OD-98** (owner, 2026-11-24): a self re-enrolment of TOTP from My account, confirmed by a current code from the old app. The old secret stays until the new one is confirmed. The replay and lock rules of criterion 12 apply. Audited.
- **OD-99** (owner, 2026-11-24): the super admin edits a pending owner's phone. The earlier link is invalidated and a new one is shown once. The edit is refused once the owner has an account. Audited.
- **OD-100** (owner, 2026-11-24): a clinic may still be created in any of the three statuses; nothing to build.

## Rows from the A-01-10 analysis (approved by the owner 2026-11-24)
| A-01-10 row | What the API gains |
|---|---|
| API gap 1: self re-enrolment (OD-98) | A re-enrolment start confirmed by a current code, and its confirm, which answers ten new recovery codes; named error codes |
| API gap 2: owner phone on clinic detail | `ClinicOwner.phoneMasked` (country code and last three digits) |
| API gap 3: pending owner's phone (OD-99) | Owner phone edit for a pending owner, answering a new `SetupLinkIssued`; a named 409 once the owner has an account; 400 on an invalid phone; the `owner_setup_pending` rule of OD-85 holds for the new phone |
| API gap 4: link expiry | `ClinicOwner.linkExpiresAt` (null when no link is open) |
| API gap 5: owner status in the list | `ClinicSummary.ownerStatus` |
| API gap 6: no-op owner actions | `reset-mfa` and `end-sessions` on a pending owner answer 409 `owner_setup_pending` |
| API gap 7: undeclared statuses | 400 on `platformCreateClinic` and `platformUpdateClinic`; 400 and 403 on `clinicUpdateSettings`; the new routes' statuses |

## Plan
Written by `/slice-plan`: routes, contracts, audit events, isolation and route-matrix rows, tests first, checkpoints, estimate.

## Stopped at
Not started.

## Evidence
- `verify` (full): —
- Reviewer findings fixed: —; deferred to backlog: —
