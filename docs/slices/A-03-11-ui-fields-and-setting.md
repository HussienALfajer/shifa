# A-03-11 UI code 3: «حقول ملف المريض» and «مرضاي فقط» (folded into A-03-10)

Status: Folded into [A-03-10](A-03-10-ui-chart-merge-read-log.md) at the A-03-01 re-plan (owner, 2026-11-27: two UI slices above the budget instead of three, components moved to [A-03-12](A-03-12-components.md)). Not built as a slice; kept so the ID is not reused. The original plan follows for the record.

Original status: Planned · Tier: T1 · Branch: `feat/A-03-11-ui-fields-and-setting`
Spec: [A-03](../specs/patients/A-03-patients.md) screens «حقول ملف المريض» and «مرضاي فقط»; criteria 11, 14, 15, 17 as seen on screen · Requirements: PLT-13, PLT-30 to PLT-36, PLT-44 · Decisions: ADR-0008, ADR-0040, ADR-0046, ADR-0047

Third UI code slice of A-03. It touches only clinic settings, so it may run beside A-03-10 in its own worktree after A-03-09 is merged.

## Goal
The owner manages the clinic's patient fields and the "my patients only" setting in clinic settings, as drawn.

## Plan
1. **Contract check** — the rows of these screens against the built API; mismatches fixed in the API.
2. **Components** — the approved missing components (for example the options editor), with `/ui-component`, synced last.
3. **Web** (clinic settings, `patients.fields.manage` and `clinic.settings.manage`)
   - «حقول ملف المريض»: fields by section with order, «7 من 20» and «2 من 5 قابلة للبحث» from capabilities, the add and edit Drawer (every type and its validation, options, view and edit roles, sensitive, searchable, shown in print, the note that the fields are not for clinical data, the type fixed after creation), archived fields with days left and restore; states none yet, limit full (shown before sending), searchable full, every 409 by its contract row.
   - «مرضاي فقط»: the setting with its source and the A-02 lock, as the idle setting draws it.
4. **Flutter** — none.
5. **End-to-end** (real backend) — the owner adds «جهة الإحالة» (single choice, searchable) and reception fills it on registration and finds the chart by it; the limit full state at 20. Screenshots light and dark on three sizes compared with the drawings; axe.

Tests written first: the journey; component tests from the sheets; the Drawer per type and per contract error.
Estimated hand-written lines: ~3,000 (components ~500, fields page and Drawer ~1,600, setting ~200, journeys and tests ~700). Re-estimated at A-03-01 checkpoint 3.

## From A-03-01 (re-plan, 2026-11-27)
- Folded into A-03-10; its components come from A-03-12.

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Screenshots compared with the drawings: <paths>
- Reviewer findings fixed: <list>

## Notes for the next session
- <only what is needed to resume>
