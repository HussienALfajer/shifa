# A-03-06 Custom field values on charts

Status: Planned · Tier: T0 · Branch: `feat/A-03-06-custom-field-values`
Spec: [A-03](../specs/patients/A-03-patients.md) criteria 4 (searchable values), 16, 17 (archived field not required, archived option kept, values purged), 40 (from A-03-01) · Requirements: PLT-30 to PLT-36 (values) · Decisions: ADR-0008, ADR-0047, OD-144

Fifth API slice of A-03, after A-03-05 (merged, #203). One slice, one PR: the work fits the ~4,000-line budget (ADR-0032), so it is not split.
Contract: delivers the rows of the [A-03 screen contract](../specs/patients/A-03-screen-contract.md) that name this slice, each proven by a contract test (ADR-0047). Where an earlier plan names a route, field or code differently, the contract wins (`customFields` → `fields`).

## Goal
Reception fills the clinic's fields on registration and edit; each member sees and edits only the fields their roles allow; sensitive values stay in the summary; searchable values join the search box; the owner sees how many charts hold each field and each choice.

## Contract rows delivered
| Row | Route | What this slice adds | Contract test |
|---|---|---|---|
| Save new | `POST /patients` | `fields` (`{ cf_key: value }`); 400 `validation_failed` at `body.fields.<key>`; 403 `field_not_editable` (`fields.<key>`) | create with every type, each refusal, the replay with `fields` |
| Edit | `PATCH /patients/:id` | `fields` (keys sent are written, `null` clears, keys left out are kept); same errors | edit, clear, 403, a held archived choice kept |
| Summary | `GET /patients/:id` (and every answer that returns `PatientChart`: create, edit, archive, restore) | `fields[]` the member may view: `key`, `label`, `section`, `order`, `type`, `value`, `sensitive`; by section, empty fields listed with `value: null` | per role: owner, reception, doctor, accountant |
| Results | `POST /patients/search` | `matchedBy: custom_field` | a searchable value finds its chart; unsearchable, archived, unviewable fields do not |
| List (owner's fields) | `GET /patients/fields/definitions` | `chartCount` per field and per option (improvement 8) | counts after writes, clears, a chart archived, a field purged |

## Plan
1. **Contracts** (`packages/contracts`, ~270)
   - `fields` on `CreatePatientRequest` and `UpdatePatientRequest`: a record keyed by `PatientFieldKey`, at most 20 entries, values of the stored shapes (string, number, boolean, string[], null).
   - `PatientChartField` and `fields[]` on `PatientChart`; `chartCount` on `PatientFieldDefinition` and its options; code `field_not_editable` in the error codes.
   - The browser and server share `checkPatientFieldValue` and `storedPatientFieldValue` (A-03-05); this slice adds `searchKeyOfPatientFieldValue(rules, value)` beside them (text folded with `foldArabic`, spaces as one; number canonical; date ISO; phone E.164; choices and yes/no: none), unit-tested in contracts.
2. **Database** (`/db-migration`, `/rls-policy`; expand only, one migration and its policy migration)
   - `patient_field_value`: `tenant_id`, `patient_id`, `field_id`, `value` jsonb (CHECK on `pg_column_size` ≤ 4 KB), `search_key` text null, `updated_by`, `updated_at`; key `(tenant_id, patient_id, field_id)`; FKs `(tenant_id, patient_id) → patient`, `(tenant_id, field_id) → patient_field`; index `(tenant_id, field_id, search_key) WHERE search_key IS NOT NULL` for search and `(tenant_id, field_id)` for counts. ENABLE + FORCE RLS on `current_tenant_id()`, classification entry (patient data), isolation case.
   - **Change from the first plan:** no separate `patient_search_value` table. The search key is a column of the value row, written for every value whose type has a key, searchable or not; search filters on the field being searchable at query time. A field that becomes or stops being searchable then needs no rewrite of up to 50,000 rows in one request, and one table means one policy and one isolation case less.
   - The chart foreign key is registered for A-03-08's merge registry (named in the slice notes of A-03-08; the registry itself is A-03-08's).
3. **API** (`apps/api/src/modules/patients/fields/`, ~1,450)
   - `field-values.ts` (new): read, check and write a chart's values. `patients.service.ts` is at 400 lines, so the values code lives here and the service only calls it.
   - **Write** in the chart's create and edit transaction: the live fields are loaded once; each key sent must be an active field the member's roles (`rolesInScope`) may edit, or 403 `field_not_editable` (an unknown or archived key: 400 `validation_failed`); values checked with the shared validator; defaults applied on create to editable fields not sent; required enforced as in the open points below; a choice the chart already holds stays valid after its option is archived, a new pick of an archived option is refused (criterion 17); phones through the A-01 normaliser. Empty values delete the row.
   - **Read**: one serialiser, `chartFieldsOf(tx, chartId, roles, now)`, called by `chartView`: live active fields the roles may view, in section order, values joined; nothing else returns values. `PatientCard` (search, family, duplicate candidates, lists) never carries `fields`, so sensitive values cannot reach them; a test proves each.
   - **Replay** of `POST /patients` with the same `id` and the same body (now with `fields`) returns the stored chart, stripped for the member who asks.
   - **Search** (A-03-03): a new path in `findHits` after the phone paths: the term's key per searchable type, matched by equality on `(tenant_id, field_id, search_key)` for live active searchable fields the member may view (no search through a field one cannot see); `matchedBy: custom_field`; ranked after file, phone and name matches; the 20 cap kept. Benchmark re-run at 50,000 charts × two clinics with 5 searchable fields filled.
   - **Counts**: `chartCount` per field (rows per field) and per option (`value = to_jsonb(id)` or `value ? id`), live charts only (active and archived, not merged), in one grouped query.
   - **Purge**: `purgeExpired` (A-03-05) deletes the values of the fields it purges in the same statement batch; chart writes call it first, as field writes do.
   - **Audit**: `patient.registered` and `patient.edited` list the custom field keys written, never values or labels.
4. **Web, Flutter** — none (A-03-09 and A-03-10 draw on these rows).
5. **End-to-end** — none (API slice; the journeys are A-03-09's).

## Decided with the owner (OD-146, 2026-11-28)
1. **Required and roles:** a required field is enforced only for members who may edit it; a reception member never fails registration because of a doctor-only required field.
2. **Required on edit:** an older chart that lacks a value of a field made required later can still be edited; only clearing a required value is refused.
3. **Searchable types:** text, long text, number, date and phone can be searchable by their value; choices and yes/no cannot (a field of those types may keep `searchable` off; A-03-05 then refuses `searchable` on them, ~30 lines).
4. **Search by phone value:** a phone field matches the full number in any accepted format, not its last digits.

## Tests written first
- Every type's value validation on the server, through the routes (the validator itself is tested in contracts) (16).
- Required and default on create; an archived field stops being required; a held archived choice kept on edit, the same choice refused on a new pick (17).
- View stripping and 403 `field_not_editable` per role on create, edit, and every answer returning `PatientChart` (16).
- Sensitive absent from search results, family, duplicate candidates and the 409 `possible_duplicate` answer (16).
- Search by a searchable value; an unsearchable, archived or unviewable field does not match; a field made unsearchable stops matching at once (4).
- Purge removes the values on the fake clock; a restored field within 30 days shows its values again (17).
- `chartCount` per field and choice (40).
- Isolation case for `patient_field_value`; leak test: no value or label in logs, spans, errors or audit.

Estimated hand-written lines: ~3,200 (contracts ~270, database ~250, values and stripping ~950, search ~350, chart counts ~100, tests ~1,280). Under the budget; checkpoint after the database and writes (~1,500) if the session runs long.

## Stopped at
Planned; plan refined after A-03-05 and approved by the owner 2026-11-28 (OD-146; second-session critique waived).

## Evidence
- `verify` (full): <summary line>
- Benchmark p95 with searchable fields: <figures>
- Reviewer and security-reviewer findings fixed: <list>

## Notes for the next session
- From A-03-05 (reviews N8, L3): archived fields are purged only inside the clinic's own requests (`purgeExpired` in `modules/patients/fields/field-store.ts`); a suspended or idle clinic never purges. Every value read must apply the cutoff (`isLive`), `purgeExpired` must also delete the purged fields' values, and chart writes should call it; criterion 17 ("values are removed") needs a worker or another purge path before values are stored for long (backlog "Purge without a worker").
- From A-03-05 (L1): view and edit roles of a value follow `rolesInScope` (tenant-wide roles and the active branch's), as the member's view does.
- `chartView` (`modules/patients/charts.ts`) takes no roles today; it gains them for the stripping, and every caller passes the scope's roles.
