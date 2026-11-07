# Orthopedic (bone & joint) outpatient clinic: MVP scope for a multi-tenant clinic SaaS (Aleppo / Azaz, Syria)

Research date: 2026-11-07. Web research only. Convention used throughout: **[MVP]** = must ship in v1, **[v2]** = should-have next release, **[Later]** = defer. Anything in "Inferences" that describes concrete clinical template content (exam items, drug classes, follow-up intervals) is drawn from standard orthopedic practice and the cited sources, but is a design proposal; it should be validated by 1-2 practicing Aleppo/Azaz orthopedic surgeons before build.

---

## 1. End-to-end workflow of an orthopedic outpatient visit (new complaint vs follow-up)

### Takeaway
Orthopedic clinics are high-volume and documentation-heavy (about 31 patients per office day in one US academic study, with EHR use consuming more than half of clinic time), so the MVP must make the "diagnosis -> plan bundle -> prescription/report/next follow-up" loop one or two taps, and must treat fracture/post-op follow-ups as a first-class, scheduled episode rather than a free-text visit.

### Cited Findings
- University of Iowa study (JAAOS 2022): EHR use consumed 58% of orthopaedic surgeons' clinical days; orthopaedic surgeons saw about 31 patients per office day, more than other surgeons or non-surgeons — [Iowa Research Online](https://iro.uiowa.edu/esploro/outputs/journalArticle/Time-and-Clerical-Burden-Posed-by/9984303987502771)
- University of Pittsburgh time-motion study of four busy orthopaedic outpatient clinics: approximately half of each surgeon's clinic time was spent using the EHR — [PMC9210372](https://pmc.ncbi.nlm.nih.gov/articles/PMC9210372)
- Arthroscopy 2022 (sports medicine clinic): orthopaedic surgeons spend on average 13.7 hours/week on paperwork/administration beyond clinical duties — [Orthobullets evidence summary](https://www.orthobullets.com/evidence/34613950)
- Healio-reported survey (2022): 80% of orthopedic physicians said documentation interferes with patient interaction; 73% take work home to finish notes (methodology not verified) — [Healio](https://cm.healio.com/news/orthopedics/20220506/video-orthopedic-surgeons-report-being-burdened-by-documentation-coding-requirements)
- ModMed EMA's core design is an "adaptive learning engine" that remembers a provider's preferred plan per diagnosis; its example for knee arthritis bundles viscosupplementation injections, discussion of possible future surgery, prescriptions and physical therapy into one plan; "protocols" generate the note, codes, eRx, orders, patient education and referral letters from one saved plan — [ModMed ABCDEs blog](https://www.modmed.com/resources/blog/the-abcdes-top-orthopedic-ehr-features-of-ema)
- Exscribe (acquired by ModMed in 2021) markets "one-click treatment plans" covering surgery and therapy orders, prescriptions and referral letters — [BusinessWire 2021](https://www.businesswire.com/news/home/20210112005369/en/); [Columbia Orthopaedic Group case study](https://www.casestudies.com/company/exscribe/case-study/columbia-orthopaedic-group-customer-case-study)
- Indian clinic software Clinicia (closest analogue to a small private ortho OPD) advertises ortho prescription templates for fracture care, arthritis, sprains and post-op care, X-ray/MRI/CT upload under each patient, and automatic reminders for cast changes, stitch removal and follow-ups — [Clinicia](https://clinicia.com/?p=1101)
- athenahealth recommends dedicated templates for procedures, follow-up visits, rehabilitation, injections, bracing and DME evaluations to reduce orthopedic documentation rework (vendor blog) — [athenahealth](https://www.athenahealth.com/resources/blog/orthopedic-documentation-workflow-tips)

### Inferences
- **Visit types the MVP should model explicitly [MVP]:** (1) New complaint; (2) Follow-up of same complaint (conservative care); (3) Fracture follow-up (linked to a fracture episode); (4) Post-op follow-up (linked to a surgery episode); (5) Procedure-only visit (injection, cast change/removal, dressing, suture removal); (6) Report-only visit (medical report / sick-leave issue, often without full exam). The visit type should pre-select which template sections open, so a fracture follow-up opens straight to "X-ray today? alignment? cast status? next step" instead of a full history.
- **Secretary-side flow for a Syrian evening clinic [MVP]:** walk-in queue + booked slots on one board; patient lookup by phone number (families share phones, so allow multiple patients per phone); "new vs returning" flag; fee collection at reception with per-visit-type default price and per-procedure add-ons; "patient brought imaging" checkbox so the secretary can photograph/upload films before the doctor sees the patient.
- **Doctor-side new-complaint note [MVP]:** chief complaint (pick-list per body region + side) -> duration -> mechanism (trauma: fall, RTA, sport, work, blast/gunshot; or atraumatic) -> key history flags (red flags for spine; DM, anticoagulants, previous surgery on the region, smoking) -> region exam template (section 2) -> imaging reviewed (section 6) -> diagnosis (pick-list with ICD code, section 9) -> plan bundle (conservative / injection / cast-splint / physio / brace / surgery) -> prescription (templates) -> documents (report, sick leave) -> next follow-up date (auto-suggested from the plan).
- **Plan bundles ("protocols") are the single most valuable time-saver [MVP-lite, v2 full]:** v1 should allow the doctor to save a named bundle per diagnosis (e.g., "Knee OA conservative" = NSAID + PPI + topical + physio referral + exercise sheet + follow-up 6 weeks). ModMed's adaptive/learning engine is a [Later] item; a user-saved bundle gives most of the value.
- **Follow-up scheduling must be generated from the episode [MVP]:** e.g., cast applied today -> suggest X-ray check in ~1 week and removal at 4-6 weeks (distal radius example, section 4); post-op -> wound check/suture removal and X-ray visits. Reminders to patients (SMS/WhatsApp) are [MVP] if the platform already has a messaging channel; otherwise [v2].

### Gaps
- No source found describing the actual workflow of Syrian private orthopedic evening clinics (secretary role, walk-in proportion, typical daily volume, fee practices). This must come from user interviews in Aleppo/Azaz.
- No study found quantifying the share of fracture/post-op follow-ups vs new complaints in Middle Eastern private ortho clinics.

---

## 2. Structured region-based orthopedic exam templates and special tests

### Takeaway
A good region template is a short fixed skeleton (side, inspection, palpation/tenderness, ROM in degrees, MRC 0-5 power, neurovascular status) plus 3-6 high-yield special tests per joint recorded as positive/negative/not done; single special tests have limited accuracy, so the template should make it fast to record a cluster, not exhaustive lists.

### Cited Findings
- MRC (Oxford) scale 0-5 is the most widely accepted clinical method of grading muscle strength; 0 = no contraction, 1 = trace/flicker, 2 = full range with gravity eliminated, 3 = against gravity, 4 = against gravity plus moderate resistance, 5 = normal; grades 4 vs 5 best distinguished by comparing both limbs; scale is subjective/categorical — [StatPearls](https://www.statpearls.com/point-of-care/25393); [Physiotutors](https://www.physiotutors.com/wiki/mrc-scale/); [Physiopedia](https://physio-pedia.com/Muscle_strength)
- Modified MRC scales add +/- sub-grades (e.g., 10-point MM-MRCS) to address coarseness — [BMC Musculoskeletal Disorders supplement](https://media.springernature.com/original/springer-static/esm/art%3A10.1186%2F1471-2474-11-72/MediaObjects/12891_2009_818_MOESM1_ESM.DOC)
- Shoulder meta-analysis (Hegedus et al. 2008): Neer sensitivity 79% / specificity 53%; Hawkins-Kennedy 79% / 59%; accuracy of Neer, Hawkins and Speed is limited — [PubMed 17720798](https://pubmed.ncbi.nlm.nih.gov/17720798/)
- 2012 update (32 added studies): no single shoulder test can be recommended as pathognomonic; combinations of tests give better, but only marginally better, accuracy — [PubMed 22773322](https://pubmed.ncbi.nlm.nih.gov/22773322/)
- Knee review (Malanga et al. 2003): Lachman appears very sensitive and specific for ACL tear; McMurray is very specific but has low sensitivity for meniscal tear; joint-line tenderness has fair sensitivity but poor specificity — [PubMed 12690600](https://pubmed.ncbi.nlm.nih.gov/12690600/)
- Laterality is a known template pain point: vendor commentary notes templates often need separate entries per side, forcing toggling or copy-paste with manual editing (vendor source) — [OrbDoc](https://orbdoc-website.pages.dev/specialties/orthopedics-sports-medicine)
- ModMed EMA ships an "Interactive Anatomical Atlas" and >550 chief complaints out of the box — [ModMed ABCDEs blog](https://www.modmed.com/resources/blog/the-abcdes-top-orthopedic-ehr-features-of-ema)
- Mindbowser review says ModMed supports PACS-embedded image annotation; ModMed also documents dictation-driven exam entry (video) — [Mindbowser](https://www.mindbowser.com/best-emr-for-orthopedics/); [ModMed video](https://www.modmed.com/resources/wistia-orthopedics-videos)

### Inferences
**Common skeleton for every region [MVP]:**
- Side: Right / Left / Bilateral (mandatory, drives report text, diagnosis code and imaging tags). Default "compare with contralateral" toggle.
- Inspection: swelling, deformity, wasting, scar, skin changes/wound, erythema, gait (lower limb/spine). Pick-chips + free text.
- Palpation: tenderness location pick-list per region (e.g., knee: medial/lateral joint line, patella facets, tibial tuberosity, pes anserine), warmth, effusion grade (knee: none/mild/moderate/tense).
- ROM: active/passive in degrees per standard movement (knee flexion/extension; shoulder flexion, abduction, ER, IR (vertebral level); hip flexion, IR, ER, abduction; ankle DF/PF, inversion/eversion; wrist flex/ext, pronation/supination; elbow flex/ext; spine as % or qualitative). Show normal reference range next to field; allow "full/painful arc" quick entry.
- Power: MRC 0-5 per key muscle group/myotome (optional +/-).
- Neurovascular: distal pulses (present/weak/absent), capillary refill, sensation by dermatome/peripheral nerve (normal/reduced/absent), reflexes for spine templates. Mandatory one-tap "NV intact" for trauma/cast visits (medicolegally important when a cast is applied).
- Special tests: per-region list, each recorded Positive / Negative / Equivocal / Not done, with "add other test" free text.

**High-yield special tests per region (proposal; tests named in the brief are all standard):**
- Knee [MVP]: Lachman, anterior drawer, posterior drawer/sag, McMurray, joint-line tenderness, valgus/varus stress at 0 and 30 degrees, patellar apprehension, effusion (bulge/patellar tap). [v2]: pivot shift, Thessaly, Apley, dial test.
- Shoulder [MVP]: Neer, Hawkins-Kennedy, painful arc, empty can (Jobe), external rotation lag/resistance, lift-off or belly-press, apprehension/relocation, Speed, cross-body adduction (ACJ). Record passive ER loss (frozen shoulder). [v2]: O'Brien, drop-arm, Yergason.
- Cervical spine [MVP]: Spurling, upper-limb dermatomes/myotomes/reflexes, Hoffmann (myelopathy red flag). [v2]: distraction, ULTT.
- Lumbar spine [MVP]: SLR (with degree), crossed SLR, femoral stretch, lower-limb myotomes/dermatomes/reflexes (L2-S1), red-flag checklist (saddle anaesthesia, sphincter, progressive deficit, fever, cancer history, trauma). [v2]: slump, Schober.
- Hip [MVP]: FABER (Patrick), FADIR/impingement, Trendelenburg, leg-length (true/apparent), log roll. [v2]: Thomas, Ober.
- Ankle/foot [MVP]: anterior drawer, talar tilt, squeeze test, Thompson (Achilles), Ottawa-rule tenderness points. [v2]: Kleiger/external rotation, windlass.
- Hand/wrist [MVP]: Phalen, Tinel (carpal tunnel), Finkelstein (de Quervain), snuffbox tenderness (scaphoid), Froment (ulnar). [v2]: Durkan, Watson, grind test.
- Elbow [MVP]: lateral/medial epicondyle tenderness, Cozen/Mill, valgus stress. [v2]: Tinel at cubital tunnel, moving valgus stress.

**Tiering:**
- [MVP] skeleton + the per-region lists above as checkboxes; normal-by-default macro ("knee exam normal except...") because speed matters more than completeness.
- [MVP-lite] simple front/back body outline (SVG) where the doctor or secretary taps pain location and side; stores region codes, not drawings. This doubles as a fast region selector that opens the right template.
- [v2] goniometer-style ROM trend chart over visits; dictation/voice input in Arabic; per-doctor custom templates editor; diagram annotation (draw on body map).
- [Later] full interactive anatomical atlas (ModMed-style), AI scribe.

### Gaps
- No source found ranking which special tests Syrian/Arab orthopedists actually use most; the per-joint lists above are a proposal.
- No pooled accuracy data were retrieved for Spurling, SLR, FABER, Phalen or Tinel in this session (the brief names them; their inclusion is based on standard practice, not a cited accuracy figure).

---

## 3. Patient-reported outcome measures (PROMs): licensing and Arabic versions

### Takeaway
Most named ortho PROMs (Oxford Knee/Hip, KOOS/HOOS, WOMAC, QuickDASH, ODI, NDI) are copyrighted and require permission; crucially, a commercial SaaS vendor embedding them falls into the paid "commercial software" category even when clinicians themselves can use paper versions free. MVP should ship only a pain NRS/VAS and a "record an externally administered score (name + total)" field; licensed electronic instruments belong in v2.

### Cited Findings
- **Oxford Knee/Hip Scores (OKS/OHS):** licensed through Oxford University Innovation (OUI) via a click-to-licence portal; the licence-details page itself lists no free/commercial terms, only a "request a licence" link and ePRO/eCOA as an administration mode — [OUI OKS licence page](https://innovation.ox.ac.uk/licence-details/oxford-knee-score-oks). Search-retrieved OUI/secondary text states licences for publicly funded healthcare and non-commercial academic research are free, while commercial use is fee-based; a review article says commercial users, large private practices and industry-funded projects pay royalties; extra fees may apply for language versions and eCOA review (sources partly conflicting, verify directly) — [OUI OKS page](https://innovation.ox.ac.uk/?p=4597); [Heartbeat Medical OKS](https://heartbeat-med.com/resources/oks)
- **KOOS / HOOS / FAOS:** managed by Mapi Research Trust on behalf of Prof. Ewa Roos since an announcement dated 10 Oct 2023; free for funded and non-funded academic users; **commercial users and healthcare organizations (hospitals, medical centers) must pay**; permission is "always required" — [Mapi Research Trust](https://www.mapi-trust.org/news-events/news/koos-hoos-and-faos). Older third-party pages still describe KOOS as licence-free (now outdated) — [Heartbeat KOOS](https://heartbeat-med.com/resources/knee-injury-and-osteoarthritis-outcome-score-koos)
- **DASH / QuickDASH (Institute for Work & Health, Toronto):** most requests are granted free use; commercial licence must be signed and paid before use. Fees (CAD): Category B "commercial software and/or web-based software for repeated use" = $1,250 first year, $650 annual renewal, plus user fees by volume ($625 up to 500 users; $1,150 up to 1,000; $2,120 up to 2,000; ... $7,600 up to 10,000). Category A for-profit products $1,500/$700; Category C commercially funded studies $1,250/$650 — [IWH DASH licences](https://dash.iwh.on.ca/licences)
- **Oswestry Disability Index (ODI v2.1a):** Mapi says clinical and academic users can obtain a licence at no charge; commercial investigators pay an "affordable" fee — [Mapi ODI news](https://www.mapi-trust.org/news-events/news/the-oswestry-disability-i)
- **Neck Disability Index (NDI):** copyright notice Vernon H. & Hagino C., 1987; distributed via Mapi ePROVIDE; derived from ODI with permission of J. Fairbank — treat as copyrighted — [WSIB NDI form](https://www.Wsib.ca/sites/default/files/2023-03/ndi.pdf); [SPRY NDI calculator](https://www.sprypt.com/calculators/neck-disability-index)
- **WOMAC:** sources conflict: one says WOMAC requires a licence (requests via womac.com) and is a registered trademark; a template vendor claims it is free in clinical practice — [CODE Technology WOMAC](https://www.codetechnology.com/blog/womac-score-tool/); contradicted by [Pabau WOMAC template](https://pabau.com/guides/womac-osteoarthritis-index-template/)
- Commercial PROM platforms (e.g., Physitrack) maintain a dedicated page on licensing third-party outcome measures, indicating vendors take on the licensing burden — [Physitrack support](https://support.physitrack.com/article/769-licensing-outcome-measures)
- **Arabic versions:**
  - OKS: Arabic cross-cultural adaptation in adult males with knee OA showed acceptable psychometrics — [PMC5432976](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5432976/); Egyptian 2019 study validated Arabic OKS, Lysholm and IKDC (reliable/valid for ligament, meniscus and OA patients) — [SICOT-J / PMC6407430](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6407430/); Arabic OKS in 100 TKA candidates, Cronbach alpha 0.85, responsive after surgery — [Salford repository](https://salford-repository.worktribe.com/output/1356447/responsiveness-reliability-and-validity-of-arabic-version-of-oxford-knee-score-for-total-knee-arthroplasty)
  - KOOS: Arabic version developed 2012; KOOS-12 AR validated in adults >40 with knee OA (excellent reliability/validity) — [synapsesocial summary](https://www.synapsesocial.com/papers/69db380f4fe01fead37c6316); [PNU Arabic health measures](https://ahm.pnu.edu.sa/measure/412/article/841)
  - QuickDASH: Arabic Q-DASH validated in 62 Egyptian patients (Med J Cairo Univ 2020) — [EKB journals](https://journals.ekb.eg/article_125145.html); 2021 study: Cronbach alpha 0.90, ICC 0.91, unidimensional, but authors call for larger studies — [MSK Science & Practice](https://dx.doi.org/10.1016/j.msksp.2021.102372)
  - ODI: Tunisian-origin Arabic ODI validated in 100 Saudi chronic LBP patients (Ann Phys Rehabil Med 2014) — [PNU AHM](https://ahm.pnu.edu.sa/measure/45/article/438); culturally adapted Arabic ODI test-retest ICC 0.97/0.93, alpha 0.85 — [PNU AHM](https://ahm.pnu.edu.sa/measure/45/article/162); [Bangor](https://research.bangor.ac.uk/en/publications/validation-of-an-arabic-version-of-the-oswestry-index-in-saudi-ar/)
  - NDI: no dedicated Arabic validation found; NDI was used as a comparator in a 2024 Saudi study — [BVS](https://pesquisa.bvsalud.org/portal/resource/e/mdl-38896911)
- US ortho EMRs treat automated PROM collection (KOOS/HOOS, PROMIS, ASES, VAS, Oswestry) as a "must-have", with manual reminders/manual score entry cited as a pain point (vendor review) — [Mindbowser](https://www.mindbowser.com/best-emr-for-orthopedics/)

### Inferences
- **[MVP]:** Pain NRS 0-10 (and/or VAS 0-100 mm) per visit, per region, charted over time; plus a generic "Outcome score" field (instrument name from a list + total score + date) so a surgeon who uses a paper OKS/ODI can log totals without the SaaS reproducing licensed item text. This avoids licence exposure at launch.
- **[v2]:** Licence 2-3 instruments with validated Arabic versions that cover the main case-mix: OKS (knee OA/TKA), QuickDASH (upper limb; IWH Category B approx. CAD 1,250 + user fees), ODI (lumbar; Mapi). Patient self-completion on tablet/phone link before the visit. KOOS/HOOS only if a license for "healthcare organizations" is negotiated.
- **[Later]:** PROMIS (licensing not verified here), registry-grade PROM schedules (pre-op, 6 weeks, 6 months, 1 year), benchmarking dashboards.
- The licensing obligation sits with the SaaS vendor (commercial software) regardless of whether the Syrian clinic would be "free" as a clinical user; budget and legal review needed before v2.

### Gaps
- Licensing status of NRS/VAS and PROMIS not verified in this session (generally regarded as non-proprietary, but no source retrieved).
- OUI's actual fee schedule and whether an Arabic OKS/OHS is an OUI-sanctioned translation were not confirmed (the "available languages" PDF was not readable).
- Whether WOMAC's rights holder charges commercial software vendors is unresolved (conflicting sources).

---

## 4. Fracture management documentation and trauma follow-up

### Takeaway
MVP needs a lightweight "fracture episode" (bone/region, side, date of injury, open/closed, displacement, treatment, cast/splint type, applied date, planned removal date, X-ray schedule, union status) that drives follow-up dates and reminders; full AO/OTA coding is v2 (optional picker), because it is copyrighted, complex, and not required for private outpatient care.

### Cited Findings
- AO/OTA Fracture and Dislocation Classification Compendium 2018 unified AO and OTA codes into a single alphanumeric code; first digit = bone, second = location (proximal 1, diaphysis 2, distal 3), then type/group/subgroup; universal modifiers in square brackets and qualifications in round brackets after the code; paired bones (radius/ulna, tibia/fibula) coded individually — [AO Foundation classification page](https://www.aofoundation.org/trauma/clinical-library-and-tools/journals-and-publications/classification); [AO Alliance 2018 info booklet](https://online.ao-alliance.org/images/PDF/AO_OTA_Classification/AOOTA_Classification_2018_Info_Booklet_T12_18011901.pdf); [musculoskeletalkey](https://musculoskeletalkey.com/1-4-fracture-classification/)
- Compendium citation: Meinberg E, Agel J, Roberts C, et al., J Orthop Trauma 32(1) Suppl, Jan 2018; AO Foundation copyright notices prohibit unauthorized reproduction — [AO Alliance booklet](https://online.ao-alliance.org/images/PDF/AO_OTA_Classification/AOOTA_Classification_2018_Info_Booklet_T12_18011901.pdf); [Orthobullets](https://orthobullets.com/evidence/18277234)
- Distal radius (conservative): UK trusts routinely advise a repeat X-ray at about 1 week (fracture may displace; new cast often applied), cast removal at 4-6 weeks — [Royal Berkshire leaflet](https://www.royalberkshire.nhs.uk/media/xsdb2yru/wrist-fracture-conservative-management_may23.pdf); [NCIC leaflet](https://www.ncic.nhs.uk/patients-visitors/patient-information-leaflets/minor-injuries-distal-radial-fracture); [King's College Hospital leaflet](https://www.kch.nhs.uk/wp-content/uploads/2026/06/4228-Distal-Radius-Fracture-info-leaflet-2024-v2.pdf)
- BOAST guidance (cited in a Cureus audit): X-ray at cast removal is not required for conservatively managed distal radius fractures unless specifically indicated; audit found only 12 of 464 follow-up radiographs changed management — [PMC9705069](https://pmc.ncbi.nlm.nih.gov/articles/PMC9705069)
- Paediatric metaphyseal distal radius pathway: first fracture-clinic visit within 7 days, review at 2 weeks, cast removal with X-ray at 6 weeks (paediatric-specific) — [Royal Children's Hospital Melbourne](https://rch.org.au/clinicalguide/guideline_index/fractures/Distal_radius_and_or_ulna_metaphyseal_fractures_Outpatient_fracture_clinics)
- Clinical union criteria commonly used: pain-free movement, non-tender fracture site, radiographically acceptable alignment, usually at ~6 weeks for distal radius; contact sport deferred to ~12 weeks — [NCIC leaflet](https://www.ncic.nhs.uk/patients-visitors/patient-information-leaflets/minor-injuries-distal-radial-fracture)
- Virtual fracture clinic / patient-initiated follow-up (PIFU): BOA guidance makes PIFU the default with booked follow-up only where unavoidable, and favors telephone/video follow-up — [Great Western Hospital audit, PMC7493733](https://pmc.ncbi.nlm.nih.gov/articles/PMC7493733); in 154 VFC patients, 71% were placed on PIFU, 17% virtual follow-up, 12% brought in — [Int Orthop 2020](https://link.springer.com/article/10.1007/s00264-020-04764-x); DNA rates are a known clinic problem and PIFU may reduce routine bookings — [SaTH library](https://www.library.sath.nhs.uk/research/2025/01/06/evaluation-of-patient-initiated-follow-up-pifu-service-in-a-fracture-clinic-a-comprehensive-service-evaluation-and-patient-satisfaction-audit-2024/)
- Fracture care in US billing is a 90-day global package covering the first cast/splint and related follow-up visits — [Coding Ahead](https://www.codingahead.com/coding-for-closed-treatments/); [AAPC](https://aapc.com/codes/coding-newsletters/my-orthopedic-coding-alert/how-to-properly-code-for-post-emergency-fracture-care-article)
- Indian ortho clinic software sends automatic reminders for cast changes, stitch removal and follow-ups — [Clinicia](https://clinicia.com/?p=1101)
- Syria context: Aqrabat Hospital describes itself as the only specialized orthopedic facility in northwest Syria (self-description) — [UOSSM](https://uossm.org/facilities/aqrpat-hospital/); WHO documented 86,000 Syrian amputees in 2017 — [Al Jazeera](https://www.aljazeera.com/news/2023/8/10/rimas-journey-prosthetic-gives-syrian-new-start-after-february-earthquake); Physicians Across Continents states orthopedic need increased after the 2023 earthquake — [PMM](https://pmm.org.pl/en/syria-en)

### Inferences
- **Fracture episode record [MVP]:**
  - Date/time of injury; mechanism (fall, RTA, sport, work, assault, blast/gunshot, other); place first treated (ER/another doctor) and treatment received before this clinic.
  - Bone + segment pick-list (proximal / shaft / distal) + side; open vs closed (with Gustilo grade as optional [v2]); displaced / undisplaced; intra-articular yes/no; angulation/shortening free text; associated injuries; NV status at presentation.
  - Treatment: conservative (cast/splint/sling/brace/boot), closed reduction (with post-reduction X-ray), referred for surgery (links to surgery episode).
  - Immobilization sub-record: type (above-elbow/below-elbow POP, scaphoid, slab/backslab, U-slab, long-leg, short-leg, cylinder, walking boot, brace, buddy strapping), material (POP / fiberglass), date applied, planned review date, planned removal date, actual removal date, complications (tight cast, sores, swelling); weight-bearing status (NWB / TTWB / PWB / FWB).
  - Follow-up X-ray schedule: auto-generated defaults per fracture type that the surgeon can edit (e.g., distal radius: 1-week check, removal 4-6 weeks); attach each X-ray to the episode with date.
  - Union tracking per visit: clinical (tender/non-tender, movement painful/pain-free) and radiological (no callus / callus / bridging / united / delayed union / malunion / non-union), so the episode can be closed with outcome.
- **Trauma follow-up reminders [MVP]:** due-date list for the secretary ("casts due for removal this week", "missed fracture follow-ups"), plus patient reminders. Missed follow-ups after cast application are clinically risky and also lost revenue.
- **Package pricing [v2]:** optional "fracture care package" price (cast + N follow-ups) mirroring the global-period concept; v1 can price items individually.
- **AO/OTA [v2]:** optional searchable code field with bone/segment pre-filled from the episode; do not reproduce compendium illustrations (copyright). Eponymous classifications (Garden, Weber, Schatzker, Neer, Gartland, Salter-Harris) as optional pick-lists [v2].
- **Telephone/video follow-up and PIFU [Later]:** relevant for Azaz/Aleppo distances, but depends on platform maturity.

### Gaps
- No Syrian/regional data on fracture case-mix in private clinics (e.g., proportion pediatric forearm, ankle, war-related injuries).
- Adult fracture follow-up schedules vary by trust/fracture; only distal radius was sourced here. Default schedules for other common fractures (ankle, clavicle, metacarpal, tibial shaft, supracondylar humerus in children) need surgeon input.

---

## 5. In-clinic procedures: injections, aspiration, casts, dressings/suture removal

### Takeaway
Each procedure needs a short structured note (joint/site, side, consent, approach/guidance, drug + dose + concentration + lot/expiry, aspirate description, complications, aftercare) and a price line; this is MVP because injections and casts are core revenue and medicolegal exposure points.

### Cited Findings
- AAPC: a joint injection/arthrocentesis note should identify the joint and laterality, state whether aspirated, injected or both, and name each injected substance with concentration and dose; for ultrasound guidance, document that a permanent image was captured, retained and interpreted — [AAPC coding alert](https://www.aapc.com/codes/coding-newsletters/my-neurology-coding-alert/neurology-pain-management-coding-know-steps-to-follow-for-arthrocentesis-coding-180535-article)
- NextGen ships a joint aspiration/injection template with linked detailed consent data — [NextGen docs](https://docs.nextgen.com/en-US/nextgenc2ae-adaptive-content-engine-help-enterprise-8-3241458/document-detailed-consent-data-for-joint-aspiration-injection-253207)
- Image-guided joint injection consent templates record specific risks, risks of not having the procedure and alternatives — [Queensland Health SW9571](https://www.health.qld.gov.au/__data/assets/pdf_file/0018/1261350/SW9571.pdf)
- Example procedure notes include a time-out (identity, procedure, site) and lot number/expiry fields (community sample) — [sample note](https://hermitage-a8j.pages.dev/2013/08/12/joint-injection); [FindACode checklist](https://FindACode.com/newsletters/decision-health/ultrasound-guidance-injection-documentation-checklist.html)
- ModMed provides pre-built, customizable injection orders that users can edit and save — [ModMed overview](https://www.modmed.com/resources/blog/overview-of-orthopedic-software)
- athenahealth recommends dedicated injection, bracing and DME templates (vendor) — [athenahealth](https://www.athenahealth.com/resources/blog/orthopedic-documentation-workflow-tips)

### Inferences
- **Injection/aspiration note [MVP]:** site (knee, shoulder subacromial/GH, trochanteric bursa, lateral epicondyle, de Quervain, trigger finger, carpal tunnel, plantar fascia, facet/epidural if done in clinic, other) + side; indication/diagnosis; verbal/written consent (checkbox + optional signed scan); approach (landmark / ultrasound-guided, image saved y/n); skin prep; aspiration volume (mL) and appearance (clear/straw/turbid/blood-stained/purulent) and whether sent for lab; injectate rows: drug (pick-list: methylprednisolone acetate, triamcinolone, betamethasone, hyaluronic acid product, PRP, local anaesthetic, other) + dose + volume + lot + expiry; complications; post-injection advice printed; repeat interval tracker (e.g., warn if steroid injection into same joint within a doctor-set interval) [v2 for the warning].
- **PRP [MVP as drug option; v2 detail]:** v1 records kit/brand and volume; v2 adds preparation details and course tracking (session 1 of 3).
- **Cast/splint application and removal [MVP]:** uses the immobilization sub-record from section 4; prints a cast-care instruction sheet (Arabic) with warning signs (pain, numbness, colour change, tightness).
- **Dressing / suture or clip removal / wound check [MVP]:** wound status (clean/dry, discharge, signs of infection), sutures removed (all/partial), dressing type, next dressing date.
- **Billing [MVP]:** each procedure is a priced line item (tenant-defined price list) added to the visit invoice; consumables (HA syringe, PRP kit, fiberglass rolls) as optional stock items [v2 for inventory deduction].
- **Procedure consent forms (Arabic) [MVP]:** one generic printable consent template per procedure family (injection, aspiration, closed reduction/cast) with doctor-editable risks.

### Gaps
- Local norms for documenting consent for injections in Syria (verbal vs written) were not found.
- No source on local prices of injections/PRP/casts in Aleppo or Azaz.

---

## 6. Imaging: patient-brought films/CDs/phone photos vs DICOM viewer

### Takeaway
For MVP, per-visit image/PDF attachment (phone camera capture of films and reports, upload of images/PDF) tagged by modality, region, side and study date, plus a simple two-image side-by-side comparison, covers the Syrian reality of patient-held films; a DICOM pipeline (CD import -> Orthanc -> OHIF) is technically feasible with open-source tools but belongs in v2/Later.

### Cited Findings
- OHIF Viewer is MIT-licensed, a browser-based ("zero-footprint") medical imaging platform that works out of the box with image archives supporting DICOMweb and uses Cornerstone3D for decoding, rendering and annotation — [OHIF docs](https://docs.ohif.org/); [noze overview](https://www.noze.it/en/insights/ohif-viewer-open-source-pacs/)
- Orthanc ships an OHIF plugin, which is GPL-licensed to satisfy the GPL of the Orthanc SDK (OHIF itself remains MIT); OHIF can also run standalone against Orthanc's DICOMweb endpoints — [Orthanc OHIF plugin README](https://orthanc.uclouvain.be/hg/orthanc-ohif/raw-file/default/README)
- US ortho EMR pain point: imaging lives in a separate tab/login, adding clicks during consults; PACS integration with annotation listed as a must-have (vendor review) — [Mindbowser](https://www.mindbowser.com/best-emr-for-orthopedics/)
- ModMed: cloud PACS with "one-click access to patient images"; PocketEMA mobile app can take photos into the chart — [ModMed ABCDEs blog](https://www.modmed.com/resources/blog/the-abcdes-top-orthopedic-ehr-features-of-ema)
- AAOS 2023 practice survey (as cited by Mindbowser) lists poor imaging integration among top complaints of orthopedic group surgeons (secondary citation) — [Mindbowser](https://www.mindbowser.com/best-emr-for-orthopedics/)
- Indian ortho clinic products (Clinicia, Drlogy, DoctorsApp) offer X-ray/MRI/CT upload into the patient record rather than diagnostic viewing — [Clinicia](https://clinicia.com/?p=1101); [Drlogy](https://www.drlogy.com/orthopedist-software); [DoctorsApp](https://www.doctorsapp.in/emr/best-emr-software-for-orthopedic-clinics-in-india-2025)

### Inferences
- **[MVP]:**
  - Capture from phone/tablet camera (secretary or doctor) directly into the visit, plus upload of JPG/PNG/PDF; multiple images per study.
  - Metadata per study: modality (X-ray / MRI / CT / US / DEXA / other), body region, side, study date (may differ from visit date), source (patient-brought / ordered by us / hospital), radiologist report attached or typed impression, doctor's own reading (short free text).
  - Timeline gallery per patient filtered by region/side; **side-by-side comparison of two images** (e.g., initial vs 6-week X-ray) with zoom/pan; this is cheap with plain images and is high-value for fracture union tracking.
  - Image compression and resumable uploads (connectivity in Azaz/Aleppo may be unreliable; no source checked, see Gaps).
- **[v2]:** basic annotation (line/angle measurement on photos for alignment, e.g., Cobb or angulation, with a calibration caveat), X-ray request form printing to outside imaging centres with clinical question, imaging-due reminders tied to the fracture episode.
- **[Later]:** DICOM CD import -> per-tenant Orthanc (DICOMweb) -> OHIF viewer embedded; integration with local imaging centres; templating for arthroplasty. Licence note: OHIF (MIT) is permissive; Orthanc and its OHIF plugin are GPL, so legal review is needed for how a hosted multi-tenant service uses them (inference, not legal advice).

### Gaps
- No source found on how Aleppo/Azaz imaging centres deliver studies (film only, CD with DICOM, WhatsApp images) or on typical file sizes/bandwidth constraints.
- No evaluation of the diagnostic adequacy of phone photographs of X-ray films was retrieved in this session.

---

## 7. Surgery: booking at a hospital, pre-op checklist, consent, implants, op note, post-op protocol

### Takeaway
For a surgeon who operates in private hospitals, the MVP needs a "surgery episode": booking (procedure, side, hospital, date, anaesthesia, fee/deposit), a pre-op readiness checklist, consent capture (scan/signature), a short operative note with free-text implant details, and auto-generated post-op follow-up visits. Full implant/UDI tracking, OR scheduling and preference cards are US-centric and can wait.

### Cited Findings
- WHO Surgical Safety Checklist: 19 items in three phases — sign-in (before anaesthesia induction), time-out (before skin incision), sign-out (before patient leaves the OR); items cover identity, procedure/site, consent, allergies, anaesthesia safety, antibiotic timing, counts, specimen labelling and handover — [Wikipedia: WHO Surgical Safety Checklist](https://en.wikipedia.org/wiki/WHO_Surgical_Safety_Checklist); [Pabau template](https://pabau.com/templates/who-surgical-safety-checklist/)
- US ortho EMR "must-haves" (vendor review): implant/device tracking with UDI logged at implantation per FDA 21 CFR Part 830; OR scheduling with instrument sets, case duration and surgeon preference cards; generic EHRs lacking an implant log push UDI data into spreadsheets — [Mindbowser](https://www.mindbowser.com/best-emr-for-orthopedics/)
- Mindbowser's comparison rates ModMed and Nextech "Yes" for implant tracking and OR scheduling, Greenway/athena/eCW/DrChrono "No/Partial" (unverified vendor comparison) — [Mindbowser](https://www.mindbowser.com/best-emr-for-orthopedics/)
- Drlogy (India) offers OT templates for fracture fixation and joint replacement alongside OPD templates — [Drlogy](https://www.drlogy.com/orthopedist-software)
- Exscribe one-click plans include surgery orders — [BusinessWire](https://www.businesswire.com/news/home/20210112005369/en/)

### Inferences
- **Surgery booking [MVP]:** procedure (pick-list + free text), side, diagnosis, hospital (tenant-maintained list), date/time, estimated duration, anaesthesia type (GA/spinal/regional/local), assistant, implants/vendor needed (free text: e.g., "DHS 135 degrees, 4-hole plate" or "TKA, brand X") and who supplies them, patient fee quote, deposit paid, status (planned/confirmed/done/cancelled/postponed). Calendar view separating clinic and OR days.
- **Pre-op readiness checklist [MVP]:** labs (CBC, coagulation, glucose/HbA1c, renal), ECG/echo, anaesthesia/cardiology clearance, anticoagulant/antiplatelet stop instructions, fasting instructions, imaging available, implant ordered, consent signed, blood availability, site marking. Printable pre-op instruction sheet (Arabic). The WHO checklist itself is executed by the hospital team; the clinic system only needs pre-op readiness items.
- **Consent [MVP]:** printable Arabic procedure-specific consent template with editable risks; upload signed scan to the surgery episode. E-signature on tablet [v2].
- **Operative note [MVP-lite]:** date, hospital, procedure, side, surgeon/assistant, anaesthesia, position, tourniquet time, approach, findings, procedure steps (template per common procedure), implants used (free text: type, size, manufacturer, lot if available), closure, blood loss, drains, complications, post-op instructions (weight-bearing, DVT prophylaxis, antibiotics, physio start). Many surgeons write the official note in the hospital file; the clinic copy matters for follow-up continuity.
- **Post-op protocol [MVP]:** on marking surgery "done", auto-create follow-up visits from a per-procedure template (e.g., wound check/suture removal ~2 weeks, X-ray at ~6 weeks, later reviews), all editable; links post-op visits to the episode.
- **[v2]:** structured implant log (manufacturer, model, size, lot) searchable for recalls; surgery-specific templates (TKA, THA, ACL reconstruction, arthroscopic meniscectomy, ORIF distal radius/ankle, DHS/PFN, K-wires, carpal tunnel release, spinal discectomy); hospital fee/surgeon fee split; surgical logbook export for the surgeon.
- **[Later]:** UDI barcode scanning, preference cards, OR scheduling integration with hospitals, PROM schedules around surgery.

### Gaps
- Did not verify whether the official WHO checklist includes an implant-specific item.
- No source on how Syrian private hospitals book surgeon cases (phone/WhatsApp with hospital secretary is likely but unverified), on implant supply chains, or on consent-form legal requirements in Syria.

---

## 8. Physiotherapy referral, home exercise sheets, orthoses/braces

### Takeaway
A printable Arabic physio referral letter and a simple brace/orthosis prescription are MVP (rehab capacity is scarce and referrals cross organizations); an exercise-sheet library is v2 because it needs original, non-copyrighted illustrated content.

### Cited Findings
- Relief International (May 2026, survey of 705 returnees across governorates incl. Aleppo): rehabilitation services (prosthetics, physiotherapy, assistive-device maintenance) are among the most severely under-resourced components of Syria's health system — [RI Syria Report May 2026](https://www.ri.org//content/uploads/2026/05/RI-Syria-Report_May-2026.pdf)
- Azaz hosts rehabilitation centres, e.g., the Step of Hope centre run by Physicians Across Continents (part of 5 centres reaching >23,000 people in NW Syria after the 2023 earthquake) — [WHO EMRO](https://www.emro.who.int/syria/news/long-term-rehabilitation-for-earthquake-survivors-in-north-west-syria.html); and the Ataa Rehabilitation and Prosthetic Limb Centre — [Al Jazeera](https://www.aljazeera.com/news/2023/8/10/rimas-journey-prosthetic-gives-syrian-new-start-after-february-earthquake)
- ModMed interfaces with a physical therapy EHR (WebPT); its plans generate referral letters and patient education materials — [ModMed ABCDEs blog](https://www.modmed.com/resources/blog/the-abcdes-top-orthopedic-ehr-features-of-ema)
- athenahealth recommends bracing/DME evaluation templates (vendor) — [athenahealth](https://www.athenahealth.com/resources/blog/orthopedic-documentation-workflow-tips)

### Inferences
- **Physio referral [MVP]:** printable/shareable (PDF/WhatsApp) Arabic letter: diagnosis, side, surgery done and date (if any), precautions/contraindications, weight-bearing status, ROM limits/brace settings, goals, suggested frequency/duration, request for progress report. Recipient = free text or tenant's list of physio centres.
- **Orthosis/brace prescription [MVP]:** item pick-list (knee brace hinged/unhinged, ROM brace with degree limits, lumbar corset, cervical collar soft/hard, arm sling, shoulder immobilizer, wrist splint, thumb spica, walking boot, insoles/arch supports, heel cup, crutches/walker), side, size, wear schedule, duration.
- **Home exercise sheets [v2]:** library of region-specific exercise sheets in Arabic with original illustrations (commercial libraries such as Physitrack are licensed; avoid copying third-party images); doctor selects sheet -> prints or sends link.
- **[Later]:** two-way referral tracking with physio centres, physio progress notes inside the platform (could be a separate "physiotherapy" specialty module in the same SaaS).

### Gaps
- No source found on referral conventions between orthopedists and physiotherapists in Aleppo/Azaz, or whether physio centres accept digital referrals.

---

## 9. Prescription quick-templates and diagnosis coding (ICD-10 / ICD-11)

### Takeaway
MVP should ship a curated ortho diagnosis list (~40-60 entries) with Arabic and English labels mapped to WHO ICD-10 codes (laterality stored separately, since WHO ICD-10 lacks the US ICD-10-CM laterality digits), plus doctor-editable drug-class prescription templates; ICD-11 mapping can come later.

### Cited Findings
- Frequently cited orthopedic codes (US ICD-10-CM, vendor/billing lists): M17.11 primary OA right knee; M17.- knee OA; M16.9 hip OA; M54.5 / M54.50 low back pain (US code updated to M54.50 etc.); M51.26 lumbar disc displacement; M54.2 cervicalgia; M75.- shoulder lesions incl. rotator cuff disorders; M77.10 lateral epicondylitis; fractures require laterality and 7th character (encounter) in ICD-10-CM — [OmniMD](https://omnimd.com/medical-codes/orthopedics/); [PGM Billing](https://www.pgmbilling.com/icd-10-codes-orthopedics); [Practice Fusion](https://practicefusion.com/icd-10/clinical-concepts-for-orthopedics/icd-10-codes/)
- ModMed EMA includes 4,750 diagnoses with ICD-10 codes and 2,050 treatment plans/procedures out of the box — [ModMed ABCDEs blog](https://www.modmed.com/resources/blog/the-abcdes-top-orthopedic-ehr-features-of-ema)
- ICD-11: 132 WHO Member States/areas at some phase of implementation (May 2024 figure repeated in WHO's 2026 fact sheet); Arabic is among the ten languages already available — [WHO ICD-11 fact sheet 2026](https://icd.who.int/en/docs/ICD11_Fact_Sheet_2026.pdf); [WHO ICD page](https://www.who.int/standards/classifications/classification-of-diseases)
- ModMed auto-suggests ICD-10/CPT codes from the exam note — [ModMed ABCDEs blog](https://www.modmed.com/resources/blog/the-abcdes-top-orthopedic-ehr-features-of-ema)
- DoctorsApp (India) bundles digital Rx generation and report upload in a yearly plan of Rs 8,999 — indicative price point for an emerging-market ortho EMR (vendor page) — [DoctorsApp](https://www.doctorsapp.in/emr/best-emr-software-for-orthopedic-clinics-in-india-2025)

### Inferences
- **Diagnosis list [MVP]:** curated pick-list grouped by region, each with Arabic name, English name, WHO ICD-10 code, and separate side field. Suggested core (WHO ICD-10 codes to be verified against the WHO browser before release): knee OA (M17), hip OA (M16), low back pain (M54.5), sciatica/lumbar radiculopathy (M54.1/M54.3/M54.4), lumbar disc herniation with radiculopathy (M51.1), cervical spondylosis/cervicalgia (M47/M54.2), cervical disc disorder (M50), frozen shoulder (M75.0), rotator cuff syndrome (M75.1), shoulder impingement (M75.4), subacromial bursitis (M75.5), lateral epicondylitis (M77.1), carpal tunnel syndrome (G56.0), de Quervain (M65.4), trigger finger (M65.3), plantar fasciitis (M72.2), Achilles tendinitis (M76.6), meniscal tear (S83.2 acute / M23.2 degenerative), ACL tear (S83.5), ankle sprain (S93.4), osteoporosis (M81), gout (M10), common fractures (distal radius S52.5, scaphoid S62.0, clavicle S42.0, proximal humerus S42.2, femoral neck S72.0, ankle S82.5/S82.6/S82.8, metacarpal S62.3, tibial shaft S82.2), soft-tissue contusion/sprain codes, post-op status (Z96.6 joint prosthesis, Z47 orthopaedic aftercare). Allow free-text diagnosis too.
- **Prescription templates [MVP]:** doctor-editable templates by drug class, with local brand names maintained per tenant: NSAIDs (oral and topical) with a linked gastro-protection line (PPI); paracetamol; muscle relaxants; neuropathic agents for radiculopathy; vitamin D and calcium; short corticosteroid courses where the surgeon uses them; post-op antibiotics; VTE prophylaxis (LMWH or oral agent) after lower-limb surgery/immobilization per surgeon protocol; post-op analgesia. Safety prompts [v2]: NSAID with anticoagulant/renal disease/age, duplicate NSAIDs, pregnancy. Doses must be entered/validated by the surgeon; the platform should not ship hard-coded dosing in v1.
- **ICD-11 [Later]:** store ICD-10 now with a mapping table; add ICD-11 when Syrian reporting requires it.
- Avoid US ICD-10-CM-only codes (e.g., M17.11, M54.50) in a Syrian product unless the target payer/authority uses ICD-10-CM.

### Gaps
- Which ICD version (WHO ICD-10 vs ICD-10-CM vs none) Syrian private clinics, insurers or the Ministry of Health actually use was not found.
- The WHO ICD-10 codes in the proposed list above come from domain knowledge, not a retrieved source in this session; verify each against icd.who.int.
- No Syrian formulary/brand availability source was retrieved for drug templates.

---

## 10. Medical reports and certificates (sick leave, fitness, injury/legal, insurance)

### Takeaway
Report and certificate printing in Arabic is MVP (frequent in ortho for work absence, school, courts and injury cases), but Syrian-specific legal requirements could not be found online, so templates must be co-designed with local surgeons and a lawyer; forensic (legal) injury reports in Syria go through a scarce forensic-medicine service, so the clinic report is often a supporting document.

### Cited Findings
- Syria's General Authority for Forensic Medicine head reportedly said there are no more than 56 forensic doctors in Syria out of 150 needed, and that the forensic report is pivotal in cases (reported by Enab Baladi; specific article not opened) — [Enab Baladi](https://www.enabbaladi.net/561469/)
- Regional analogue: the UAE requires sick-leave reports to be attested by the medical facility and the Ministry, with the diagnosis recorded — [UAE MOHAP sick-leave attestation](https://mohap.gov.ae/assets/download/dfb6930a/خدمة%20اعتماد%20الإجازات%20المرضية%20وإجازة%20المرافق%20-28_638477391689503995.pdf.aspx)
- US ortho EMR pain point: standard SOAP templates don't produce workers' comp narratives, so staff copy-paste into disability forms; workers' comp documentation (disability ratings, injury-to-recovery timelines) listed as a must-have (vendor review) — [Mindbowser](https://www.mindbowser.com/best-emr-for-orthopedics/)

### Inferences
- **[MVP] templates (Arabic, clinic letterhead, doctor name/specialty/syndicate number, date, patient ID, unique document number):**
  1. Sick-leave certificate: patient name/ID, diagnosis (optional display, patient consent), rest period from-to, light-duty alternative, signature/stamp.
  2. Medical report (general): history, examination findings, imaging findings, diagnosis, treatment given, expected recovery period/disability estimate, recommendations.
  3. Injury report (for police/court/insurance): date and mechanism of injury as stated by patient, objective findings with side, imaging, diagnosis, expected healing time and temporary disability days (a common element in Arab medicolegal practice; to be confirmed locally), "patient states" vs "examination shows" separation.
  4. Fitness certificate (return to work/sport/school, fitness for travel with cast).
  5. Referral letter (to another specialist/hospital) and physio referral (section 8).
  - Auto-fill from the visit; doctor edits; PDF print and share; immutable copy saved in the chart with issue log (who issued, when).
- **[v2]:** QR code verification link on certificates (anti-forgery), bilingual Arabic/English reports (for patients going to Turkey or abroad), report fee item.
- **[Later]:** integration with any Syrian e-government/insurance verification if it emerges.

### Gaps
- No source found on Syrian legal requirements for sick-leave certificates, medical reports, or doctor-issued injury reports (syndicate rules, required fields, stamping, ministry attestation), for either government-controlled Aleppo or the Azaz area (which historically operated under different administrations).
- No source on Syrian insurance companies' report formats.

---

## 11. Orthopedic-specific EMRs: what they include and what surgeons value or complain about

### Takeaway
Market leaders win on pre-built ortho content (complaints, diagnoses, plans), one-click plan bundles, integrated imaging, PROM automation, and procedure/injection orders; surgeon complaints center on documentation time, poor imaging integration, laterality/template rigidity, and manual workarounds (spreadsheets for implants, PROMs, referrals). A Syrian MVP should copy the content-and-speed lessons, not the US compliance features.

### Cited Findings
- ModMed EMA: >550 chief complaints, 4,750 ICD-10 diagnoses, 2,050 treatment plans/procedures; adaptive learning suggests diagnoses/plans; auto-suggested coding; cloud PACS; WebPT interface; mobile app with photo capture and dictation; ePrescribing; patient portal, kiosk, outcomes, registry, tasking — [ModMed ABCDEs blog](https://www.modmed.com/resources/blog/the-abcdes-top-orthopedic-ehr-features-of-ema)
- Third-party review claims ModMed Orthopedics has 80+ templates and adaptive learning — [SPRY](https://www.sprypt.com/blog/orthopedic-modmed)
- Exscribe: built-in orthopaedic workflows, one-click treatment plans, optional PACS, practice management, e-prescribing integrations, patient portal; acquired by ModMed in 2021 — [Case study](https://www.casestudies.com/company/exscribe/case-study/columbia-orthopaedic-group-customer-case-study); [BusinessWire](https://www.businesswire.com/news/home/20210112005369/en/)
- Vendor comparison (unverified, Mindbowser): pricing per provider per month ModMed $400-600, Nextech $350-550, Greenway $200-350, athena $140-300, eCW $150-300, DrChrono ~$299; ModMed/Nextech "Yes" on implant tracking, PACS integration, PROMs, OR scheduling, workers' comp — [Mindbowser](https://www.mindbowser.com/best-emr-for-orthopedics/)
- KLAS 2024 (as cited by Mindbowser): only 44% of clinicians agree their EHR provides expected outside integration; documentation burden is the #1 complaint across specialties; ModMed 86.7/100, Nextech 85.2/100; specialty EMR implementations average 5.2 months vs 3 months promised (secondary citation) — [Mindbowser](https://www.mindbowser.com/best-emr-for-orthopedics/)
- Surgeon complaints listed: no native implant log (spreadsheets/sticky notes), imaging in separate tab/login, SOAP templates not fit for workers' comp narratives, ambiguous templates forcing dictation into generic fields, manual PROM reminders and score entry, referral tracking by phone/spreadsheet, "integration tax" across 3+ systems (vendor source) — [Mindbowser](https://www.mindbowser.com/best-emr-for-orthopedics/)
- EHR time burden in ortho: 58% of clinical day (Iowa); ~half of clinic time (Pittsburgh); 80% say documentation interferes with patient interaction — [Iowa](https://iro.uiowa.edu/esploro/outputs/journalArticle/Time-and-Clerical-Burden-Posed-by/9984303987502771); [PMC9210372](https://pmc.ncbi.nlm.nih.gov/articles/PMC9210372); [Healio](https://cm.healio.com/news/orthopedics/20220506/video-orthopedic-surgeons-report-being-burdened-by-documentation-coding-requirements)
- Ambient AI scribes are being evaluated as a documentation-burden remedy for surgeons (Vanderbilt survey, 105 surgeons, not ortho-specific) — [JMIR Med Inform 2026](https://medinform.jmir.org/2026/1/e89329/PDF)
- Emerging-market comparators (India): Clinicia (ortho Rx templates, imaging upload, cast/stitch/follow-up reminders), Drlogy (OPD templates, voice-to-text Rx, ortho case history, imaging integration, OT templates, billing incl. physiotherapy), DoctorsApp (custom ortho templates, imaging import, Rs 8,999/year plan) — mostly marketing claims — [Clinicia](https://clinicia.com/?p=1101); [Drlogy](https://www.drlogy.com/orthopedist-software); [DoctorsApp](https://www.doctorsapp.in/emr/best-emr-software-for-orthopedic-clinics-in-india-2025)

### Inferences
- Copy: pre-built Arabic ortho content (complaints, diagnoses, plan bundles, Rx templates, report templates) so a surgeon is productive on day 1; one-tap plan bundles; imaging inside the visit; follow-up reminders tied to casts/sutures/post-op; fast laterality handling.
- Skip for Syria v1: US-specific items (UDI/21 CFR 830, MIPS, ePA, formularies, workers' comp forms, CPT coding, global-period billing logic).
- Price anchor: Indian ortho EMRs at roughly Rs 9k/year vs US $140-600/provider/month implies Syrian pricing must be at the low end of emerging-market ranges (pricing research is outside this scope).

### Gaps
- No Arab-region (Syria, Jordan, Lebanon, Iraq, Turkey-based Syrian) orthopedic-specific EMR products or user reviews were found in this session.
- No independent (non-vendor) survey of surgeon priorities for ortho EMR features was retrieved; Mindbowser and Healio citations of KLAS/AAOS data are secondary.

---

## 12. Consolidated scope: MVP vs v2 vs Later (orthopedics)

### Takeaway
MVP = fast, Arabic, region-based ortho note + fracture/cast and surgery episodes that drive follow-ups and reminders + image capture/compare + procedure notes with pricing + Rx/report templates + pain NRS. v2 = licensed PROMs, AO/OTA picker, annotation/measurement, implant log, exercise library, plan-bundle intelligence. Later = DICOM/OHIF, telehealth/PIFU, AI scribe, registries.

### Cited Findings
- Time burden and template/imaging pain points justify prioritizing speed and integrated images — [Iowa](https://iro.uiowa.edu/esploro/outputs/journalArticle/Time-and-Clerical-Burden-Posed-by/9984303987502771); [Mindbowser](https://www.mindbowser.com/best-emr-for-orthopedics/)
- PROM licensing costs for commercial software (e.g., QuickDASH CAD 1,250 + user fees; KOOS fees for healthcare organizations) justify deferring embedded PROMs — [IWH](https://dash.iwh.on.ca/licences); [Mapi](https://www.mapi-trust.org/news-events/news/koos-hoos-and-faos)
- Open-source DICOM stack exists (OHIF MIT, Orthanc GPL) for a later phase — [OHIF docs](https://docs.ohif.org/); [Orthanc OHIF README](https://orthanc.uclouvain.be/hg/orthanc-ohif/raw-file/default/README)
- Cast/stitch/follow-up reminders are table stakes in emerging-market ortho software — [Clinicia](https://clinicia.com/?p=1101)

### Inferences

| Area | MVP (v1) | v2 | Later |
|---|---|---|---|
| Visit workflow | Visit types (new, follow-up, fracture f/u, post-op, procedure-only, report-only); walk-in + booked queue; region-first note; user-saved plan bundles | Plan-bundle suggestions from history; Arabic voice dictation | AI/ambient scribe; adaptive learning |
| Exam | Region templates (knee, shoulder, C-spine, L-spine, hip, ankle/foot, hand/wrist, elbow) with side, inspection, palpation, ROM degrees, MRC 0-5, NV status, 3-8 key special tests; "normal except" macros; simple body map for pain location | Extended test lists; ROM trend charts; custom template builder | Interactive anatomical atlas |
| PROMs | Pain NRS/VAS per visit and chart; "external score" total entry | Licensed Arabic OKS, QuickDASH, ODI (patient self-fill via link/tablet) | KOOS/HOOS, PROMIS, scheduled PROM programs, registries |
| Fractures | Fracture episode (bone/segment, side, open/closed, displacement, mechanism, date); cast/splint record with applied/review/removal dates; WB status; union status per visit; due-lists and reminders | AO/OTA and eponymous classification pickers; fracture package pricing | PIFU/virtual fracture clinic flows |
| Procedures | Injection/aspiration, cast apply/remove, dressing/suture removal notes with drug, dose, lot/expiry, side, consent; price lines; printable aftercare sheets | Repeat-injection interval warnings; PRP course tracking; consumables inventory; tablet e-signature | US guidance image archiving rules |
| Imaging | Camera capture + upload (image/PDF) per visit, tagged modality/region/side/study date; timeline; two-image side-by-side compare | Angle/length annotation; X-ray request forms; imaging-due reminders | DICOM CD import, Orthanc + OHIF, imaging-centre integration |
| Surgery | Surgery booking (procedure, side, hospital, date, anaesthesia, implants free text, fee/deposit, status); pre-op readiness checklist; consent print + scan; short op note; auto post-op follow-ups | Structured implant log; procedure-specific op-note templates; surgeon logbook; fee split | UDI scanning, hospital OR integration, preference cards |
| Rehab/orthoses | Physio referral letter; brace/orthosis prescription | Arabic home-exercise library with original illustrations | Two-way physio referral tracking/physio module |
| Rx & coding | Ortho diagnosis list (Arabic/English, WHO ICD-10, separate side); doctor-editable Rx templates by drug class with local brands | Drug-interaction/NSAID safety prompts | ICD-11 mapping |
| Reports | Arabic sick leave, medical report, injury report, fitness certificate, referral letter; auto-fill; immutable issued copy | QR verification; bilingual reports | Government/insurer integrations |
| Reminders | Follow-up/cast-removal/suture-removal reminders (secretary due-lists; patient messages if channel exists) | Automated multi-step reminder sequences | Telephone/video follow-up |

### Gaps
- All tiering above is an inference from the sources plus standard orthopedic practice; it has not been validated with Syrian orthopedic surgeons, secretaries or patients. Recommended next step: 3-5 structured interviews/observations in Aleppo and Azaz evening clinics to confirm visit mix, report requirements, imaging formats and messaging channels.
