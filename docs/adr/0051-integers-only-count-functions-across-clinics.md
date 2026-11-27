# ADR-0051: Integers-only count functions across clinics for the platform role

Status: Accepted (by Claude under the owner's delegation, 2026-11-27; pending owner confirmation) · Date: 2026-11-27 · Deciders: Claude under the owner's overnight delegation (OD-129) · Amends: [ADR-0043](0043-database-roles-auth-and-platform.md) (the platform role stays off clinic rows)

## Context
[ADR-0043](0043-database-roles-auth-and-platform.md) keeps `shifa_platform` off clinic data: it holds no SELECT on clinic tables beyond owner memberships and roles, and restrictive policies hold it to its own rows even with a tenant set. Several super-admin screens still need figures that only clinic rows hold:
- a clinic's doctors and active branches beside its limits and in a type preview ([A-02](../specs/platform/A-02-settings-entitlements-console.md) criteria 2, 3; `tenant_usage_counts(uuid)`, built in A-02-02 ahead of this ADR, backlog item from its security review L4);
- how many non-archived branches hold each city and area, in how many clinics, with how many doctors (criterion 24, slice A-02-06);
- announcement dismissals and targeted members (criterion 22, slice A-02-07).

Granting the platform role SELECT on `branch`, `membership` or `role_assignment` would let a bug or a compromised admin path read names, phones and roles of every clinic. Counting in the application would need exactly those rows.

## Decision
- **SECURITY DEFINER count functions** in `public`, owned by `shifa_owner` (NOBYPASSRLS), with `SET search_path = pg_catalog, public`, `REVOKE ALL … FROM PUBLIC` and `GRANT EXECUTE … TO shifa_platform` only.
- **Integers only.** Every result column is an `integer`. A function never returns a row, an id, a name or text. Where the caller asks about several things at once (places), results are keyed by the position of each input in the caller's array, so even the platform's own ids do not come back from it.
- **Under the clinic's own policies.** The function reads clinic rows by setting `app.tenant_id` (transaction-local) to one clinic at a time, so the tenant policies still decide what it sees, and restores the caller's value before it returns. Clinics to read are passed by the caller from `tenant` (which the platform role may list) in the same statement; the owner itself cannot list tenants.
- **Inside named actions only.** Each function refuses (`42501`) unless `app.admin_reason` is one of the platform actions that show its figures, so every call sits inside an audited `withPlatformAdmin()` transaction.
- **Listed and pinned.** Each function is listed with its reason in `COUNT_FUNCTIONS` of `packages/db/src/schema/classification.ts`; `packages/db/test/privileges.test.ts` fails when the set of SECURITY DEFINER functions in `public` differs from that list, or one of them has another search path, a non-integer result, or EXECUTE for any role but `shifa_platform`.
- Functions today: `tenant_usage_counts(uuid)` (A-02-02) and `place_counts(text, uuid[], uuid[])` (A-02-06). A-02-07 adds its own the same way.

## Consequences
+ The super admin sees the figures the screens need; the platform role still holds no SELECT on clinic rows, and nothing but numbers leaves the function.
+ Each new count is a reviewed, reasoned, pinned database object, not a grant.
− Counts are small information leaks by design: a count of 1 in a place tells the super admin one clinic holds it (never which, from this function). Acceptable for a platform operator who already lists clinics.
− `place_counts` runs one query per clinic per call: fine for the pilot (tens of clinics); a materialised count table would replace it at hundreds (backlog).
− A SECURITY DEFINER bug runs as the owner; the fixed search path, the action check and the privilege pin bound it.

## Alternatives considered
- **SELECT grants on clinic tables with restrictive policies for the platform role:** the rows themselves would reach the platform path.
- **Owner-only permanent policies gated on a setting:** the RLS presence check refuses policies for roles outside the application roles, and any role can set an `app.*` setting.
- **Denormalised counters written by the clinic path:** more writes on every branch and member change, and drift to repair; kept as the scale-up path.

## Sources
OD-129; spec A-02 "Money, abuse and privacy"; [slice A-02-02](../slices/A-02-02-entitlements-and-overrides.md) (`tenant_usage_counts`), [slice A-02-06](../slices/A-02-06-cities-areas-branch-place.md); A-02-02 security review L4 (backlog).
