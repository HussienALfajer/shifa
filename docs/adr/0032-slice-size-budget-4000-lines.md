# ADR-0032: Slice and PR size budget raised to about 4,000 hand-written lines

Status: Accepted (owner, 2026-11-15) · Date: 2026-11-15 · Deciders: product owner (with Claude) · Amends: [ADR-0025](0025-development-methodology-claude-code.md) (the "≈1,000 hand-written lines cap" of the per-slice loop)

## Context
ADR-0025 caps a slice and its PR at about 1,000 hand-written lines, and `scripts/check-pr-size.mjs` warns above that (the hard limit was removed on 2026-11-09). Several slices already ran over it by owner choice (0.2-05, 0.2-09b3, 0.2-09c), and planning spike 0.3-S1 at that size produced six dependent slices for one throwaway spike. The owner prefers fewer, larger slices.

## Decision
- A slice is one session and one PR of about **4,000** hand-written lines or fewer (generated files, lockfiles and binaries excluded, as before).
- `scripts/lib/pr-size.mjs` warns above 4,000; it still never fails.
- Splitting stays by sub-feature, not only by backend/frontend; schema and API-contract changes are still serialised. A large slice records checkpoints in its plan so a session can stop and resume cleanly.

## Consequences
+ Fewer PRs and less hand-over overhead for work that belongs together.
− Larger diffs for the reviewer agents and the owner to read; T0 review takes longer, and a session is more likely to need a checkpoint and a fresh context mid-slice.

## Alternatives considered
- Keep 1,000 and let the owner override per slice: what was done so far; the owner chose a standing budget instead.
