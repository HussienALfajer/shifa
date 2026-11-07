# Healthcare Data Standards & Specialty Clinical Template Requirements (for EMR + Template Engine design of a Syrian multi-tenant clinic SaaS)

Research date: 2026-11-07. Web research only. Every claim carries an inline source. Where a statement is my own design reasoning it is placed under "Inferences", and anything I could not source is under "Gaps".

---

## 1. HL7 FHIR version status in 2026 and how FHIR resources map to a clinic system (practitioner in multiple orgs, scheduling, IPS)

### Takeaway
FHIR R4 (4.0.1, 2018) is still the version everything ships on: SDC, IPS, HAPI and Medplum. R5 (2023) is the "current published" version. R6 is in its normative ballot cycle in 2026, with the second full ballot in mid-2026 and no fixed publication date. R6 also moves Invoice and ChargeItem out of core. A new clinic SaaS should therefore model internally in R4/R5-compatible shapes, expose an R4 API now and plan an R6 migration path. Billing should be its own domain model rather than relying on FHIR core resources.

### Cited Findings
**Version status**
- R4 (4.0.1) was published on Dec 27, 2018 as "Release 4 (1st Normative Content + Trial Use Developments)". R4B (4.3.0) was released on May 28, 2022. R5 (5.0.0) was published on Mar 26, 2023, and the history page still calls it the "current published version". — [HL7 FHIR Version History](https://hl7.org/fhir/history.html)
- FHIR v6.0.0-ballot5 is titled "R6 Ballot (2nd Full Ballot)" and was generated on Jul 17, 2026. In its words: "ALL of the specification is being balloted as a full Normative ANSI Standard"; "no draft or trial-use content remains"; and "once this ballot is complete, no breaking changes to normative content are allowed". It also says breaking changes from R5 are allowed, because R5 was not normative, and that "There is certain to be another ballot after this". No publication date is given. — [R6 Ballot 5 intro](https://hl7.org/fhir/6.0.0-ballot5/ballot-intro.html)
- R6 ballot 5 lists 32 resources moved out of core into incubator IGs, including **ChargeItem, Invoice**, Contract, InsurancePlan, DeviceUsage, GraphDefinition, StructureMap, SupplyRequest, TestScript and Transport. MedicationRequest, MedicationDispense, MedicationStatement and Observation are named as changed. — [R6 Ballot 5 intro](https://hl7.org/fhir/6.0.0-ballot5/ballot-intro.html)
- The CI build (build.fhir.org) was labelled "FHIR v6.0.0-snapshot1", package hl7.fhir.r6.core#6.0.0-snapshot1, generated Oct 21, 2026. Its note to balloters still reads "first full ballot of R6", which is inconsistent with ballot5 being the second full ballot. — [FHIR CI-Build](https://build.fhir.org/)
- The first full normative R6 ballot ran in the January 2026 cycle. HL7 Canada comments were due Jan 14, 2026. — [Infoway forum: Jan 2026 ballot package](https://infocentral.infoway-inforoute.ca/en/forum/266-fhir-implementations/6863-hl7-international-jan-2026-ballot-package-for-download)
- Other R6 moves out of core: PersonalRelationship, EncounterHistory and InsuranceProduct went to admin-incubator. Permission went to data-access-policies, while Consent stays in core. Several device, inventory and medication-definition resources moved as well. The article is dated Mar 19, 2026. — [Health Samurai: FHIR additional resources](https://www.health-samurai.io/blog/fhir-additional-resources)
- Estimates of when R6 will be final vary from "late 2026" to "2027 at the earliest". MITRE expects R4 to stay the primary US version through 2030, and US Core will not support R6 before v11 (2028). These are secondary or vendor sources. — [Health Samurai R6 prep](https://www.health-samurai.io/blog/getting-ready-for-fhir-r6-what-you-need-to-know); [MITRE FHIR Versions](https://mitre.github.io/fhir-for-research/modules/fhir-versions); [Redox](https://redoxengine.com/blog/fhir-r6-enhancements-for-care-coordination-rpm-prior-auth-and-more/)
- SDC IG current published version is 4.0.0 (STU 4), based on FHIR R4. The CI build is 4.0.0-ci-build. — [SDC IG](https://hl7.org/fhir/uv/sdc/); [SDC CI build](https://build.fhir.org/ig/HL7/sdc/)
- IPS IG current published version is 2.0.1 (STU 2), based on FHIR R4. — [IPS IG](https://hl7.org/fhir/uv/ips/)

**Practitioner working in multiple organizations (PractitionerRole)**
- PractitionerRole records the roles, services and settings in which a practitioner works at an organization. A practitioner may have multiple PractitionerRole records, or one record with several roles. The organization need not be the direct employer, and a role can be limited to a `period`. — [FHIR R5 PractitionerRole](https://hl7.org/fhir/R5/practitionerrole.html)
- Every detail in a multi-location PractitionerRole applies to all of its locations. If contact details, availability or services differ by location, a separate record is needed, and many implementations profile it down to one location/role/service. "There is no address on the PractitionerRole as the location... contains the address." — [FHIR R5 PractitionerRole](https://hl7.org/fhir/R5/practitionerrole.html)
- R5 changes: `availableTime`/`notAvailable` moved under a structured `availability` (Availability datatype), and `telecom` moved under `contact` (ExtendedContactDetail). `communication` and `characteristic` are new. "Qualifications (from the Practitioner resource) do not imply a Role." — [FHIR R5 PractitionerRole](https://hl7.org/fhir/R5/practitionerrole.html)

**Scheduling model (Schedule / Slot / Appointment)**
- Schedule is a container for bookable time slots for one service or resource. It sets `planningHorizon` (the period during which appointments are accepted) and "does not provide any information about actual appointments", a separation that helps with privacy. — [FHIR R5 Schedule](https://hl7.org/fhir/R5/schedule.html)
- Slots reference the Schedule (`Slot.schedule`); they are not contained in it. They are the smallest bookable units: open, booked or blocked. Several slots may share the same time (e.g., 12 seats in a group session). Slots change often, while the Schedule changes only occasionally. — [FHIR R5 Schedule](https://hl7.org/fhir/R5/schedule.html)
- `Schedule.actor` (1..*) can reference Patient, Practitioner, PractitionerRole, CareTeam, RelatedPerson, Device, HealthcareService or Location. A practitioner at several locations may have one schedule per location listing both the practitioner and the location. Booking a multi-resource appointment (two doctors + device + room) may mean checking several schedules. — [FHIR R5 Schedule](https://hl7.org/fhir/R5/schedule.html)
- Server business rules decide overbooking: a client may attempt to book a busy slot. `serviceType` became a CodeableReference to HealthcareService in R5. — [FHIR R5 Schedule](https://hl7.org/fhir/R5/schedule.html)

**Clinical documents**
- Composition.status is preliminary | final | amended | entered-in-error. A final composition is not altered and later work goes into a new version. Documents are immutable Bundles (type "document") with Composition first. `attester.mode` is personal | professional | legal | official. `relatesTo` codes are replaces | transforms | signs | appends. — [FHIR R4 Composition](https://hl7.org/fhir/R4/composition.html)

### Inferences
- **Architect's resource map** (based on FHIR resource scopes; not individually re-verified in this session):
  - Tenancy and organization: Organization (the clinic tenant, plus a child Organization or Location per branch), Location (branch, room, chair), HealthcareService (bookable service, e.g. "Dental cleaning 30 min").
  - People: Practitioner (one global identity, holding licence and qualification) plus a PractitionerRole per tenant/branch/specialty. This is exactly the "doctor working in 2 clinics" case. Patient (per-tenant chart record) and RelatedPerson (guardian, spouse, payer for a child).
  - Scheduling: Schedule (one per PractitionerRole × Location), Slot, Appointment, and AppointmentResponse when several participants must accept.
  - Clinical: Encounter (the visit), Observation (vitals, scores, measurements, tooth- or eye-level findings), Condition (diagnoses, ICD-coded), AllergyIntolerance, MedicationRequest (prescription), MedicationStatement (patient-reported meds), Procedure (done treatments, including dental procedures per tooth), ServiceRequest (lab/imaging orders, dental lab orders), DiagnosticReport + ImagingStudy (results and DICOM), DocumentReference (scans, PDFs, photos), Immunization, CarePlan (treatment plans, physio plans), Composition (signed visit note), Provenance (signatures and authorship), AuditEvent (access log), Consent (sharing).
  - Forms: Questionnaire/QuestionnaireResponse.
  - Billing: Invoice/ChargeItem are acceptable as R4 export shapes. Because R6 moves them to incubators, keep billing a native domain model with an optional FHIR facade.
- Practitioner availability should be modelled per (practitioner, location) pair, because FHIR itself warns that multi-location PractitionerRole records force identical availability across locations.
- Store data internally in a FHIR-shaped canonical model (resource-like JSON with stable IDs, `meta.versionId` and coded elements), but do not let the FHIR version leak into business logic. R6's normative freeze means a one-time R4/R5→R6 mapping later rather than ongoing churn.

### Gaps
- The exact date of the next R6 ballot and the final R6 publication date are not published. I found no HL7-official schedule.
- I did not fetch the R5 Appointment, Slot or Encounter pages, so Slot status codes (busy/free/busy-unavailable/busy-tentative/entered-in-error) and Appointment status codes are from memory and need verification.

---

## 2. Template/form technology: FHIR Questionnaire + SDC vs openEHR archetypes/templates vs custom JSON-schema forms, and versioning so old records keep rendering

### Takeaway
FHIR Questionnaire + SDC is the most practical standards base for a SaaS template engine. It has open-source renderers (LHC-Forms, Medplum React), four standard ways to extract structured resources ($extract), and a clear canonical `url|version` pinning mechanism. openEHR offers stronger clinical-model governance (CKM archetypes), but its template (OPT) versioning is itself under-specified and the tooling is heavier. OpenMRS O3 is evidence that a custom JSON form schema bound to a concept dictionary also works at scale. In every option, the rule is the same: published template versions are immutable, every record pins the exact version, and linkIds/concept codes stay stable.

### Cited Findings
**FHIR Questionnaire core**
- `Questionnaire.url` is a canonical ID that "SHALL remain the same when the questionnaire is stored on different servers". `version` is an author-managed business version that may be a timestamp, with no expected ordering. `versionAlgorithm[x]` (R5) says how to compare versions. `date` must change when the version or status changes. `status` is draft | active | retired | unknown. `derivedFrom` lists the canonical Questionnaires this one is based on. — [FHIR R5 Questionnaire](https://hl7.org/fhir/R5/questionnaire.html)
- Item types include group, display, boolean, decimal, integer, date, dateTime, time, string, coding and quantity, among others. Only coded/number/date/string/quantity items can have answerOption/answerValueSet, and not both at once. `enableWhen` supports exists, =, !=, >, <, >=, <=, with `enableBehavior` all|any; `enableWhenExpression` handles complex logic. `disabledDisplay` is hidden | protected; `readOnly`, `repeats` and `maxLength` are also available. — [FHIR R5 Questionnaire](https://hl7.org/fhir/R5/questionnaire.html)
- A QuestionnaireResponse references the exact version as `url|version`. Lloyd McKenzie (FHIR maintainer) confirmed the bar separator, recommended pinning a version, and noted that canonicals must be full URIs. — [FHIR chat: Questionnaire versioning with canonical URL](https://chat-archive.fhir.org/stream/179166-implementers/topic/Questionnaire.20versioning.20with.20canonical.20URL.html)
- Versioning practice (Health Samurai, Feb 24, 2026; vendor guidance, not normative):
  - `url` never changes, (url, version) pairs are unique, published versions are immutable and several versions coexist. SemVer is recommended.
  - MAJOR: removing a question, changing a linkId, replacing a code, changing meaning, or moving items between groups.
  - MINOR: adding questions, adding codes, small logic changes.
  - PATCH: typo fixes.
  - "linkId binds Questionnaire items to QuestionnaireResponse answers, so changing it is always major."
  - Keep a changelog and automated diff checks.
  — [Health Samurai: How to version a FHIR Questionnaire](https://www.health-samurai.io/blog/how-to-version-a-fhir-questionnaire)

**SDC extraction (turning form answers into structured clinical data)**
- Observation-based extraction: put `observationExtract`=true on root, group or item and an `item.code` (typically LOINC). It is the simplest option but produces only Observations, with no `focus`/`dataAbsentReason`. — [SDC Extraction (CI)](https://build.fhir.org/ig/HL7/sdc/en/extraction.html)
- Definition-based extraction uses `definitionExtract` plus `item.definition` (StructureDefinition paths). It can produce any resource or profile but is the most involved to author and updates by replacing rather than merging. — [SDC Extraction (CI)](https://build.fhir.org/ig/HL7/sdc/en/extraction.html)
- Template-based extraction uses `templateExtract`/`templateExtractBundle` with contained template resources and FHIRPath (`templateExtractContext`, `templateExtractValue`). Templates are readable, but the bundle variant is incompatible with modular forms. — [SDC Extraction (CI)](https://build.fhir.org/ig/HL7/sdc/en/extraction.html)
- StructureMap-based extraction uses `targetStructureMap`. It is the most powerful option but needs FHIR Mapping Language expertise, and a failing map generally extracts nothing. — [SDC Extraction (CI)](https://build.fhir.org/ig/HL7/sdc/en/extraction.html)
- `$extract` takes a completed QuestionnaireResponse and returns a resource or Bundle. It does not post to a server, and the client must validate the output against profiles. — [SDC Extraction (CI)](https://build.fhir.org/ig/HL7/sdc/en/extraction.html)

**Renderers**
- LHC-Forms (LForms), from NLM/LHNCBC with Regenstrief and LOINC, is an open-source Web Component that renders FHIR Questionnaires and produces QuestionnaireResponses and Observations. It "partially supports" SDC and has support files for R5, R4B, R4 and STU3. The README mentions v30.0.0, and a full npm import package "isn't ready yet". — [LHNCBC/lforms GitHub](https://github.com/LHNCBC/lforms)
- A 2021 FHIR chat described the LForms license as BSD-derived ("permitted for commercial and non-commercial purposes"). The current LICENSE.md was not verified. — [lforms search summary / FHIR chat](https://chat-archive.fhir.org/stream/179255-questionnaire/topic/Questionnaire.20form.20rendering.20in.20IG.html)

**openEHR**
- openEHR has three layers (Reference Model → archetypes → templates), whereas FHIR has two (resources → profiles). Archetypes behave roughly like resources and templates like profiles, though profiles are "less controlled". — [openEHR Discourse: openEHR and FHIR UK Core](https://discourse.openehr.org/t/openehr-and-fhir-ukcore/2564/17)
- A CKM vital-signs template has been converted into a FHIR Questionnaire, and developers often capture with a QuestionnaireResponse and then map to proper resources in the backend. — [openEHR Discourse thread](https://discourse.openehr.org/t/openehr-and-fhir-ukcore/2564/20)
- The openEHR spec has no formal OPT (operational template) versioning: "not specified in OPT 1.4". A draft proposes semver-style template versions where archetype and terminology changes "bubble-up". — [openEHR wiki: Templates 1.4 versioning & identification](https://openehr.atlassian.net/wiki/spaces/spec/pages/379650049/Templates+1.4+versioning+identification)
- EHRbase supports template versioning "more implicit rather than explicit" since v2.29.0. Its admin API can update/delete templates without keeping a version history, and OPTs must be registered before compositions can be stored. — [openEHR Discourse: OPT Versioning on CDRs, esp. EHRbase](https://discourse.openehr.org/t/opt-versioning-on-cdrs-esp-ehrbase/17111); [open-cis ADR 0003](https://platzhersh.github.io/open-cis/decisions/0003-template-management)
- A vendor claims openEHR offers fuller clinical-data version control than FHIR. This is vendor framing. — [Medblocks](https://medblocks.com/blog/openehr-vs-fhir-and-other-health-it-standards)

**Custom JSON form schema (OpenMRS O3 as reference)**
- O3 forms are JSON documents structured as pages → sections → questions. Top-level properties include a unique name, an encounter type UUID and intents. `isSubform` embeds forms, and question types map to obs, obsGroup, encounterLocation and others. The O3 Form Builder offers a visual and a JSON editor, with draft (unpublished) and published states. The React Form Engine is now the default; the Angular engine (openmrs-ngx-formentry) is kept at parity. — [OpenMRS Core Concepts](https://openmrs.atlassian.net/wiki/spaces/docs/pages/68780087/Core+Concepts); [openmrs-ngx-formentry](https://github.com/openmrs/openmrs-ngx-formentry/)

### Inferences
- **Recommended template engine design:**
  - Template definition: an internal JSON template DSL that compiles 1:1 to (or simply is) FHIR Questionnaire + SDC extensions. Custom widgets (odontogram, body map, eye OD/OS grid, growth chart, perio chart) are expressed as `item.extension` "widget" hints or `questionnaire-itemControl` codes. The canonical data underneath stays as coded items.
  - Three-tier inheritance: Global template (platform) → Specialty pack (e.g., `pack:dental@2.1.0`) → Tenant fork. Tenant forks use `derivedFrom` pointing to the parent canonical so upgrades can be offered as diffs, and tenants can only add or hide items, not repurpose linkIds.
  - Immutability: a published `url|version` is never edited. Each QuestionnaireResponse/Encounter note stores the pinned `url|version`, and the renderer loads that exact version to display old records. Keep all versions forever, since storage cost is trivial compared with medico-legal risk.
  - Stable semantics: every item carries a stable linkId and, where possible, a code (LOINC/SNOMED/ICD/local). Extraction to Observation/Condition happens at sign-off, so analytics and the patient summary read from structured resources rather than from free-form answers.
  - Prefer observation-based and template-based extraction for most clinical fields. Reserve StructureMap for complex cases, given its "nothing extracted on failure" behaviour.
- openEHR is the better choice only for a national-scale CDR with clinical modelling staff. For a startup SaaS, the governance overhead and OPT-versioning immaturity outweigh the benefits. Borrowing CKM archetypes as content references for field lists (vital signs, Apgar, etc.) is still valuable.

### Gaps
- I did not retrieve the normative SDC text on population mechanisms (observation-based, expression-based, StructureMap) or on modular forms (`subQuestionnaire`/`$assemble`).
- I did not verify LHC-Forms' current LICENSE.md text or the Medplum QuestionnaireForm feature coverage.

---

## 3. Terminologies: ICD-10 vs ICD-11, SNOMED CT licensing for Syria, LOINC, ATC, Syrian/Arabic drug data, drug-interaction data

### Takeaway
- ICD-11 is the strongest diagnosis-coding choice for an Arabic-first product. Arabic is an official ICD-11 language with a live Arabic browser. It is free under CC BY-ND 3.0 IGO, and WHO provides an embeddable offline API container. ICD-10 should still be supported for mapping and legacy data.
- SNOMED CT is free for Syria only if Syria remains World-Bank "low income", which it is for FY2026, and only under SNOMED's affiliate process, which also requires special permission for web applications. The free CC BY 4.0 "IPS Terminology" subset is a safer default.
- LOINC is free, including commercially, and has had an Arabic variant since v2.81 (Aug 2025).
- WHO ATC/DDD prohibits commercial redistribution without permission.
- No machine-readable Syrian drug registry was found. Only MOH PDF lists exist.

### Cited Findings
**ICD-11**
- Arabic is among the ICD-11 languages already available (Arabic, Chinese, Czech, English, French, Portuguese, Russian, Spanish, Turkish, Uzbek), with 25 more underway. The license allows commercial and non-commercial use provided codes are not adapted and the work is cited. Translations require written agreements with WHO (icd@who.int). — [WHO ICD page](https://www.who.int/standards/classifications/classification-of-diseases); [WHO licensing: classifications](https://www.who.int/about/licensing/classifications/en/)
- The Arabic ICD-11 MMS browser is live for release 2025-01. — [ICD-11 MMS Arabic browser](https://icd.who.int/browse/2025-01/mms/ar)
- WHO publishes Arabic ICD-11 materials: an Arabic fact sheet, an Arabic implementation/transition guide and a 2026 Arabic document. — [ICD-11 factsheet (ar)](https://ICD.who.int/ar/docs/icd11factsheet_ar.pdf); [ICD-11 Implementation or Transition Guide (ar)](https://ICD.who.int/ar/docs/192190_ICD-11_Implementation_or_Transition_Guide-ar.pdf); [ICD11 2026 (ar)](https://icd.who.int/ar/docs/ICD11_Sahifat_Waqaa_2026_ar.pdf)
- ICD-11 content is licensed CC BY-ND 3.0 IGO, so no adaptations. The ICD-API software is under a separate WHO licence: it may be embedded in commercial and non-commercial applications but not sold standalone, and not modified. The ICD-API Docker container runs offline ("you will not need Internet connection") and requires `-e acceptLicense=true`. — [ICD-11 License (ICD-API docs)](https://icd.who.int/docs/icd-api/license); [ICD-API in a Container](https://icd.who.int/docs/icd-api/ICDAPI-DockerContainer); [ICD11 license PDF](https://icd.Who.Int/en/docs/ICD11-license.pdf)
- Adoption in the region:
  - ICD-11 was piloted in Egypt, Iran, Iraq, Kuwait and Tunisia (2021 EMRO note).
  - Saudi Arabia won a WHA Global Excellence Award for its national mortality data platform, and WHO EMRO's Regional Director said in Oct 2025 that "more countries are adopting ICD-11".
  - Bahrain trained coders on ICD-11 tools in Feb 2025.
  - Saudi Arabia used the Australian ICD-10-AM for clinical coding as of 2022 (possibly outdated).
  — [EMHJ 2021 editorial](https://applications.emro.who.int/emhj/v27/02/1020-3397-2021-2702-111-112-eng.pdf); [EMRO RD statement RC72](https://www.emro.who.int/media/news/verbal-statement-by-dr-hanan-balkhy-who-regional-director-for-the-eastern-mediterranean-at-the-72nd-regional-committee-for-the-eastern-mediterranean.html); [WHO EMRO Bahrain](https://www.emro.who.int/bahrain/news/bahrain-conducts-capacity-building-training-on-cause-of-death-registration-and-the-international-classification-of-diseases.html); [Saudi ADHD CPG](https://cpg.adhd.org.sa/en/2022/02/28/preparations-for-icd-11/)

**SNOMED CT**
- Non-member countries rated "low income" by the World Bank (Band E) can get fee-exempt affiliate licences. Other exemptions cover development, qualifying research and humanitarian/charitable use. "Every user of a product containing SNOMED CT must obtain a license", and "Web applications and browsers need special permission and fees". — [SNOMED fee exemptions](https://www.snomed.org/fee-exemptions)
- The fee schedule lists 0 USD per hospital/institution/practice in the low-income band, versus 652–1,954 USD per institution in higher bands. Non-member licensees must file an annual Statement of Usage via MLDS and declare intended use before it begins. — [SNOMED licensing](https://snomed.org/licensing); [NLM SNOMED licensing](https://www.nlm.nih.gov/healthit/snomedct/snomed_licensing.html)
- SNOMED has issued low-income licences, e.g. to Ethiopia, Rwanda and Yemen. — [SNOMED blog: Not a member?](https://www.snomed.org/news/blog%3A-not-a-member%3F-snomed-international-provides-barrier-free-access-to-many-resources)
- Syria is on the World Bank FY2026 low-income list (25 of 201 economies; GNI per capita ≤ $1,135; issued June 29). This is secondary reporting. — [Enab Baladi, June 2026](https://english.enabbaladi.net/archives/2026/06/world-bank-lists-syria-among-low-income-economies/); [ASPNR low-income list](https://aspnr.org/site/assets/files/8123/low_income_countries.pdf)
- The SNOMED IPS Terminology is a free subset licensed CC BY 4.0, usable "without the need for a SNOMED International license", and descends from the HL7 IPS Free Set. One 2023 paper says CC BY-NC 4.0 instead, which conflicts with SNOMED's own documents. — [SNOMED IPS Terminology product page](https://www.snomed.org/snomed-ct/Other-SNOMED-products/international-patient-summary-terminology); [IPS Terminology release notes Dec 2024](https://snomed.atlassian.net/wiki/spaces/RMT/pages/131958732/SNOMED+International+IPS+Terminology+Production+Release+Notes+-+December+2024); [IOS Press paper](https://ebooks.iospress.nl/pdf/doi/10.3233/SHTI230928); [HL7 IPS HTA license analysis](https://hl7.org/fhir/uv/ips/qa-hta.html)

**LOINC**
- LOINC v2.81 (Aug 2025) added Arabic (for users in Jordan) and Czech linguistic variants. The LOINC license permits commercial and non-commercial use with attribution and forbids changing LOINC or using it to build another standard. A free account is required to download. Some third-party content (e.g., survey instruments) carries its own copyright. — [Regenstrief: two new languages](https://www.regenstrief.org/article/two-new-languages-and-4000-new-concepts-in-loinc-release/); [Getting LOINC](https://loinc.org/?p=7451)

**Drugs**
- WHO ATC/DDD: use requires reference to the WHO Collaborating Centre. Copies of the guidelines state "Copying and distribution for commercial purposes is not allowed" and forbid modification. The contact for permission is whocc@fhi.no. These come from secondary copies; check the official copyright page. — [WHOCC use of ATC/DDD](https://atcddd.fhi.no/use_of_atc_ddd/); [NLM RxNorm ATC source doc](https://www.nlm.nih.gov/research/umls/rxnorm/sourcereleasedocs/atc.html); [Scribd copy of guidelines](https://www.scribd.com/document/420581769/ATCC-DDD)
- Syrian MOH hosts a PDF of the "National Drugs List of the Syrian Arab Republic, 10th edition" (لائحة الأدوية الوطنية). WHO EMRO hosts Syria's Essential Medicines List 2019. No searchable Syrian registry or API was found. — [MOH Syria PDF](https://www.moh.gov.sy/public/images/dxLnZbIXDB3vv4ZluR.pdf); [Syria EML 2019 (WHO EMRO)](https://www.emro.who.int/pdf/syr/publications-other/syrias-essential-medicine-list-2019.pdf)
- Neighbouring regulators publish structured, ATC-tagged drug lists online (Saudi SFDA reference drug list; Lebanon MoPH drug index), which could serve as models or partial cross-references. — [SFDA drugs list](https://www.sfda.gov.sa/en/reference-repositories-drugs-list?page=44); [Lebanon MoPH drug index](https://www.moph.gov.lb/ar/Drugs/index/0/8024/letter:D/page:2/sort:Drug.atc/direction:DESC)
- DDInter 2.0 (NAR 2024, PMID 39180399) is open-access, with 302,516 DDI records across ~2,290–2,310 approved drugs. No explicit licence was found. — [DDInter 2.0 paper](https://academic.oup.com/nar/article/53/D1/D1356/7740584); [ddinter2.scbdd.com](https://ddinter2.scbdd.com/); [Database Commons](https://ngdc.cncb.ac.cn/databasecommons/database/id/7473)

### Inferences
- **Code-system strategy:**
  - Diagnoses: ICD-11 MMS as primary, with an Arabic UI from the WHO Arabic linearization, via the self-hosted ICD-API container. Keep ICD-10 codes alongside for reporting, insurers and legacy data. ICD-11 also includes ICD-10 mapping tables (not verified in this session).
  - Findings and problems: the SNOMED IPS Terminology free set plus local codes. Upgrade to full SNOMED only after obtaining written affiliate permission covering a web-based SaaS.
  - Labs and vitals: LOINC.
  - Drugs: a platform-curated Syrian product catalogue (trade name, Arabic name, manufacturer, strength, form, generic/INN), seeded from the MOH National Drugs List PDF. Link each product to an INN/generic concept; for ATC, store codes as references but do not redistribute the ATC index commercially without WHOCC permission.
- DDI checking: DDInter 2.0 is fine for prototyping, but its licence is unknown. A commercial vendor (e.g., DrugBank, First Databank, Medi-Span — not researched here) needs separate pricing and sanctions review. A curated "top interactions" list (warfarin, QT-prolongers, NSAIDs + anticoagulants, etc.) could be a pragmatic phase-1 approach.
- Sanctions or export-control constraints on licensing UK- or US-origin terminology content to Syrian entities could affect SNOMED, LOINC or commercial drug databases. This needs legal review; see Gaps.

### Gaps
- I found no official statement on which ICD revision Syria's MOH currently mandates for clinical coding or death certification.
- I found no current, machine-readable Syrian drug registry (with registration numbers and prices) or an official MOH API. The date of the 10th-edition list was not visible.
- I did not verify whether SNOMED International currently grants affiliate licences to Syrian entities, given sanctions and the "web applications need special permission" clause.
- DDInter 2.0's licence and terms of use are unknown.
- I did not research commercial drug knowledge bases with Arabic content (e.g., Middle East-focused drug databases).

---

## 4. Specialty-specific template requirements (what a good template must contain; what needs custom widgets)

### Takeaway
Most specialty content can be expressed as versioned Questionnaire items that extract to Observations. Eight areas, however, need purpose-built widgets with their own structured data model:
- dental odontogram (FDI teeth × surfaces, plus a phased treatment plan)
- 6-site periodontal chart
- OD/OS eye exam grid
- WHO growth-chart plotting (LMS z-scores)
- OB dating calculator (LMP/US with ACOG redating rules)
- risk-score calculators
- dermatology body map with serial photo comparison
- validated psychometric scales with scoring and segregated sensitive notes

### Cited Findings
**Dental**
- FDI two-digit notation (ISO 3950) codes each tooth as quadrant + tooth.
  - Permanent quadrants are 1–4 (teeth 11–48).
  - Primary quadrants are 5 (upper right), 6 (upper left), 7 (lower left) and 8 (lower right), with teeth 51–85 numbered 1–5 from the midline.
  - The chart is conventionally viewed with the patient's right on the viewer's left.
  - ISO 3950 is titled "Dentistry — Designation system for teeth and areas of the oral cavity"; the latest edition is cited as 2016.
  — [Wikipedia: FDI notation](https://en.wikipedia.org/wiki/FDI_World_Dental_Federation_notation); [ISO 3950:1977 sample](https://cdn.standards.iteh.ai/samples/9599/82df23bd7b0345b08c3641dad614a45d/ISO-3950-1977.pdf)
- Mixed-dentition records (primary + permanent) are a known source of charting errors. — [FDI vs Universal blog](https://translatemd-site.pages.dev/blog/fdi-vs-universal-dental)
- Periodontal charting fields:
  - Probing depth at 6 sites per tooth (MB, B, DB, ML, L, DL) with light force, recording the deepest reading per site.
  - Recession, measured CEJ to gingival margin.
  - CAL: PD + recession when the margin is apical to the CEJ, or PD − margin-to-CEJ when it is coronal. "Most computerised clinical systems will calculate CAL automatically."
  - Bleeding on probing per site, suppuration, furcation (Glickman I–IV, Nabers probe), mobility (Miller), and plaque/calculus.
  - In smokers, absence of BOP is not a reliable indicator of inactivity.
  — [SDCEP periodontal parameters](https://www.periodontalcare.sdcep.org.uk/guidance/assessment/special-tests/full-periodontal-examination/what-should-be-recorded/periodontal-parameters); [SDCEP baseline charting](https://www.periodontalcare.sdcep.org.uk/guidance/assessment/special-tests/full-periodontal-examination/baseline-charting-for-diagnosis); [CityTech perio charting PDF](https://openlab.citytech.cuny.edu/den1100faculty24/files/2024/10/Basic-Probing-Technique-and-Perio-Charting.pdf)
- Dental imaging: OHIF (MIT) plus Orthanc (DICOMweb) is a common stack. A community project (AmbientCT, MIT) ships dental window/level presets on OHIF 3.9.2/Cornerstone3D. Note that the Orthanc OHIF plugin is GPL. — [OHIF docs](https://docs.ohif.org/); [Orthanc OHIF plugin README](https://orthanc.uclouvain.be/hg/orthanc-ohif/raw-file/default/README); [AmbientCT](https://gh.r-mj.com/Ambientwork/AmbientCT)
- DICOM CP-1570 argues that dentistry needs acquisition-context attributes for clinical and forensic photography. — [DICOM CP-1570](https://dicomstandard.org/news-dir/current/docs/cpack130/cp1570.pdf)

**Cardiology**
- The 2024 ESC AF guideline advocates CHA₂DS₂-VA (sex category removed) over CHA₂DS₂-VASc. Anticoagulation is recommended at a score ≥2 and considered at 1. The supporting Yoshimura et al. (Europace, Nov 2024) analysis found similar C-statistics (0.62–0.71). — [PMC: Refining CHA2DS2VASc](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11574618/); [Univ. Birmingham news](https://www.birmingham.ac.uk/news/2024/give-equal-consideration-to-gender-when-giving-blood-thinners-in-atrial-fibrillation-research-says); [The Hospitalist](https://community.the-hospitalist.org/ecardiologynews/article/271567/arrhythmias-ep/goodbye-chadsvasc-sex-complicates-stroke-risk-scoring-af)

**Ophthalmology**
- FHIR VisionPrescription is an authorization for glasses or contact lenses, not an exam record. `eye` is right/left (OD/OS), and lens specs carry sphere, cylinder (0.25 D steps), axis, add, prism and so on. It has no fields for visual acuity or IOP. — [FHIR VisionPrescription definitions](https://hl7.org/fhir/R4/visionprescription-definitions.html)
- One IG pattern splits an optical prescription into a VisionPrescription plus LOINC-coded Observations for pupillary distance and visual acuity, per eye at distance and near (a CI-build IG). — [SGHI StructureMap ExtractOpticalPrescription](https://build.fhir.org/ig/savannahghi/sil_fhir_profile_ig/StructureMap-ExtractOpticalPrescription.xml.html)
- A US eye-EHR vendor lists five exam areas required for billing: visual acuity, pupils, motility, visual fields and IOP. — [Eyefinity EHR help](https://help.eyefinity.com/eehr/Browser/Performing_a_Routine_Vis.htm)

**Pediatrics**
- WHO Child Growth Standards (0–5 y) are published as z-score and percentile tables (PDF/Excel) by sex: weight-for-age, length/height-for-age (length to 2 y, height 2–5 y) and weight-for-length/height. — [WHO weight-for-age](https://who.int/tools/child-growth-standards/standards/weight-for-age); [WHO height-for-age](https://www.who.int/childgrowth/standards/height_for_age/en/)
- The WHO 2007 reference covers 5–19 y. LMS parameters for 0–5 (MGRS) and 5–19 (2007 reference) are packaged in the R package AGD (a secondary source; verify against WHO files). — [AGD References-WHO](https://rdrr.io/cran/AGD/man/References-WHO.html)
- **Syria immunization schedule (pre-conflict, undated secondary source):**
  - Birth: BCG, HepB, OPV
  - 2 m: DTwP-Hib-HepB, IPV
  - 4 m: DTwP-Hib-HepB, IPV
  - 6 m: DTwP-Hib-HepB, OPV, influenza
  - 12 m: MMR, OPV, Vit A
  - 18 m: DTwP-Hib-HepB, MMR, OPV, Vit A
  - 6 y: DT, OPV
  - 12 y: Td
  - 55 y+: annual influenza
  - No rotavirus, PCV, varicella or HPV.
  - Coverage fell from 95% (2010) to 45% (2013).
  — [RCH Melbourne: Syrian refugees](https://rch.org.au/immigranthealth/clinical/syrian-refugees/)
- The Gavi Syria cMYP 2021–2023 contains an "Immunization Schedule for children in Syria 2019" table, which I could not extract. — [Gavi cMYP Syria 2021–2023](https://gavi.org/news/document-library/comprehensive-multi-year-plan-syria-2021-2023)
- MOH Syria's national programme also has a tetanus schedule for women aged 15–49 and a catch-up schedule for children aged 5–12 who missed doses. Its goals include >95% coverage for all vaccines, staying polio-free, and eliminating measles, rubella and neonatal tetanus. The Expanded Programme on Immunization director is Dr. Turki Al-Daher. — [SANA](https://sana.sy/locals/2300872/); [SANA health](https://sana.sy/health/2615942/)
- National coverage was reported above 81% in 2025, with about 699,000 infants under one targeted. WUENIC 2025 revision (Jul 2026) data are available. — [Arab News PK](https://www.arabnews.pk/node/2642106); [UNICEF WUENIC SYR](https://data.unicef.org/wp-content/uploads/cp/immunisation/wuenic_syr.pdf)
- Pentavalent is part of the routine programme, supported by Gavi and UNICEF. — [Enab Baladi](https://www.enabbaladi.net/783819/)

**OB/GYN**
- ACOG/AIUM/SMFM Committee Opinion 700 says to determine GA and EDD as soon as LMP and/or the first accurate ultrasound are available, document them, and change them only rarely. ART pregnancies are dated by ART-derived GA. With no ultrasound before 22 0/7 weeks, a pregnancy is "suboptimally dated". — [SMFM summary of CO 700](https://publications.smfm.org/publications/239-acog-committee-opinion-700-methods-for-estimating-the/)
- Redating when the LMP–ultrasound discrepancy exceeds:
  - 5 days at ≤8 6/7 wk (CRL)
  - 7 days at 9 0/7–13 6/7 wk
  - 7 days at 14 0/7–15 6/7 wk
  - 10 days at 16 0/7–21 6/7 wk
  - 14 days at 22 0/7–27 6/7 wk
  - 21 days at ≥28 wk
  Third-trimester dating needs caution because it can mask growth restriction. These were reaffirmed in Harvard CRICO's 2026 OB guideline. — [Harvard CRICO Guideline 7](https://www.rmf.harvard.edu/Risk-Prevention-and-Education/Guidelines-and-Algorithms-Catalog-Page/Guidelines-Algorithms/2026/OB-Guideline-Files/Guideline-7-Pregnancy-Dating-Estimated-Date-of-Delivery); [U Iowa ACOG redating](https://www.healthcare.uiowa.edu/familymedicine/fpinfo/OB/OB2017/ACOG%20redating%20gestational%20age.pdf)

**Dermatology**
- DICOM WG-19 is developing supplements for dermoscopy, total body photography and reflectance confocal microscopy, plus a Skin Lesion Tracking structured report. The 2D total-body-photography supplement was slated for a March 2026 public-comment vote. Existing VL (Visible Light, Sup 15) and Secondary Capture objects with coded anatomy are already usable for dermatology photos. — [DICOM WG-19](https://www.dicomstandard.org/activity/wgs/wg-19); [Clunie ISIC 2017 slides](https://www.dclunie.com/papers/ISIC2017_DICOM_Dermatology_Clunie.pdf)

**Psychiatry**
- PHQ-9 and GAD-7 are by Spitzer, Williams, Kroenke et al. with a Pfizer educational grant: "No permission required to reproduce, translate, display or distribute". One WorkSafeNB copy claims "All rights reserved", which dissents, and the PRIME-MD name is a Pfizer trademark. — [ND HHS PHQ-9 & GAD-7 PDF](https://www.hhs.nd.gov/sites/www/files/documents/BH/BHC/PHQ-9-and-GAD-7.pdf); [Salford PsyTech PHQ-9](https://hub.salford.ac.uk/psytech/?p=2446); [Apple support](https://support.apple.com/en-mide/105070); [WorkSafeNB PHQ-9](https://www.worksafenb.ca/media/63128/phq-9-test.pdf)
- Psychotherapy notes, per HIPAA 45 CFR 164.501, are notes by a mental-health professional analysing counselling-session conversations that are kept separate from the rest of the record. Medication monitoring, session times, modalities, diagnosis, symptoms, treatment plan and progress summaries are excluded and belong in the regular record. Most disclosures need specific patient authorization. — [Bricker Graydon: 164.501](https://www.bricker.com/insights/resources/key/hipaa-privacy-regulations-definitions-psychotherapy-notes-164-501); [HHS FAQ on mental health](https://www.hhs.gov/hipaa/for-professionals/faq/does-hipaa-provide-extra-protections-mental-health-information-compared-other-health.html); [APA resource](https://www.psychiatry.org/File%20Library/Psychiatrists/Practice/Practice-Management/HIPAA/resourcedocument-PsychotherapyNotesHIPAA-1-.pdf)

### Inferences
These are design recommendations from domain knowledge and were not individually sourced in this session.
- **Dental widget:**
  - Odontogram with FDI numbering and a primary/permanent/mixed toggle.
  - Per-tooth status (present, missing, implant, crown, RCT, etc.) and per-surface findings on M, O/I, D, B/F, L/P, with a cervical-surface option.
  - Each finding carries status: existing, planned or completed. A planned finding becomes a treatment-plan item with phase (1 urgent/2 restorative/3 prosthetic/maintenance), fee and consent, and links to Procedure on completion.
  - 6-site perio chart with auto-CAL, BOP/suppuration toggles, furcation/mobility and a comparison against the previous exam.
  - Dental lab order (ServiceRequest: shade, material, due date, lab).
  - Ortho module (Angle class, overjet/overbite, cephalometric values, aligner/bracket stage) and an X-ray viewer (OHIF/DICOMweb, or plain images for clinics without DICOM sensors).
- **Cardiology:**
  - Vitals with trend graphs and ECG upload (PDF/image, with optional structured intervals PR/QRS/QT/QTc).
  - Echo report fields: LVEF, LV dimensions, wall motion, valves and gradients, PASP.
  - Calculators: CHA₂DS₂-VA (ESC 2024) with legacy CHA₂DS₂-VASc kept, HAS-BLED, and an ASCVD or SCORE2 choice (European context).
  - INR tracking flowsheet with target range, dose and next-test date.
  - Calculators must be versioned like templates: store score version, inputs and result.
- **Ophthalmology:**
  - Paired OD/OS (+OU) grid widget.
  - VA in Snellen/decimal/logMAR (sc/cc/pinhole), auto/manifest/cycloplegic refraction (sph/cyl/axis/add), IOP (method + time), pupils and motility.
  - Slit-lamp by structure (lids, conjunctiva, cornea, AC, iris, lens) and fundus (disc C/D ratio, macula, vessels, periphery) with drawing.
  - Spectacle prescription maps to VisionPrescription.
- **Pediatrics:**
  - Growth chart widget computing z-scores from WHO LMS (0–5) and WHO 2007 (5–19), with corrected age for preterm babies.
  - Immunization module driven by a versioned, MOH-sourced schedule table (not hard-coded), with catch-up logic.
  - Milestone checklist and weight-based dosing (mg/kg with max-dose caps).
- **OB/GYN:**
  - G/P (GTPAL) widget and a pregnancy episode (EpisodeOfCare).
  - EDD calculator using Naegele/LMP plus ultrasound redating per ACOG 700, with the final EDD locked and audited.
  - Antenatal visit flowsheet (BP, weight, fundal height, FHR, urine, presentation), ultrasound report fields (CRL/BPD/HC/AC/FL/EFW/AFI/placenta), and gynae/contraception/Pap tracking.
- **Dermatology:** body-map widget (anatomic-site coded lesions), serial photo comparison with consistent anatomic tagging (DICOM VL or JPEG + metadata), and procedure packages (laser/peel sessions with counters).
- **Physiotherapy:** session packages (prepaid N sessions), ROM goniometry per joint and side (active/passive), pain VAS/NRS, outcome scales, and a home exercise plan (CarePlan with exercises, sets, reps, video).
- **ENT:** audiogram widget (air/bone per frequency per ear), tympanometry, otoscopy/nasal endoscopy drawings.
- **Orthopedics:** joint-specific exam, imaging, fracture classification, cast/implant tracking, ROM, and PROMs.
- **Psychiatry:**
  - Scored PHQ-9/GAD-7 with an item-9 suicide-risk alert.
  - Mental status exam, risk assessment, and a separate "psychotherapy note" store with stricter ACL. Patient-app visibility is off by default, and the note is excluded from routine sharing.
- **Internal/general medicine:** SOAP note, problem list, chronic-disease flowsheets (DM: HbA1c, eGFR, foot and eye exams; HTN), and a medication reconciliation widget.

### Gaps
- I could not obtain the current official Syrian MOH EPI schedule. The cited schedule is pre-conflict and undated; the Gavi cMYP 2019 table and the MOH PDF were inaccessible. Whether PCV, rotavirus or a 2-dose MMR timing change has since been introduced is unverified.
- No primary source was retrieved for HAS-BLED, ASCVD/SCORE2, INR targets, ENT, orthopedics or physio data elements, or Syrian specialty society guidelines.
- I did not confirm the DICOM IO (intra-oral radiography) modality details or a dental-specific FHIR IG.

---

## 5. Open-source references to learn from or reuse (licenses, maturity, reusability)

### Takeaway
- Permissive and safe to embed in a commercial SaaS: HAPI FHIR (Apache 2.0), Medplum (Apache 2.0 core), OHIF (MIT). LHC-Forms has a BSD-like licence that still needs verification.
- MPL 2.0 (file-level copyleft): OpenMRS (with a "Healthcare Disclaimer") and Ozone.
- Strong copyleft (avoid code reuse, but learn from them): OpenEMR (GPL), GNU Health (GPL-3.0+), Bahmni (AGPL-3.0), and the Orthanc OHIF plugin (GPL).

### Cited Findings
- HAPI FHIR is "licensed under the Apache Software License 2.0". Its repo has modules for DSTU2, DSTU3, R4, R4B and R5. — [hapifhir/hapi-fhir GitHub](https://github.com/hapifhir/hapi-fhir)
- Medplum: "most of the Medplum platform is released as open source software under the Apache 2.0 license". This covers the FHIR server, core APIs, SDKs, React component library and CLI. Hosting, enterprise support and integrations are commercial. — [Medplum open source](https://www.medplum.com/open-source)
- Medplum implements Patient `$match` with a `match-grade` extension ("certain" at ≥0.90) and treats non-CMS identifier systems as namespace-bound unique identifiers (e.g., an EMPI or project MRN). — [Medplum Patient $match](https://www.medplum.com/docs/api/fhir/operations/patient-match)
- OpenMRS is MPL 2.0 with a "Healthcare Disclaimer" (no warranty regarding privacy-law or clinical-standard compliance; not a substitute for professional judgment). — [OpenMRS Wikipedia](https://en.wikipedia.org/wiki/OpenMRS); [ScanCode: OpenMRS exception](https://scancode-licensedb.aboutcode.org/openmrs-exception-to-mpl-2.0.LICENSE)
- O3 form engine: JSON schema, React Form Engine default, O3 Form Builder, and an HFE→O3 converter. — [OpenMRS Core Concepts](https://openmrs.atlassian.net/wiki/spaces/docs/pages/68780087/Core+Concepts); [HFE to O3](https://openmrs.atlassian.net/wiki/spaces/docs/pages/144605185/Converting+from+HTML+Form+Entry+HFE+Forms+to+O3+Forms)
- Bahmni: its new components and modifications are AGPL 3.0, while bundled products keep their own licences (OpenMRS MPL 2.0, OpenELIS AGPL-3.0, Odoo CE LGPL-3.0 from v9). — [Bahmni license](https://www.bahmni.org/license)
- Ozone HIS is MPL-2.0 per its repo listing. It bundles OpenMRS 3 (EMR), SENAITE (lab), Odoo (ERP) and Superset (analytics). — [Ozone repo listing](https://awesome.ecosyste.ms/projects/github.com%2Fozone-his%2Fozone); [OpenMRS wiki: Ozone](https://openmrs.atlassian.net/wiki/spaces/docs/pages/25477009/Ozone+-+Health+Information+System)
- OpenEMR is GPL. An ONC page says GPL v3 or higher, while one guide says GPL-2.0, which conflicts. It has held ONC 2015 Cures Update certification since 7.0.0. Since 6.0.0 it has OAuth2/OIDC, a REST API and FHIR R4 with SMART on FHIR (US Core aligned). — [OpenEMR FAQ](https://open-emr.org/wiki/index.php/FAQ); [OpenEMR licensing/cert page](https://openemr-bdslab.upv.es/acknowledge_license_cert.html); [CapMinds OpenEMR guide](https://www.capminds.com/blog/the-ultimate-guide-to-openemr-features-benefits-and-complete-implementation-roadmap/)
- GNU Health is GPL-3.0-or-later, built on Tryton (GPL-3). It has a separate Python FHIR server component. — [GNU Health Wikipedia](https://www.Wikipedia.com/wiki/GNU_Health); [openSUSE build](https://build.opensuse.org/users/DocB); [LWN](https://lwn.net/Articles/462600/)
- OHIF Viewer is MIT and works with any DICOMweb archive. The Orthanc OHIF plugin is GPL, to satisfy the Orthanc SDK licence. — [OHIF docs](https://docs.ohif.org/); [Orthanc OHIF README](https://orthanc.uclouvain.be/hg/orthanc-ohif/raw-file/default/README)
- LHC-Forms: see Section 2 (NLM web component; BSD-like licence per a 2021 report). — [LHNCBC/lforms](https://github.com/LHNCBC/lforms)
- Aidbox (commercial) offers an MPI module with probabilistic (Fellegi-Sunter) matching and `$match/$merge/$unmerge`, and supports R6 ballot builds for prototyping. — [Aidbox MPI](https://www.health-samurai.io/docs/aidbox/modules/mpi); [Health Samurai R6](https://www.health-samurai.io/blog/getting-ready-for-fhir-r6-what-you-need-to-know)

### Inferences
**Reuse candidates**
- Medplum: React components (incl. Questionnaire rendering), FHIR datatypes/TS types and possibly the server as an internal FHIR store. Apache 2.0 allows this.
- LHC-Forms: an alternative SDC renderer.
- HAPI FHIR: validator/terminology tooling, if the stack is JVM.
- OHIF + Orthanc as standalone services, so that the GPL plugin is not linked into proprietary code.

**Learn-from only**
- OpenMRS O3: forms JSON, concept dictionary pattern, patient chart micro-frontends.
- Bahmni/Ozone: integrated EMR + lab + ERP flows.
- OpenEMR: US-centric billing and ONC features.
- GNU Health: public-health and family modules.

**Licence notes**
- AGPL (Bahmni) is the riskiest for a SaaS, because network use triggers source-disclosure obligations.
- MPL is file-level copyleft: modified MPL files must be shared, but proprietary files can coexist.

### Gaps
- I did not verify current maturity metrics (release cadence, last release dates) for each project, or the GPL-2 vs GPL-3 question for OpenEMR.
- I did not verify whether Medplum's scheduling, Bots and QuestionnaireForm components are entirely in the Apache-licensed repo.
- I found no Arabic/RTL support assessment for any of these UIs.

---

## 6. Medical-record integrity & security (immutability, sign-off, amendments, audit, RBAC/ABAC, break-glass, consent, encryption, retention, HIPAA/GDPR/EHDS, OWASP ASVS)

### Takeaway
Reference frameworks converge on a common set of controls:
- Notes become immutable once signed. Corrections are new versions or addenda linked to the original (FHIR Composition final → amended, `relatesTo` replaces/appends).
- Every read and write is audit-logged (HIPAA §164.312(b)), and audit and policy documentation is kept for at least 6 years.
- Access is role-plus-attribute based, with time-boxed, justified, logged break-glass access (FHIR BTG purpose-of-use).
- Patients can see who accessed their data (EHDS).
- Extra-sensitive content (psychotherapy notes) is segregated and requires explicit authorization.
- The application is verified against OWASP ASVS 5.0.

### Cited Findings
- HIPAA §164.312(b) (audit controls) requires recording and examining system activity but sets no log-retention period. The 6-year retention rule is §164.316(b)(2)(i) and applies to required documentation, from creation or the last effective date, whichever is later. Applying 6 years to the raw audit logs themselves is common practice rather than an explicit mandate. State or other law may require longer. — [Schellman](https://www.schellman.com/blog/hipaa-audit-log-retention-requirements-do-i-really-need-to-retain-all-my-audit-logs-for-6-years); [Aptible](https://www.aptible.com/hipaa/audit-log-retention); [45 CFR 164.316 (2007 CFR)](https://www.govinfo.gov/content/pkg/CFR-2007-title45-vol1/pdf/CFR-2007-title45-vol1-sec164-316.pdf)
- FHIR defines a "Break the Glass" concept for emergency treatment access (typically when the patient cannot consent). It is conveyed as purpose-of-use code BTG (v3-ActReason) in the HTTP request. FHIR "does not define any policy or protocol around such requests". The R6 ballot moved BTG text from security-labels to the Security page. — [FHIR R4 security labels](https://www.hl7.org/fhir/R4/security-labels.html); [R6 ballot5 security labels](https://hl7.org/fhir/6.0.0-ballot5/security-labels.html); [FHIR-27917](https://jira.hl7.org/browse/FHIR-27917)
- IHE Privacy Consent on FHIR (PCF) has an example Consent that denies everything except break-glass access. DS4P (Data Segmentation for Privacy) is HL7's method for labelling sensitive data. — [IHE PCF break-glass consent example](https://build.fhir.org/ig/IHE/ITI.PCF/Consent-ex-dissent-intermediate-break-glass.html); [FHIR security labels](https://www.hl7.org/fhir/security-labels.html)
- In R6, Consent stays in core and Permission moved to an incubator. — [Health Samurai](https://www.health-samurai.io/blog/fhir-additional-resources)
- Composition: final documents are immutable. Changes after finalisation produce the "amended" status, and errors produce "entered-in-error", which systems "SHALL NOT ignore". `relatesTo` (replaces/appends/signs/transforms) and `attester` (personal/professional/legal/official) support sign-off and addenda. — [FHIR R4 Composition](https://hl7.org/fhir/R4/composition.html)
- Psychotherapy-note segregation and authorization: see Section 4. — [HHS FAQ](https://www.hhs.gov/hipaa/for-professionals/faq/does-hipaa-provide-extra-protections-mental-health-information-compared-other-health.html)
- OWASP ASVS 5.0.0 was released May 30, 2025 at Global AppSec EU, the first major release in five years. It has about 350 requirements in 17 chapters, up from ~286 in 14. New chapters include Self-Contained Tokens (V9), OAuth & OIDC (V10) and WebRTC (V17). OWASP recommends citing requirements as `v5.0.0-<chapter>.<section>.<req>` because IDs change between versions. — [OWASP ASVS GitHub](https://github.com/OWASP/ASVS); [arc42 ASVS](https://quality.arc42.org/standards/owasp-asvs); [Appknox](https://www.appknox.com/cyber-security-jargons/owasp-asvs)
- EU EHDS Regulation (EU) 2025/327 entered into force on 26 March 2025.
  - Priority categories (Art. 14): patient summaries, ePrescriptions, eDispensations, imaging and reports, lab results and discharge reports.
  - Individuals may access and download their data, restrict specific professionals' access and see who accessed their data.
  - IPS is the base of the European patient summary.
  - Application dates conflict across sources: 2027 for most primary-use provisions, and 2029 for exchange of the first categories.
  — [EC EHDS page](https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en); [PLMJ](https://www.plmj.com/xms/files/NL_European_Health_Data_Space_Regulation.pdf); [Noze](https://www.noze.it/en/insights/ehds-regulation-2025-327/); [Kennedys 2026](https://www.kennedyslaw.com/en/thought-leadership/article/2026/the-european-health-data-space-is-in-force-implications-for-healthcare-medtech-and-life-sciences)

### Inferences
- **Record lifecycle:**
  - Draft (editable, autosaved) → Signed (immutable; signer, timestamp and content hash stored).
  - Corrections are an Addendum (append) or an Amendment (new version, with the prior version retained and shown as superseded, plus a reason). Entered-in-error records are hidden but retained.
  - Never hard-delete clinical data.
  - Implement this as append-only versioned rows (or event sourcing) with a per-record hash chain to make tampering evident.
- **Audit:**
  - Log every read (chart open, document view, export, print), write, sign, share and break-glass event as AuditEvent-shaped records: who, role, tenant, patient, resource, purpose, IP/device, timestamp.
  - Store logs in a separate append-only store with retention of at least 6 years; given Syrian medico-legal uncertainty, retain clinical records indefinitely or per future MOH rules.
  - Expose an "access history" view to patients in the app, in line with the EHDS model.
- **Access control:**
  - RBAC: tenant-scoped roles (owner, doctor, nurse, receptionist, accountant, lab).
  - ABAC: attributes such as treating relationship, branch, specialty, sensitivity label (e.g., psychiatry, sexual/reproductive health, HIV) and consent status.
  - Break-glass: requires a reason, is time-limited (e.g., 4–24 h), notifies the clinic owner/privacy officer and is reviewed after the fact.
  - Receptionists see demographics and appointments but not clinical notes. Billing staff see charges but not note content.
- **Consent and sharing:**
  - Cross-clinic sharing only by patient-granted Consent (scope = clinic/practitioner, data categories, period), revocable from the patient app. The default is "no cross-tenant visibility".
  - Sensitive categories are excluded unless explicitly included.
- **Encryption and secrets:**
  - TLS 1.2+ in transit, encryption at rest (per-tenant keys or envelope encryption via KMS), and field-level encryption for highly sensitive notes and national IDs.
  - Encrypted backups with restore testing.
  - Verify against ASVS 5.0 (L2 minimum for PHI; L3 for authentication and access-control modules), with MFA for clinicians.
- **Reference frameworks:** HIPAA is the controls checklist (audit, access, integrity, transmission security). GDPR/EHDS is the model for patient rights (access, portability, restriction, access log). In both, health data is treated as special-category data.

### Gaps
- I could not access the HHS right-of-access and amendment (§164.526) pages (HTTP 403), so I have not cited the 30-day access timeline or the amendment procedure.
- I did not research Syria's own legal requirements: data-protection law, medical-record retention periods under the Syrian medical ethics code, e-signature law, or data-localization rules. These must come from another workstream or from legal counsel.
- I did not retrieve GDPR Art. 9 text directly.

---

## 7. Patient-held records (PHR): content, and linking a global patient account to per-clinic charts (MPI / identity)

### Takeaway
- PHR content: model the patient-app summary on the IPS / EHDS priority categories (allergies, medications, problems, immunizations, results, procedures, imaging, discharge/visit summaries) so it is portable.
- Identity: keep one global Person/patient identity with a separate Patient chart per tenant. Link them through an MPI that uses probabilistic matching (Fellegi-Sunter-style), namespace-scoped identifiers and explicit patient-confirmed linking. FHIR provides `$match` and `Patient.link` but deliberately leaves the matching algorithm to the implementer.

### Cited Findings
- IPS IG v2.0.1 (STU2, R4) is the international patient summary standard. EHDS uses IPS as the base of the EU patient summary. — [IPS IG](https://hl7.org/fhir/uv/ips/); [Noze EHDS](https://www.noze.it/en/insights/ehds-regulation-2025-327/)
- EHDS priority categories for patient access are patient summary, ePrescription, eDispensation, imaging and reports, lab results and discharge reports. Patients can restrict access and see access logs. — [PLMJ EHDS note](https://www.plmj.com/xms/files/NL_European_Health_Data_Space_Regulation.pdf); [McCann FitzGerald](https://www.mccannfitzgerald.com/knowledge/pharma-and-life-sciences/european-health-data-space-regulation-primary-use-provisions)
- FHIR `$match` "does not specify any particular algorithm, nor a minimum set of information". FHIR gives `Patient.identifier` and `Patient.link` for merge and split handling, but no matching weights or thresholds. — [HL7 R4 Patient $match](https://www.hl7.org/fhir/R4/operation-patient-match.xml.html); [ICF: Beyond Patient Matching](https://www.icf.com/insights/health/fhir-challenges-opportunities-solve-identity-problem)
- Probabilistic MPI practice:
  - Fellegi-Sunter m/u probabilities per field.
  - Multi-pass blocking optimized for recall, with the scoring stage making the final decision.
  - A missing value "is not evidence that two records belong to different patients".
  — [CapMinds MPI strategies](https://www.capminds.com/blog/mpi-survivorship-rules-and-probabilistic-matching-strategies-for-enterprise-patient-identity-resolution/)
- Vendor MPIs expose `$match`, `$merge` and `$unmerge`. Medplum grades matches with "certain" at ≥0.90 and scopes identifiers by namespace (EMPI vs project MRN). — [Aidbox MPI](https://www.health-samurai.io/docs/aidbox/modules/mpi); [Medplum $match](https://www.medplum.com/docs/api/fhir/operations/patient-match)
- The SNOMED IPS Terminology (CC BY 4.0) supports sharing coded patient summaries without a SNOMED licence. — [SNOMED IPS Terminology](https://www.snomed.org/snomed-ct/Other-SNOMED-products/international-patient-summary-terminology)

### Inferences
- **Identity model:**
  - Global `Person` (patient-app account, verified by phone OTP plus an optional Syrian national ID number) with 0..n linked tenant `Patient` charts. Each chart has a tenant MRN, an identifier with a namespace per tenant, and a `Patient.link` (type "seealso" or "refer") to the global identity.
  - Probabilistic matching suggests links using Arabic-name normalization (hamza/taa marbuta/alif variants, "ابن/بن", father's and grandfather's names, mother's name), DOB, phone, national ID and gender. A link is only confirmed by the patient in the app (QR/OTP at the reception desk) or by staff with audit logging.
  - Never auto-merge across tenants.
- **PHR content:**
  - IPS sections: allergies, active meds, problem list, immunizations (with the Syrian schedule and next due dose), recent results, procedures, devices/implants, vital-sign trends, pregnancy status, visit summaries signed by doctors, prescriptions (shareable via QR at the pharmacy), imaging reports/images and invoices.
  - Patient-entered data (self-measured BP and glucose, uploaded old reports) must be visually and structurally separated (Provenance = patient) from clinician-verified data.
- **Sharing:**
  - The patient grants a clinic or doctor time-bound access via Consent (e.g., "share my summary with Dr. X for 30 days").
  - A clinic's chart stays the clinic's legal record. The PHR shows what the clinic released: signed summaries, prescriptions and results, by default excluding psychotherapy notes and clinician-flagged sensitive items.
  - Export IPS as a FHIR document Bundle and PDF, with an optional SMART Health Link/QR (not researched here).
- **Minors and guardians:** RelatedPerson-based proxy access for children (the vaccination card is a key use case), with an age-of-transition policy.

### Gaps
- I did not research SMART Health Cards/Links, IHE PIXm/PDQm/MHD profiles, or patient-matching performance on Arabic names (no Arabic-specific matching sources found).
- I did not research Syrian national ID and civil-registry integration options, or legal rules on who owns the clinic record vs the patient copy in Syria.
