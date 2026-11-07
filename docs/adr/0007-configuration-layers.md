# ADR-0007: Configuration layers — entitlements, feature flags and cascading settings; per-doctor features are entitlement-gated modules

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
The owner wants to switch features on/off per clinic, build features requested by one doctor and later enable them for others, and let clinics customise within limits. Mixing these concerns is the fastest route to `if (tenant == X)` code [RN-05 §3–§4].

## Decision
- Three separate layers:
  - Entitlements: what a tenant has commercially. Resolution: explicit tenant override → highest "replace" add-on → plan value plus "increment" add-ons → deny by default. Stored in our own tables (`plan`, `plan_feature`, `addon`, `tenant_override` with reason and expiry), cached per tenant.
  - Feature flags: technical rollout and kill switches only, behind an OpenFeature-compatible interface with an in-house provider. Permanent customer differences never live in flags.
  - Settings: how a feature behaves. Cascade, nearest scope wins: platform → plan/edition → specialty pack → organization → branch → practitioner → user. Each key has a JSON Schema, `overridable_by`, `locked`, and sensitivity metadata; the admin UI shows where each value is inherited from.
- A feature is active only if entitled AND flag-on AND enabled in resolved settings.
- A doctor-requested feature goes: request → can settings, custom fields, forms or rules solve it? → if not, generalise → build a module behind an entitlement key with a manifest (key, version, required entitlements, settings schema, events, permissions) → enable for the requesting tenant via override → later package as an add-on. No customer-specific branches, no tenant-ID conditionals, no per-tenant schema differences.
- Contract terms: features funded by a customer remain platform IP (to be reviewed by a lawyer).

## Consequences
+ The super-admin panel can toggle and price features without deployments.
+ Custom work compounds into sellable product.
− Requires discipline and a feature-request triage; enforced in review.

## Alternatives considered
- External flag/entitlement SaaS (LaunchDarkly, Stigg, Schematic): USD billing and access risk; unnecessary at this scale. Self-hosted Flagsmith/Unleash remain possible later via OpenFeature [RN-16 §13].
- Per-customer forks: rejected.

## Sources
[RN-05 §3–§4], [RN-16 §13], [RN-01]
