# A-02 screen-to-API contract

Status: Draft. Admin web rows written at checkpoint 1 of [A-02-01](../../slices/A-02-01-design-and-screen-contract.md) (2026-11-26), awaiting the owner's approval; clinic web rows come at checkpoint 2 · Date: 2026-11-26 · Owner: product owner
Companion of [spec A-02](A-02-settings-entitlements-console.md) (ADR-0047, OD-117). Rows are added by the design slice from the approved drawings. After approval a row changes only in the slice that owns it, with the drawing updated and the owner told.

## How to read and use it
- One row per screen and state. A route used by several screens is listed once per screen, so each screen's needs stay visible.
- **Owner** is the API slice that delivers and tests the row: A-02-02 to A-02-07. An A-01 route keeps the A-01 slice that built it, unless a change is needed; the change is then owned by an A-02 slice.
- Each API slice proves its rows with contract tests: every field present with its type, every error and status answered as listed. The UI code slices (A-02-08 to A-02-10) check every row against the built API before they code.
- Never in a response or an error: support reasons in logs, override reasons in audit data, announcement text in logs, phones, tokens (spec, "Money, abuse and privacy").
- Every admin route below is `@PlatformAdmin` (super admin with the second factor passed). Their shared answers are not repeated per row: 401 `session_expired` → sign-in with the reason; 403 `forbidden` → the shell's "not allowed" page; a lost answer (no network) → the screen's own "not saved / not loaded" state named in its row. Timestamps are ISO date-times (UTC); the screens show them in the device's zone, and the usage day is the Damascus day.
- Labels of keys (`limits.practitioners` → «الأطباء», `session.idle_minutes` → «الخروج عند عدم النشاط», flag titles) come from i18n by key on the client; the API sends keys, never Arabic text, except text a person typed (reasons, announcement bodies, place names).

## Drawings
"Shifa Screens · Admin web", page "Proposals": `A02Clinic` (clinic page tabs), `A02Clinics`, `A02Flags`, `A02Announcements`, `A02Cities`, each with a tablet board (`…Tablet`), and the sheets `A02SheetUsageChart` and `A02SheetMultiCombobox`. Each board's state panel lists the states named in the rows below.

## Contract: admin web (checkpoint 1)

### Clinic page, «الاشتراك والحدود» (`A02Clinic`, states `sub` … `typeSaved`)
| Screen · state | Route (method, path) | Request fields | Response fields → what they drive | Errors and statuses → screen behaviour | Access | Owner |
|---|---|---|---|---|---|---|
| Limits · loaded (`sub`) | `GET /platform/clinics/:id/entitlements` (planned) | `id` | `plan` (`solo`/`multi_doctor`/`multi_branch`) → «الخطة» card; `items[]`: `key`, `kind` (`limit`/`feature`), `planValue` (number or boolean) → «الخطة»; `override` (`value`, `reason`, `expiresAt` nullable, `expired` boolean, `setByName`, `setAt`) or null → «التجاوز» cell (badge «حتى dd/mm/yyyy», muted strike and «انتهى …» when `expired`); `effective` → «السارية»; `used` (number or null: null for keys not yet counted, `limits.custom_fields` until A-03) → «المستخدم» or «—» | 404 `not_found` → the clinic-not-found page of A-01-10 | super admin | A-02-02 (`used`: A-02-03) |
| Limits · loading (`subLoading`) | same | | | still loading → Skeleton | | A-02-02 |
| Limits · failed (`subError`) | same | | | 5xx or no network → EmptyState «تعذّر التحميل» with «إعادة المحاولة» | | A-02-02 |
| Override · dialog and save (`override`, `overrideSaved`) | `PUT /platform/clinics/:id/overrides/:key` (planned) | `value` (number ≥ 0 for a limit, boolean for a feature), `reason` (1–500, trimmed), `expiresAt` (`YYYY-MM-DD` or null; end of that Damascus day) | the updated item (as above) → row updates, Callout «حُفظ التجاوز» | 400 `validation_failed` `body.reason` → field error «اكتب سبب التجاوز» (`overrideError`); `body.value` → field error; `body.expiresAt` (today or past) → field error «اختر تاريخًا بعد اليوم»; 404 `not_found` (clinic, or a key outside the catalogue) → close and reload | super admin | A-02-02 |
| Override · remove (`removeAsk`) | `DELETE /platform/clinics/:id/overrides/:key` (planned) | | the item without override → row updates | 404 `not_found` (no override) → reload the list | super admin | A-02-02 |
| Type change · preview (`typeChange`) | `GET /platform/clinics/:id/type-preview?type=` (planned) | `type` | `type`; `limits[]`: `key`, `current` (effective now), `next` (effective after: plan value of the new type, or the override that stays), `used`, `over` (boolean: `next < used`) → table, warning badge on `next`, Callout «الفروع فوق الحد الجديد» when any `over` | 400 `validation_failed` `query.type` (same type) → the radio of the current type is not offered | super admin | A-02-02 |
| Type change · done (`typeSaved`) | `PATCH /platform/clinics/:id` (existing, gains `type`) | `type` (with or without `status`, `subscriptionEnd`) | `ClinicDetail` with the new `type` → header, «الخطة» card, Callout «تغيّر نوع العيادة» | 400 `validation_failed` → keep the dialog, Callout danger; no network → «لم يصل الرد» as A-01-10 | super admin | A-02-02 |

### Clinic page, «الإعدادات» (`A02Clinic`, states `set` … `setNone`)
| Screen · state | Route (method, path) | Request fields | Response fields → what they drive | Errors and statuses → screen behaviour | Access | Owner |
|---|---|---|---|---|---|---|
| Settings · loaded (`set`, `setClinic`, `setLocked`) | `GET /platform/clinics/:id/settings` (planned) | `id` | `settings[]`: `key`, `value`, `source` (`default`/`platform`/`plan`/`organization`/… the scope that won) → «موروث من: الإعداد الافتراضي» / «من: العيادة» / «من: الإدارة»; `locked` (boolean) → Badge «مقفل من الإدارة», «فتح القفل» instead of «قفل بقيمة»; `lockable` (boolean) → the action shown; `choices` (the schema's allowed values, when an enum) → the Select of the lock dialog | 404 `not_found` → clinic-not-found page | super admin | A-02-04 |
| Settings · none (`setNone`) | same | | `settings: []` → EmptyState «لا إعدادات للعيادة بعد» | | | A-02-04 |
| Lock with a value (`setDialog` → `setLocked`) | `PUT /platform/clinics/:id/settings/:key/lock` (planned) | `value` (validated against the key's schema) | the updated setting → row, Callout «قُفل الإعداد» | 400 `validation_failed` `body.value` → field error; 409 `setting_not_lockable` (new) → close, Callout danger; 404 `not_found` (key unknown) → reload | super admin | A-02-04 |
| Unlock (`unlockAsk`) | `DELETE /platform/clinics/:id/settings/:key/lock` (planned) | | the setting with its new `value` and `source` → row | 404 `not_found` (not locked) → reload | super admin | A-02-04 |

### Clinic page, «دخول الدعم» (`A02Clinic`, states `sup` … `supSuspended`)
| Screen · state | Route (method, path) | Request fields | Response fields → what they drive | Errors and statuses → screen behaviour | Access | Owner |
|---|---|---|---|---|---|---|
| Support · form and log (`sup`, `supOpen`, `supEnded`) | `GET /platform/clinics/:id/support-grants` (planned) | `id` | `now` (server time, so time left does not trust the device clock); `mine` (this super admin's open grant or null) → card «دخولك مفتوح» with Badge «متبقٍّ n دقيقة» (from `expiresAt − now`, ticking each minute) or the form; `grants[]`: `id`, `adminName`, `reason`, `startedAt`, `expiresAt`, `endedAt` (null while open), `endedBy` (`admin`/`owner`/`expiry`) with `endedByName` → «سجل دخول الدعم» table («مفتوح حتى …», «انتهت المدة», «المالك: …») | 404 `not_found` → clinic-not-found page | super admin | A-02-05 |
| Support · open (`sup` → `supOpen`) | `POST /platform/clinics/:id/support-grants` (planned) | `reason` (10–500 after trimming), `minutes` (30, 60, 120, 240) | 201 `grant` (as above) and `handoffUrl` (single use, short-lived; the mechanism is the ADR of A-02-05) → card «دخولك مفتوح», the new tab opened at `handoffUrl` | 400 `validation_failed` `body.reason` → field error «اكتب سببًا من 10 أحرف على الأقل» (`supError`); 409 `support_active` (new) → Callout warning «لديك دخول مفتوح لهذه العيادة» with «عرض الدخول المفتوح» (`supActive`) | super admin | A-02-05 |
| Support · open the tab again («فتح عيادة الويب») | `POST /platform/support-grants/:id/handoff` (planned) | | `handoffUrl` → new tab | 409 `support_ended` (new) → reload: the grant moves to the log | the grant's super admin | A-02-05 |
| Support · end («إنهاء») | `POST /platform/support-grants/:id/end` (planned) | | the ended grant → Callout «انتهى دخولك» (`supEnded`), row in the log | 409 `support_ended` → reload | the grant's super admin | A-02-05 |
| Support · suspended clinic (`supSuspended`) | `GET /platform/clinics/:id` (existing) | | `status: suspended` → Callout info «العيادة موقوفة» above the form; opening is allowed (criterion 14) | | super admin | A-01-10 (no change) |

### Clinic page, «الاستخدام» (`A02Clinic`, states `use` … `useEmpty`)
| Screen · state | Route (method, path) | Request fields | Response fields → what they drive | Errors and statuses → screen behaviour | Access | Owner |
|---|---|---|---|---|---|---|
| Usage · loaded (`use`) | `GET /platform/clinics/:id/usage` (planned) | `id` | `today` (Damascus date) and `todayCounts` (`signIns`, `membersSignedIn`, `activeMembers`, `activeBranches`) → four figures; `lastActivityAt` → «آخر نشاط»; `days[]` (exactly 30, oldest first, zero-filled: `date`, `signIns`, `membersSignedIn`) → UsageChart (today last, gold) | 404 `not_found` → clinic-not-found page | super admin | A-02-07 |
| Usage · loading, none (`useLoading`, `useEmpty`) | same | | `hasData: false` (no counter row yet) → EmptyState «لا بيانات استخدام بعد» | 5xx or no network → «تعذّر التحميل» | | A-02-07 |

### Clinics list (`A02Clinics`)
| Screen · state | Route (method, path) | Request fields | Response fields → what they drive | Errors and statuses → screen behaviour | Access | Owner |
|---|---|---|---|---|---|---|
| List with usage (`list`, `sorted`) | `GET /platform/clinics` (existing, gains fields) | `search` (optional) | each `ClinicSummary` gains `lastActivityAt` (nullable) → «آخر نشاط» («اليوم 10:42», «أمس 18:05», «قبل n أيام», «لا نشاط بعد») and `signIns7d` (integer, the last seven Damascus days, today included) → «الدخول (7 أيام)»; both sortable on the client | as today (A-01-10) | super admin | A-02-07 |

### Flags (`A02Flags`)
| Screen · state | Route (method, path) | Request fields | Response fields → what they drive | Errors and statuses → screen behaviour | Access | Owner |
|---|---|---|---|---|---|---|
| Flags · list (`list`, `none`, `loading`, `error`) | `GET /platform/flags` (planned) | | `flags[]` (only flags declared in code): `key`, `defaultValue` (boolean), `mode` (`off`/`on`/`selected`; a flag without a row reports its default as `off` or `on`), `clinics[]` (`id`, `name`), `reason` (nullable), `updatedByName`, `updatedAt` (nullable: never changed) → rows with Badge (off for all: danger «مطفأة للجميع» when set as a kill switch, neutral when the default), the clinics, the reason and who changed it; `flags: []` → EmptyState | 5xx or no network → «تعذّر التحميل» | super admin | A-02-03 |
| Flags · change (`change` … `confirm`, `saved`) | `PUT /platform/flags/:key` (planned) | `mode`, `clinicIds` (required and non-empty when `selected`; kept but ignored otherwise), `reason` (1–500) | the updated flag → row, Callout «تغيّرت …» | 400 `validation_failed` `body.clinicIds` → picker error «اختر عيادة واحدة على الأقل» (`pickerError`); `body.reason` → field error (`reasonMissing`); 404 `not_found` (key no longer in code) → reload | super admin | A-02-03 |
| Flags · clinic picker (`pickerTyping`) | `GET /platform/clinics?search=` (existing) | `search` | `clinics[].id`, `name` → MultiCombobox options | as today | super admin | A-02-03 (search fix below) |

### Announcements (`A02Announcements`)
| Screen · state | Route (method, path) | Request fields | Response fields → what they drive | Errors and statuses → screen behaviour | Access | Owner |
|---|---|---|---|---|---|---|
| Announcements · list (`list`, `scheduled`, `ended`, `scheduledEmpty`, `empty`) | `GET /platform/announcements?status=` (planned) | `status` (`scheduled`/`active`/`ended`) | `counts` (`scheduled`, `active`, `ended`) → SegmentedControl counts, and all zero → EmptyState «لا إعلانات بعد»; `announcements[]`: `id`, `body`, `level` (`info`/`warning`) → Badge «معلومة»/«تنبيه», `startsAt`, `endsAt` (nullable) → period, `status`, `endedEarly` with `endedByName` → «أُنهي مبكرًا: …», `target` (`all`/`selected`) and `clinics[]` → «كل العيادات» / names, `createdByName`, `createdAt` | 5xx or no network → «تعذّر التحميل» | super admin | A-02-07 |
| Announcements · create (`form`, `formSome`, `linkError`, `created`) | `POST /platform/announcements` (planned) | `body` (1–280 after trimming, plain text), `level`, `startsAt`, `endsAt` (nullable, after `startsAt`), `target`, `clinicIds` (non-empty when `selected`) | 201 the announcement → Callout «جُدول الإعلان» or «نُشر الإعلان» (by `status`) | 400 `validation_failed` `body.body` (empty, too long), `body.endsAt`, `body.clinicIds` → field errors; 400 `announcement_link` (new; a URL, `www.`, an e-mail or markup in the body) → field error «لا يُقبل رابط في نص الإعلان» (`linkError`) | super admin | A-02-07 |
| Announcements · edit (`edit`) | `PATCH /platform/announcements/:id` (planned) | the same fields, all optional | the announcement → row | as create; 409 `announcement_ended` (new) → reload, the row is in «المنتهية» | super admin | A-02-07 |
| Announcements · end early or cancel (`endAsk`) | `POST /platform/announcements/:id/end` (planned) | | the announcement with `status: ended`, `endedEarly: true` → row moves to «المنتهية» | 409 `announcement_ended` → reload | super admin | A-02-07 |

### Cities and areas (`A02Cities`)
| Screen · state | Route (method, path) | Request fields | Response fields → what they drive | Errors and statuses → screen behaviour | Access | Owner |
|---|---|---|---|---|---|---|
| Places · list (`list`, `azaz`, `archived`, `empty`, `search`, `searchNone`) | `GET /platform/cities?includeArchived=` (planned) | `includeArchived` (boolean) | `cities[]`: `id`, `name`, `archivedAt` (nullable) → Badge «مؤرشفة»; `areas[]` (`id`, `name`, `archivedAt`) → areas column and «n مناطق»; search runs on the client with the shared Arabic fold (alef forms, taa marbuta, diacritics), the same as Combobox | `cities: []` → EmptyState «لا مدن بعد»; 5xx or no network → «تعذّر التحميل» | super admin | A-02-06 |
| Places · add | `POST /platform/cities`, `POST /platform/cities/:id/areas` (planned) | `name` (1–100, trimmed) | the city or area → list | 400 `validation_failed` `body.name` → field error; 409 `place_name_taken` (new; same folded name among the city's areas or among cities, archived included) → field error «“…” موجودة في حلب» (`dup`) | super admin | A-02-06 |
| Places · rename (`rename`) | `PATCH /platform/cities/:id`, `PATCH /platform/areas/:id` (planned) | `name` | the city or area | as add | super admin | A-02-06 |
| Places · archive (`archiveAsk`) | `POST /platform/cities/:id/archive`, `POST /platform/areas/:id/archive` (planned) | | the city or area with `archivedAt` | 409 `place_archived` (new; already archived) → reload | super admin | A-02-06 |

## Contract: clinic web (checkpoint 2)
To be written from the checkpoint 2 drawings. Routes already implied by the spec: `GET /clinic/capabilities` and `GET /clinic/subscription` (A-02-03), `GET /clinic/settings` with `source` and `locked` (A-02-04), the owner's banner and log, `POST /clinic/support-grants/:id/end` and the support session's 403 `support_read_only` and 401 `support_ended` (A-02-05), the city and area pickers and the branch's `cityId` and `areaId` (A-02-06), `GET /me/announcements` and the dismissal (A-02-07), and 409 `limit_reached` on the team and branch forms (A-02-03).

## Routes no screen uses
| Route | Why no screen uses it |
|---|---|
| Add-on create, edit, end (`addon`) | Spec criterion 1: add-ons exist with no screen in A-02; seeded or set by migration only |
| Plan values (`plan`, `plan_feature`) edit | Out of scope (spec): plans are seeded; the screens read them through the entitlements row |
| `support.elevate` | Reserved in the catalogue; grants nothing in Release 1 |

## Existing API met by these screens
Unprofessional or missing answers in A-01 routes that the A-02 screens meet, each with the API slice that fixes it.

| Route | Finding | Fix | Owner |
|---|---|---|---|
| `GET /platform/clinics` | The search is `ILIKE '%…%'` on the raw name: «احمد» does not find «أحمد», «الطبى» does not find «الطبي», and a match in the middle of a word counts; the clinic picker (flags, announcements) needs the same matching as Combobox | Search on a folded name (alef forms, taa marbuta, alef maqsura, diacritics) at the start of a word; one fold function shared with the cities search | A-02-03 |
| `GET /platform/clinics` | No `lastActivityAt` or `signIns7d` | Added from `usage_daily` and the clinic's last activity | A-02-07 |
| `GET /platform/clinics` | Returns every clinic with no page; fine for the pilot (tens of clinics), not for hundreds | Recorded in `docs/backlog.md`; no change in A-02 | — |
| `PATCH /platform/clinics/:id` | The type cannot be changed, and a type change has no audit row | Gains `type`; the plan follows the type at once; audited (criterion 18) | A-02-02 |
| `GET /clinic/settings`, `PATCH /clinic/settings` | `idleMinutes` is a column of `tenant`, with no source and no lock | Served by the cascade with `source` and `locked`; a write under a lock answers 409 `setting_locked` (new) | A-02-04 |
