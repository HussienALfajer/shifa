---
name: slice-plan
description: Turn an approved spec into one or more slice files with a layered, test-first plan. Use in plan mode in a fresh session after /spec.
argument-hint: "<spec path>"
disable-model-invocation: true
---

Plan slices for the approved spec: $ARGUMENTS

1. Read the spec, its domain doc and ADRs, `docs/roadmap.md` and the code the change touches.
2. Split the work so each slice is one session and one PR of about 1,000 hand-written lines or fewer. Split by sub-feature, not only by backend/frontend. Schema and API-contract changes are serialised.
3. Give each slice a risk tier from `docs/process/development-workflow.md` §2 (T0 auth/RLS/patient data/audit/money/migrations/permissions/infra; T1 domain/contracts; T2 UI polish/docs/tests).
4. For each slice copy `docs/slices/_template.md` to `docs/slices/<phase>-<nn>-<kebab-title>.md` and fill in:
   - goal, tier, branch `<type>/<phase>-<nn>-<name>`, spec link and requirement IDs;
   - the plan by layer: contracts → database (RLS, expand/migrate/contract) → API → web → Flutter → end-to-end;
   - the tests written first, mapped to acceptance criteria;
   - the hand-written line estimate.
5. Add the slices to the phase table in `docs/roadmap.md` with status `Planned`.
6. For T0 slices, ask for a second session to critique the plan before building.

Show the owner the slice list (in Arabic) and wait for approval.
