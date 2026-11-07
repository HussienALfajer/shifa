# Shifa

Multi-tenant clinic platform for Syria (Aleppo, Azaz): clinic web system, super admin, waiting-room display, public booking pages and a Flutter patient app. Current phase: documentation only — no code yet. Phase 0.2 (foundation) replaces this file with the full version.

## Start here
- Map of all docs: `docs/README.md`
- Status and next phase: `docs/roadmap.md`
- How we work (slice loop, risk tiers, definition of done): `docs/process/development-workflow.md`
- Release 1 scope: `docs/product/scope-release-1.md`
- Decisions: `docs/adr/README.md` · Open questions: `docs/open-decisions.md`

## Non-negotiables
- Repository content (code, docs, commit messages) is English. The product UI is Arabic-first (RTL). Reports to the owner are in Arabic.
- No real patient data anywhere in this repository or the development environment; synthetic data only (`docs/compliance/data-handling.md`).
- This repository is public (ADR-0026): never commit secrets, credentials, production hosts or private notes. `docs/research/archive/2026-11-08-r4-claude-code-method/project_*.md` stay local and git-ignored.
- Accepted ADRs are never edited; a change is a new ADR that supersedes the old one.
- `docs/research/archive/` is read-only evidence; cite it as `[RN-xx §section]`.
- Do not guess open decisions; ask the owner and record the answer in `docs/open-decisions.md`.
- Requirements are cited by ID (`SCH-07`, `DEN-12`); keep IDs stable.
