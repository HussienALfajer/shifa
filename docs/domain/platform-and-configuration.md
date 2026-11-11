# Platform and Configuration

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-01, RN-05, RN-11, RN-16, RN-19

Purpose: defines the shared platform layer that every Shifa surface builds on. It covers the tenancy hierarchy and identities, the super-admin panel, how features are switched on per clinic, per-doctor custom features, custom fields, branding, roles and permissions, audit, MFA and data export. Built in **Phase A**. Specialty content (dental, orthopedics, imaging) lives in its own domain docs. This doc only defines how the platform switches it on.

Related: [scheduling and queue](scheduling-queue.md) · [billing](billing-multicurrency.md) · [messaging](messaging-and-verification.md) · [patient app](patient-app.md) · [ADR index](../adr/README.md) · [open decisions](../open-decisions.md)

## 1. Tenancy model (ADR-0004, ADR-0006)

One data model serves a solo doctor, a multi-doctor clinic and a multi-branch group. There are never separate systems or forks per customer type [RN-05 §1, §2].

```
Platform
└─ Tenant            (subscription/billing account)
   └─ Organization   (legal clinic or group)
      └─ Branch      (location, currency, price list, cash boxes)
         └─ Resource (room, dental chair, device)
Practitioner (global identity) ─< PractitionerRole (per organization/branch)
Person/Patient account (global) ─< PatientChart (per organization, MRN)
```

- PLT-01 Every tenant-scoped row carries `tenant_id`. Isolation is enforced by PostgreSQL RLS (`FORCE ROW LEVEL SECURITY`, transaction-scoped `set_config`), and the app connects as a non-owner, non-`BYPASSRLS` role (ADR-0004) [RN-05 §1] [RN-16 §3].
- PLT-02 A tenant→deployment routing record exists from day one, so a large group can later move to a dedicated database without code changes (Later: the actual silo move).
- PLT-03 A solo doctor is a tenant with one organization, one implicit branch and one practitioner. The UI hides branch switching and room management until a second branch or resource exists (progressive disclosure).
- PLT-04 A multi-branch tenant has a branch switcher. Each branch has its own working hours, price lists, enabled currencies, cash boxes and resources.
- PLT-05 A practitioner has one global login and one PractitionerRole per organization/branch. Each role carries its fees, schedule, stamp and signature. A doctor working in several clinics switches between them without a second account.
- PLT-06 A clinic-specific feature never follows a doctor to another clinic. Entitlements belong to the tenant, not the practitioner.
- PLT-07 A patient has one global platform account (phone-verified, with family dependents under one phone; see [messaging](messaging-and-verification.md)) linked to a separate chart per organization.
- PLT-08 The receptionist can create a chart without a patient account. The patient later claims it after phone verification or a reception QR. Probabilistic matching on Arabic names suggests links but never merges charts automatically; a person confirms every link, and the link is audited [RN-04 §7].
- PLT-09 The clinical record belongs to the clinic. Sharing a chart with another clinic requires explicit, scoped, revocable patient consent (Later: cross-clinic sharing UI).

## 2. Super-admin panel

Platform staff use it. MFA is mandatory and every action is audited [RN-11 §6].

- PLT-10 Tenant management: create a tenant (type: solo / multi-doctor / multi-branch), set status (trial, active, suspended) and a manually set subscription end date. Pricing is deferred (OD-07).
- PLT-11 Doctor verification queue: the doctor uploads ID, degree certificate and practice licence. Staff approve or reject with a note. Approval grants the verified badge. Unverified doctors are never listed publicly, and changes to identity, licence or location trigger re-verification [RN-11 §1].
- PLT-12 Specialty assignment: staff assign each practitioner a specialty (General, Dental, Orthopedics in Release 1). The specialty enables the matching specialty pack. A practitioner cannot change their own specialty.
- PLT-13 Per-tenant feature toggles and limits: staff can enable or disable any entitlement key and set numeric limits (practitioners, branches, custom fields) for each tenant, with a reason and an optional expiry.
- PLT-14 Support access: read-only by default, time-boxed, a mandatory reason, visible to the clinic owner, and fully audited. Write access needs a separate, explicit elevation.
- PLT-15 Reference data management: drug catalogue, diagnosis lists, default procedure catalogues (dental, ortho), consent and report templates, cities and areas (Aleppo neighbourhoods, Azaz), and licensed-content catalogues.
- PLT-16 Usage metrics per tenant: logins, visits per day, bookings, queue tickets, and messages sent and failed.
- PLT-17 WhatsApp session health per clinic: linked or unlinked, last seen, warnings, and the circuit-breaker state (see [messaging](messaging-and-verification.md)).
- PLT-18 Announcements: a dismissible banner targeted at all tenants or selected ones.
- PLT-19 User support tools: reset a user's phone binding or password and revoke sessions. Every use is audited.

## 3. Entitlements, feature flags and settings (ADR-0007)

These are three separate layers that are never mixed [RN-05 §3].

| Layer | Question it answers | Owner | Example |
|---|---|---|---|
| Entitlement | What is this tenant allowed to use? | Platform / commercial | `pack.dental`, `imaging.dicom`, `limits.custom_fields = 20` |
| Feature flag | Is new code switched on here yet? | Engineering, short-lived | `queue_v2` for 10% of tenants, kill switch |
| Setting | How does an enabled feature behave here? | Clinic, within limits | default visit length, walk-in insertion rule |

- PLT-20 A feature is active only if the tenant is entitled, its flag is on, and the resolved setting enables it. The UI hides it, or shows an upsell, when any one of these fails.
- PLT-21 Entitlement resolution, in order: explicit tenant override → highest replacing add-on → plan plus incremental add-ons → deny. The result is cached per tenant and invalidated on any change.
- PLT-22 Settings cascade: Platform defaults → Plan/edition → Specialty pack → Organization → Branch → Practitioner → User preference. The nearest scope wins.
- PLT-23 Each setting key declares which scopes may override it (`overridable_by`), whether a higher scope can lock it (`locked`), a JSON Schema for validation, and a sensitivity level.
- PLT-24 Admin screens show where each effective value comes from (for example "inherited from: Dental pack").
- PLT-25 Flags use an OpenFeature-compatible interface over in-house tables. Long-lived per-customer differences live in entitlements or settings, never in flags.

## 4. Per-doctor custom features

A doctor's custom request is handled as a generic module behind an entitlement. There are no branches per customer and no `if (tenant == X)` in code [RN-05 §4].

- PLT-26 A request first goes through the extension ladder: settings → custom fields → forms/templates → print templates → automation rules (Later) → webhooks (Later) → a platform-built module. Most requests should end at the cheap rungs.
- PLT-27 A platform-built module has a manifest: key, version, required entitlements, settings schema, subscribed events and permissions. It is enabled for the requesting tenant through a tenant override. Inside a multi-doctor tenant it can be narrowed to one practitioner through the settings cascade.
- PLT-28 The commercial terms (contract) state that platform-built features are platform IP and may be offered to other tenants. An optional paid exclusivity window is allowed. The terms need a lawyer's review.
- PLT-29 Release 1 ships the mechanism (entitlement keys, overrides, manifests) only. No custom features are built in Release 1.

## 5. Custom fields (ADR-0008)

- PLT-30 Release 1 offers custom fields on the **patient file only**, up to **20 fields per tenant**. Other entities are Later. The general model allows ~50 per entity per edition, with a hard ceiling of 150 [RN-05 §5].
- PLT-31 Field types are a closed list: text, long text, number, date, single choice, multiple choice, yes/no, phone.
- PLT-32 Each field has an immutable key with a `cf_` prefix and labels in Arabic and English. It can be marked required or optional, has validation (min/max, regex) and a default value. It also defines which roles can view and edit it, a section/position, whether it appears in print, and a sensitive-health flag that subjects it to read auditing.
- PLT-33 Values are stored in JSONB and validated against the definition on the server and the client. A field a role cannot view is stripped from that role's API responses.
- PLT-34 Deletion is soft. Data is retained for 30 days, the field counts toward the limit until purged, and its key is never reused.
- PLT-35 Core fields cannot be deleted or renamed. Fields that clinical safety or billing depend on (date of birth, sex, allergies, child weight) can never be hidden.
- PLT-36 At most 5 custom fields per entity can be marked searchable. Those get an expression index or a generated column.

## 6. Branding and public page

- PLT-37 Each clinic configures its logo, letterhead, stamp, doctor signature images, address and map location, and contact numbers.
- PLT-38 Print templates (prescription A5, receipt 58/80 mm and A5, report A4) offer constrained layout options and render from HTML for both print and PDF.
- PLT-39 Every clinic and doctor gets a public page on a platform subdomain, plus a printable QR code (see [patient app](patient-app.md)).
- PLT-40 Custom domains with automatic TLS (Later) [RN-05 §6].
- PLT-41 Tenant brand colours are computed server-side from a seed colour and checked for contrast. Status and clinical colours are locked and never overridable [RN-19 §A12].

## 7. Roles and permissions

- PLT-42 Predefined roles: Owner/Admin, Doctor, Receptionist, Assistant/Nurse and Accountant, each with simple permission toggles. Custom roles are Later.
- PLT-43 Receptionists cannot see clinical notes by default.
- PLT-44 The organization setting "my patients only" restricts a doctor to charts where they are the treating practitioner. The default is all clinic patients.
- PLT-45 Permissions are scoped per organization and per branch. A user can hold different roles in different branches.
- PLT-46 Sensitive actions (discounts, refunds, rate overrides, voids, data export, support elevation) each have their own permission.

## 8. Audit, security and data export

- PLT-47 An append-only audit log records every clinical and financial create, update and void with before/after values, plus every opening of a patient chart (read audit). The log is protected by database permissions.
- PLT-48 MFA (TOTP or passkey) is mandatory for platform staff and clinic owners, and optional for other staff. Idle sessions log out automatically.
- PLT-49 The clinic owner can export all of the clinic's data (patients, visits, invoices, attachments index) in a documented format.
- PLT-50 No real patient data exists in any development or test environment. Only synthetic multi-tenant data is used (ADR-0023).
- PLT-51 PostgreSQL is backed up with point-in-time recovery, encrypted, with data loss of at most 5 minutes and a restore within 4 hours; a restore drill proves it every week on synthetic data and every quarter in production (ADR-0029).
- PLT-52 Logs, traces, metrics and error reports never contain personal or clinical data: attributes pass an allowlist in the application and a second filter before storage; a test with synthetic patient data proves it (ADR-0029). Layer one in the API: [slice 0.2-09b1](../slices/0.2-09b1-api-telemetry.md).

## Key entities

- `tenant`, `organization`, `branch`, `resource`: hierarchy and bookable rooms/chairs/devices.
- `deployment_route`: tenant → database/cell mapping.
- `user_account`, `membership`, `role_assignment`: login plus scoped roles.
- `practitioner`, `practitioner_role`, `practitioner_verification`: global doctor identity, per-clinic role and badge workflow.
- `person`, `dependent_link`, `patient_chart`, `chart_link`, `consent`: patient identity, family, per-clinic chart and sharing.
- `plan`, `plan_feature`, `addon`, `tenant_override`, `feature_flag`: entitlements and flags.
- `setting_definition`, `setting_value`: cascading settings with locks.
- `module_manifest`: platform-built optional modules.
- `custom_field_definition`: per-tenant field registry (values in entity JSONB).
- `branding`, `print_template`: clinic identity and layouts.
- `audit_event`: append-only log, including reads.
- `support_access_grant`: time-boxed, reasoned support sessions.

## Verification notes

- A cross-tenant isolation suite seeds at least two tenants and asserts zero cross-tenant rows for every repository and query path, using the app's non-superuser role. A guard test fails if any tenant-scoped table lacks an RLS policy.
- An RLS test runs behind the connection pooler in transaction mode and proves that tenant context never leaks between transactions.
- A route permission matrix test calls every route with every role and compares the result to the expected matrix.
- Entitlement resolution has table-driven tests covering plan, add-ons, overrides, expiry and deny-by-default.
- Settings cascade tests cover scope precedence, locks and schema validation.
- Custom-field tests cover the limit, closed types, immutable keys, soft-delete counting, stripping of hidden fields per role and searchable-field indexing.
- Audit tests prove that a chart read writes an audit row, and that the application role cannot update or delete audit rows.
- Support-access tests prove that an expired grant denies access and that the owner sees the access record.
