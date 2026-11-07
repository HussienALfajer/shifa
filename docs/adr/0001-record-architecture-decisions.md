# ADR-0001: Record architecture decisions

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
Shifa will be built almost entirely by Claude Code sessions that start without memory. Decisions taken in chat (2026-11-07/08) are lost unless written down. In the owner's earlier projects, ADRs kept many short sessions consistent, but ADRs edited in place and docs that drifted from code caused confusion [RN-20 §3] [RN-21 §3]. Research notes are evidence, not decisions, and some of them were later corrected (e.g. Syria's data-protection law, see [syria data law](../compliance/syria-data-law.md)).

## Decision
- Architecture and product-shaping decisions live in `docs/adr/NNNN-kebab-title.md`, one decision per file, using the template in [README](README.md).
- An Accepted ADR is never rewritten. Only its status line may change (`Superseded by ADR-NNNN`). A change of mind is a new ADR that supersedes the old one.
- A Proposed ADR may be edited until it is accepted; it must name the open decision (OD-xx) that blocks it.
- Research in `docs/research/archive/` is read-only evidence cited as `[RN-xx §n]`. Where research and an ADR disagree, the ADR wins.
- Unresolved questions live in [open decisions](../open-decisions.md), never inside code comments or chat.

## Consequences
+ Any session can recover the "why" from the repo; reviewers can check code against decisions.
+ History of changed minds stays visible (e.g. React Native → Flutter).
− Small overhead per decision; the index in README must be kept current (checked by a docs lint in Phase 0).

## Alternatives considered
- Decisions inside CLAUDE.md: rejected — bloats always-loaded context and mixes rules with history [RN-18 §4.3].
- Wiki outside the repo: rejected — agents cannot read it and it drifts.

## Sources
[RN-18 §4.3, §4.12], [RN-20 §3], [RN-21 §3], [RN-22 §3]
