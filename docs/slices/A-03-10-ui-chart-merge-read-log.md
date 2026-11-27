# A-03-10 UI code 2: chart summary, merge and read log

Status: Planned · Tier: T1 · Branch: `feat/A-03-10-ui-chart-merge-read-log`
Spec: [A-03](../specs/patients/A-03-patients.md) screens «ملف المريض», merge, «من فتح هذا الملف»; criteria 8, 9, 10, 11, 12, 13, 16, 18, 19 as seen on screen · Requirements: CLN-01 (identity), CLN-41, CLN-44, CLN-45 · Decisions: ADR-0040, ADR-0046, ADR-0047

Second UI code slice of A-03, after A-03-09 (it opens the chart from search and reuses the form).

## Goal
Staff open a chart and see its identity, family, treating doctors and custom fields; the owner archives, restores and merges charts and sees who opened each one, as drawn.

## Plan
1. **Contract check** — the rows of these screens against the built API; mismatches fixed in the API.
2. **Components** — the approved missing components of these screens (for example the merge chooser), with `/ui-component`, synced last.
3. **Web**
   - Chart summary: identity header, family card with «إضافة فرد من العائلة» (phone prefilled), treating doctors («غير نشط»), custom fields by section, the owner's read-log card; edit (A-03-09's form), archive and restore with their questions; states archived, merged (link to the kept chart), not found or hidden (one page), loading, error, support read-only. The card frame is the one later specs add their cards to (CLN-01).
   - Merge (owner): pick the second chart, side by side, a choice per field, the confirmation naming both file numbers; states not active and done.
   - «من فتح هذا الملف»: full list paged by 50; none yet.
4. **Flutter** — none.
5. **End-to-end** (real backend) — the owner merges two charts and the merged number opens the kept chart; "my patients only" on hides a chart from a doctor (search and direct link). Screenshots light and dark on three sizes compared with the drawings; axe.

Tests written first: the two journeys; component tests from the sheets; chart states from the contract rows.
Estimated hand-written lines: ~3,600 (components ~600, summary ~1,200, merge ~800, read log ~300, journeys and tests ~700). Re-estimated at A-03-01 checkpoint 3.

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Screenshots compared with the drawings: <paths>
- Reviewer findings fixed: <list>

## Notes for the next session
- <only what is needed to resume>
