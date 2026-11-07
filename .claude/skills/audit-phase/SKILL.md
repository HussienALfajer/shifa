---
name: audit-phase
description: End-of-phase audit with parallel read-only reviewers before the next phase starts.
argument-hint: "<phase id, e.g. 0.2 or A>"
disable-model-invocation: true
---

Audit phase $ARGUMENTS.

1. Read `docs/roadmap.md` (the phase's exit criteria and slice list) and the merged slice files.
2. Run `pnpm verify:full` through the `checker` agent.
3. Start read-only reviewers in parallel (at most 4), each with one dimension and the list of merged PRs:
   - tenant isolation and permissions (`security-reviewer`);
   - patient data, audit and logging (`security-reviewer`);
   - correctness against the specs (`reviewer`);
   - instruction files, docs and roadmap drift (`reviewer`): stale statements, rules repeated instead of enforced.
4. Verify each finding yourself. Blocking ones become fix slices; others go to `docs/backlog.md`.
5. Write `docs/audits/<phase>-<date>.md`: exit criteria with evidence, findings and their disposition.
6. Report to the owner in Arabic and ask for the walkthrough of the real app before the next phase starts.
