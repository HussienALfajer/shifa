# Orthopedic Outpatient EMR: Full Professional Scope, Licensing Reality and UX (research notes, as of 2026-11-07)

Scope note: this covers everything BEYOND the already-decided baseline (8 region exam templates, side, inspection, palpation, ROM, MRC power, neurovascular status, special tests, pain NRS, fracture episode with cast tracking, in-clinic procedures, photo/PDF imaging with compare, minimal surgery booking and op note, physio referral, ortho reports). Research was web-only, done 2026-11-07. The session's web-search budget ran out before VTE (NICE NG89), compartment-syndrome (BOAST), arthroplasty follow-up schedule, Medbridge licensing, WOMAC/SANE/Lysholm/Tegner licensing and orthotics could be researched; these are listed as gaps. Items marked "[textbook, not re-verified]" are standard orthopedic content that I did not re-source in this session; the report writer should treat them as design input that a clinician must check, not as cited facts.

## 1. Interactive skeleton / body chart: how leading products do it, and which assets can be used

### Takeaway
Market leaders treat the body chart as a fast "tap to document" entry point, not a picture: ModMed EMA uses a touch-first Interactive Anatomical Atlas where drawings flow into the note. Physio-oriented products (Cliniko, Jane) give a simple freehand editor (pen, colour, text, eraser, undo) on swappable template images plus a dedicated spine chart with per-level checkboxes. No product I found publishes a ready-made, licensable, clickable skeleton component. The practical route is to draw your own SVG regions on top of public-domain Wikimedia skeleton art (LadyofHats, released worldwide into the public domain), or to adapt MIT-licensed React body-selector packages (front/back muscle-style silhouettes, not skeletons).

### Cited Findings
**ModMed EMA (modmed Orthopedics)**
- Marketed as touch-based: "Draw freehand on photos or the Interactive Anatomical Atlas, then automatically add your drawings to the patient's chart". Providers "tap and touch their way through an entire clinical encounter" using the atlas and a "Virtual Exam Room" — [ModMed: The ABCDEs of orthopedic EHR features](https://www.modmed.com/resources/orthopedics/the-abcdes-top-orthopedic-ehr-features-of-ema); [modmed Orthopedics product page](https://www.modmed.com/orthopedics/)
- EMA claims it can "automatically generate a note and bill before the patient leaves the room". It learns provider habits, auto-suggests note content and protocols, and suggests ICD-10, CPT and modifier codes — [modmed Orthopedics](https://www.modmed.com/orthopedics/); [ModMed ABCDEs blog](https://www.modmed.com/resources/blog/the-abcdes-top-orthopedic-ehr-features-of-ema)
- ModMed also demos documenting the ortho exam by dictation, and markets "ModMed Scribe 2.0", built into EMA and said to be trained on de-identified data from over 750 million encounters (vendor claim) — [ModMed ortho dictation demo](https://www.modmed.com/resources/videos/ortho-dictation-demo); [modmed Orthopedics](https://www.modmed.com/orthopedics/)
- I found no independent evaluation of the atlas. A third-party listing shows a 4/5 average from 45 reviews — [EMRFinder EMA listing](https://emrfinder.com/ema-by-modernizing-medicine-emr-software)

**Cliniko (physio)**
- The body chart is a question type inside treatment-note templates ("Add body chart" button). Only administrators and power receptionists can set this up — [Cliniko: add body chart questions to templates](https://help.cliniko.com/en/articles/2358149-add-body-chart-questions-to-treatment-note-templates); [Cliniko: using body charts in treatment notes](https://help.cliniko.com/en/articles/2348486-using-body-charts-in-treatment-notes)
- The editor has six tools: hand (pan), pencil (mouse, trackpad, stylus or finger), eraser, text, colour (colour-code markings and text) and undo/redo — [Cliniko: understanding the body chart editor](https://help.cliniko.com/en/articles/2351214-understanding-the-body-chart-editor)
- It ships default templates, and clinics can upload their own images or diagrams — [Cliniko body charts feature page](https://www.cliniko.com/features/health-records/body-charts/); [Cliniko: upload your own body chart templates](https://help.cliniko.com/articles/2357738-upload-your-own-body-chart-templates)

**Jane App**
- The "Body Chart" chart item uses Jane's default body image or a clinic's own image, with editable captions. A separate "Spine" item has "checkboxes for each joint, sketch on a spine diagram and notes", and its image cannot be swapped. Sketch templates and uploaded images can be marked up. Duplicating a chart removes the signature from the copy — [Jane guide: chart items for creating a chart template](https://jane.app/guide/chart-items-for-creating-a-chart-template)

**Other EHRs and pain-drawing practice**
- Sevocity markets a drawing tool that annotates anatomical images in the encounter, marking fracture sites, injection points and surgical sites — [Sevocity orthopedics EHR](https://www.sevocity.com/ehr-specialties/orthopedics/)
- Body-charting guidance (Zanda Health) maps pain, numbness and tension onto an anatomical diagram, keeps a legend so the "where" (chart) and "what" (legend) stay readable, and separates point symptoms from radiating ones — [Zanda Health body charting guide](https://zandahealth.com/blog/body-charting-guide/)
- The Ransford pain drawing (Ransford, Cairns & Mooney, Spine 1976) is the classic symbol-based pain drawing for low back pain, scored with a "penalty point" system for non-anatomic or exaggerated drawings. Body-surface-area scores correlate highly with the penalty score — [Dynamic Chiropractic: a closer look at pain drawings](https://dynamicchiropractic.com/article/43268-a-closer-look-at-pain-drawings); [Scilit: a rating system for patient pain drawings](https://scilit.com/publications/12ff276eab61757f0d365cc70fe870d4)

**Assets and their licences**
- Wikimedia "Human skeleton front en.svg" by LadyofHats (Mariana Ruiz Villarreal): "released into the public domain by its author… This applies worldwide." Variants exist with no labels, no text/no colour, numbered and arrows, plus a back view ("Human skeleton back no-text no-color.svg") and many language versions — [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Human_skeleton_front_en.svg)
- Related LadyofHats files (axial skeleton blank, arm bones diagram) carry the same public-domain tag, per the search summary of mirrors — [Axial skeleton diagram blank (mirror)](https://download.osmand.net/wiki/File:Axial_skeleton_diagram_blank.svg); [Human arm bones diagram (UBC wiki mirror)](https://wiki.ubc.ca/File:Human_arm_bones_diagram.svg)
- The dermatome map "Dermatomes labeled, male front 3d-shaded.svg" is CC BY-SA 4.0 (author Goran_tek-en). Attribution and share-alike apply, which is awkward for proprietary SVG derivatives — [mirror of Commons file](https://download.osmand.net/wiki/File:Dermatomes_labeled,_male_front_3d-shaded.svg)
- React packages (all MIT per their listings; none is a skeleton):
  - `@darshanpatel2608/human-body-react`: clickable selectable body parts — [jsDelivr](https://www.jsdelivr.com/package/npm/@darshanpatel2608/human-body-react)
  - `react-body-selector`: SVG, front/back switching, intensity sliders, aimed at "pain tracking", React 18+ — [pkgstats](https://www.pkgstats.com/pkg:react-body-selector)
  - `react-native-body-highlighter` (MIT, v3.1.3): muscle slugs with intensity — [Yarn](https://classic.yarnpkg.com/en/package/react-native-body-highlighter)
  - The `@teambuildr` fork splits left and right sides of the body — [Yarn](https://classic.yarnpkg.com/en/package/@teambuildr/react-native-body-highlighter)
- The search found no open-source clickable skeleton SVG component — [search summary of npm/yarn results above](https://www.pkgstats.com/pkg:react-body-selector)

### Inferences
- **Recommended chart design for R1 (synthesis of the patterns above):**
  1. **Two layers.**
     - "Anatomy picker": a clickable SVG skeleton/silhouette that selects a structured `BodySite`. It drives region templates, laterality, the problem list and procedures.
     - "Drawing layer": freehand plus stamps (Cliniko/Jane-style), stored as vector JSON per encounter.
     - Clicking a bone or joint should open the matching region exam template with side pre-filled. This is the ModMed "tap through the encounter" pattern.
  2. **Views.**
     - Anterior and posterior full body, plus lateral spine.
     - Zoom panels: hand dorsal/palmar with digits 1–5 and MCP/PIP/DIP (thumb MCP/IP); foot dorsal/plantar with rays 1–5 and MTP/PIP/DIP (hallux MTP/IP); spine C1–C7, T1–T12, L1–L5, S1 (S2–S5 for saddle sensation) and coccyx.
     - Optional shoulder, knee and ankle close-ups for arthroscopy findings.
  3. **Laterality.**
     - Every site has an explicit side: L, R, bilateral or midline.
     - Render the patient's right on the viewer's left (anatomical convention) and print a large "R"/"L" on the canvas.
     - Never infer side from the click position alone; confirm it in a side chip.
  4. **Pain-drawing symptom palette.** Ache, sharp/stabbing, burning, numbness, pins-and-needles, plus "other". Each has a distinct colour and pattern (not colour alone, for print and colour-blind users). Include a point-vs-radiating toggle (arrow tool) and an intensity (NRS) per mark. A Ransford-style penalty score is optional and later.
  5. **Overlays.** Toggle dermatome and peripheral-nerve overlays on the body chart. Redraw them from scratch or from a CC0 source to avoid CC BY-SA share-alike obligations.
  6. **Per-visit history.** Keep a snapshot per visit, with side-by-side or "ghost previous visit" comparison, because physio body charts are typically layered across visits.
  7. **Arabic/RTL.** The canvas must not mirror in RTL. Only the UI chrome flips, and anatomical left/right labels stay fixed.
- **Asset strategy.** Trace the public-domain LadyofHats front and back skeletons into clean region paths (one `<path id>` per bone or joint, keyed to a site dictionary). Commission a simple flat silhouette for the pain drawing. This avoids CC BY-SA and gives full ownership.

### Gaps
- I could not obtain screenshots or field-level documentation of the NextGen Orthopaedics, Epic orthopedics or Exscribe body/skeleton tools. Exscribe sources only confirmed orthopedic templates and one-click protocols, not chart details.
- I could not verify the exact Ransford symbol legend (the search did not return the original key).
- No CC0/public-domain dermatome SVG was confirmed.
- I did not open the GitHub LICENSE files of the npm packages, only the registry listings.

## 2. AO/OTA Fracture and Dislocation Classification (2018) and alternatives: licensing for commercial software

### Takeaway
The 2018 OTA/AO Compendium's own notice allows reproducing the figures and using the classification "for research, educational and or medical purposes" without permission, but states it "cannot be used commercially or for-profit without permission". A commercial multi-tenant SaaS therefore needs written permission from AO Foundation/OTA (and possibly the publisher, Wolters Kluwer) before embedding AO descriptions or illustrations. No public fee schedule or software licensing page was found. Eponymous classifications (Gustilo-Anderson, Salter-Harris, Garden, Weber, etc.) are already embedded by commercial EHRs, and in US law a classification's underlying system or idea is not protected by copyright, though the original wording, arrangement and illustrations can be (ADA v. Delta Dental). The safe approach is to implement codes and categories with self-authored text and drawings.

### Cited Findings
**AO/OTA**
- The compendium notice reads: "the figures may be reproduced and the classification may be used for research, educational and or medical purposes without the need to request permission from the OTA, AO Foundation or the publisher. It cannot be used commercially or for-profit without permission." It is found in copies of the 2018 compendium (J Orthop Trauma 2018; 32 Suppl 1) — [OTA-hosted softproof of JOT vol 32 suppl (search snippet; PDF now 404)](https://ota.org/media/531625/rev-jotv32n1s-issue-softproof_11218.pdf); [third-party copy of compendium](https://n.gst.elementfx.com/dl/aoota-classification); [PubMed 29256945](https://www.pubmed.gov/29256945/)
- Some compendium content is third-party. One cartilage grading system is used "with the permission of the International Cartilage Repair Society" and would need separate clearance — [search snippet of compendium copies, OTA softproof](https://ota.org/media/531625/rev-jotv32n1s-issue-softproof_11218.pdf)
- AO Foundation's classification page (2026):
  - offers adult and pediatric posters and brochures "for personal use";
  - links the free AO/OTA Fracture Classification app (iOS; Android `org.aofoundation.aoclassification`);
  - says the 2018 compendium covers "adults and children";
  - lists no post-2018 revision, gives no commercial or software-integration terms and no permissions contact (only a general contact page).
  — [AO Foundation: AO/OTA Classification Compendium 2018](https://www.aofoundation.org/trauma/clinical-library-and-tools/journals-and-publications/classification); [App Store listing](https://apps.apple.com/us/app/id399757053)
- Some AO Spine classification documents (for example the AO Spine–DGOU Osteoporotic Fracture pocket card) are licensed CC BY-NC-ND 4.0, which forbids commercial use and derivatives without separate permission — [AO Spine OF pocket card PDF](https://media.aofoundation.org/spine/-/media/project/aocd/aospine/documents/ao-spine-osteoporotic-classification-pocket-card.pdf?rev=f2bab7c9eb33482ab5642db5dc54ef5c)
- AO has its own coding software, AO COIAC (Comprehensive Injury Automatic Classifier), historically distributed free to surgeons and used for CMF and pediatric classification documentation — [Thieme: AOCMF classification within AOCOIAC](https://doi.org/10.1055/s-0034-1389564); [PCCF validation paper (AO COIAC used)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5385104)
- Third-party commercial apps built on the 2018 classification exist, crediting the JOT publication and AO Spine for spine content. Whether they hold licences is not stated — [Classify – FractureCode, App Store](https://apps.apple.com/pw/app/classify-fracturecode/id1661567578)
- A 2025–26 study reports AO/OTA classification is rarely documented systematically in EMRs and proposes LLM extraction from radiology reports and verbal communication — [SSRN: Automated AO/OTA classification using LLMs](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7635350)
- Deep learning can classify 2018 AO/OTA malleolar fractures at a high level of correctness (research only) — [PMC7919919](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7919919/)
- **Code structure:**
  - bone (1 humerus, 2 radius/ulna, 3 femur, 4 tibia/fibula; other regions cover spine, pelvis, hand, foot, face);
  - segment (1 proximal, 2 diaphyseal, 3 distal; 4 malleolar for tibia/fibula);
  - type A/B/C;
  - group 1–3;
  - subgroup.
  The system was first published 1996, revised 2006/2007 and updated 2018 — [Wikipedia: Müller AO classification](https://en.wikipedia.org/wiki/M%C3%BCller_AO_Classification_of_fractures)

**Pediatric (PCCF)**
- The AO Pediatric Comprehensive Classification of Long-Bone Fractures adapts Müller AO to the growing skeleton:
  - bone, segment, then a letter for type: E epiphyseal, M metaphyseal, D diaphyseal;
  - a child-specific pattern code;
  - a severity code (simple or multifragmentary only);
  - an extra displacement code for supracondylar humerus and radial head fractures.
  — [PMC5385104](https://pmc.ncbi.nlm.nih.gov/articles/PMC5385104); [Acta Orthopaedica PCCF series](https://actaorthop.org/actao/article/view/9669)
- In validation cohorts:
  - Salter-Harris patterns were 66% of single epiphyseal lower-limb fractures;
  - greenstick fractures were 32% of upper-limb diaphyseal fractures;
  - 0.7% of upper-limb fractures could not be classified;
  - authors suggested re-adding a specific code for toddler's fractures;
  - clinical (treatment/prognosis) relevance still needs prospective study.
  — [PMC5385104](https://pmc.ncbi.nlm.nih.gov/articles/PMC5385104)

**Eponymous classifications and copyright**
- 17 U.S.C. §102(b): copyright does not extend to "any idea, procedure, process, system, method of operation, concept, principle, or discovery" regardless of form — [govinfo 17 USC 102](https://www.govinfo.gov/content/pkg/USCODE-2024-title17/html/USCODE-2024-title17-chap1-sec102.htm)
- ADA v. Delta Dental (7th Cir. 1997): a procedure taxonomy (descriptions and numbering) can be copyrightable expression and is not an unprotectable "system". The code's descriptive text was protected — [case brief](https://www.lexplug.com/casebrief/american_dental_association_v_delta_dental_plans_association_68b9d9da6e6d31b500ba8431)
- Commercial ortho EHRs embed eponymous classifications. MD Synergy's Althea advertises ICD-10 lookup with laterality and encounter type plus Gustilo and Salter-Harris fields — [MD Synergy orthopedics EHR](https://www.mdsynergy.com/?p=21929)
- **Gustilo-Anderson in coding:** ICD-10-CM initial-encounter 7th characters are:
  - A = closed;
  - B = open type I/II or unspecified;
  - C = open type IIIA/IIIB/IIIC.
  When the Gustilo type is not specified, the type I/II character is assigned. Coders cannot infer the grade from radiology; the treating surgeon must document it.
  — [AAPC Radiology Coding Alert](https://aapc.com/codes/coding-newsletters/my-radiology-coding-alert/icd-10-cm-2022-identify-the-correct-7th-character-for-active-fracture-treatment-171854-article); [AHA Coding Clinic via FindACode](https://www.findacode.com/newsletters/aha-coding-clinic/icd/7th-character-default-gustilo-anderson-classification-I031038.html); [ACEP open fracture vignette](https://www.acep.org/administration/reimbursement/icd--10-resources/icd-10-open-fracture-vignette)
- Inter-observer reliability of the 2018 AO/OTA proximal humerus classification has been compared with other systems (Neer etc.); reliability is a known issue — [PMC7067934](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7067934/)

### Inferences
- **AO/OTA plan:**
  1. Send a written permission request now to AO Foundation (AO Trauma, Davos, via the AO contact page) and OTA (Classification Committee), copying Wolters Kluwer permissions. Describe a commercial multi-tenant SaaS in Syria, the intended display (codes plus short descriptions plus self-drawn or AO illustrations), the number of tenants and the pricing model. Ask explicitly whether an LMIC or humanitarian concession applies.
  2. Until permission arrives, ship an "AO/OTA code" field that only validates code syntax (bone, segment, type, group, subgroup, qualifier, modifier), with no AO text or images. Clinicians already know the codes, so this stays useful.
  3. Add a guided picker (bone → segment → type → group) with AO wording only after the licence.
  4. Treat AO Spine and PCCF content as separately licensed. The AO Spine CC BY-NC-ND licence explicitly bars commercial use.
- **Free alternative set for R1, self-authored definitions** [textbook, not re-verified; clinician review required]:
  - Open fractures: Gustilo-Anderson I/II/IIIA/IIIB/IIIC (required field for open fractures).
  - Closed soft-tissue injury: Tscherne C0–C3.
  - Physeal: Salter-Harris I–V.
  - Femoral neck: Garden I–IV (plus Pauwels).
  - Ankle: Weber A/B/C (plus Lauge-Hansen optional).
  - Proximal humerus: Neer 1–4 part.
  - Tibial plateau: Schatzker I–VI.
  - Distal radius: Frykman I–VIII (plus "AO 2R3" code).
  - Radial head: Mason I–III (Johnston IV).
  - Later candidates: calcaneus (Sanders), talar neck (Hawkins), periprosthetic femur (Vancouver), pelvis (Young-Burgess/Tile), knee OA radiographic grade (Kellgren-Lawrence), scaphoid (Herbert), supracondylar humerus (Gartland).
  - Use original wording and own diagrams. Do not copy textbook or Orthobullets text or figures.
- **Classification data model.** Model classification as a versioned dictionary (system, version, code, display text per language, licence status) so licensed systems can be switched on per tenant without schema change.

### Gaps
- No AO/OTA commercial licence fee, contract template or processing time was found. AO has no public "licensing for software" page in my results, so the only route is to ask directly.
- I could not open the primary JOT 2018 front matter (the OTA PDF returned 404 and the AO booklet PDF was too large). The permission wording comes from search snippets of two copies, which agree.
- I found nothing on universal modifiers/qualifier lists, or on any 2020+ updates (for example to the pediatric or spine parts), from a primary source.
- Legal status of eponymous classifications under Syrian, Swiss or UK law was not researched; the US §102(b) / Delta Dental reasoning is indicative only and not legal advice.

## 3. PROMs: licensing for embedding in a commercial SaaS used in Syria, costs, and Arabic/Turkish versions

### Takeaway
Most marquee orthopedic PROMs are not free for a commercial software vendor:
- **Oxford scores (OKS, OHS, OSS, OES):** owned by Oxford University Innovation (OUI); all use must be under licence; commercial users pay royalties, rate not published.
- **QuickDASH/DASH:** the Institute for Work & Health publishes fees, Category B "commercial software" CAD 1,250 first year plus CAD 650/yr renewal plus user fees from CAD 625.
- **KOOS/HOOS/FAOS:** moved to Mapi Research Trust in 2023; commercial users and healthcare organisations pay, amount not published.
- **ODI v2.1a:** Mapi; free for clinical and academic use, fee for commercial.
- **EQ-5D:** EuroQol; free non-commercial, fee for commercial and digital.
- **PROMIS:** paper forms free for clinical use; EHR/API use carries licence fees.

Commonly cited as free (verify in writing): SPADI, FAAM, ASES, KOOS JR/HOOS JR (no licence, no modification), IKDC subjective, Constant-Murley (clinician use). AOFAS should not be used; the AOFAS itself recommended against it in 2011 and 2018.

### Cited Findings
**DASH / QuickDASH (Institute for Work & Health, Toronto)**
- One-year licence fees (CAD), with annual renewals:
  - Category A, for-profit publications or products: $1,500; renewal $700 plus user fees.
  - Category B, commercial software and/or web-based software for repeated use: $1,250; renewal $650 plus user fees.
  - Category C, commercially funded studies: $1,250; renewal $650.
  — [IWH DASH licences](https://dash.iwh.on.ca/licences)
- User fees (CAD) by number of users: ≤500 $625; ≤1,000 $1,150; ≤2,000 $2,120; ≤3,000 $2,940; ≤4,000 $3,640; ≤5,000 $4,250; ≤7,500 $6,000; ≤10,000 $7,600; >10,000 by quote. They are applied to the target volume on the User Profile form — [IWH DASH licences](https://dash.iwh.on.ca/licences)
- Commercial applicants submit a User Profile form, and the instrument may not be used before the licence is signed and paid. A 10% administrative fee applies on holds and cancellations. No LMIC discount is mentioned — [IWH DASH licences](https://dash.iwh.on.ca/licences)
- Non-profit use needs no licence and no fee, but the instrument "may not be sold or incorporated into a product to be sold… without written permission" — [IWH DASH FAQ](https://dash.iwh.on.ca/faq)
- Translations: Arabic DASH and QuickDASH (Dr Naser Mohammed Alotaibi, Kuwait University), with Arabic-for-Libya in progress; Turkish DASH and QuickDASH, 2012 (Çiğdem Öksüz, Hacettepe University). The page gives no validation status — [IWH available translations](https://dash.iwh.on.ca/available-translations)

**Oxford Knee / Hip / Shoulder / Elbow Scores (Oxford University Innovation, Clinical Outcomes)**
- Copyright in OHS and OKS is owned by OUI, and "any and all use of the Oxford orthopedic scores should be under licence from Clinical Outcomes". Licences are requested through OUI's online process. Administration modes listed include "ePRO/eCOA – computer-based administration". There is an "Available languages" PDF — [OUI OKS licence details](https://innovation.ox.ac.uk/licence-details/oxford-knee-score-oks); [OUI OHS licence details](https://innovation.ox.ac.uk/licence-details/oxford-hip-score-ohs); [OUI clinical outcome assessments](https://innovation.ox.ac.uk/licensing-opportunities/clinical-outcome-assessments)
- Fee structure:
  - Comprehensive user manuals cost £150 each (OUI page, per search snippet) — [OUI OKS page](https://innovation.ox.ac.uk/?p=4597)
  - A third party (Heartbeat Medical) states the scores are free for non-commercial users, but commercial users, large private practices and industry-funded projects pay royalties — [Heartbeat Medical OKS resource](https://heartbeat-med.com/resources/oks)
  - US CMS quality-programme licences were granted free of copyright fees — [OUI: Information for CMS members](https://innovation.ox.ac.uk/?p=15939)
- Concrete market signals:
  - A UK G-Cloud platform offering OHS/OKS lists £7,000 per licence per year — [UK Digital Marketplace G-Cloud listing](https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/services/975083407571147)
  - The Canadian CIHI national licence bars commercial use without written authorisation from both CIHI and OUI, and requires reporting the annual count of unique patients surveyed — [CIHI 2024 Oxford hip/knee registration form](https://www.cihi.ca/sites/default/files/document/2024-oxford-hip-knee-registration-form-en.pdf)
- Arabic OKS:
  - Validated in Egypt (SICOT-J 2019) together with Arabic Lysholm and Arabic IKDC, for ligament, meniscus and OA patients; OKS Cronbach α 0.90 — [PMC6407430](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6407430/)
  - OKS-Ar was validated for TKA (JBJS Am 2020; n=100, 80 women; test-retest rs 0.94; α 0.85) — [Salford repository](https://salford-repository.worktribe.com/output/1356447/responsiveness-reliability-and-validity-of-arabic-version-of-oxford-knee-score-for-total-knee-arthroplasty)

**KOOS / HOOS / FAOS (Mapi Research Trust)**
- Since May 2023 (announced 10 Oct 2023), Professor Ewa Roos entrusted KOOS, HOOS, FAOS and derivatives (KOOS-12, HOOS-12, KOOS-Child) to Mapi. They are free for funded and unfunded academic users. "Commercial users and health care organizations/hospitals/medical centers must pay a fee", and permission is always required. Terms and languages are on ePROVIDE — [Mapi: KOOS, HOOS and FAOS](https://www.mapi-trust.org/news-events/news/koos-hoos-and-faos)
- Conflicting older source: the KOOS user guide (2012) says KOOS is public domain and needs no permission. This is superseded by the 2023 Mapi terms — [KOOS user's guide 2012 (copy)](https://braceworks.ca/wp-content/uploads/2016/03/KOOSusersguide2012.pdf)
- KOOS JR / HOOS JR (developed at Hospital for Special Surgery): listed as free with no licence required, but "surveys may not be altered without written permission". Contact ARJRResearch@hss.edu — [CODE Technology HOOS JR & KOOS JR](https://www.codetechnology.com/hoos-jr-and-koos-jr); [HSS HOOS/KOOS JR page (search result; fetch returned 404)](https://www.hss.edu/research/healthcare-research-institute/hoos-koos)

**Oswestry Disability Index (ODI) and Neck Disability Index (NDI)**
- ODI: Mapi Research Trust handles global licensing at the author's request, because of "rogue versions". Version 2.1a is preferred. Clinical and academic licences are "no charge", commercial users pay "an affordable license fee" (amount not stated), and more than 60 translations exist — [Mapi: the Oswestry Disability Index](https://www.mapi-trust.org/news-events/news/the-oswestry-disability-i)
- NDI: the manual states all use is subject to permission from the author (Howard Vernon). Some sites say Mapi distributes it — [NDI original test manual](https://www.fysio.dk/globalassets/restricted/fafo/maaleredskaber/ndi_original_testmanual.pdf)

**EQ-5D (EuroQol Research Foundation)**
- Free for non-commercial use after registration; commercial use (for-profit companies) is charged. The fee is calculated by the EuroQol office from registration details — [SRA Lab EQ-5D page](https://www.sralab.org/rehabilitation-measures/euroqol-5-dimension-questionnaire); [EQ-5D registration](https://eq-registration.herokuapp.com); [EuroQol: obtain EQ-5D](https://euroqol.org/register/obtain-eq-5d/)
- In April 2022 EuroQol replaced device-specific digital formats with one digital format and a new commercial licence fee structure for it (2022 notice as summarised in search; current fees unknown) — [Castor PRO-tax brief](https://www.castoredc.com/insight-briefs/pro-tax-top-10-commercial-pros-cost-effective-alternatives/)
- An Arabic EQ-5D-5L was validated in degenerative spine disease (BMC Public Health 2024; n=100; α 0.816; ICC 0.85 for the score), using the Arabic ODI and Arabic SF-36 as comparators — [BMC Public Health 2024](https://bmcpublichealth.biomedcentral.com/articles/10.1186/s12889-024-18367-3)

**PROMIS (HealthMeasures / Northwestern)**
- Paper/PDF measures are free for clinical and non-commercial research use. The Assessment Center API (CAT and scoring) requires an annual quote-based licence. The PROMIS Epic app carries an annual licence fee — [IntuitionLabs PROMIS profile](https://intuitionlabs.ai/software/oncology-specific-ehremr/patient-reported-outcomes-pros/promis); [Northwestern EASI-PRO Epic](https://sites.northwestern.edu/easipro/epic)
- One blog says uploading PROMIS into an EMR needs explicit permission (not authoritative). The 2016 Assessment Center FAQ listed fees such as $5,000 per study per year (dated) — [OT Potential blog](https://otpotential.com/blog/promis-measures); [Assessment Center FAQ 2016](https://www.assessmentcenter.net/documents/FAQ.pdf)

**Free or low-friction instruments (secondary sources; verify with developers)**
- SPADI (13 items: 5 pain, 8 disability): free, no licence — [SRA Lab SPADI](https://www.sralab.org/rehabilitation-measures/shoulder-pain-and-disability-index); [CODE Technology SPADI](https://www.codetechnology.com/blog/spadi-shoulder-score/)
- FAAM: free, no licence required — [CODE Technology FAAM](https://www.codetechnology.com/?p=22716)
- ASES: "does not require a license and is free to use" (third party) — [CODE Technology ASES](https://www.codetechnology.com/?p=21850)
- Constant-Murley: "available free for use by clinicians and researchers". The developer keeps the intellectual property — [Shoulderdoc outcome scores](https://shoulderdoc.co.uk/section/903); [Physiotutors Constant-Murley](https://www.physiotutors.com/questionnaires/constant-murley-shoulder-score/)
- IKDC subjective knee form: listed as free in a knee-measures review, with a scoring sheet on sportsmed.org (search summary; secondary) — [Arthritis Care & Research knee measures review (Deep Blue)](https://deepblue.lib.umich.edu/bitstream/handle/2027.42/163466/acr24235.pdf)
- WOMAC: "licensing terms vary". Castor suggests KOOS/HOOS or KOOS JR/HOOS JR as alternatives — [Castor PRO-tax brief](https://www.castoredc.com/insight-briefs/pro-tax-top-10-commercial-pros-cost-effective-alternatives/)

**AOFAS**
- In 2011 the AOFAS called its own clinical rating scales "less than ideal" for lack of reliability and validity. A 2018 position statement recommended against continued use, and AOFAS cannot recommend one universal PROM. The scale is still widely used in papers — [Foot & Ankle Orthopaedics 2018 (DOAJ)](https://doaj.org/article/0bffeb0060d045a5a645ce41bc0eb5d2); [AOFAS position statement record](https://iro.uiowa.edu/esploro/outputs/abstract/AOFAS-Position-Statement-on-the-Future/9984958624602771)

**How PROM platforms handle licensing**
- Physitrack has a help article titled "Licensing third-party outcome measures", which shows platforms push some licensing to clinics. The page returned 404 when fetched, so content is unverified — [Physitrack support (search result)](https://support.physitrack.com/article/769-licensing-outcome-measures)

### Inferences
- **Licence matrix for R1 planning:**

| Instrument | Licensor | Commercial SaaS status | Arabic | Turkish |
|---|---|---|---|---|
| OKS/OHS/OSS/OES | OUI | Licence plus royalty (quote) | OKS-Ar validated (Egypt, TKA); others unknown | Unknown |
| QuickDASH/DASH | IWH | Cat B CAD 1,250 + user fee (≥CAD 625) yr 1; CAD 650 + user fee/yr | Yes (Kuwait) | Yes (2012) |
| KOOS/HOOS/FAOS (+12-item) | Mapi | Fee for commercial and healthcare orgs (quote) | KOOS Arabic reported (search summary) | Unknown |
| KOOS JR/HOOS JR | HSS | Reportedly free, no modification | Unknown | Unknown |
| ODI 2.1a | Mapi | Free clinical; commercial fee (quote) | Arabic ODI exists (used as comparator) | Unknown |
| NDI | Vernon/Mapi | Permission needed | Unknown | Unknown |
| EQ-5D-5L | EuroQol | Commercial and digital fee (quote) | Validated 2024 | Unknown |
| PROMIS | HealthMeasures | EHR/API licence fee | Unknown | Unknown |
| SPADI, FAAM, ASES, Constant, IKDC | Developers | Reportedly free | IKDC/Lysholm Arabic (Egypt 2019) | Unknown |
| AOFAS | — | Do not use (deprecated by owner) | — | — |

- **Two licensing models are possible:**
  - (a) Vendor licence: the SaaS company licenses each instrument for all tenants (IWH Category B explicitly covers "commercial software… for repeated use").
  - (b) Tenant "bring your own licence": the clinic licenses directly. Mapi and OUI both target "healthcare organisations", so clinics may be charged anyway.
  - Build a per-tenant `InstrumentLicence` flag so an instrument is hidden unless licensed. This also protects against the IWH rule that the instrument may not be used before the licence is paid.
- **Syria specifics.** Request LMIC or humanitarian pricing explicitly. None of the licensors I checked publishes one, so ask. Also confirm licensors' sanctions-screening stance for Syria before contracting (not researched here).
- **PROM engine requirements:**
  - verbatim item text per licensed language version, no edits (HSS and Mapi forbid modification);
  - scoring algorithms per the user manual (OUI sells manuals at £150);
  - missing-item rules;
  - patient self-completion on tablet or link;
  - longitudinal graph with MCID bands;
  - schedule rules (pre-op, 6 weeks, 3 months, 6 months, 1 year, then yearly);
  - an instrument version stored with every response.

### Gaps
- No published fee numbers for OUI, Mapi (KOOS/ODI), EuroQol commercial/digital, or PROMIS EHR use. All are quote-based.
- No confirmation of Arabic versions of OHS/OSS/OES, QuickDASH validation status, or Turkish Oxford/KOOS/ODI versions. These are on licensor language lists (OUI "Available languages" PDF, ePROVIDE) that I could not open.
- Licensing for WOMAC (rights holder not confirmed), Lysholm, Tegner, SANE and mJOA was not found.
- The Arabic KOOS-12 validation (n=201 vs Arabic WOMAC) was reported in a search summary, but I could not tie it to a primary URL. The Princess Nourah University "Arabic Health Measures" catalogue (ahm.pnu.edu.sa) surfaced in results and may list Arabic versions; not opened.

## 4. Spine module essentials

### Takeaway
A professional spine module needs:
- a level-based neuro exam (myotome power, dermatome sensation and reflexes, recorded per side and per level);
- a structured red-flag screen, with cauda equina items prominent;
- myelopathy signs;
- radiculopathy mapping onto the body chart;
- spine PROMs (ODI, NDI; both need permission);
- imaging measurements (Cobb angle) tracked over time.

Wrong-level surgery is the most common wrong-site error reported by orthopedic board candidates, so explicit level selection and confirmation matter.

### Cited Findings
- Bowel/bladder symptoms with perianal (saddle) numbness suggest cauda equina syndrome, "a true emergency that requires urgent decompression" — [AAFP 2001](https://www.aafp.org/afp/2001/0815/p631)
- Red-flag lists differ across guidelines; a systematic review of 8 guidelines found no two shared the same list — [Red Whale: spinal cord compression and CES](https://redwhale.co.uk/pearls/spinal-cord-compression-and-cauda-equina-syndrome)
- NHS Greater Glasgow & Clyde maintains an MSK red-flags/serious-pathology index usable as a template source — [NHS GGC Right Decisions: red flags](https://rightdecisions.scot.nhs.uk/ggc-msk-index-in-development/red-flags)
- Degenerative cervical myelopathy signs:
  - upper motor neuron signs include hyperreflexia, Hoffmann sign, upgoing plantars, spasticity and corticospinal motor deficits;
  - sensitivity is highest for the inverted supinator sign (61%), then the suprapatellar reflex (56%) and Hoffmann (44%);
  - there is no definite association between Hoffmann, Babinski or hyperreflexia and severity.
  — [PMC11289551 systematic review](https://pmc.ncbi.nlm.nih.gov/articles/PMC11289551)
- Jane's spine chart uses per-joint (level) checkboxes plus a sketchable spine diagram — [Jane guide](https://jane.app/guide/chart-items-for-creating-a-chart-template)
- Cobb angle: Cornerstone3D (the OHIF viewer's toolkit) includes a `CobbAngleTool` annotation class; OHIF includes length and angle tools — [Cornerstone CobbAngleTool](https://cornerstonejs.org/docs/api/tools/classes/CobbAngleTool); [PMC7259879 (OHIF)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7259879)
- Among American Board of Orthopaedic Surgery candidates, wrong-site surgery continued despite "Sign Your Site" and the Universal Protocol, and wrong-level spine surgery was the most common reported error — [AHRQ PSNet summary](https://psnet.ahrq.gov/issue/occurrence-wrong-site-surgery-self-reported-candidates-certification-american-board)
- ODI 2.1a (Mapi) is free for clinical use and charged for commercial use. NDI needs author permission. An Arabic ODI exists and was used as a validated comparator — [Mapi ODI](https://www.mapi-trust.org/news-events/news/the-oswestry-disability-i); [NDI manual](https://www.fysio.dk/globalassets/restricted/fafo/maaleredskaber/ndi_original_testmanual.pdf); [BMC Public Health 2024](https://bmcpublichealth.biomedcentral.com/articles/10.1186/s12889-024-18367-3)
- AO Spine classifications (for example the osteoporotic fracture classification) are CC BY-NC-ND, so commercial embedding needs permission — [AO Spine OF pocket card](https://media.aofoundation.org/spine/-/media/project/aocd/aospine/documents/ao-spine-osteoporotic-classification-pocket-card.pdf?rev=f2bab7c9eb33482ab5642db5dc54ef5c)

### Inferences
- **Neuro-by-level grid** [textbook ISNCSCI key muscles, not re-verified]:
  - Columns: Level, Side L/R, Motor (MRC 0–5), Light touch (0 absent / 1 altered / 2 normal), Pin-prick (same scale), Reflex (0–4+), Note.
  - Upper limb levels: C5 elbow flexors, C6 wrist extensors, C7 elbow extensors, C8 finger flexors, T1 little-finger abductors.
  - Lower limb levels: L2 hip flexors, L3 knee extensors, L4 ankle dorsiflexors, L5 long toe extensors, S1 ankle plantar flexors.
  - Reflexes: biceps C5, brachioradialis C6, triceps C7, patellar L4, Achilles S1.
  - Sensory: dermatome per level, with tap-on-dermatome via the body-chart overlay.
  - Shortcuts: "all normal" one-tap, then edit exceptions.
- **Red-flag checklist** (yes/no/unknown, any "yes" raises a banner and a mandatory plan):
  - cauda equina items: saddle anaesthesia, new bladder/bowel dysfunction, sexual dysfunction, bilateral sciatica, progressive neuro deficit;
  - other items: history of cancer, weight loss, fever/IV drug use/immunosuppression, significant trauma or osteoporosis with minor trauma, age thresholds, night or non-mechanical pain, structural deformity.
  - Adapt the list from one named guideline (for example NHS GGC or NICE) and cite it in-app, because lists differ between guidelines.
- **Radiculopathy mapping.** Pain-drawing marks on a dermatome plus the motor/reflex grid should produce a suggested level, which the clinician confirms. Never set the level automatically.
- **Myelopathy panel:** Hoffmann, inverted supinator, Babinski, clonus, gait/tandem, grip-and-release test (10 s count), Romberg, plus mJOA (licensing unverified).
- **Scoliosis/deformity:** curve list (region, apex, end vertebrae upper/lower, Cobb degrees, direction), Risser grade, menarche/growth markers, brace hours/day, and a Cobb trend chart per curve.
- **Wrong-level safety.** For spine procedures, the selected levels (for example L4–L5) must appear in the booking, consent and op note, and changes must be flagged with a reason.

### Gaps
- No primary-source content was fetched for mJOA scoring/cut-offs, the ISNCSCI worksheet licence (ASIA), Risser grading or spine-specific outcome sets (for example SRS-22 licensing).
- How NextGen, ModMed or Epic implement spine level pickers was not found.

## 5. Sports medicine and arthroplasty: registry-style implant data, follow-up and return to sport

### Takeaway
National joint registries (NJR UK via the NHS Data Dictionary, AOANJRR, the EFORT NORE minimal dataset) define the implant fields a professional system should capture:
- manufacturer, catalogue number and batch/lot (mandatory in the NJR hip set);
- surgical approach and minimally invasive flag;
- fixation (cemented, cementless or hybrid), with cementing details;
- the NJR component database now links up to 5 GTINs to a catalogue number, which supports barcode/UDI scanning.

Follow-up schedules and return-to-sport criteria were not researched (search budget exhausted).

### Cited Findings
- The NHS Data Dictionary NJR hip dataset (May 2024 archive) lists implant catalogue number and implant batch/lot number as mandatory in the components group, and surgical approach and minimally invasive indicators as mandatory items — [NHS Data Dictionary: NJR data set – hip](https://archive.datadictionary.nhs.uk/DD%20Release%20May%202024/data_sets/clinical_content/national_joint_registry_data_set/national_joint_registry_data_set_-_hip.html)
- The 2003 change request CP323 added NJR MDS elements (catalogue number, batch/lot number, classification code, manufacturer, model), effective 1 April 2003 — [NHS DD CP323](https://v2.datadictionary.nhs.uk/change_packages/cp323/CP323.asp.html)
- The NJR component database classifies fixation as cemented, cementless or hybrid. In 2025 it was updated to allow up to 5 GTINs per component catalogue number — [NJR component database (UK Gov Web Archive)](https://tnaqa.mirrorweb.com/ukgwa/20260505144557mp_/https://www.njrcentre.org.uk/njr-component-database/)
- The older (2012) NJR dataset included cementing fields: cement gun, mixing system, pressuriser and hip cementing technique — [NHS DD 2012 NJR data set](https://archive.datadictionary.nhs.uk/DD%20Release%20June%202012/data_dictionary/messages/clinical_data_sets/data_sets/national_joint_registry_data_set.asp@shownav=0.html)
- Other reference datasets: the AOANJRR data dictionary and the EFORT NORE minimal registry dataset (not opened) — [AOANJRR data dictionary](https://aoanjrr.sahmri.com/aoanjrr-data-dictionary); [EFORT NORE minimal registry dataset](https://efortnet.efort.org/documents/7050849/7790575/NORE_Minimal_Registry_Dataset.pdf)
- KOOS JR/HOOS JR were designed for joint replacement and are reportedly free. Oxford hip/knee are the UK NJR/PROMs standard but need an OUI licence — [CODE Technology HOOS/KOOS JR](https://www.codetechnology.com/hoos-jr-and-koos-jr); [OUI OKS](https://innovation.ox.ac.uk/licence-details/oxford-knee-score-oks)
- Arabic IKDC and Lysholm were validated (SICOT-J 2019) for ligament and meniscus injuries, which suits sports knee follow-up — [PMC6407430](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6407430/)

### Inferences
- **`ImplantUsage` fields:**
  - procedure, joint, side, component role (femoral stem, head, acetabular shell, liner, tibial tray, insert, femoral component, patella, cement);
  - manufacturer, brand/model, catalogue (REF) number, lot/batch, size, GTIN/UDI, expiry date;
  - fixation (cemented/cementless/hybrid) and cement brand/lot;
  - bearing surface (MoP, CoP, CoC) and head size [textbook, not re-verified].
  - Encounter fields: approach (posterior, lateral, anterior, anterolateral; medial parapatellar, subvastus), MIS flag, navigation/robotic flag, ASA grade, BMI, indication.
  - Support barcode or GS1 DataMatrix scanning on a phone to fill REF, lot and expiry.
- **Arthroplasty follow-up template** (configurable, needs clinician validation):
  - visits at 2 and 6 weeks (wound, ROM, VTE), 3 months, 1 year, then periodic radiographic review;
  - PROM time-points attached (pre-op baseline is essential).
- **Sports episode:**
  - injury date, mechanism, sport and level (Tegner activity level, licence unverified);
  - surgery (ACL graft type, meniscal repair vs meniscectomy, cartilage grade);
  - return-to-sport milestones checklist (ROM, effusion, strength LSI %, hop tests LSI %, psychological readiness), with a cleared/not-cleared decision and date.

### Gaps
- BHS/BASK arthroplasty follow-up recommendations and ACL return-to-sport criteria (for example ACL-RSI licensing, hop-test batteries) were not researched; the search budget was exhausted.
- I did not open the AOANJRR or NORE datasets to list their exact fields.

## 6. Trauma / fracture clinic workflows: union, complications, VTE

### Takeaway
Beyond cast tracking, professional fracture clinics need:
- a day-list ("fracture clinic list") with x-ray-before-review flow;
- union assessment, for example RUST for tibial shafts: 4 cortices scored 1–3 each, total 4–12, with union commonly defined as ≥9 (some evidence supports ≥10);
- structured complication checklists;
- documented VTE risk assessment for lower-limb immobilisation.

The Gustilo grade and open/closed status should be mandatory structured fields because coding depends on them.

### Cited Findings
- RUST scores callus and fracture line per cortex across four cortices. The total runs from 4 (definitely not healed) to 12 (completely healed). In tibial nailing, RUST 9 was used as "radiographically healed" (median about 20.9 weeks to reach it). Most reviewers considered RUST 9 as united, and >90% considered RUST 10 / mRUST 13 united. A rat biomechanical study supports RUST ≥10 as "healed" — [PMC5009237](https://pmc.ncbi.nlm.nih.gov/articles/PMC5009237); [OTA 2014 poster](https://ota.org/sites/files/legacy_abstracts/ota14/OTA%20AM14%20Poster%20016.pdf); [Bone & Joint Research rat RUST study](https://boneandjoint.org.uk/Article/10.1302/2046-3758.54.2000628/pdf)
- Some abstracts report union thresholds of RUST 9 / mRUST 10, so thresholds conflict between studies — [OTA 2017 paper 002](https://ota.org/sites/files/legacy_abstracts/ota17/OTA%20AM17%20Paper%20002.pdf)
- ICD-10-CM fracture 7th characters encode open/closed and Gustilo group for the initial encounter, and malunion/nonunion and sequela on subsequent encounters (for example "R" = subsequent encounter, open IIIA–C, with malunion; "S" = sequela). The surgeon must document the Gustilo grade — [AAPC](https://aapc.com/codes/coding-newsletters/my-radiology-coding-alert/icd-10-cm-2022-identify-the-correct-7th-character-for-active-fracture-treatment-171854-article); [ICD-10-CM 7th character values listing](https://icdlist.com/icd-10/instructional-notes/7th-character/open-fracture-type-encounter)
- MD Synergy highlights encounter type (initial/subsequent/sequela) plus laterality in ortho ICD-10 lookup — [MD Synergy](https://www.mdsynergy.com/?p=21929)

### Inferences
- **Fracture clinic list view:**
  - Columns: today's patients, injury date, days/weeks since injury, fracture (site, side, classification), management (cast/splint/ORIF), x-ray-needed flag, cast-change due, next-step chips (remove cast, convert to boot, refer physio, discharge).
  - Filters: per surgeon and per clinic (fracture clinic vs cast room).
- **Union assessment:**
  - clinical items (tenderness at site, pain on weight-bearing, movement at site);
  - radiographic items (callus bridging per cortex, RUST/mRUST calculator for tibia/femur shafts);
  - status: united / delayed / nonunion / malunion, with angle measurements.
- **Complications checklist** (each with date, severity, action):
  - infection: superficial/deep, FRI criteria [not re-verified];
  - nonunion, malunion, implant failure, loss of reduction;
  - compartment syndrome: 5 Ps, pain on passive stretch, pressure if measured, fasciotomy;
  - neurovascular injury, CRPS, pressure sore under cast, stiffness, VTE.
- **VTE documentation:** a risk-assessment form for lower-limb immobilisation and post-op, with prophylaxis agent, dose and duration, or a recorded reason for none. The specific tool and rules are a gap (NICE NG89 could not be fetched).
- **Coding.** Syria likely uses WHO ICD-10, which has no ICD-10-CM laterality or 7th characters. Still capture side, Gustilo grade, encounter type and union status as structured fields so CM-style coding is possible later (Syria coding practice not verified).

### Gaps
- NICE NG89 / VTE in lower-limb immobilisation, BOAST compartment-syndrome documentation standards and fracture-related infection consensus definitions were not retrieved (NICE 403; search budget exhausted).
- No published workflow detail from a commercial "fracture clinic" module (for example NHS virtual fracture clinic software) was found in this session.

## 7. Radiographic measurements and templating: what a SaaS can realistically do

### Takeaway
Basic orthopedic measurements (length, angle, Cobb angle, ROI) are available in the open-source OHIF viewer / Cornerstone3D toolkit and are realistic for Release 1-extended in a web DICOM viewer. Calibrated arthroplasty templating with manufacturer implant libraries (TraumaCad, mediCAD) is a separate licensed product sold by quote, with cloud single-user options. Integrate or defer rather than build.

### Cited Findings
- Cornerstone3D provides a `CobbAngleTool` (an SVG annotation tool with edit and cancel). Older Cornerstone tools include AngleTool, ArrowAnnotate, Bidirectional, CircleROI and CobbAngle — [Cornerstone3D CobbAngleTool](https://cornerstonejs.org/docs/api/tools/classes/CobbAngleTool); [Cornerstone v1 tools API](https://v1.cornerstonejs.org/api/tools)
- OHIF Viewer built-in measurements: length, angle, ROI (rectangle, ellipse), plus segmentation, magnifier and CINE — [PMC7259879](https://pmc.ncbi.nlm.nih.gov/articles/PMC7259879)
- TraumaCad (Brainlab) cloud version: web-based, single-user licence, for individuals and small practices. The on-premises version uses concurrent licensing. A template subscription includes free template requests for any implant. Pricing is by proposal — [TraumaCad cloud](https://traumacad.quentry.com/); [Brainlab orthopedic templating](https://brainlab.com/ja/surgery-products/orthopedic-surgery-products/orthopedic-templating-software)
- mediCAD is priced per user with a free trial (no figure). The Siemens-distributed mediCAD Classic uses a one-year subscription licence — [Capterra mediCAD](https://www.capterra.com/p/254690/mediCAD/); [Siemens teamplay mediCAD Classic T&C](https://store.teamplay.siemens.com/api/download/media/mediCAD%20Hectec%20GmbH/mediCad%20Classic/6.0.0.10/OpenApps-mediCAD-Classic_TnC_07122020.pdf)
- AI fracture classification on radiographs is research-grade (ankle AO/OTA) — [PMC7919919](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7919919/)

### Inferences
- **R1-extended measurement set**, built on OHIF/Cornerstone tools plus small custom tools, each saved as a structured `ImagingMeasurement` (type, value, unit, side, image reference, calibration method):
  - Calibration: a known-size marker (25 mm ball) or a manual pixel-spacing check. Many Syrian clinics will photograph films or use CR without reliable pixel spacing, so photo-only images get a "not calibrated" flag.
  - Lower limb: HKA (mechanical axis), mLDFA, MPTA, leg-length discrepancy.
  - Foot: hallux valgus angle and IMA 1–2.
  - Spine: Cobb angle and sagittal parameters.
  - Shoulder: acromiohumeral interval.
  - Hip: CE angle, Tönnis angle, femoral offset.
  - Upper limb: radial inclination, volar tilt, ulnar variance (distal radius).
  - Angle definitions [textbook, not re-verified].
- **Templating.** Defer, or offer a deep link and export to TraumaCad/mediCAD cloud. Building implant template libraries requires manufacturer data agreements.

### Gaps
- No public pricing for TraumaCad, mediCAD or OrthoView. OrthoView returned no results.
- I did not verify whether the current OHIF v3 default toolbar exposes Cobb angle without configuration.

## 8. Operative notes, implant log, logbook, consent and post-op protocols

### Takeaway
Top ortho products use procedure-specific templates with one-click "protocols". Exscribe markets saving common choices as one-click modifiable treatment plans. The highest-value safety feature is a single source of truth for site, side and level carried from booking to consent to op note, because laterality mismatches are the most common error in surgical listings. Electronic standardised listing forms measurably reduced errors.

### Cited Findings
- A failure analysis at a high-volume academic centre found a 1.4% error rate between the surgical listing and the procedure performed. Laterality was the most frequent error. The rate fell significantly after an electronic standardised listing form was introduced. About 800 cases were caught pre-operatively — [AHRQ PSNet: surgical case listing accuracy](https://psnet.ahrq.gov/issue/surgical-case-listing-accuracy-failure-analysis-high-volume-academic-medical-center)
- In a Spanish prospective study of 101 foot-surgery patients, side was often missing from documentation, more so in orthopaedic and anaesthesia records — [Rev Esp Cir Ortop Traumatol](https://www.elsevier.es/en-revista-revista-espanola-cirugia-ortopedica-traumatologia-429-articulo-surgery-on-wrong-side-implication-S198888561200020X)
- In an AAOS membership survey summarised in a review, 21% of hand surgeons reported a wrong-site surgery at least once; the knee and hand were the most frequent sites — [IJ Surgery review](https://www.ijsurgery.com/index.php/isj/article/download/727/722/1945)
- Exscribe: "physicians can easily save commonly used choices as protocols to create one-click modifiable treatment plans". Built-in orthopaedic workflows, PACS optional, patient iOS app for forms and questionnaires — [TechnologyAdvice Exscribe overview](https://technologyadvice.com/products/exscribe-reviews/); [Exscribe case study](https://www.casestudies.com/company/exscribe/case-study/sugar-orthopaedics-customer-case-study); [Exscribe Mobile EHR app](https://apps.apple.com/cd/app/exscribe-mobile-ehr/id1438331373)

### Inferences
- **Procedure template library for R1-extended** (each = structured header + prefilled narrative blocks + required fields):
  - ORIF by bone (implant, reduction quality, fluoroscopy images);
  - intramedullary nailing;
  - closed reduction + K-wires;
  - ex-fix;
  - knee and shoulder arthroscopy (portal sites, findings per compartment, cartilage grade, meniscus tear type, procedures);
  - ACL reconstruction (graft, fixation, tunnel);
  - TKA/THA (approach, implants via `ImplantUsage`, alignment, closure);
  - carpal tunnel release, trigger finger release, tendon repair;
  - debridement and washout (Gustilo, cultures);
  - hardware removal;
  - spinal decompression/fusion (levels).
- **Universal header fields:**
  - diagnosis + side/level, procedure + side/level, surgeon/assistant, anaesthesia type;
  - tourniquet (site, pressure, time);
  - antibiotic prophylaxis, VTE plan;
  - EBL, drains, specimens, implants, complications;
  - closure, dressing, immobilisation;
  - post-op orders link.
- **Consent per procedure:** procedure-specific risks list in Arabic (editable per tenant), side/level printed in large type, patient and witness signature (tablet), and a timestamp linked to the booking.
- **Post-op protocol templates:**
  - weight-bearing status (NWB/TTWB/PWB %/WBAT/FWB) with date-based progression;
  - ROM limits (brace locked/unlocked degrees per week);
  - suture removal date, x-ray schedule, physio start;
  - each generating patient tasks and reminders.
- **Surgeon logbook:** derived automatically from op notes (procedure, role, date, patient age band, outcome or complication), exportable as CSV/PDF. Valuable for Syrian trainees and board applications.

### Gaps
- No vendor documentation was obtained for specific op-note template contents (ModMed, NextGen, Epic Orthopedics). The template lists above are design inferences.

## 9. Rehabilitation: exercise prescription libraries, licensing, and Arabic home-exercise sheets

### Takeaway
Physitrack (with the PhysioTools library) is the reference product: 18,000+ filmed exercise videos, a white-label patient app, Epic SMART-on-FHIR integration and a REST API. Pricing for API, library licensing or white-label is not public and is handled by enterprise sales. For a Syrian SaaS, the realistic R1 path is a self-produced Arabic exercise library (own photos/videos, own text) with printable home-exercise sheets, and an optional Physitrack integration later.

### Cited Findings
- Physitrack has 18,000+ professionally filmed exercise videos combined with PhysioTools content (part of Physitrack Group). It offers a white-label or co-branded PhysiApp, with top tiers listing SSO, multi-site and EMR/EPR integration. No prices are shown — [Physitrack branded app](https://physitrack.com/branded-app); [Physitrack vs Medbridge Epic integration](https://www.physitrack.com/insights/hep-platform-epic-integration-physitrack-vs-medbridge)
- Integrations: Epic via SMART-on-FHIR launch with HL7 writeback (live); drchrono, Raintree and Jane listed; others via REST API and custom SSO — [Physitrack: works alongside your EMR](https://www.physitrack.com/insights/physitrack-emr-complement-hep-rtm-patient-engagement); [IntuitionLabs Physitrack profile (17,000+ exercises, REST API v2)](https://intuitionlabs.ai/software/physical-occupational-therapy/telerehabilitation-platforms/physitrack)

### Inferences
- **Own library MVP:** about 150–250 core exercises across the 8 regions. Each has 2–3 photos or a short video shot in-house, Arabic instructions (Modern Standard Arabic, simple wording), sets/reps/hold/frequency, and side-specific mirroring.
- **Sheet format:** print and WhatsApp-share as a PDF; QR code to a video.
- **Protocol bundles:** post-ACL phase 1, frozen shoulder, low back pain, ankle sprain, post-TKA, linked to the post-op protocol so weight-bearing and ROM constraints filter allowed exercises.

### Gaps
- Medbridge licensing terms and whether Physitrack licenses its library to third-party EMRs (vs integrating its own app) were not researched or published.
- No open-licensed (CC0/CC BY) rehab exercise image library was identified in this session.
- Arabic availability of PhysiApp was not checked.

## 10. Orthotics/braces prescriptions and injection tracking

### Takeaway
There is no universal cap on corticosteroid injections, but common practice limits are about 3–4 per joint per year with at least about 3 months between injections, and BSSH-cited limits of about 2 per digit for trigger finger (another guideline allows 3). This supports configurable per-joint cumulative counters and interval warnings rather than hard blocks. Orthotics prescription content was not researched.

### Cited Findings
- AAOS OrthoInfo: no formal limit, but providers often use a practical limit of 3–4 cortisone shots per year — [AAOS OrthoInfo: cortisone shot](https://orthoinfo.aaos.org/en/treatment/cortisone-shot-steroid-injection)
- A recent multidisciplinary guideline (NYSORA summary) says:
  - there is no universally established yearly or lifetime maximum;
  - use the lowest effective dose and lengthen intervals between repeats where possible;
  - for the knee, an initial maximum of 40 mg triamcinolone, with no added benefit from 80 mg.
  — [NYSORA: new guidelines on corticosteroid injections](https://nysora.com/education-news/new-guidelines-reshape-corticosteroid-injections-for-joint-and-musculoskeletal-pain/)
- Hand/wrist review (Cureus 2025):
  - studies recommend at most 4 injections per year at a minimum 3-month interval;
  - EULAR advises no more than 3–4 per joint per year;
  - BSSH cited at most 2 injections per digit (another guideline 3).
  — [Cureus 2025 review](https://assets.cureus.com/uploads/review_article/pdf/425266/20251117-210581-ju7d4.pdf)
- Patient.info: no more than three injections in the same body part per year — [Patient.info steroid injections](https://it.patient.info/treatment-medication/steroids/steroid-injections?lang=null)
- Sevocity's drawing tool marks injection points on anatomical images — [Sevocity](https://www.sevocity.com/ehr-specialties/orthopedics/)

### Inferences
- **`Injection` entity fields:**
  - date, `BodySite` + side (joint, bursa, tendon sheath, digit, spinal level);
  - approach (landmark/ultrasound/fluoroscopy);
  - drug (steroid type, mg), local anaesthetic (mL), other (hyaluronic acid, PRP);
  - lot number, consent, aspirate (volume, appearance, sent for culture/crystals);
  - immediate response and complications.
- **Rules engine** (tenant-configurable defaults):
  - warn if the same site was injected within 90 days;
  - warn if ≥3 (or 4) steroid injections in the same joint in a rolling 12 months;
  - digit-specific counter for trigger finger (warn at 2);
  - running cumulative steroid mg per site and per patient per year;
  - diabetic patients get a glucose-rise advisory.
  - Show the history inline on the body chart (dots on injected joints).
- **Orthosis/brace order fields** [design inference]:
  - device type (collar, TLSO, knee brace hinged with ROM lock degrees, AFO, wrist splint, walking boot, insoles);
  - side, size/measurements, settings (ROM limits), wear schedule (hours/day, duration);
  - supplier, fitting date, review date;
  - link to the fracture or post-op episode.

### Gaps
- Orthotics prescription standards and catalogues were not researched.
- Steroid dose-equivalence tables and authoritative cumulative-dose thresholds were not found (only low-quality sources discussed cumulative dose).

## 11. What orthopedic surgeons value most and complain about in EMRs

### Takeaway
Orthopedic surgeons spend more clinic time in the EHR than face-to-face. One institution measured EHR work at 58% of the clinical day. They value speed (scribes, AI listening, one-click protocols, note and bill before the patient leaves), specialty templates and workflow efficiency. The main safety pain point is laterality/level documentation. Design for minimal clicks: defaults, "all normal then exceptions", carry-forward from the last visit, and touch/tablet use.

### Cited Findings
- **Time burden:**
  - At the University of Iowa, EHR work consumed 58% of orthopaedic surgeons' clinical days, more than face-to-face time — [Kesler et al., JAAOS 2022 (Iowa repository)](https://iro.uiowa.edu/esploro/outputs/journalArticle/Time-and-Clerical-Burden-Posed-by/9984303987502771)
  - An Epic Signal study quantified outpatient orthopaedic faculty EHR time (AAOS 2025 abstract) — [AAOS 2025 abstract](https://index.mirasmart.com/AAOS2025/PDFfiles/AAOS2025-003486.PDF)
  - In 133 surgeons, female surgeons had higher daily EHR time and documentation burden — [Thieme ACI study](https://thieme-connect.com/products/all/doi/10.1055/a-2194-1061)
- **Scribes and AI documentation:**
  - Scribes in a high-volume sports clinic were studied for reducing documentation time without hurting satisfaction — [PMC9210372](https://pmc.ncbi.nlm.nih.gov/articles/PMC9210372)
  - An AI listening tool significantly reduced documentation time in an orthopaedic clinic (AAOS 2026 abstract) — [AAOS 2026 abstract](https://index.mirasmart.com/AAOS2026/PDFfiles/AAOS2026-004920.pdf)
  - Ambient AI scribe use was associated with better perceived documentation efficiency (Vanderbilt surgeon survey; 28.5% response) — [JMIR Med Inform 2026](https://medinform.jmir.org/2026/1/e89329)
- **Satisfaction:** a POSNA 2015 survey of 324 pediatric orthopaedic surgeons found no overall satisfaction difference by vendor, but significant differences in template usefulness and workflow efficiency — [Pediatric ortho EMR satisfaction (catalogue record)](https://vufind-test.katalog.k.utb.cz/SummonRecord/FETCH-LOGICAL-p108t-f00931b5f416d44f7b73a29793808d19e7ece79f8e0129914269579a4088b5862)
- **AAOS policy:** health IT should improve care and reduce provider burden rather than take time from patients — [AAOS HIT advocacy](https://www.aaos.org/Advocacy/HIT)
- **Vendor positioning confirms what sells:** ModMed's note and bill before the patient leaves, touch atlas and auto-suggested codes; Exscribe's one-click protocols — [modmed Orthopedics](https://www.modmed.com/orthopedics/); [TechnologyAdvice Exscribe](https://technologyadvice.com/products/exscribe-reviews/)
- **Laterality/level errors:** laterality is the commonest listing error (1.4% listing–procedure mismatch); side is often omitted in ortho records; wrong-level spine surgery is the commonest wrong-site error among board candidates — [PSNet listing accuracy](https://psnet.ahrq.gov/issue/surgical-case-listing-accuracy-failure-analysis-high-volume-academic-medical-center); [Rev Esp Cir Ortop](https://www.elsevier.es/en-revista-revista-espanola-cirugia-ortopedica-traumatologia-429-articulo-surgery-on-wrong-side-implication-S198888561200020X); [PSNet ABOS candidates](https://psnet.ahrq.gov/issue/occurrence-wrong-site-surgery-self-reported-candidates-certification-american-board)

### Inferences
- **UX rules for "very professional, clear, easy":**
  1. Body-first entry: tap a joint, the region template opens with side set.
  2. Exam "normal defaults": one tap marks all normal, then edit exceptions. ROM shows normal reference values pre-filled for quick deltas.
  3. Carry forward the last visit's findings with diff highlighting.
  4. Favourite "protocols" per diagnosis: one click fills plan, orders, PROMs, physio referral and patient sheet (the Exscribe pattern).
  5. Side and level are explicit, mandatory and colour-coded (for example R = blue, L = orange) everywhere: problem list, orders, booking, consent, op note, imaging. Any mismatch across the chain raises a hard warning.
  6. Tablet-first, large targets, works offline or poor-network tolerant (Aleppo/Azaz connectivity is an inference, not researched).
  7. Patient-entered data (PROMs, pain drawing) completed in the waiting room.
  8. Dictation/AI scribe is "later", but design note sections to accept dictated text now.

### Gaps
- No Syria-specific or Arabic-language user research on orthopedic EMR preferences was found.
- No click-count benchmarks per encounter for leading ortho EHRs were found.

## 12. Tiered recommendation and key data-model entities (synthesis)

### Takeaway
Ship a fast, body-first orthopedic chart in Release 1 using only self-owned or public-domain assets and free/eponymous classifications. Start licensing negotiations immediately (AO/OTA, OUI Oxford scores, IWH QuickDASH, Mapi KOOS/ODI, EuroQol) and gate licensed content behind per-tenant licence flags so it can be switched on without a release. Defer templating, PROMIS CAT and AI features.

### Cited Findings
- Licensed content and its terms:
  - AO/OTA commercial use needs permission — [OTA softproof (snippet)](https://ota.org/media/531625/rev-jotv32n1s-issue-softproof_11218.pdf)
  - QuickDASH Category B is CAD 1,250 plus user fees — [IWH licences](https://dash.iwh.on.ca/licences)
  - Oxford scores must be licensed from OUI — [OUI OKS](https://innovation.ox.ac.uk/licence-details/oxford-knee-score-oks)
  - KOOS/HOOS charge commercial users and healthcare organisations — [Mapi KOOS/HOOS/FAOS](https://www.mapi-trust.org/news-events/news/koos-hoos-and-faos)
  - ODI is charged for commercial use — [Mapi ODI](https://www.mapi-trust.org/news-events/news/the-oswestry-disability-i)
- Public-domain skeleton art is available — [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Human_skeleton_front_en.svg)
- OHIF/Cornerstone provide angle, length and Cobb tools — [Cornerstone CobbAngleTool](https://cornerstonejs.org/docs/api/tools/classes/CobbAngleTool)
- Laterality is the commonest listing error — [PSNet](https://psnet.ahrq.gov/issue/surgical-case-listing-accuracy-failure-analysis-high-volume-academic-medical-center)

### Inferences
**Release 1: core (must ship)**
1. Interactive body chart:
   - anterior/posterior full-body skeleton plus silhouette;
   - zoom panels for hand (digits, joints), foot (rays, joints) and spine (C1–S1, saddle);
   - explicit laterality chips;
   - pain drawing with 5–6 symptom types (colour + pattern), point/radiating, intensity;
   - per-visit snapshots and compare;
   - tapping a site opens the region template.
2. Site/side/level single source of truth, propagated to problem list, booking, consent, op note and imaging, with mismatch warnings.
3. Fracture diagnosis:
   - open/closed;
   - mandatory Gustilo-Anderson for open fractures, Tscherne for closed;
   - eponymous pickers (Salter-Harris, Garden, Weber, Neer, Schatzker, Frykman, Mason) with self-authored text;
   - AO/OTA code field with syntax validation only.
4. Fracture clinic list and cast clinic queue; union assessment with RUST/mRUST calculator; complications checklist; VTE assessment field (tool to be chosen with clinicians).
5. Injection log with per-site cumulative counters and interval warnings (configurable).
6. PROM engine with per-tenant licence gating. Free instruments at launch, after written confirmation: SPADI, FAAM, ASES, KOOS JR/HOOS JR, IKDC, plus NRS (already decided). AOFAS excluded.
7. Spine core: level-based neuro grid (motor/sensory/reflex per side), red-flag checklist with alert banner, myelopathy signs panel.

**Release 1: extended (ship if licences or capacity allow)**
1. Licensed PROMs as contracts close: Oxford OKS/OHS/OSS/OES (Arabic OKS validated), QuickDASH (Arabic and Turkish exist), ODI 2.1a (Arabic exists), KOOS/HOOS, EQ-5D-5L (Arabic validated), NDI.
2. AO/OTA guided picker with official wording/illustrations once AO/OTA permission is granted. PCCF and AO Spine are separately permissioned.
3. Web DICOM viewer (OHIF/Cornerstone3D) with length, angle, Cobb, HKA, hallux valgus/IMA and LLD tools; calibration flag; measurements stored as structured data; Cobb trend chart.
4. Arthroplasty implant log (NJR-style fields: manufacturer, REF, lot, size, GTIN, fixation, approach) with barcode scan, plus an arthroplasty follow-up schedule template.
5. Procedure-specific op-note templates, procedure-specific Arabic consent, post-op protocol templates (WB/ROM progression), auto surgeon logbook.
6. Own Arabic home-exercise library (printable/WhatsApp PDF + QR video) linked to protocols.
7. Orthosis/brace order form.
8. Sports episode with return-to-sport milestone checklist.

**Later**
- Ransford-style pain-drawing scoring.
- Dermatome overlays from a licence-clean source.
- Digital templating integration (TraumaCad/mediCAD cloud).
- PROMIS CAT (API licence).
- Physitrack/Medbridge integration.
- Registry exports.
- AI scribe/ambient listening.
- AI-assisted AO/OTA suggestion from reports.
- Patient-portal remote PROMs with reminders.
- Analytics (union time, complication rates, PROM deltas per surgeon).

**Key data-model entities (fields abbreviated)**
- `AnatomicalSite`: id, region, structure (bone/joint/digit/ray/vertebral level/dermatome), parent, laterality-applicable flag, display names AR/EN, SVG path id, optional SNOMED CT code.
- `SiteRef` (value object used everywhere): site_id, side (L/R/bilateral/midline/NA), digit/ray/level qualifiers.
- `OrthoEpisode`: patient, type (trauma/elective/spine/sports/arthroplasty/paediatric), primary `SiteRef`, onset/injury date, mechanism, status, linked encounters/procedures.
- `BodyChartSnapshot`: encounter, view (ant/post/lat/hand/foot/spine), vector strokes JSON, markers[].
- `PainMarker`: `SiteRef`, symptom type (ache/sharp/burning/numbness/paraesthesia/other), radiating flag + path, NRS.
- `NeuroLevelFinding`: encounter, level, side, motor MRC, light touch, pin-prick, reflex grade.
- `RedFlagScreen`: encounter, item, answer, triggered action.
- `MyelopathySign`: encounter, sign, result.
- `FractureDiagnosis`: episode, `SiteRef`, open/closed, Gustilo, Tscherne, displacement, `ClassificationAssignment`[].
- `ClassificationSystem` (name, version, licence status, owner) and `ClassificationCode` (system, code, parent, labels AR/EN, licensed-content flag).
- `ClassificationAssignment`: fracture, system, code, assigned by, date.
- `Immobilisation`: type (cast/splint/boot/brace), `SiteRef`, applied/removed dates, checks.
- `UnionAssessment`: date, clinical signs, RUST per cortex ×4, total, status.
- `Complication`: episode, type, onset date, severity, management.
- `VTEAssessment`: risk tool, score, prophylaxis agent/dose/duration or reason none.
- `Procedure`: `SiteRef`, levels, template, op note fields, tourniquet, antibiotics, EBL, implants[], complications.
- `ImplantUsage`: procedure, component role, manufacturer, brand, REF, lot, size, GTIN/UDI, expiry, fixation, cement lot.
- `Consent`: procedure, `SiteRef`, risks version, signatures, timestamp.
- `PostOpProtocol`: phases[] (date offset, WB status, ROM limits, brace settings, exercises, review).
- `Injection`: `SiteRef`, date, approach, drug, mg, LA, lot, aspirate, response. Derived counters per site per 12 months.
- `OrthosisOrder`: device, `SiteRef`, size, settings, wear schedule, supplier, review.
- `PROMInstrument`: code, name, owner, version, languages[], scoring algorithm id, licence model.
- `TenantInstrumentLicence`: tenant, instrument, licence ref, valid from/to, user cap.
- `PROMAdministration`: patient, instrument version, language, time-point, mode, responses[], scores[].
- `ImagingStudy` / `ImagingMeasurement`: type (HKA, Cobb, HVA, IMA, LLD, length, angle), value, unit, side, calibration status, image ref.
- `ExerciseItem`: media, AR/EN text, region, constraints. `ExercisePrescription`: items, dosage, sheet PDF.
- `ReturnToSportAssessment`: date, criteria results, decision.
- `SurgeonLogbookEntry`: derived from `Procedure` and role.

### Gaps
- Licence costs for AO/OTA, OUI, Mapi, EuroQol and PROMIS must be obtained by direct enquiry. Budget impact cannot be estimated beyond IWH's published QuickDASH fees.
- Sanctions/compliance position of licensors (UK, Canada, Netherlands/France, Switzerland, US) toward a Syria-based customer was not researched.
- Clinical content flagged "[textbook, not re-verified]" (eponymous class definitions, ISNCSCI key muscles, angle definitions, implant bearing options) needs sign-off by a Syrian orthopedic lead before build.
- Not researched because the search budget ran out: VTE (NICE NG89), compartment syndrome (BOAST), arthroplasty follow-up (BHS/BASK), return-to-sport criteria, orthotics catalogues, Medbridge.
