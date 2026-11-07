# ADR-0008: Custom fields — definitions registry + JSONB with fixed limits

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
Clinics must be able to add fields "within clear, professional limits". Unbounded custom fields slow down the receptionist's screen and break reporting; PostgreSQL keeps no statistics inside JSONB, so heavily queried JSONB keys plan badly [RN-05 §5].

## Decision
- A `custom_field_definition` registry per tenant and entity: immutable key with `cf_` prefix, Arabic and English labels, type from a closed list (text, long text, integer, decimal, date, datetime, boolean, single select, multi select, phone, email, file, user reference, patient reference), options, validation (required, min/max, regex, JSON Schema), default, layout (section, order, show on print/booking), view/edit roles, a "sensitive health data" flag that puts the field under read auditing, status with soft delete, version.
- Values are stored in a JSONB column on the owning entity and validated server- and client-side against the same schema; fields a role cannot see are stripped from responses.
- Release 1 scope: custom fields on the patient file only, up to 20 fields per tenant. Later editions: up to 50 per entity (100 for groups, hard cap 150), up to 5 searchable/indexed fields per entity (10 for groups), 250 options per list, 30-day soft delete that still counts toward the limit; keys are never reused.
- Searchable fields get an expression index or a generated column with a B-tree index.
- Core fields cannot be deleted or renamed; some may be hidden, but safety-relevant ones (date of birth, sex, allergies, child weight) can never be hidden.
- Clinical data never goes into custom fields; it goes through versioned templates ([ADR-0009](0009-clinical-templates-specialty-packs.md)).
- If many tenants create the same field, the platform promotes it to a core column through a normal migration.

## Consequences
+ Real flexibility with predictable performance and reporting.
− Limits will occasionally frustrate a clinic; they are an entitlement and can be raised per plan.

## Alternatives considered
- EAV tables: flexible but slow and awkward to report; kept only for rare per-value history needs.
- Typed extension tables per tenant: schema divergence; rejected.

## Sources
[RN-05 §5], [RN-01], [RN-11 §9]
