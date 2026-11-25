---
name: spec
description: Interview the owner and write an approved feature spec before any feature code. Use at the start of a slice loop.
argument-hint: "<area> <feature name>"
disable-model-invocation: true
---

Write the spec for: $ARGUMENTS

1. Read the domain doc for the area (`docs/domain/`), `docs/product/scope-release-1.md`, related ADRs and `docs/open-decisions.md`. Collect the requirement IDs this feature covers (for example `SCH-07`).
2. Interview the owner in Arabic with `AskUserQuestion`: 3–4 options per question, your recommendation first. Ask only what the docs do not answer. Never guess an open decision; if one blocks the spec, ask, then record the answer in `docs/open-decisions.md`.
3. Write `docs/specs/<area>/<id>-<name>.md` in English with these sections:
   - Goal (one paragraph) and requirement IDs.
   - User stories (role → action → outcome), Arabic UI terms in parentheses where useful.
   - Acceptance criteria, numbered, each testable.
   - Edge cases, offline behaviour, permissions per role.
   - Money, abuse and privacy considerations (tenant scoping, audit, what must never be logged).
   - Verification contract: for every criterion, the exact test or check that proves it (unit, integration, isolation suite, browser run against the real backend, golden test).
   - Out of scope; open questions (must be empty before approval).
4. If the feature has UI, write a screen inventory in words; do not draw (ADR-0042, OD-80; the design slice draws them before the API, ADR-0047, `/slice-plan`):
   - each screen: name, purpose, sizes (desktop, 10-inch tablet, phone as the feature needs), and every state with the data it shows and the actions it offers (empty, loading, error, permission-denied where they apply);
   - group the screens by app (the likely checkpoints of the design slice);
   - add to the verification contract: "Design slice: drawings, screen-to-API contract and analysis approved; API slices: each contract row proven by a contract test; UI code slices: browser screenshot compared with the approved drawing". Do not commit artifact links (public repository).
5. Ask the owner to approve the spec only (no drawings at this step). A new decision becomes a new ADR (`docs/adr/`), never an edit to an accepted one.

Keep the spec under ~8 KB; split by sub-feature if it grows.
