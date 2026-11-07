# ADR-0006: One organisation model for solo, multi-doctor and multi-branch; global practitioner and patient identities

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
The product must serve a solo doctor, a clinic with several doctors and a multi-branch group. Doctors in Aleppo and Azaz often work in several clinics; patients book for family members from one phone, sometimes Syrian (+963) and Turkish (+90) numbers [RN-01] [RN-03 §6]. Building separate products per customer type is the classic SaaS anti-pattern [RN-05 §1–§2].

## Decision
- One hierarchy for everyone: Platform → Tenant (subscription account) → Organization (legal clinic/group) → Branch (location) → Resources (rooms, dental chairs, devices). A solo doctor is a tenant with one organization, one implicit branch and one practitioner; the UI hides what the edition does not need (progressive disclosure).
- Practitioner is a global identity (name, specialty, licence number, verification status) with a PractitionerRole per organization/branch carrying fees, schedules, stamp and signature. Availability is modelled per (practitioner, branch) [RN-04 §1].
- A user account can hold memberships with roles scoped to organization or branch; one login works across clinics with a clinic switcher.
- Person is a global patient account (phone-verified, dependents under one guardian, Syrian and Turkish numbers). Each organization keeps its own PatientChart with its own file number (MRN). Clinic staff can create charts without an account; the patient claims them later after phone verification or a reception QR.
- The clinic owns its clinical record. Nothing is shared with another organization without explicit, scoped, revocable patient consent. Charts are never merged automatically across organizations; probabilistic matching (Arabic name normalisation) only suggests links that a patient or staff member confirms, with audit [RN-04 §7].

## Consequences
+ One codebase and data model; upgrades from solo to group need no migration.
+ Natural support for doctors with several workplaces and for family booking.
− Every query and permission must consider organization and branch scope; enforced by RLS and permission tests.

## Alternatives considered
- Separate solo and clinic products: duplicated effort and painful upgrades.
- Patient accounts per clinic only: breaks family booking and the cross-clinic patient app.
- Automatic cross-clinic chart merge: unsafe; rejected.

## Sources
[RN-05 §1–§2], [RN-04 §1, §7], [RN-03 §6], [RN-01]
