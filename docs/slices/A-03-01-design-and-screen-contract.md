# A-03-01 Design slice: every A-03 screen and the screen-to-API contract

Status: In progress (checkpoint 1 approved 2026-11-27; checkpoint 2 next) · Tier: T1 (it fixes the API contract; no product code) · Branch: `docs/A-03-01-design-and-screen-contract`
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
Checkpoint 1 approved by the owner (2026-11-27): the three screens, their contract rows, spec gaps 1–9 (gap 6 option a), improvements 1–5, the components RecordList, RecordHeader, DescriptionList and the Drawer «wide» change; the answers are spec criteria 21–33. Next: checkpoint 2 (`A03Merge`, `A03ReadLog`, `A03Fields`, `A03MyPatients`).

## Checkpoint 1 (reception and charts)
### What is drawn
"Shifa Screens · Clinic web", page "Proposals", below the A-02 rows: one row per screen, the desktop board (1440) with its state panel, then the tablet (1024) and the phone (390). The design system's copy on the canvas was refreshed to version `1795743045-04ed` (the bundle now holds PageBanner, UsageChart and MultiCombobox; tokens unchanged). Layout from tokens in `a03/a03.css` on top of `a02/a02.css`.
- `A03Search` «المرضى» (16 states): empty box with search hints and «فتحتها مؤخرًا» (improvement 2); a name typed another way («ريم احمد» finds «ريم أحمد الحلبي», «ريما…», another part order); a phone (the whole family, each with its relation); a file number; a merged number (Badge «مدموج», leads to 1043); more than 20 (Callout); the owner's «مع المؤرشفة»; one letter; no result (register with the typed name); no patients («سجّل أول مريض»); loading, error, rate limited; the accountant without «مريض جديد»; a doctor with «مرضاي فقط»; a support session (PageBanner, «للقراءة فقط»). Each result shows name (matched words in bold), why it matched (improvement 1), file number, sex and age («~» when estimated), phone and family size; the whole row opens the chart; ↑ ↓ Enter on desktop.
- `A03Register` «مريض جديد» / edit (16 states): a wide side panel over «المرضى» on desktop and tablet, a full page on the phone. Sections: name parts with the display name previewed; contact phone with the family on it (each member a link) and the relation to the holder, or «رقم جديد»; second phone; sex; date of birth or age (years, or months under 2) with the «~» note; previous number; treating doctors (MultiCombobox, inactive kept, not offered); the clinic's fields by section with the line that they are not for clinical data. States: blank, a phone with a family, a new phone, by age, an infant, edit (phone change moves the family), duplicate candidates (open one, or tick «تحققت…» and «حفظ ملف جديد على أي حال»), an archived candidate, a candidate hidden by «مرضاي فقط» (file number only), someone else saved first (`stale`), validation, previous number taken, saving, offline, no answer (safe retry), saved (the file number large, «فتح الملف», «تسجيل آخر», «فرد آخر من العائلة»).
- `A03Chart` «ملف المريض» (16 states): identity header (name, «ملف 1043», sex, age, phones, previous number, registered branch and date, last edit), «العائلة» with «إضافة فرد من العائلة», «حقول العيادة» by section (a sensitive field marked «حساس», seen by the owner only here), «الأطباء المعالجون» («غير نشطة» kept), the owner's «من فتح هذا الملف» (last five, «الدعم الفني» marked, «السجل كاملًا»), and dashed places where A-04, A-06 and A-07 add their cards (drawing only). States: owner, the owner's menu (merge, print later, archive), reception, a doctor with «مرضاي فقط» (family member not theirs left out, no sensitive field), the accountant (read only), a support session, estimated age (Tooltip), alone on the phone, no treating doctor, the archive question, archived for the owner (restore) and for others (ask the owner), merged (leads to 1043), not found or hidden (one page), loading, error.

In Play the results and family rows open the chart, the crumbs go back to «المرضى», «حفظ» runs saving then saved, and the state panel reaches every state. A choice inside a bundle component cannot tell the board (the components are islands); those states are reached from the state panel. Choosing a state remounts the page, so fields show that state's values.

### Design system check
- Shifa Design System found by name, README read, canvas copy refreshed (bundle, its stylesheet, tokens) and its record updated.
- Round 2 (owner, 2026-11-27: real components on every screen, a new one drawn where none fits). Every control, badge, callout, field, empty state, skeleton, question, banner, menu, tooltip and table is the bundle's (`Shifa.*`); «من فتح هذا الملف» is the real DataTable with a wrapping column, as the owner asked for the support log in A-02-01. What no bundle component holds is one of three proposed components, each drawn once from tokens and mounted from that one source by the screens and its sheet: `A03RecordList` (results, family, candidates, treating doctors, recently opened), `A03RecordHeader` (the chart's identity, the saved file), `A03DescriptionList` (the clinic's fields). The form panel stays drawn from the Drawer's tokens, since the bundle's Drawer takes text fields only (proposed change 1, wide).
- Static check of every A-03 board, the components, the sheets, `a03/a03.css` and `a03/components.css` (script in the session's scratchpad): 0 literal colours, 0 unknown `--shifa-` names; literal lengths only for board sizes, placeholder sizes and the 358 px narrow specimens.
- Every state of `A03Search`, `A03Register` and `A03Chart` rendered in Chromium on the three sizes, light and dark, with a local copy of the canvas runtime (288 renders): 0 page errors, 0 unfilled values, nothing wider than its window, except the owner's «المزيد» menu on tablet and phone, which opens as the Menu's bottom sheet over the whole board (a portal, as in the app). The four sheets rendered with 0 errors.

### Spec gaps (answers go into the spec after approval)
1. Search term lengths: a name needs 2 letters; digits search from the first digit for a file number, from 7 for a phone tail. Drawn so (`short`).
2. Search tells the screen when more than 20 charts matched (`truncated`), so it can ask for another word. Drawn so (`many`).
3. The first-patient state needs to know the clinic has no chart: `GET /patients/count`, which also gives the page line «1,284 ملفًا».
4. The summary shows who registered the chart and who last edited it, and when («آخر تعديل 20/11/2026 بيد سمر قدور»).
5. «من فتح هذا الملف» can never be empty on the chart, since the owner's own opening is its first row; the "none yet" state of the full log only shows if the log is opened without the summary. Proposed: keep it as a safety state only.
6. An archived candidate during registration by someone other than the owner: they may still register anyway, acknowledged and audited, with the note that the owner could restore it instead (`dupArchived`). Owner's choice (a), 2026-11-27; the refusal (b) was not taken.
7. Two people editing one chart: the edit sends `expectedUpdatedAt` and a stale save answers 409 `stale` with «عدّل غيرك هذا الملف للتو». Accepted and drawn (`stale`).
8. The relation is only asked when the phone already has a holder; a new phone makes the chart its holder.
9. The screens need the member's effective permissions (`permissions[]` in the session) and each chart's allowed actions (`allowed`), so nothing is offered that the server would refuse.

### Improvements (each accepted or declined by the owner; estimates are hand-written lines)
| # | Improvement | Adds (API · component · screens) | Lines | Slices |
|---|---|---|---|---|
| 1 | Why each result matched («الاسم بتهجئة قريبة», «الهاتف · ابنة», «الملف 1077 دُمج هنا») and the matched words in bold | `matchedBy`, `matchedParts` in search results · none · result rows | ~180 | A-03-03, A-03-09 |
| 2 | «فتحتها مؤخرًا»: the last 8 charts this member opened, under the empty search box | `GET /patients/recent` from the member's own `patient.chart_viewed` rows, visibility applied · none · search page | ~220 | A-03-07, A-03-09 |
| 3 | «فرد آخر من العائلة» after saving: a new form with the same phone | none · none · saved state | ~40 | A-03-09 |
| 4 | Keyboard on the results: ↑ ↓ to move, Enter to open | none · none · search page | ~80 | A-03-09 |
| 5 | A wide form panel (550 px) so name parts sit two by two (component change 1, sheet `A03SheetDrawerWide`) | none · Drawer `size="wide"` · form | ~120 | A-03-09 |

### Owner review, search (2026-11-27)
- Spec gaps 1 (term lengths), 2 (`truncated`), 3 (`GET /patients/count`) and 9 (`permissions[]` in the session, `allowed` on the chart) accepted as drawn; written into the spec with the other checkpoint 1 answers.
- Improvements 1 (why each result matched, matched words heavier), 2 («فتحتها مؤخرًا») and 4 (arrows and Enter on the results) accepted.
- RecordList or DataTable for the results: the owner chose RecordList (option 1 of three: one component for every list of people; its header and row heights follow the DataTable's tokens, `shifa-table-row-height`). The DataTable stays for records that are read, sorted and paged («من فتح هذا الملف»).

### Owner review, registration (2026-11-27)
- Spec gap 6: option (a), an archived candidate may still be registered anyway after the acknowledgement, audited like any other; the state that refused it (`archivedAsk`) is taken off the board.
- Spec gap 7 accepted and drawn (`stale`: a stale edit answers 409 `stale`; Callout naming who saved and when, «تحميل التعديل الأحدث»).
- Spec gap 8 accepted as drawn (the relation is asked only when the phone has a holder).
- Improvements 3 («فرد آخر من العائلة») and 5 (Drawer «wide», sheet `A03SheetDrawerWide`) accepted.
- RecordList (family, candidates) and RecordHeader (the saved file) approved by the owner.

### Owner review, chart (2026-11-27)
- Spec gaps 4 (created and last edited by whom and when) and 5 (the card is never empty; "none yet" only on the full log) accepted as drawn.
- DescriptionList approved. With RecordList, RecordHeader and the Drawer «wide» change, every checkpoint 1 component is approved.
- Checkpoint 1 approved (2026-11-27); its answers are criteria 21–33 of the spec.

### Component changes (proposed)
1. **Drawer: a wide size** (improvement 5; sheet `A03SheetDrawerWide`). `size="wide"`: `shifa-size-drawer` plus `shifa-width-37-5` (550 px), never wider than the screen; the default stays 400 px; on a phone the form is a page, not a drawer. Approved with the screens (ADR-0046), then built with `/ui-component` in A-03-09.

### Missing components (proposed; each on its sheet, every state, light and dark, Arabic RTL and English LTR, both densities, a 358 px width)
1. **RecordList** «قائمة السجلات» (sheet `A03SheetRecordList`, source `A03RecordList`): rows of people or records; avatar, title with the matched words in a heavier weight, a second line of badges and short texts, optional columns, and at the end a chevron (the row is a link), a button or a badge; three layouts (table, two lines, tiles), sizes md and sm; a locked row (no name, no avatar) for a chart hidden by "my patients only"; dim (archived), current; loading and empty. One Tab stop, arrows and Enter (code). Used by search, recently opened, family (form and chart), duplicate candidates, treating doctors. Estimate ~450 lines (component, stories, tests, screenshots) in A-03-09.
2. **RecordHeader** «رأس السجل» (sheet `A03SheetRecordHeader`, source `A03RecordHeader`): a record's identity at the top of its page: avatar, title, the record number in a gold tag, badges (one with a Tooltip for an estimated age), facts, a meta line, actions (buttons and one menu) or «للقراءة فقط»; muted for archived or merged; compact in a panel (the saved file); loading. Estimate ~300 lines in A-03-10.
3. **DescriptionList** «قائمة الوصف» (sheet `A03SheetDescriptionList`, source `A03DescriptionList`): labels and values by section, «—» for an empty value, one badge per value («حساس»), latin values isolated, one or two columns; loading. Estimate ~200 lines in A-03-10.
- Not new components: age or date of birth with «~» (SegmentedControl, DatePicker, NumberInput, Select), the phone with its family (Input, Callout, RecordList, Select), the duplicate box (Callout, RecordList, Checkbox).
- The merge chooser and the field-type builder are drawn at checkpoint 2.

## Evidence
- Token and component check of the artboards: checkpoint 1, 0 literal colours, 0 unknown tokens on the three screens (all sizes), the three proposed components, the four sheets and both stylesheets; 288 browser renders with 0 errors (2026-11-27); checkpoint 2: <pending>
- Owner approvals (dates): checkpoint 1 2026-11-27 (search, registration, chart, the four component sheets); checkpoint 2 <pending>; re-plan <pending>
- Improvements accepted / declined: 1–5 accepted (2026-11-27); none declined

## Notes for the next session
- Drawing and artifact links are not committed (public repository, ADR-0040); record page and artboard names and approval dates here.
