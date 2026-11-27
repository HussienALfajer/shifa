# A-03-12 Components: RecordList, RecordHeader, DescriptionList, EditableList and the Drawer «wide»

Status: Planned · Tier: T1 · Branch: `feat/A-03-12-components`
Spec: [A-03](../specs/patients/A-03-patients.md) (the components its screens need) · Decisions: ADR-0039, ADR-0040, ADR-0046, ADR-0047, ADR-0048

Added at the A-03-01 re-plan (owner, 2026-11-27), on the A-02 model (`feat/A-02-components`): the approved components are built ahead of the UI code slices, in one PR. It touches only `packages/ui` and the design system, no schema and no API contract, so it may run in its own worktree beside the API slices, starting once A-03-01 is merged.

## Goal
The four components and the one component change that the owner approved at A-03-01 exist in `packages/ui`, tested as every component is, synced to the Shifa Design System and drawn on "Shifa Components", so A-03-09 and A-03-10 only assemble screens.

## Plan
Each with `/ui-component`, from its approved sheet on "Shifa Screens · Clinic web", page "Proposals" (owner, 2026-11-27):
1. **RecordList** (`A03SheetRecordList`): layouts table, two lines and tiles; sizes md and sm; avatar, or a type icon; the title with matched words in a heavier weight; a second line of badges and texts; optional columns with the DataTable's header and row tokens; at the end a chevron (the row is a link), a button, a badge, or small tool buttons and a button; locked (hidden chart), dim, current; loading and empty; one Tab stop, ↑ ↓, Home, End, Enter.
2. **RecordHeader** (`A03SheetRecordHeader`): avatar, title (h1 or h2), the record number in a gold tag, badges and one with a Tooltip, facts, a meta line, buttons and one Menu (a bottom sheet on touch), or «للقراءة فقط»; muted; compact; loading.
3. **DescriptionList** (`A03SheetDescriptionList`): sections of label and value (`dl`), «—» read as empty, one badge per value, latin values isolated, one or two columns; loading.
4. **EditableList** (`A03SheetEditableList`): numbered rows, rename in place with its error, up and down, archive and restore, use per row, the add line and its error, the count against the maximum; empty, full, read-only.
5. **Drawer `size="wide"`** (`A03SheetDrawerWide`): 550 px, never wider than the screen; the default stays 400.

For each: RTL and LTR, light and dark, both densities, axe, stories, screenshots (baselines refreshed), the bundle entry with its README and preview; then the design system sync (`pnpm design-system:build` and the publish in `docs/process/ui-screenshots.md`, started by the owner) and a sheet per component on "Shifa Components" (ADR-0048). The proposal sheets are marked superseded.

Tests written first: component tests from each sheet's states (keyboard and screen reader behaviour included).
Estimated hand-written lines: ~1,370 (RecordList ~450, RecordHeader ~300, DescriptionList ~200, EditableList ~300, Drawer «wide» ~120).

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Screenshots compared with the drawings: <paths>
- Reviewer findings fixed: <list>

## Notes for the next session
- <only what is needed to resume>
