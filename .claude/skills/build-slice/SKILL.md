---
name: build-slice
description: Build an approved slice test-first, layer by layer, with verify after each layer and evidence in the slice file.
argument-hint: "<slice file path>"
disable-model-invocation: true
---

Build the slice: $ARGUMENTS

1. Read the slice file and its spec. Check `git status` and create or switch to the slice branch named in the file. Restate the goal and tier to the owner in one line. A design slice (ADR-0047) writes no product code: it follows its slice file (draw, analyse, the owner's approval, re-plan) and skips steps 2 and 3. In an API slice, every screen-to-API contract row the slice file names gets a contract test; a change forced during the build updates that row and its drawing in the same slice and is reported to the owner.
2. Create `.claude/state/red-phase` (the Stop hook skips `verify` while it exists). Write the failing tests listed in the plan first and run them to see them fail for the right reason. Then list their paths in `.claude/state/locked-tests.txt` (one per line): the edit hook stops you from weakening them. If a locked test is wrong, stop and ask the owner.
3. Delete `.claude/state/red-phase`, then implement one layer at a time (contracts → db → API → web → Flutter → end-to-end). After each layer:
   - run `pnpm verify` and fix until green;
   - commit at the green checkpoint (conventional commit, slice ID in the scope);
   - update the "Stopped at" line in the slice file.
4. Before the PR:
   - `pnpm verify` green (CI runs the full gate, ADR-0033); also `pnpm verify:full` when the slice touches build or boot check, the DB test harness, drift generators, CI or `verify`; for UI, run the app against the real backend in the browser, capture screenshots (Arabic RTL) and compare each with its approved drawing or component sheet in the Shifa design project (ADR-0040): fix a difference or explain it in the slice file; after a component batch passes, sync the real components to the Shifa Design System (`pnpm design-system:build`, then the publish in `docs/process/ui-screenshots.md`; the owner starts it);
   - write the evidence (commands and summary lines) into the slice file;
   - run the `reviewer` agent (and `security-reviewer` for T0) with the branch and slice file; fix real findings, put non-blocking ones in `docs/backlog.md`.
5. Clear `.claude/state/locked-tests.txt`, open the PR (slice and spec linked, evidence, tier), update `docs/roadmap.md`, and report to the owner in Arabic: what changed, evidence, risks, what is left.

Never edit generated files, committed migrations or accepted ADRs; never skip hooks.
