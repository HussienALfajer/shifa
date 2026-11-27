# A-03-12 Components: RecordList, RecordHeader, DescriptionList, EditableList and the Drawer «wide»

Status: Done · Tier: T1 · Branch: `feat/A-03-12-components` (built in a cloud session on its assigned branch, `claude/eloquent-archimedes-3djyl2`, `docs/process/cloud-sessions.md` §4)
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
Done. Merged as #199 (2026-11-27). After the owner started it the same day: the Shifa Design System synced (version `1795803185-f463`, `lastChange.via` `main@608d7cc`); "Shifa Components" got a sheet and a playground for RecordList, RecordHeader, DescriptionList and EditableList, and the Drawer sheet the wide size (`canvas/sheets-a03.ts`, `data-a03.ts`, `playground-a03.ts`); the five proposal sheets (`A03Sheet…`) were removed from "Shifa Screens · Clinic web" at the owner's request. The four drawn sources (`A03RecordList`, `A03RecordHeader`, `A03DescriptionList`, `A03EditableList`) stay on that canvas because its A-03 screens import them; A-03-09 and A-03-10 build the screens on the real components.

## Built
- `src/record-list/` (`record-list.tsx`, `record-list-row.tsx`, `types.ts`), `src/record-header/`, `src/description-list/`, `src/editable-list/` (`words.ts` for Arabic and English), and `Drawer size="wide"` in `src/drawer/drawer.tsx`; exported from `src/index.ts`.
- `--container-record-table: 640px` in `src/styles/variants.css`: the table layout's own breakpoint.
- Design system: bundle entries (`compound-a03.tsx` turns callbacks into local state for a board), types in `index-a03.d.ts`, README and preview per component, the Drawer's `size` in its data and README. `SpinnerProps` moved from `index.d.ts` to `index-data.d.ts` to keep `index.d.ts` under 400 lines.

## Differences from the drawings (explained)
1. **Dim avatar is grey, not faded.** The sheet faded an archived row's avatar to 60 %; axe then measured its initials at 2.4–3.8 : 1. `grayscale` keeps the "inactive" look at full contrast.
2. **An empty RecordList is a named group, not a list.** The EmptyState's heading may not sit in `role="list"` (axe `aria-required-children`).
3. **The table layout needs 640 px of its own width**, else two lines (the sheet showed the switch only at 358 px; 640 is where a title and three columns still read). The matrix stories are ~600 px wide, so `TableWide` (outside the matrix) draws the table itself.
4. **RecordList keyboard on rows with buttons.** The sheet asks for one Tab stop; it holds for link rows. A row with its own buttons (candidates, fields) keeps them in the Tab order (they would be unreachable otherwise), and ↑ ↓ land on its first button.
5. **RecordHeader actions are any content** (Buttons and one Menu, as drawn); `muted` hides them all, as the sheet's behaviour note says.
6. **EditableList checks duplicates itself** with `foldArabic` among all items, archived included (spec gap 15); the archive Toast with «تراجع» is the screen's (A-03-10).
7. **Drawer «wide»** is an inline `calc` of the two tokens, not a new token, as the sheet names it.
8. **Tab enters RecordList on its first link, not on the `current` row** (a locked test holds this): on the search page focus stays in the box and the screen moves `current`; a list entered by Tab starts at its top.
9. **Read-only EditableList shows no «استعادة»** on archived rows; the sheet drew it disabled. The locked test asks for no buttons at all in read-only rows; a support session cannot restore either way.

## Tests
Written first and locked (`.claude/state/locked-tests.txt` while building): `record-list.test.tsx` (13 cases × 2 directions), `record-header.test.tsx` (8 × 2), `description-list.test.tsx` (7 × 2), `editable-list.test.tsx` (10 × 2), `drawer/drawer.wide.test.tsx` (4 × 2); all failed first on the missing modules. After locking, lint refused their nullable casts; they were changed to the repository's `must(value, what)` helper (a missing element now fails louder), every `expect` unchanged, and locked again (reported to the owner).

## Evidence
- `pnpm verify`: all green (2026-11-27, final tree).
- `node scripts/verify.mjs full --part ui`: all green — browser tests, every story as a test with axe, Storybook build, 353 screenshots against the baselines in the pinned Docker image.
- New baselines (34): `packages/ui/screenshots/baselines/components-{recordlist,recordheader,descriptionlist,editablelist}--*.png`, `components-drawer--shown-wide.png`. Compared with `A03SheetRecordList`, `A03SheetRecordHeader`, `A03SheetDescriptionList`, `A03SheetEditableList` and `A03SheetDrawerWide`: same structure, tokens and states; differences 1–3 above. `--update` also rewrote 89 existing baselines with no visible change; they were restored, and the compare pass is green with them.
- `pnpm design-system:build`: writes the four new components with README and preview.
- Reviewer (2026-11-27), all fixed or answered, with regression tests in `record-list.review.test.tsx` and `editable-list.review.test.tsx`:
  - B1 RecordList lost the keyboard's focus when a row tool reordered the rows (and at an end, natively disabled): tools are `aria-disabled` at an end and the pressed tool is focused again after the render, only when focus fell to the page.
  - B2 EditableList's archive dropped focus: it moves to the row's «استعادة».
  - «استعادة» is `aria-disabled` when the list is full; the footer sits after the list, not in it; RecordHeader's avatar is hidden from screen readers (the title says the name); the design-system types' second `Variant` was renamed (the joined `index.d.ts` now passes `tsc --strict`); a test for ↑ ↓ across link, button and locked rows.
  - Tab on `current` and read-only «استعادة»: kept, see differences 8 and 9.
- After the fixes: `pnpm verify` and `verify full --part ui` all green again; screenshots unchanged.

## Notes for the next session
- Nothing left: synced, drawn on "Shifa Components", proposal sheets removed (see Stopped at).
