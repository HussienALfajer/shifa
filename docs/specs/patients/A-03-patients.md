# Spec A-03: patients — registration, search, duplicates, family, summary, custom fields, chart-read audit

Status: Approved by the owner 2026-11-27; criteria 21–33 and 34–41 added from A-03-01 checkpoints 1 and 2 (owner, 2026-11-27) · Date: 2026-11-27 · Risk tier: T0 (patient data, tenancy/RLS, read audit, permissions, migrations) · Owner: product owner
Builds on [A-01a](../platform/A-01a-clinic-owner-sign-in.md), [A-01b](../platform/A-01b-team-roles-branches-switcher.md) and [A-02](../platform/A-02-settings-entitlements-console.md) (order: OD-75). Decisions: ADR-0004, ADR-0006, ADR-0008, ADR-0031, ADR-0034, ADR-0047; OD-42, OD-135 to OD-144. One spec by the owner's choice (OD-135), above the usual size. Screens: inventory below; drawn in the design slice before the API, with a screen-to-API contract (ADR-0047).

## Goal
Reception registers a patient in seconds and finds them again by name, phone or file number, however the name was spelled. Each clinic keeps its own chart per patient with its own file number, shared by all its branches; a family shares one phone; the clinic is warned before it creates a duplicate and the owner can merge one that slipped through. The chart summary is the frame later specs add their cards to. The owner adds up to 20 administrative fields to the chart, and sees who opened each chart. There is no import (OD-142).

Requirements: CLN-01 (identity part; later specs add their cards), CLN-27 (chart reads), CLN-39 to CLN-45, PLT-07 and PLT-08 (the per-clinic chart only; the global patient account and claiming are A-11), PLT-13 (custom-field limit enforced), PLT-30 to PLT-36 (print use stored, applied in A-08), PLT-44, PLT-47 (patient events and chart reads).

## User stories
- Receptionist → types «ريم احمد» in «المرضى» → finds «ريم أحمد الحلبي» (رقم الملف 1043) among close spellings.
- Receptionist → registers «مريض جديد» with a phone already in the clinic → sees the family on that phone, marks the child «ابنة» → the chart joins the family.
- Receptionist → registers «محمد خالد» with a phone and age that match a chart → sees «ملف مشابه موجود», opens it instead.
- Owner → merges two charts of the same person → one file number remains; the other leads to it.
- Owner → adds «جهة الإحالة» (single choice, searchable) in «حقول ملف المريض» → reception fills it on registration.
- Owner → opens «من فتح هذا الملف» on a chart → sees each opening with person, role, branch and time.

## Acceptance criteria
Registration and file number (OD-136, OD-137)
1. A chart holds the given name «الاسم» (required), father's name «اسم الأب» and family name «الكنية» (optional), mother's name «اسم الأم» (optional); each part 1–40 letters (Arabic or Latin), spaces, hyphen or apostrophe; the display name is given, father, family. Also required: contact phone «هاتف التواصل» (E.164 via the A-01 normaliser; +963 and +90), sex (ذكر، أنثى), and either a date of birth or an age (years, or months under 2), stored as an estimated date of birth with a flag and shown with «~». Optional: a second phone, the previous (paper) file number «رقم الملف السابق», treating doctors (criterion 9), custom fields (criteria 14–17). The branch where it was registered is kept.
2. Each new chart gets the clinic's next file number: one counter per clinic for all branches, starting at 1, never reused, no two charts share one under concurrent saves, and a failed save uses none. The previous file number is unique per clinic after trimming (409 `previous_file_number_taken`).
3. Chart ids are UUIDs chosen by the client, so A-05's offline registration (ADR-0031) needs no schema change; a replayed create with the same id and body returns the stored chart.

Search (OD-42, ADR-0034)
4. One search box finds active charts by name (normalised, typo-tolerant, any part order), by phone (any accepted format, or the last 7 or more digits), by file number, by previous file number, and by the value of a searchable custom field. Results: at most 20, best first; each shows display name, file number, age, sex, contact phone and family size. The owner can include archived charts. A merged chart's file number finds the chart it was merged into, marked «مدموج».
5. Name search runs inside the tenant's RLS on a name-token table (tokens of the normalised parts, matched by equality, then ranked by similarity), with no `LEAKPROOF` change, no superuser and no extra service (OD-42). Under the application role behind the pooler, with 50,000 charts in each of two clinics, search and the duplicate check answer within 150 ms at p95. The design is recorded as a new ADR amending ADR-0034.
6. The normaliser is the ADR-0034 one; the backlog gaps (ALM U+061C, U+2060, ؤ, digit and NFC variants) are decided and added to the shared vectors before search ships. The search term travels in the request body only.

Duplicates and merge (OD-139)
7. While registering, the form checks for candidates: the same contact phone with a similar given name, or a similar full name with a birth year within 2 years. Up to 5 candidates show, archived ones marked; reception opens one or registers anyway. The create is re-checked on the server: unacknowledged candidates answer 409 `possible_duplicate` with their ids; registering anyway is audited with the candidate ids.
8. The owner merges two active charts: picks the chart to keep, then for each identity field the value to keep (the kept chart's by default); empty custom fields are filled from the other chart and treating doctors are joined. The other chart becomes «مدموج» (read-only, never deleted) and leads to the kept one. Every later table that refers to a chart registers a merge step; a start-up check refuses a chart foreign key without one. A merge cannot be undone and is confirmed naming both file numbers.

Family (OD-138)
9. Charts with the same contact phone form a family. Each chart has an optional relation to the phone's holder «صاحب الهاتف، ابن، ابنة، زوج، زوجة، أب، أم، أخ، أخت، آخر». Typing a phone that exists shows the family; the summary lists the other members with «إضافة فرد من العائلة» (phone prefilled). Changing the phone moves the chart to that family.

Treating doctors and "my patients only" (OD-140)
10. A chart lists its treating doctors «الأطباء المعالجون» (doctor members of the clinic). A doctor who registers a chart is added; others pick one or more, or none; anyone who may edit the chart can change the list. A-04 and A-07 add doctors from appointments and visits.
11. The organization setting `patients.my_patients_only` (A-02 cascade; boolean, default off; owner) limits a member whose roles in the clinic grant doctor but not owner to charts listing them: search, family lists and the summary leave the rest out, a direct read answers 404 `not_found`, and duplicate candidates outside the list show only «ملف مشابه لدى طبيب آخر» with the file number.

Summary, archive and edit (OD-143)
12. «ملف المريض» shows identity (display name, file number, previous number, age, sex, phones, registered branch, state), family, treating doctors and custom fields by section. Later specs add their cards (CLN-01 alerts, visits, appointments, balance). Editing uses the registration form with the same checks.
13. Charts are never deleted. The owner archives and restores a chart; an archived chart is left out of search unless included, cannot be edited and shows «مؤرشف»; others asking to register it again are told to ask the owner.

Custom fields (OD-144, ADR-0008)
14. The owner manages «حقول ملف المريض» in clinic settings: Arabic label (English optional), type (text, long text, number, date, single choice, multiple choice, yes/no, phone; fixed after creation), required, validation (length or range, a text pattern), default, options (≤ 250; renamed or archived, never deleted), roles that view and roles that edit, section title and order, sensitive, searchable, shown in print (stored; A-08 uses it). The key is generated with the `cf_` prefix, immutable and never reused. The form says custom fields are not for clinical data.
15. `limits.custom_fields` (A-02; 20) counts active fields and archived ones within 30 days; one more answers 409 `limit_reached`, and the screen shows a full limit before sending; capabilities and the super admin's limits now report its use. At most 5 searchable (409 `searchable_limit`); a sensitive field cannot be searchable.
16. Values are validated against the definitions on the server and in the browser. A field a member's roles cannot view is absent from every answer to them; writing a field they cannot edit answers 403 `field_not_editable`. Sensitive values appear only in the summary, never in search results or lists.
17. Archiving a field hides it and stops it being required; it can be restored within 30 days; after 30 days its values are removed and it stops counting. Core fields (names, phones, sex, date of birth) are not custom fields and cannot be hidden or renamed.

Read audit and events (OD-141)
18. Each read of a chart's summary writes exactly one `patient.chart_viewed` row (actor, role, branch, time, chart id, and whether sensitive fields were included); search results and the duplicate check write none. In a support session the row is marked support (A-02 criterion 14).
19. The owner's card «من فتح هذا الملف» lists those rows for the chart, newest first, paged by 50: person, role, branch, time; support reads as «الدعم الفني» with the super admin's name.
20. Audit (A-01a criterion 14) also records chart created, edited (changed field keys, no values), archived, restored, merged (both ids), duplicate registered anyway (candidate ids), treating doctors changed, and custom field created, edited, archived, restored and purged.

Added at A-03-01 checkpoint 1 (owner, 2026-11-27; drawings `A03Search`, `A03Register`, `A03Chart`, contract `A-03-screen-contract.md`)
21. A search term needs 2 letters for a name; digits search from the first digit for a file number and from 7 for a phone tail; a shorter term is not sent. The answer says when more than 20 charts matched (`truncated`) and the screen asks for another word.
22. `GET /patients/count` gives the charts the member may see; with none at all the page shows «سجّل أول مريض» instead of results.
23. The session carries the member's effective permission keys (`permissions[]`, overrides included) and each summary carries `allowed` (edit, archive, restore, merge, read log) for that member, chart state and session, so no screen offers an action the server would refuse; the server still enforces each.
24. Each search result says why it matched (`matchedBy`: name, name variant, part order, phone, phone tail, file number, previous file number, custom field) and which name parts matched (`matchedParts`); the screen marks those words in a heavier weight, never a colour.
25. Under an empty search box, «فتحتها مؤخرًا» lists the last 8 distinct charts this member opened, from their own `patient.chart_viewed` rows, visibility applied (hidden charts left out, a merged one replaced by the kept one); reading it writes no `chart_viewed` row.
26. The results move with ↑ and ↓ and open with Enter; each result row is a link to the chart.
27. A duplicate candidate that is archived does not block registration: any member who may register can register anyway after acknowledging the candidates, audited with their ids (criterion 7); the screen says the owner could restore it instead.
28. Edits and archive send `expectedUpdatedAt`; a save after someone else's answers 409 `stale`, and the screen names who saved and when, with «تحميل التعديل الأحدث».
29. The relation to the phone's holder is asked only when the phone already has a holder; a phone new to the clinic makes the chart its holder.
30. After saving, «فرد آخر من العائلة» opens a new registration with the same contact phone.
31. Registration and edit open as a wide side panel (550 px, Drawer `size="wide"`) on desktop and tablet, and as a full page on a phone.
32. The summary shows the registering branch and date, and who last edited the chart and when (`createdAt`, `createdByName`, `updatedAt`, `updatedByName`).
33. «من فتح هذا الملف» on the chart always lists at least the current opening; the full log keeps a "none yet" state for safety only.

Added at A-03-01 checkpoint 2 (owner, 2026-11-27; drawings `A03Merge`, `A03ReadLog`, `A03Fields`, `A03MyPatients`)
34. The merge proposes the older chart (lower file number) as the one kept; the owner can swap. Only differing identity fields are offered, each defaulting to the kept chart's value; when the kept contact phone differs and the kept chart has no second phone, the other contact phone becomes its second phone.
35. A chart that is archived or merged cannot be merged (409 `patient_not_active`); the merge sends `expectedUpdatedAt` for both charts and a change meanwhile answers 409 `stale` with nothing merged.
36. The full read log pages by page number (50 per page) and shows whether sensitive fields were included in each opening; a filter shows support openings only, with the count of each (`supportTotal`).
37. A choice field needs at least 2 active choices; choice names are unique within a field and active field labels unique in the clinic, both after Arabic folding.
38. Fields move up and down within their section; sections keep their creation order.
39. A text field's value shape is a preset (any text, digits only, letters only) or a custom expression, which the server checks with a safe engine and a length cap.
40. The fields list and the choice editor show how many charts hold each field and each choice, and the archive question names the number of charts whose values will be removed.
41. «مرضاي فقط» shows its impact before and after it is on: doctors it covers out of all doctors, doctors who are also owners (not covered), and charts with no treating doctor; numbers only.

## Edge cases and offline
- Twins on one phone: different given names are no duplicate; the same name warns and reception registers anyway.
- A child without a phone uses a guardian's; an Azaz patient a +90 number.
- An age later corrected to an exact date clears the flag.
- A deactivated doctor stays on treating lists marked «غير نشط» and is not offered.
- Merging charts with different phones: the kept phone decides the family.
- A field archived while required stops being required; an archived option stays on charts that hold it and is not offered.
- Offline: A-03 needs the network; forms show the offline state and never save silently. Offline walk-in registration and its file number at sync are A-05.

## Permissions
| Action | Owner | Doctor | Receptionist | Assistant | Accountant | Support session |
|---|---|---|---|---|---|---|
| Search, open summary (`patients.view`) | ✓ | ✓ (criterion 11) | ✓ | ✓ | ✓ | read |
| Register, edit, family, treating doctors (`patients.manage`) | ✓ | ✓ | ✓ | ✓ | – | – |
| Archive, restore, merge (`patients.archive`, `patients.merge`) | ✓ | – | – | – | – | – |
| Custom field definitions (`patients.fields.manage`) | ✓ | – | – | – | – | read |
| Chart read log (`patients.read_log.view`) | ✓ | – | – | – | – | read |
| "My patients only" (`clinic.settings.manage`) | ✓ | – | – | – | – | read |
Custom field values follow each field's view and edit roles. Branch-scoped members see the whole clinic's charts (patients are shared across branches).

## Money, abuse and privacy
No money. Tenant scoping: the chart, the file-number counter, name tokens, treating doctors, searchable values and field definitions carry `tenant_id` with FORCE RLS and isolation cases; later tables refer to a chart by `(tenant_id, patient_id)` (backlog "Patient ids on commands"). A-03 adds no global patient table (the account is A-11). Abuse: staff browsing charts (18, 19), scraping through search (20 results, a per-member rate limit, ids are UUIDs), hidden charts reached by id (11, 404), duplicates (7, 8). Never in logs, spans, errors, audit or URLs: names, phones, dates of birth, previous file numbers, search terms, custom field values and labels. Synthetic data only; the generator produces charts of this shape.

## Verification contract
| Criteria | Proof |
|---|---|
| 1, 2, 3 | API tests: required and optional parts, both phone countries, age to estimated date; concurrent creates give distinct numbers and a failed save none; replayed create returns the stored chart; previous number unique |
| 4, 6 | API tests per search path (name variants from the vectors, phone formats and last digits, file and previous number, custom field), archived and merged results, the 20 cap; vectors run on TypeScript and Dart ports; the term absent from logs and URLs (leak test) |
| 5 | Benchmark test at 50,000 charts × two clinics under the app role behind PgBouncer (p95 ≤ 150 ms); query plan uses the token index; ADR written |
| 7 | API tests: each candidate rule, archived candidates, 409 on an unacknowledged create, audit row on register anyway |
| 8 | API tests: field choice, custom field fill, doctors joined, merged chart read-only and found by its number; start-up check fails on an unregistered chart foreign key |
| 9, 10 | API tests: family by phone, relation, phone change moves the chart; treating doctors on create by role, edit |
| 11 | Route matrix with the setting on and off: search, family, summary 404, candidate shape; owner-doctor sees all |
| 12, 13 | Contract test of the summary; archive and restore rules; edit refused on archived |
| 14–17 | API tests: every type and validation, limit 409 and use in capabilities, searchable limit, view stripping and 403 on edit per role, sensitive kept out of lists, 30-day restore and purge on a fake clock |
| 18–20 | API tests: one row per summary read and none for search; support marking; log paging and contents; one audit row per event without values; isolation cases for every new table |
| 21, 22, 24, 25, 26 | API tests: term lengths, `truncated` at 21 matches, `count` under "my patients only", `matchedBy` and `matchedParts` per search path, recent list (distinct, visibility, merged replaced, no audit row); UI journey: arrows and Enter open a chart |
| 23 | Contract tests of `permissions[]` with an override and of `allowed` per role, chart state and support session |
| 27, 28, 29 | API tests: archived candidate registered anyway and audited; 409 `stale` on edit and archive; relation required only with a holder |
| 30, 31, 32, 33 | UI checks against the drawings; contract test of the summary's created and updated fields |
| 34, 35 | API tests: default kept chart, differences only, second phone filled, 409 `patient_not_active` and `stale` |
| 36 | API tests: page numbers, `sensitiveIncluded`, support filter and `supportTotal` |
| 37, 38, 39 | API tests: two choices minimum, folded uniqueness of choices and labels, order within a section, presets and an unsafe custom expression refused |
| 40, 41 | API tests: chart counts per field and choice; impact numbers (covered doctors, owner-doctors, charts without a doctor) |
| Screens | Design slice: drawings, screen-to-API contract and analysis approved; API slices: each contract row proven by a contract test; UI code slices: browser screenshot compared with the approved drawing; Playwright journeys against the real backend (register with a family phone; duplicate warning then open existing; search by a variant spelling; owner merges; "my patients only" hides a chart) |

## Screens (inventory; drawn before the API, ADR-0047)
Clinic web only, Arabic RTL, light and dark; desktop, 10-inch tablet (reception) and phone.
Reception and charts:
- **«المرضى» (search)**: one box, results with name, file number, age, sex, phone, family size; owner's «المؤرشفة» filter; «مريض جديد». States: clinic without patients («سجّل أول مريض»), no results (register with the typed name), loading, error, accountant without «مريض جديد».
- **«مريض جديد» / edit (drawer on desktop, full page on phone)**: name parts, phone with the family on it and relation, sex, date of birth or age, second phone, previous number, treating doctors, custom fields by section. States: duplicate candidates panel, candidates hidden by "my patients only", validation, previous number taken, saving, offline, saved (file number shown, «فتح الملف» or «تسجيل آخر»).
- **«ملف المريض» (summary)**: identity header, family card with «إضافة فرد من العائلة», treating doctors, custom fields, read log card (owner); actions edit, archive or restore, merge. States: archived, merged (leads to the kept chart), not found or hidden, loading, error, support read-only.
- **Merge (owner)**: pick the second chart, both side by side, a choice per field, confirmation with both numbers. States: chart not active, done.
- **«من فتح هذا الملف»**: full list, paged. State: none yet.
Clinic settings:
- **«حقول ملف المريض»**: fields by section with order, «7 من 20», «2 من 5 قابلة للبحث», add and edit drawer, archived fields with days left and restore. States: none yet, limit full, searchable full.
- **«مرضاي فقط»**: the setting with its source and lock (A-02).

## Out of scope
Import of any kind, from Excel or other systems (OD-142); the global patient account, family profiles in the app and claiming charts (A-11); alerts, visits, history (A-07); appointments (A-04); balance (A-06); print of custom fields (A-08); offline registration (A-05); data export (A-12); cross-clinic matching; custom fields on other entities.

## Open questions
None.
