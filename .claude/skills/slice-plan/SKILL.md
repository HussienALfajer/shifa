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
   - for UI (ADR-0047, ADR-0046, OD-80) the order is design slice → API slices → UI code slices:
     - **Design slice**, first, no product code: every screen of the spec drawn as a working prototype the owner tests in Play (interactive artboards, flow from screen to screen, every state in the spec reachable), Arabic RTL, light and dark, synthetic names from `@shifa/testing` only; the Shifa Design System throughout (README read first, Shifa Guide rules kept: real components, tokens for every colour, space, radius, shadow and size, its type styles, no literal values, checked before showing); a large set approved at several checkpoints. Its analysis: the screen-to-API contract table (each screen and state → route, request and response fields, every error and status and what the screen does, permission), anything unprofessional in the existing API, spec gaps, improvements each with what it adds and its estimated lines for the owner to accept or decline one by one (accepted ones drawn and added to the spec), missing components on their own sheet with every state and on their screens. After approval, re-estimate the plan; the owner sees the final slice count before any build.
     - **API slices** name the contract rows they deliver and prove each with a contract test.
     - **UI code slices**, last, split by the budget: each checks the drawings and the contract against the built API (a mismatch is fixed in the API, never in the client), builds the approved missing components with `/ui-component` and syncs them, then the screens; screenshots against the real backend compared with the drawings.
     - Component slices keep ADR-0040: a "sheet and owner approval" checkpoint first, the design-system sync last;
   - the tests written first, mapped to acceptance criteria;
   - the hand-written line estimate.
5. Add the slices to the phase table in `docs/roadmap.md` with status `Planned`.
6. For T0 slices, ask for a second session to critique the plan before building.

Show the owner the slice list (in Arabic) and wait for approval.
