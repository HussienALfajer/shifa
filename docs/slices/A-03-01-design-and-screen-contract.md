# A-03-01 Design slice: every A-03 screen and the screen-to-API contract

Status: Planned · Tier: T1 (it fixes the API contract; no product code) · Branch: `docs/A-03-01-design-and-screen-contract`
Spec: [A-03](../specs/patients/A-03-patients.md), section "Screens" (all of it), criteria 1–20 as seen on screen · Requirements: CLN-01, CLN-27, CLN-39 to CLN-45, PLT-07, PLT-08, PLT-13, PLT-30 to PLT-36, PLT-44, PLT-47 · Decisions: ADR-0040, ADR-0046, ADR-0047, ADR-0049, OD-80

First slice of A-03 (ADR-0047): nothing of A-03 is built before its drawings, contract and improvements are approved. It may run beside the A-02 UI code slices (A-02-08 to A-02-10): it writes no product code.

## Goal
The owner tests every A-03 screen in Play, decides each proposed improvement knowing its cost, and approves a written screen-to-API contract. The seven API slices then build and test against it, and the three UI code slices build the screens on top of it.

## Plan
Every board, as in A-02-01: Shifa Design System found by name and README read first (canvas copy refreshed), Shifa Guide rules, real bundle components, `--shifa-*` tokens and type styles only; clinic web's frame; Arabic RTL, light and dark; desktop 1440, tablet 1024 (reception), phone 390; synthetic data from `@shifa/testing` only; every state reachable by its action or a state panel outside the frame; checked for literal colours, unknown tokens and hand-drawn copies before showing, result written here. Page "Proposals" of "Shifa Screens · Clinic web" (ADR-0049).

### Checkpoint 1 — reception and charts (owner approval)
- `A03Search` «المرضى»: one box, results (name, file number, age with «~», sex, phone, family size), the owner's «المؤرشفة» filter, «مريض جديد»; a merged number leading to its chart («مدموج»); states: no patients («سجّل أول مريض»), no results (register with the typed name), loading, error, accountant without «مريض جديد», "my patients only" on.
- `A03Register` «مريض جديد» / edit (Drawer on desktop and tablet, full page on phone): name parts, phone with the family on it and the relation, sex, date of birth or age, second phone, previous number, treating doctors, custom fields by section (with the note that they are not for clinical data); states: duplicate candidates panel (open one, register anyway; archived marked), candidates hidden by "my patients only", validation, previous number taken, saving, offline, saved (file number, «فتح الملف», «تسجيل آخر»), archived chart asked again («اطلب من المالك»).
- `A03Chart` «ملف المريض»: identity header, family card with «إضافة فرد من العائلة», treating doctors («غير نشط» marked), custom fields by section, the owner's read-log card; actions edit, archive or restore, merge; states: archived, merged (leads to the kept chart), not found or hidden (one page for both), loading, error, support read-only.
### Checkpoint 2 — owner tools and settings (owner approval)
- `A03Merge`: pick the second chart (search), both side by side, a choice per identity field, custom fields filled, doctors joined, confirmation naming both file numbers; states: chart not active, done.
- `A03ReadLog` «من فتح هذا الملف»: full list paged by 50 (person, role, branch, time; «الدعم الفني» with the super admin's name); state: none yet.
- `A03Fields` «حقول ملف المريض»: fields by section with order, «7 من 20», «2 من 5 قابلة للبحث», add and edit Drawer (every type and its validation, options up to 250 with rename and archive, view and edit roles, sensitive, searchable, shown in print), archived fields with days left and restore; states: none yet, limit full, searchable full, sensitive and searchable refused together, type fixed after creation.
- `A03MyPatients` «مرضاي فقط»: the setting with its source and the A-02 lock.

### Analysis (both checkpoints; Arabic board for the owner, English in the repository)
1. **Screen-to-API contract** in `docs/specs/patients/A-03-screen-contract.md`, in the A-02 contract's form: one row per screen and state (route, request and response fields, every error and status with the screen's behaviour, permission, owning slice A-03-02 to A-03-08); every implied route listed or its absence explained. No name, phone or search term in a URL (criterion 6).
2. **Existing API met by these screens** (members for the doctor picker, capabilities, settings cascade, support session): anything unprofessional, assigned to an API slice.
3. **Spec gaps:** each added to the spec after the owner's answer.
4. **Improvements:** each with what it adds (API, component, screens), its estimated lines and the slice that carries it; accepted or declined one by one; accepted ones drawn and added to the spec as numbered criteria.
5. **Missing components** (candidates: an age-or-date field with «~», a phone field with the family preview, a side-by-side merge chooser, a field-type builder for options): each on its own sheet with every state, light and dark, RTL and LTR, both densities, and on its screens (ADR-0046).
### Checkpoint 3 — re-plan
`/slice-plan` re-estimates A-03-02 to A-03-11 with the contract and the accepted improvements; each slice file gains a "From A-03-01" section with its contract rows and components. The owner sees and approves the final slice count before A-03-02 starts.

Tests written first: none (no code). The proof is the owner's approval of both checkpoints, the contract reviewed with the spec, and the re-plan.
Estimated hand-written lines: ~1,000 in the repository (contract ~650, spec amendments ~150, slice and roadmap updates ~200); the drawings are in the design project.

## Stopped at
Planned.

## Evidence
- Token and component check of the artboards: <per checkpoint>
- Owner approvals (dates): <checkpoint 1, checkpoint 2, re-plan>
- Improvements accepted / declined: <list>

## Notes for the next session
- Drawing and artifact links are not committed (public repository, ADR-0040); record page and artboard names and approval dates here.
