---
name: slice-plan
description: Turn an approved spec into one or more slice files with a layered, test-first plan. Use in plan mode in a fresh session after /spec.
argument-hint: "<spec path>"
disable-model-invocation: true
---

Plan slices for the approved spec: $ARGUMENTS

1. Read the spec, its domain doc and ADRs, `docs/roadmap.md` and the code the change touches.
2. Split the work so each slice is one session and one PR of about 4,000 hand-written lines or fewer (ADR-0032); a large slice names checkpoints in its plan. Split by sub-feature, not only by backend/frontend. Schema and API-contract changes are serialised.
3. Give each slice a risk tier from `docs/process/development-workflow.md` §2 (T0 auth/RLS/patient data/audit/money/migrations/permissions/infra; T1 domain/contracts; T2 UI polish/docs/tests).
4. For each slice copy `docs/slices/_template.md` to `docs/slices/<phase>-<nn>-<kebab-title>.md` and fill in:
   - goal, tier, branch `<type>/<phase>-<nn>-<name>`, spec link and requirement IDs;
   - the plan by layer: contracts → database (RLS, expand/migrate/contract) → API → web → Flutter → end-to-end;
   - for UI (ADR-0042, OD-80): a UI batch slice comes after the API it uses and starts with a "draw, analyse, owner approval" checkpoint. The Shifa Design System is used throughout (README read first, Shifa Guide rules kept): its real components, tokens for every colour, space, radius, shadow and size, its type styles, no literal values (checked before showing). The screens are drawn as a working prototype the owner tests in Play (interactive artboards, flow from screen to screen, every state listed in the spec reachable), Arabic RTL, light and dark, synthetic names from `@shifa/testing` only. The screens use the whole API they sit on (ADR-0046): the analysis opens with a table of every route, response field and error the batch's screens use, each shown, driving a state, or named with the reason it is not. With the drawings comes a written analysis: API gaps and anything unprofessional in the API (fixed in the API, never in the client), spec gaps, creative improvements each with its cost for the owner to accept or decline, and missing components: each is drawn in the same checkpoint on its own sheet with every state and at once on the screens that need it; the owner approves it or asks for changes; then it is built with `/ui-component` and synced before the screens' code uses it (ADR-0046). Component slices keep their rule (ADR-0040): a component batch starts with a "sheet and owner approval" checkpoint and ends with the design-system sync;
   - the tests written first, mapped to acceptance criteria;
   - the hand-written line estimate.
5. Add the slices to the phase table in `docs/roadmap.md` with status `Planned`.
6. For T0 slices, ask for a second session to critique the plan before building.

Show the owner the slice list (in Arabic) and wait for approval.
