# A-03-10 UI code 2, owner tools: merge, read log, patient fields and «مرضاي فقط»

Status: Planned · Tier: T1 · Branch: `feat/A-03-10-ui-owner-tools`
Spec: [A-03](../specs/patients/A-03-patients.md) screens merge, «من فتح هذا الملف», «حقول ملف المريض» and «مرضاي فقط»; criteria 8, 11, 14, 15, 17, 19 and 34–41 as seen on screen · Requirements: CLN-41, CLN-45, PLT-13, PLT-30 to PLT-36, PLT-44 · Decisions: ADR-0008, ADR-0040, ADR-0046, ADR-0047

Second and last UI code slice of A-03, after A-03-09 (the merge opens from the chart and the fields appear in its form). Re-planned at A-03-01 checkpoint 3 (owner, 2026-11-27): it takes the former A-03-11; above the ~4,000-line budget by the owner's choice (ADR-0032).

## Goal
The owner merges two charts, reads who opened each chart, manages the clinic's patient fields and the "my patients only" setting, as drawn.

## Plan
1. **Contract check** — every row of `A03Merge`, `A03ReadLog`, `A03Fields` and `A03MyPatients` in the [contract](../specs/patients/A-03-screen-contract.md) against the built API; mismatches fixed in the API.
2. **Web**, with the components of A-03-12 (EditableList, RecordList, RecordHeader, DescriptionList, Drawer «wide»):
   - Merge (owner): pick the other chart (active only), the two charts side by side with the older kept by default, a choice per differing field, what is joined, the confirmation naming both file numbers; states not active, stale and done.
   - «من فتح هذا الملف»: DataTable paged by 50 with the Pagination, «مع الحقول الحساسة», the «الدعم الفني» filter with counts (improvement 6); none yet (safety), error, support session.
   - «حقول ملف المريض»: fields by section with type icon, flags and roles, up and down within a section, the two meters, archived fields with days left and restore (chart counts, improvement 8); the wide panel per type (lengths, value shape presets or a custom expression, choices in EditableList, default), required, searchable (5), sensitive (never searchable), print, view and edit roles, type fixed on edit, archive question; none yet, limit full, every 409 by its row.
   - Clinic settings «المرضى»: «مرضاي فقط» with its source, the A-02 lock and its impact (improvement 7); the link to the fields with their use.
3. **Flutter** — none.
4. **End-to-end** (real backend) — the owner merges two charts and the merged number opens the kept chart; "my patients only" hides a chart from a doctor (search and direct link); the owner adds «جهة الإحالة» (single choice, searchable), reception fills it on registration and finds the chart by it; the limit full at 20. Screenshots light and dark on three sizes compared with the drawings; axe.

Tests written first: the four journeys; the panel per type and per contract error; merge and log states from the contract rows.
Estimated hand-written lines: ~4,440 (merge ~800, read log ~350, fields page and panel ~1,710, setting ~250, journeys and tests ~1,330).

## From A-03-01 (re-plan, 2026-11-27)
- Contract rows: every row of `A03Merge`, `A03ReadLog`, `A03Fields`, `A03MyPatients`.
- Criteria added on screen: 34–41.
- Components: none built here; they come from A-03-12.
- Drawings: `A03Merge`, `A03ReadLog`, `A03Fields`, `A03MyPatients` (approved 2026-11-27).
- New estimate: ~4,440, about 440 over the budget (owner's choice).

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Screenshots compared with the drawings: <paths>
- Reviewer findings fixed: <list>

## Notes for the next session
- <only what is needed to resume>
