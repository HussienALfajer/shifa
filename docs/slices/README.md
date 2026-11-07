# Slices

Status: Living · Last updated: 2026-11-08 · Owner: product owner

A slice is the unit of work: one session, one PR, one risk tier. Each slice has one file here, named `<phase>-<nn>-<kebab-title>.md` (for example `A-03-queue-ticket-printing.md`). The file holds the plan, progress and hand-over for that slice only, so no shared task file grows without limit [RN-21, RN-22].

Rules:
- Create the file with `/slice-plan` after the spec is approved; copy [_template.md](_template.md).
- Keep it under ~6 KB. Lasting facts go to the spec, a domain doc or an ADR, never here.
- The "Stopped at" line is updated at every checkpoint so any session can resume.
- When the slice is merged, set Status to `Done` and stop editing the file. Overall status lives in [roadmap](../roadmap.md).
