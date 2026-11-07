# Dental Module — Full Professional Scope (beyond the already-decided baseline)

Scope note: already decided and NOT re-researched here: FDI notation, ~15 core findings/procedures, 6 fixed-color statuses, base vs proposed layers, per-tooth history, treatment plans with phases/installments, lab cases, tooth-tagged images, dental medical-history alerts, Arabic consents, multi-currency billing. Research date: November 2026. "Inferences" contain design recommendations; where they rely on general dental domain knowledge rather than a source fetched in this session, they are labelled "(domain knowledge, not re-verified)".

---

## Q1. Professional odontogram UX (rendering, interaction, speed, history, printing, tablet, voice, open-source components)

### Takeaway
Top products converge on: tooth-first selection, multi-select with drag/Ctrl, explicit bridge/range workflows, a "time slider"/history view of the chart, hover/quick-pick menus for the clinician's most-used items, view filters (base only / current / all), mixed-dentition and root views, and saving the chart as an image. The biggest documented usability failures are mixing "existing condition" vs "planned procedure" controls, unclear status semantics, wrong-tooth charting from miscounting, and too many clicks. A permissively licensed SVG odontogram exists (react-odontogram, MIT) but is a selector, not a full clinical chart (no surfaces), so a custom anatomical SVG chart is needed.

### Cited Findings
**Rendering / views**
- Dentally offers a dentition drop-down to switch views, a "condensed mixed-dentition" chart showing adult and child teeth in two rows with base and planned treatment, and the ability to lock the dentition on screen while charting then unlock it to free space for notes — [Dentally overview](https://www.dentally.com/en-gb/insights-hub/an-overview-of-charting-in-dentally)
- Dentally has a customisable "Root View" and mixed-dentition tools; a "socket selection" drop-down for base charting (esp. initial charting of permanent teeth) is only available with Root View enabled — [Dentally chart updates](https://news.dentally.com/56184-your-latest-chart-updates); [Dentally support page](https://www.dentally.com/support/orthodontics)
- Dentally changed its odontogram to hide missing teeth on both the base and treatment-planning lines because users mis-counted positions and charted on the wrong tooth; whole-tooth items (implants, bridges, dentures) can still be charted over gaps (early-adoption feature as of July 2024) — [Dentally help: odontogram lines](https://help.dentally.com/en/articles/9589866-how-the-odontogram-treatment-lines-work)
- A UK vendor help page (Software of Excellence/Exact "Graphical 2D tooth charting") describes a switch filtering the chart to three options: base charting only, all charting, or current charting — [SOE help](https://help.softwareofexcellence.com/hc/en-gb/articles/360059065071-Graphical-2D-Tooth-Charting) (via search snippet; page not opened)
- Open Dental graphical chart: supports Universal, FDI, Haderup and Palmer; Palmer is forced in the Ortho tab with "Tooth chart ortho mode"; supernumerary teeth are not auto-displayed (must be drawn with a pen tool); graphic is driven by the procedure code's "paint type" + treatment area; colors depend on status (treatment planned, complete, existing-current provider, existing-other provider, referred, condition) and a per-code color override; metal work typically dark, ceramic/plastic light; teeth can be moved via a "Movements" tab; "Show Big" opens a large chart; "Save the Tooth Chart" saves an image to the Imaging module; "Hide Graphics" removes outdated graphics (e.g., removed crown) — [Open Dental Graphical Tooth Chart](https://opendental.com/Manual/graphicaltoothchart.html)
- Open Dental "Tooth chart ortho mode" shows only the facial/buccal view of teeth in the Ortho tab — [Open Dental Ortho](https://opendental.com/Manual/ortho.html)

**Selection, multi-select, bridges**
- Open Dental: click tooth or its number to select, click again to deselect, click-and-drag to select several teeth — [Open Dental Graphical Tooth Chart](https://opendental.com/Manual/graphicaltoothchart.html)
- Dentally: clicking a tooth socket opens a selection menu; to apply one treatment across several teeth/surfaces, right-click or hold Ctrl/Alt to link them; a customisable "hover chart" gives instant access to most-used treatments, alongside favourite lists and treatment-plan templates — [Dentally overview](https://www.dentally.com/en-gb/insights-hub/an-overview-of-charting-in-dentally)
- Carestream Sensei bridge workflow: choose Planning vs Current mode first; click each tooth number of the bridge, click "Bridge", confirm; then assign Pontic or Abutment per tooth and a procedure code per tooth; a clinical note and graphic are generated; surface charting (decay, chip) can still be added to abutments afterwards — [Sensei Charting Bridges](https://help.carestreamdental.com/rh/web/server/Sensei_Cloud/projects_responsive/CM300_SCWorkbook/Charting_Bridges.htm)
- Denticon known pitfall: after removing bridge abutments the pontic is left behind and cannot be removed directly (workaround via a custom code) — [Planet DDS support](https://support.planetdds.com/hc/en-us/articles/29342931161883-We-are-trying-to-remove-a-patient-s-existing-bridge-from-their-restorative-chart-We-removed-the-abutments-but-now-we-cannot-remove-the-pontic-How-do-we-correct-this)

**History / "chart as of date" / printing**
- Open Dental: drag a slider under the tooth chart to view chart changes over time; treatment-planned items appear as of "Date TP", other statuses as of "Date Entry" — [Open Dental Graphical Tooth Chart](https://opendental.com/Manual/graphicaltoothchart.html)
- Open Dental Show tab: date filter for the progress-notes grid (today, yesterday, this year, last year, custom range); right-click → Print Progress Notes for that range; statuses shown on the chart depend on the selected "Chart View" settings — [Open Dental Show tab](https://opendental.com/manual/showtabchart.html) (via search snippet)

**Tablet / chairside / offline**
- Open Dental ODTouch: perio exams can be completed on a tablet app; while open there the desktop perio chart is locked, with an "Unlock" override — [Open Dental Perio Chart](https://www.opendental.com/manual/perio.html)
- Dentolize: offline charting continues without a connection and syncs later; mobile app lets clinicians record diagnoses, plan treatment and update procedures from a phone — [Dentolize features](https://dentolize.com/our-feature/); [Dentolize App Store](https://apps.apple.com/app/id1612892336)
- Dentolize 2026 update enlarged the dental chart and added visual effects so conditions/procedures are easier to spot — [Dentolize updates](https://dentolize.com/updates)

**Voice charting**
- Dentally: AI notes created from dictation; clinical note templates guide dictation — [Dentally overview](https://www.dentally.com/en-gb/insights-hub/an-overview-of-charting-in-dentally); [Dentally support page](https://www.dentally.com/support/orthodontics)
- Curve Care+ (native AI suite): Notes+ (drafts notes from conversations), Charting+ (voice updates to the odontogram), Perio+ (voice perio) — [Dr. Bicuspid](https://www.drbicuspid.com/clinical/treatment-software/ai/article/15829798/curve-dental-curve-dental-launches-curve-care-clinical-ai-suite)
- Dentrix Ascend Clinical Technology Suite includes voice-enabled charting of findings during exams; Voice Perio released 7/15/26, only on the Accelerate subscription or Ambient add-on — [Dentrix Ascend Voice Perio](https://www.dentrixascend.com/dental-solutions/charting-imaging-and-clinical-ai/voice-perio/); [Dentrix Ascend suite](https://www.dentrixascend.com/dental-solutions/charting-imaging-and-clinical-ai/dentrix-ascend-clinical-technology-suite/)

**Usability evidence**
- Formal test of Dentrix, EagleSoft, SoftDent, PracticeWorks (20 novice users, 9 tasks each): average only 43% tasks correct, 30% incorrect, 28% incomplete; 286 usability problems. Hardest tasks: recording 2 mm pocket depths for teeth 1–8 (21% of problems), deleting an existing amalgam (14%), marking a tooth missing (13%); bridge planning varied by system — [Thyvalikakath et al., PMC2614265](https://pmc.ncbi.nlm.nih.gov/articles/PMC2614265)
- Same study, root causes: most users select tooth first (SoftDent required icon first → failures); Dentrix required an unlabeled step to distinguish existing condition vs planned procedure (4/5 failed "mark missing"); users confused "missing" with "extracted"; primary+permanent shown together by default caused wrong-tooth charting; condition and procedure controls mixed on one toolbar; >half of users selected spanned teeth first for a bridge; perio on a separate screen caused navigation problems; Delete key / right-click didn't work; read-only fields had no visual cue. Recommendations: match dentists' task flow, show only relevant controls, keep same-context info together, label/group controls clearly, follow platform conventions — [PMC2614265](https://pmc.ncbi.nlm.nih.gov/articles/PMC2614265)
- Touch-based "iTooth" prototype (9 dentists/hygienists/assistants): 78% had trouble finding an icon, 44% confused by charting statuses, half failed to recognize the root-canal gesture; SUS 67.75 (average); suggested grouping "pathology" and "treatment planned" statuses and better symbols — [Marshfield iTooth study](https://www.marshfieldresearch.org/srip/students/adam-sorenson)
- "Smart odontogram" app tested with 15 dentists: effectiveness/efficiency/satisfaction rated good (small descriptive study) — [Padjadjaran J Dent 2022](https://jurnal.unpad.ac.id/pjd/article/view/36566)
- Capterra reviews: dominant complaint is click count ("too many clicks", tasks needing 2–3 clicks instead of 1) for Dentrix, Dentrix Ascend, Curve, Denticon; Curve users say tooth charting is "too sensitive"; iDentalSoft "too many steps to chart"; cloud systems criticized for slow imaging/response on weak internet — [Capterra Dentrix](https://www.capterra.com/p/2329/Dentrix/reviews/); [Capterra Dentrix Ascend](https://www.capterra.com/p/177828/Dentrix-Ascend/reviews/?page=4); [Capterra Curve](https://www.capterra.com/p/98688/Curve-Dental-Hero/reviews/); [Capterra Denticon](https://www.capterra.com/p/35009/Denticon/reviews/?page=2); [Capterra iDentalSoft](https://www.capterra.com/p/148958/iDentalSoft/reviews/?page=2)

**Open-source odontogram components**
- react-odontogram (biomathcode): MIT; SVG + React hooks; FDI default, Universal, Palmer (each selected tooth reports all three); `defaultSelected`, `onChange`, `singleSelect`, `teethConditions` (fill/outline per condition), `showLabels` legend, `readOnly`, light/dark, tooltips, circle/square layouts, full/upper/lower views, hidden form input, `maxTeeth` per quadrant for primary/mixed; each tooth = SVG paths (outline/shadow/highlight); companion react-native-odontogram; no tooth-surface support mentioned; ~82 stars, 26 forks — [react-odontogram (mirror of GitHub README)](https://gh.r-mj.com/biomathcode/react-odontogram)
- react-odontogram-3d: MIT (© Dea Alverina), 3D, Tailwind-based — [pkgstats](https://www.pkgstats.com/pkg:react-odontogram-3d)
- OpenMolar (Python, Scottish practice): listed as GPL v3 by Softpedia but GitHub shows license "unknown" — [Softpedia](https://linux.softpedia.com/get/Science-and-Engineering/Medical-Science-Apps-/openMolar-47014.shtml); [GitHub openmolar1](https://github.com/rowinggolfer/openmolar1)
- Open Dentist (clawnify/open-dentist): TypeScript, interactive FDI odontogram, 1 star, license not surfaced; DinoDent (C++/Qt6) GPL-3.0; Apexo described as free open-source — [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fclawnify%2Fopen-dentist); [Medentic review](https://www.medentic.app/en/blog/top-free-dental-practice-management-software-2025)
- Open Dental changed from GPL to proprietary at v24.4; 24.3 is the last GPL version (vendor cited AI bots training on code) — [Open Dental license](https://opendental.com/site/license.html); [Wikipedia](https://en.wikipedia.org/wiki/Open_Dental)

### Inferences
- Interaction model to adopt (from usability evidence): **tooth(s) first → action second**; a single palette that is split visually into "Findings/Existing" vs "Planned/Proposed" (matches the decided base vs proposed layers) so the user never has to infer which one they are recording; "Missing" and "Extracted" must be clearly separate items with explanatory tooltips.
- Recommended rendering (domain knowledge, not re-verified): anatomical SVG per tooth with three linked views — buccal/labial crown+root (shows crowns, RCT, posts, implants, extractions, bridges), occlusal/incisal 5-surface diagram (M, O/I, D, B/F, L/P, plus cervical classes as optional sub-areas) as the tap target for surface restorations, and a compact "geometric" mode (surface boxes) for small screens. Geometric-only charts are faster for surfaces; anatomical charts communicate better to patients — offer both via a toggle with one data model.
- Tap targets ≥44 px per surface on tablets; long-press = context menu (mirrors right-click); drag across teeth = range (bridge span); Shift-click = range, Ctrl/Cmd-click = add; keyboard: typing an FDI number (e.g., "36") jumps to that tooth, letters for surfaces (M,O,D,B,L), Enter applies last-used item, digits 1–9 for the user's quick-pick slots; Delete removes the selected chart item; Ctrl+Z undo.
- Hide or dim missing teeth (Dentally evidence) but keep the gap selectable for implants/pontics; show primary teeth only when the patient's age/dentition setting says so (avoids SoftDent wrong-tooth issue).
- Bridge wizard: select span (drag) → app auto-proposes abutments at the ends and pontics on missing positions → user can toggle each unit (abutment/pontic/cantilever) → material per unit → one linked "bridge group" record so removing/editing affects the whole bridge (avoids Denticon orphan-pontic bug).
- "Chart as of date": implement as a date slider + date picker; all chart items are event-sourced with valid-from/valid-to dates so the chart can be re-rendered at any date and exported (PDF/PNG) with patient header, date, legend and FDI labels.
- Avoid open-source chart dependencies with GPL (OpenMolar, DinoDent, pre-24.4 Open Dental) in a SaaS where code may later be distributed; react-odontogram (MIT) can be used as a starting skeleton for selection/notation logic but surfaces/roots/graphics must be built in-house.

### Gaps
- No primary documentation found on how CS R4, Planmeca Romexis charting, Carestream CS Practice, or Dentrix Ascend render teeth (anatomical vs geometric) or their keyboard shortcuts; YouTube demos were not reviewed.
- No published task-time benchmarks comparing anatomical vs geometric odontograms.
- Licence of react-odontogram verified only via README/mirror, not the LICENSE file itself.

---

## Q2. Full periodontal chart (fields, fast entry, voice, indices, comparison, 2017 AAP/EFP staging/grading, patient report)

### Takeaway
A professional perio chart = per exam: 6-site PD, gingival margin (±), auto-CAL, MGJ/keratinized tissue, BOP, suppuration, plaque, calculus, mobility, furcation, per-tooth skip/implant flags, exam notes; up to ~6 prior exams visible for comparison; red-threshold highlighting; auto-advance with configurable path; triplet and ≥10 entry; indices (plaque %, BOP %); print/save to images; voice entry is now a mainstream (paid) differentiator. Software can compute much of AAP/EFP staging/grading from charted data but complexity factors and history still need clinician input; a study showed software support yields substantial inter-rater agreement.

### Cited Findings
**Open Dental perio chart (most detailed public reference)**
- Rows: Probing (with markers P plaque, C calculus, B bleeding, S suppuration as colored dots), Mobility (facial, one number per tooth), Furc (0–3), auto CAL (read-only = probing + gingival margin), Ging Marg (recession vs coronal values; "Ging Marg+" or Ctrl+number for positive), MGJ (max facial; mand facial and lingual) — [Open Dental Perio](https://www.opendental.com/manual/perio.html)
- Up to six recent exams side by side; up to five earlier exams shown greyed for reference; Add / Copy (duplicates most recent exam with today's date) / Default / Delete; per-user "Show current exam only"; exam notes with Copy Note — [Open Dental Perio](https://www.opendental.com/manual/perio.html)
- Advance sequences: "Maxillary First" (1–16 F, 16–1 L, 32–17 L, 17–32 F) and "Facials First"; Current Direction auto-updates per section and can be toggled; "Triplets" enters 3 values at once; Ctrl + digit = 10+digit (Ctrl+3 = 13); a string like 1B1211C22S can be pasted; enter depth then marker (e.g., 5 then bleeding); arrow-key navigation; J/G/F/M jump to MGJ/GingMarg/Furc/Mobility rows; "." returns to last probing area; click-drag fills multiple cells — [Open Dental Perio](https://www.opendental.com/manual/perio.html)
- "Numbers in Red": thresholds adjustable; PD, GM, CAL, Furc, Mobility red when ≥ value; MGJ red when ≤ value (little attached gingiva); "# Teeth" counts red teeth per row; "Calc Index %" computes four index percentages over typically 192 sites, skipped teeth excluded — [Open Dental Perio](https://www.opendental.com/manual/perio.html)
- Skipped teeth bypassed by auto-advance, stored per exam and carried forward; preferences "Perio exams always skip missing teeth" and "treat implants as not missing"; implants shown with "i" (e.g., 17i); primary, supernumerary and retained deciduous teeth cannot be perio-charted (limitation) — [Open Dental Perio](https://www.opendental.com/manual/perio.html)
- "Save to Images" (Tooth Charts folder, named by date) and Print — [Open Dental Perio](https://www.opendental.com/manual/perio.html)
- Other vendors: Carestream SoftDent supports auto-advance and "Creating Custom Charting Paths"; Dentrix Voice documents skipping unerupted teeth, implants and pontics; XLDent perio skips dentures — [SoftDent custom paths](https://help.carestreamdental.com/rh/web/server/SoftDent/projects_responsive/DE1075_SDChart_Wkbk/Creating_Custom_Charting_Paths.htm); [Dentrix Voice help](https://intercom.help/dentrix-voice/en/articles/15872735-how-to-skip-unerupted-teeth-implants-and-pontics-in-perio-dentrix-desktop); [XLDent](https://www.xldent.com/whats-new/version-15-xlchart-arrival-list-enhancements-2-2)

**Voice perio**
- Open Dental voice perio: English commands, Universal numbering; add/copy exam, pause/resume, move, delete, skip tooth, toggle triplets, jump to first empty probing position; "Select <tooth> <surface>"; depths 0–19 ("plus" + digit above 9); bleeding/calculus/suppuration/plaque by site; furcation/GM/mobility/MGJ require a PD first; recommended noise-cancelling headsets (Logitech H390, Jabra Evolve 65, Logitech H800); not available on Open Dental Cloud — [Open Dental Voice Perio](https://opendental.com/manual/periochartingvoice.html)
- Dentrix Ascend Voice Perio: vendor claims full-mouth 6-point chart in under five minutes without an assistant; entries written directly into the chart; tier-gated (Accelerate/Ambient) — [Dentrix Ascend Voice Perio](https://www.dentrixascend.com/dental-solutions/charting-imaging-and-clinical-ai/voice-perio/)
- Curve: Bola AI partnership (claims 99.9% recognition across accents) and native Perio+; claims 3.5x faster charting (vendor claim, no cited study); CareStack and Denti.AI also sell voice perio — [Curve perio](https://www.curvedental.com/perio-charting); [Dr. Bicuspid](https://www.drbicuspid.com/clinical/treatment-software/ai/article/15829798/curve-dental-curve-dental-launches-curve-care-clinical-ai-suite); [CareStack](https://carestack.com/en-GB/dental-software/features/voice-perio); [Denti.AI](https://www.denti.ai/voice-perio)

**Clinical definitions to encode**
- Miller mobility: Class I up to 1 mm horizontal; Class II >1 mm horizontal, no vertical; Class III >1 mm horizontal + vertical depressibility — [NBDHE study guide](https://open-exam-prep.com/study-guides/nbdhe/ch4/ch4-sec3) (secondary source; thresholds vary slightly between sources)
- Glickman furcation Grades I–IV (I incipient; III through-and-through; IV through-and-through with recession, clearly visible); Hamp: Class 1 horizontal <3 mm, Class 2 >3 mm, Class 3 through-and-through — [NBDHE study guide](https://open-exam-prep.com/study-guides/nbdhe/ch4/ch4-sec3); [BMC Oral Health table](https://bmcoralhealth.biomedcentral.com/articles/10.1186/1472-6831-15-S1-S5/tables/5)
- O'Leary Plaque Control Record: plaque-positive surfaces ÷ surfaces examined × 100; standard 4 surfaces per tooth (not occlusal/incisal), optionally 6 (F, MF, ML, L, DL, DF); "good" thresholds vary by source (<10% or <20%) — [AAPD archive](https://www.aapd.org/globalassets/media/publications/archives/wei-04-01.pdf); [Clinical trial protocol NCT03364751](https://cdn.clinicaltrials.gov/large-docs/51/NCT03364751/Prot_000.pdf)
- BPE (BSP 2019): sextant highest score; codes 0 (no treatment), 1 (BOP, PD <3.5 mm → OHI), 2 (calculus/defective margin → OHI + remove plaque-retentive factors), 3 (PD 3.5–5.5 mm → OHI + RSD), 4 (PD ≥6 mm); "*" = furcation only (since 2011), recorded with the number; codes 3/4/* require full periodontal charting; codes 0–2 recorded at every routine exam — [BSP BPE 2019](https://www.bsperio.org.uk/assets/downloads/BSP_BPE_Guidelines_2019.pdf); [SDCEP](https://periodontalcare.sdcep.org.uk/guidance/assessment/clinical-examination/periodontal-probing/bpe-screening-of-adults/)
- Dentally offers BPE and BEWE charting from the chart tab — [Dentally overview](https://www.dentally.com/en-gb/insights-hub/an-overview-of-charting-in-dentally)

**2017 AAP/EFP classification and software assistance**
- Staging by interdental CAL at site of greatest loss: Stage I 1–2 mm, II 3–4 mm, III and IV ≥5 mm; radiographic bone loss may substitute if CAL unavailable; III vs IV separated mainly by complexity (III: PD ≥6 mm, vertical bone loss ≥3 mm, furcation class II/III, moderate ridge defects; IV adds complex rehabilitation needs—masticatory dysfunction, secondary occlusal trauma, bite collapse) — [AAP guide (Waterpik-hosted)](https://www.waterpik.com/pro/resources/pdf/AAP-classification-system-guide.pdf); [dentalcare CE610](https://www.dentalcare.com/en-us/ce-courses/ce610/requirements-periodontitis-case); a UCL table lists ≥8 mm for Stage IV, conflicting with other sources — [Needleman tables](https://discovery.ucl.ac.uk/10057843/6/Needleman_Revised%20Tables%201-4%2C%20March%2012.pdf)
- Grading: % bone loss/age <0.25 = A, 0.25–1.0 = B, >1.0 = C; start at Grade B and look for evidence to shift; modifiers smoking (<10 vs ≥10 cigarettes/day) and HbA1c (<7% vs ≥7%) — [AAP guide](https://www.waterpik.com/pro/resources/pdf/AAP-classification-system-guide.pdf); [EFP guidance report](https://www.efp.org/publications/projects/new-classification/guidance/report-02b.pdf)
- Software-assisted staging/grading: with a dedicated app, general dentists reached Fleiss kappa 0.818 (stage), 0.608 (extent), 0.632 (grade) — [Marini PhD thesis, Sapienza](https://iris.uniroma1.it/retrieve/311579db-8d6c-4103-93ca-5687caea2573/Tesi_dottorato_Marini.pdf); decision tools are "not exhaustive", BSP implementation offers a simplified alternative — [UCC review](https://cora.ucc.ie/server/api/core/bitstreams/ef4ff1d2-0e92-4ad1-8edd-997142090e27/content)
- No official AAP/EFP online calculator surfaced; EFP decision tree is downloadable — [Haleon health partner](https://www.haleonhealthpartner.com/en-hk/oral-health/conditions/gum-health/diagnosis/)

### Inferences
- Perio exam fields (per site ×6: DB, B, MB, DL, L, ML — FDI order): PD (0–19), GM (signed mm, explicit convention: + = recession apical to CEJ, − = coronal/hyperplasia — define once and show the sign visually), CAL = PD + GM (auto, read-only), BOP (bool), suppuration (bool), plaque (bool), calculus (bool). Per tooth: mobility (0–III Miller), furcation per entrance (Glickman I–IV or Hamp 1–3; tenant setting chooses), keratinized tissue width/MGJ (mm), skip flag, implant flag (implant uses peri-implant labels: BOP, suppuration, PD, recession, bone level). Per exam: date, provider, type (full/re-eval/maintenance/BPE screen), notes, smoking and HbA1c snapshot (for grading), linked radiograph.
- Entry speed design (from Open Dental): numeric keypad-only flow; auto-advance path presets (Upper buccal → upper palatal → lower lingual → lower buccal, and "Buccals first"); triplet mode; "B" key after a depth toggles bleeding on the current site; "S", "P", "C" similar; "+" prefix or long-press for ≥10; skip missing teeth automatically; "copy previous exam" for maintenance; big on-screen number pad for tablets.
- Comparison: show last exam PD in grey under current entry; delta row (Δ PD/Δ CAL) colored green/red; a sparkline per site across exams; "sites ≥4 mm", "sites ≥6 mm", BOP%, plaque% totals with change since last exam.
- Staging/grading assistant: auto-propose stage from max interdental CAL + charted tooth loss due to perio + max PD + furcation; auto-compute extent (localized <30% teeth vs generalized; molar-incisor pattern) and %bone loss/age from a clinician-entered radiographic bone-loss % on the worst tooth; propose grade with modifiers from medical history (smoking, diabetes/HbA1c); clinician must confirm → stored as diagnosis with "auto-suggested" vs "confirmed" flags. (Tooth-loss criteria and extent thresholds come from the 2018 Tonetti/Papapanou tables — domain knowledge, not re-verified this session.)
- BPE as the R1 quick screen (6 sextant boxes, 0–4 + "*"), with rule: any 3/4/* prompts "Start full perio chart".
- Patient-friendly perio report (domain knowledge): Arabic one-page PDF with a colored gum map (green ≤3 mm, yellow 4–5, red ≥6), BOP% and plaque% gauges, comparison to last visit, stage/grade in plain Arabic, and home-care instructions.
- Voice perio is a post-R1 differentiator; numbers-only grammar (Arabic or English digits) is feasible later with browser speech APIs, but noise-cancelling headset guidance is needed (Open Dental evidence).

### Gaps
- No primary source for foot-pedal perio entry in current products (Florida Probe hardware bridge is mentioned by Open Dental but not detailed).
- Exact staging tables (RBL%, tooth-loss counts, extent definitions) not re-fetched from the primary J Periodontol/J Clin Periodontol papers in this session.
- No source on peri-implant chart conventions in specific products beyond Open Dental's "i" marker.

---

## Q3. Orthodontic clinical module (records, photos, ceph, appliances, aligners, retention, progress notes)

### Takeaway
Orthodontic software splits into (a) imaging/ceph (Dolphin-class: 400+ analyses, superimposition, VTO) and (b) clinical tracking (Open Dental-style ortho tab: hardware on chart, prescriptions, configurable ortho chart grid per visit). Aligner tracking (manufacturer-agnostic) is now a standard PMS feature. Open-source ceph AI exists but is research-grade with licence caveats. For R1, a structured ortho exam + standard photo series + per-visit appliance/wire/elastic log + aligner stage/IPR tracking is achievable; full ceph tracing is "R1-extended or later".

### Cited Findings
- Open Dental Ortho tab: filters "Tooth chart ortho mode" (facial-only view), "Show Ortho grids", "Show Graphics" (brackets drawn on chart), "Show Hidden", "Show Exam Date" (adding hardware creates a new exam dated today); hardware controls "Prescriptions" (auto-chart hardware sets), "Add Single", "Hide/Unhide", "Delete", "Copy" (copy last exam's hardware to today); hardware types include brackets, wires, elastics; Ortho Chart tabs with configurable number/labels ("Setup Tabs"), grid edited per visit — [Open Dental Ortho](https://opendental.com/Manual/ortho.html); [Open Dental Ortho Chart site](https://www.opendental.com/site/0_orthochart.html)
- Dolphin Imaging ceph: analyzes lateral cephs, progress superimpositions, >400 lateral analyses incl. Ricketts, McNamara, Steiner, Tweed, Jarabak, Björk; VTO wizards; photo management; 3D adds airway analysis, facial photo wrap, digital models — [Dolphin brochure](https://www.dolphinimaging.com/Areas/Product/Documents/Imaging/20200710_Imaging%201195.pdf)
- OrthoCAD (digital models) 3D browser shows models from five simultaneous perspectives — [Orthotown imaging guide](https://www.orthotown.com/magazine/article/5654/imaging-guide)
- Carestream CS OrthoTrac added universal aligner tracking regardless of manufacturer or in-house fabrication — [Ortho Practice US](https://orthopracticeus.com/new-software-enhancements-improve-workflow-in-orthodontic-offices/)
- Aligner treatment data: treatment cards/ClinCheck show where/when attachments go, precision/button cuts, where/when IPR is planned, passive and overcorrection aligners; staging tab shows when teeth start/stop moving; clinicians commonly place attachments at stage 3 — [Dentaltown "8 Steps"](https://www.dentaltown.com/magazine/article/7675/8-steps-to-success); [Dentistry.co.uk](https://dentistry.co.uk/?p=460782)
- Public Invisalign summaries record IPR per contact pair (e.g., 0.2 mm between 11/21, 0.3 mm between 22/23) and attachment types per tooth — [Invisalign Gallery case](https://go.invisaligngallery.com/treatment/t-34/)
- ABO records: facial montage with one lateral (facing right) and two frontal (lips relaxed, smiling) views; intraoral frontal in maximum intercuspation; post-treatment photos within one week of final models — [ABO photograph requirements](https://americanboardortho.com/orthodontists/become-certified/clinical-exam/mail-in-cre-submission-procedure/case-record-preparation/photograph-requirements/)
- Typical series 8–9 photos: extraoral frontal rest, frontal smile, profile(s); intraoral frontal, right/left buccal, upper/lower occlusal; may add 3/4 profile and retracted views — [APO Philippines guideline](https://apo.com.ph/?p=2849); [Shofu photography article](https://www.shofu.com/wp-content/uploads/Focus-on-Photography-Article-US-Journal-Spring-2016-Photography-Anna-Kataoka.pdf)
- Steiner (1953) measures: SNA, SNB, ANB, SND, GoGn-SN, U1-NA, L1-NB, U1-L1, Occl-SN; SNA ≈82° ±2°, SNB ≈80° ±2°; ANB affected by vertical face position — [Trisakti journal](https://e-journal.trisakti.ac.id/index.php/jkgt/article/download/5158/3920/13676); McNamara composite norms from three samples — [McNamara 1984 (UMich)](https://media.dent.umich.edu/labs/mcnamara/files/A%20method%20of%20cephalometric%20evaluation.pdf)
- Open-source ceph: CephTrace (MIT code, ONNX models, 88.4% detection within 2 mm; MIT does not grant patent licence for commercial use of methods); CEPHA29 benchmark; CephalometriX (MIT, low activity); CEPHOSS (peer-reviewed open-source AI for limited-FOV images) — [CephTrace](https://github.com/sidwiz/cephtrace-research); [CEPHA29](https://github.com/manwaarkhd/CEPHA29); [GitHub cephalometry topic](https://github.com/topics/cephalometry); [CEPHOSS](https://bohrium.dp.tech/paper/arxiv/39433150)

### Inferences
- Ortho initial exam (structured form; domain knowledge, not re-verified): Angle molar class R/L (I, II div1, II div2, III; with ½/full-unit), canine class R/L, overjet (mm, signed), overbite (mm or %; open bite negative), upper/lower crowding/spacing (mm per arch), midlines (upper to face, lower to upper; mm + direction), crossbite (anterior/posterior, teeth list), scissor bite, profile (straight/convex/concave), facial symmetry, lip competence, smile line, habits, TMJ screen, CVM stage, dentition stage, IOTN DHC/AC (UK-style index) or simple severity, diagnosis summary, problem list, treatment objectives, extraction plan (teeth), anchorage, appliance plan, estimated duration (months).
- Photo series module: a template ("Ortho 8-view": 3 extraoral + 5 intraoral; optional 3/4 smile, 45°) with placeholder silhouettes, capture order guidance on tablet/phone, auto-rotation/mirroring for occlusal/buccal mirror shots, and side-by-side before/progress/after comparison per view.
- Appliance tracking per visit (Open Dental model): hardware items per tooth (bracket system/prescription e.g., MBT/Roth, slot .018/.022, band, tube, button, TAD), arch-wire per arch (size, material NiTi/SS/TMA, shape), elastics (type/size/force, configuration Class II/III/box, hooks teeth, wear hours), power chains, springs, bends; "copy last visit" and "apply prescription set"; chart shows brackets/wires graphically in facial view.
- Aligner tracking: brand (any/in-house), total stages U/L, refinements, current stage, change interval (7/10/14 days), aligners dispensed (from–to), attachments map per tooth (type, placed at stage), IPR chart per contact (mm, planned stage, done date/visit), compliance notes, refinement scans.
- Retention: retainer type per arch (fixed bonded teeth range, Hawley, Essix/vacuum-formed), delivery date, wear instructions, retention check recall schedule.
- Ortho progress note per visit: date, appointment type, wires changed, elastics, hygiene rating, compliance, breakages/emergencies, next step, months in treatment (auto), linked photos.
- Ceph: R1-extended = manual landmark placement on an uploaded ceph with calibration (ruler mm), automatic Steiner + a few McNamara/Downs measures, norm table with deviations, export PDF; later = AI auto-landmarks (licence/validation caution with research code).

### Gaps
- No primary vendor documentation found on wire-sequence UIs or IPR-chart forms (only clinician articles and case summaries).
- A snippet attributing IPR limits (~0.3 mm anterior, ~0.5 mm posterior per contact) to "Aligner Dental Academy" could not be tied to a verified URL.
- IOTN thresholds and full ceph landmark list not fetched from a primary source this session.

---

## Q4. Endodontics (per-canal records, endo chart, diagnosis)

### Takeaway
Endo needs per-canal (not per-tooth) structured records — canal name, working length with reference point, apical size/taper/final file, obturation — plus standardized AAE pulpal/periapical diagnoses and an endo test table. Dedicated endo PMS (TDO) chart canals as rows; general products rarely do this well.

### Cited Findings
- Endo software should record working length, apical size, taper and final file **per canal**, with obturation per canal; canal count/configuration must be updatable during the case (e.g., MB2 discovered); retreatment templates need prior-obturation fields; irrigation protocol should be selectable fields; post-op periapical assessment and CBCT attach to the case — [DSN article](https://www.dsn.com/how-modern-endodontic-software-handles-multi-canal-cases-without-the-workarounds/)
- TDO (endo-specific PMS) charts "Canals for Treatment" as rows that can be deleted; microscope photos import directly to the TDO chart — [TDO KB](https://kb.tdo4endo.com/print.php?id=236); [EndoExperience](https://endoexperience.com/the-endofiles/products/software/)
- Working-length references: radiograph with size 15 K-file ~0.5–2 mm short of radiographic apex; apical constriction 0.5–2 mm from radiographic apex; apex locator readings adjusted (e.g., subtract 0.5–1.0 mm) and confirmed by X-ray — [Scribd endo doc](https://www.scribd.com/document/622222612/Endodontics); [D-Locator IFU](https://www.proclinic.es/media/proclinic-es/annexes/90579_ifu_es_en.pdf); [VDW Raypex 6](https://www.medicalexpo.com/prod/vdw-gmbh/product-74426-502810.html)
- CBCT planning software can predetermine canal lengths (tendency to short measurements) — [Int J Comput Dent 2018](https://read.qxmd.com/read/30539174/accuracy-of-cbct-based-root-canal-length-predetermination-using-new-endodontic-planning-software-compared-to-measurements-performed-with-an-electronic-apex-locator-ex-vivo)
- AAE diagnoses — pulpal: normal pulp, reversible pulpitis, symptomatic irreversible pulpitis, asymptomatic irreversible pulpitis, pulp necrosis, previously treated, previously initiated therapy; periapical: normal apical tissues, symptomatic apical periodontitis, asymptomatic apical periodontitis, acute apical abscess, chronic apical abscess (and condensing osteitis) — [AAE consensus terminology](https://www.aae.org/specialty/wp-content/uploads/sites/2/2017/07/aaeconsensusconferencerecommendeddiagnosticterminology.pdf)
- AAE + ESE are jointly revising terminology; July 2025 draft periapical table adds categories (e.g., localized symptomatic apical periodontitis, apical hypersensitivity) — [ESE](https://www.e-s-e.eu/for-professionals/resources-for-clinicians/updating-diagnostic-terminology-in-endodontics/); [AAE draft table](https://www.aae.org/specialty/wp-content/uploads/sites/2/2025/07/PeriapicalTable_ForWeb07172025.pdf)

### Inferences
- Endo record (domain knowledge for fields not sourced above): tooth; diagnosis (pulpal + periapical picklists, versioned so AAE/ESE update can be added); endo tests table per tested tooth incl. controls — cold, heat, EPT (value), percussion, palpation, bite test, mobility, probing, sinus tract; radiographic findings; anesthesia; isolation (rubber dam); canals table (name from tooth-specific picklist: MB, MB2, DB, P, D, M, MB/ML/DB/DL, B/L, single; reference point e.g., "MB cusp"; estimated length; EAL length; radiographic WL; final WL; master apical file size/taper; file system; irrigants & activation; intracanal medicament (CaOH) and visit; obturation technique (single cone, cold lateral, warm vertical, carrier-based) and sealer; obturation length/quality); temporary/final restoration; multi-visit status; post-op instructions; follow-up recall (e.g., 6/12 months) with periapical healing score.
- Odontogram linkage: RCT graphic per canal drawn on root view (filled canals vs planned), "RCT in progress" state.

### Gaps
- No primary TDO/Endovision field documentation on working length/obturation found; the Scribd source is low-authority.
- Periapical index (PAI) scoring not researched.

---

## Q5. Implants (surgical record, components, stability, grafts, loading, passport)

### Takeaway
Implant documentation must capture product traceability (manufacturer, REF, LOT, UDI, diameter/length, platform) for every component, plus surgical parameters (insertion torque, ISQ serial values), grafts/membranes, and a patient-facing implant passport. Loading decisions combine torque and ISQ; thresholds vary in literature, so software should record values, not enforce rules.

### Cited Findings
- EU MDR implant card (MDCG 2019-8 v2): manufacturer prints device name, serial/lot, UDI, manufacturer name/address; clinician fills patient name/ID, implanting institution name/address and implantation date — [MDCG 2019-8](https://ec.europa.eu/docsroom/documents/40321/attachments/1/translations/en/renditions/native)
- Straumann patient implant passport: per-implant blocks with REF, LOT, implant type (e.g., bone level), diameter, material (Roxolid/Ti), abutment type, placement date, lab material, surgeon stamp — [Straumann passport](https://www.straumann.com/content/dam/media-center/straumann/en-us/patients/USLIT.1499-Patient-Facing-Implant-Passport.pdf); other manufacturer passports (Sweden & Martina 2026, Hiossen 2025) exist — [Sweden & Martina](https://www.sweden-martina.com/wp-content/uploads/2026/06/DENTALPASSPORT-F-rev.03-26_LR.pdf); [Hiossen](https://hiossen.com/wp-content/uploads/2025/11/Implant-Passport_4pt5x6_12P.pdf)
- ISQ >65–70 may indicate sufficient stability for early/immediate loading; another source uses IT >25 and <50 Ncm with ISQ >60 — [PMC12697411 review](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12697411/)
- Insertion torque >35 Ncm is a common benchmark for immediate loading (35–45 Ncm "optimal" per another source) — [Dazzle Dental blog](https://www.dazzle.dental/blog/primary-stability-dental-implants) (low-authority)
- Torque and ISQ don't track closely; ISQ is one of several loading parameters — [Osstell](https://www.osstell.com/news/top-5-questions-to-isq-users); RFA's value is repeated measurement over time — [Dental Tribune](https://www.dental-tribune.com/news/resonance-frequency-analysis-the-only-longitudinal-metric-for-implant-stability/)
- Definition of immediate loading varies (within 48 h vs within one week) — [PMC12697411](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12697411/)

### Inferences
- Implant surgical record (domain knowledge where not sourced): site (FDI), indication, pre-op CBCT reference, bone quality (Lekholm–Zarb D1–D4), ridge width/height, guided vs freehand (surgical guide ID/lab), flap/flapless, osteotomy protocol, implant (brand/system, line, REF, LOT, UDI, diameter, length, platform, connection), insertion torque (Ncm), ISQ (buccolingual/mesiodistal, at placement and re-check dates), depth relative to crest, primary closure, healing component (cover screw vs healing abutment: REF/LOT/height/diameter), graft materials (type: autograft/allograft/xenograft/alloplast; brand, LOT, volume) and membranes (resorbable/non; brand, LOT, size), sinus lift (lateral/crestal), sutures (type/size, removal date), medications, complications, post-op instructions, planned loading protocol (immediate/early/conventional) and date.
- Restorative phase: impression/scan type (scan body REF/LOT), abutment (stock/custom/Ti-base; REF/LOT; torque applied), screw- vs cement-retained, crown material, lab case link, final torque; maintenance recall with peri-implant probing, BOP, bone-level radiograph.
- Implant passport: auto-generated bilingual (Arabic/English) PDF/QR card from these records; inventory module can scan barcodes (GS1 UDI) into REF/LOT fields (big speed win).
- Odontogram: implant graphic in root view with "implant/abutment/crown" sub-states and loading status.

### Gaps
- No product documentation found showing implant-record screens in Dentrix/Dentally/Curve; Western PMS often leave this to free text or implant-planning software.
- No authoritative consensus thresholds for torque/ISQ (literature varies).

---

## Q6. Prosthodontics, oral surgery, pediatric, cosmetic, TMJ

### Takeaway
These modules are mostly structured note templates + chart graphics + lab-case linkage. The few evidence-backed specifics found: Frankl behavior scale for pediatric charting; bridge/denture workflows; child prophy recall types. Shade, smile-design and TMJ forms rely on domain knowledge (no strong sources fetched).

### Cited Findings
- Frankl behavior rating: 4-point scale (1 definitely negative, 2 negative, 3 positive, 4 definitely positive), developed 1962, assigned by the pediatric dentist after treatment and included in routine charting; some studies code it 0–3 — [PMC9552619](https://pmc.ncbi.nlm.nih.gov/articles/PMC9552619); [NDEB pediatric guide](https://open-exam-prep.com/study-guides/ca-ndeb-afk/pediatric-dentistry/behavior-management-primary-care)
- Open Dental recall: "Child Prophy" special recall type is used only to determine procedures for a child's recall appointment — [Open Dental Recall Types](https://opendental.com/manual/recalltypes.html)
- Dentally charts dentures/bridges/implants over gaps; condensed mixed-dentition chart (adult + child rows) — [Dentally help](https://help.dentally.com/en/articles/9589866-how-the-odontogram-treatment-lines-work); [Dentally overview](https://www.dentally.com/en-gb/insights-hub/an-overview-of-charting-in-dentally)
- Bridge charting with abutment/pontic roles and per-unit codes — [Sensei Charting Bridges](https://help.carestreamdental.com/rh/web/server/Sensei_Cloud/projects_responsive/CM300_SCWorkbook/Charting_Bridges.htm)
- Dentally charting includes BEWE (Basic Erosive Wear Examination) — [Dentally overview](https://www.dentally.com/en-gb/insights-hub/an-overview-of-charting-in-dentally)

### Inferences (domain knowledge, not re-verified)
- **Prosthodontics**: crown/onlay/veneer/bridge/denture records with material (zirconia, e.max/lithium disilicate, PFM, metal, composite, PMMA temp), shade (VITA classic A1–D4 and/or 3D-Master; stump shade), margin type, preparation date, impression/scan, temporary, try-in steps (framework, bisque, final), cementation (cement type) — linked to lab cases (already decided). Removable: complete/partial (Kennedy class), acrylic vs cast/flexible, clasp teeth, jaw relation steps (impressions → bite → try-in → delivery → adjustments). Tooth-wear (BEWE) and occlusion notes.
- **Oral surgery**: extraction note template (tooth, indication, anesthesia type/agent/carpules, technique simple vs surgical, flap, bone removal, sectioning, complications e.g., root tip left/oroantral communication, hemostasis, sutures type/size/count, removal date), third-molar classification (Pell & Gregory, Winter), biopsy (site, specimen sent, lab), post-op instruction handout (Arabic) auto-attached, post-op prescriptions, follow-up call/appointment.
- **Pediatric**: mixed/primary dentition chart (FDI 51–85), eruption status (unerupted/erupting/erupted/exfoliating), Frankl per visit, behavior management technique used, fluoride varnish application (product, date), sealants (teeth, retention check), pulpotomy/pulpectomy, stainless-steel crowns, space maintainers (type: band-and-loop, lingual arch, Nance; teeth; insert date; removal plan), caries risk (CAMBRA 0–5 version), parent/guardian consent and accompanying person, growth/development notes, habit appliances.
- **Cosmetic**: shade records with photo (shade tab in frame), before/after photo pairs, smile-design photo set (full-face smile, retracted, 1:1 anterior, lateral), whitening (method, shade before/after), veneers mock-up approval, digital smile design as later (or integration).
- **TMJ**: screening (pain VAS, joint sounds click/crepitus R/L, mouth opening mm max/assisted, deviation/deflection, muscle palpation map, parafunction/bruxism), splint record (type, delivery, adjustments) — DC/TMD formal protocol is "later".

### Gaps
- No primary sources fetched for shade-record UIs, smile-design tooling, TMJ/DC-TMD forms, extraction-note templates, or AAPD space-maintainer/fluoride charting conventions.

---

## Q7. Clinical note templates, auto-notes, recall/hygiene system, risk assessment, OHI handouts

### Takeaway
Leading products auto-create clinical notes from charted procedures (Sensei), offer note templates and AI dictation (Dentally, Curve, Dentrix Ascend), and run recall by "recall types" with intervals and procedure bundles (Open Dental). Caries risk assessment (CAMBRA) has a clear scoring model that software can compute.

### Cited Findings
- Sensei: charting a bridge auto-adds a clinical note and graphic — [Sensei Charting Bridges](https://help.carestreamdental.com/rh/web/server/Sensei_Cloud/projects_responsive/CM300_SCWorkbook/Charting_Bridges.htm)
- Dentally: clinical note templates, pre-built treatment-plan templates, AI notes from dictation into structured template notes with multiple editable entries; clinical sidebar shows notes, history, images alongside the chart — [Dentally overview](https://www.dentally.com/en-gb/insights-hub/an-overview-of-charting-in-dentally); [Dentally support page](https://www.dentally.com/support/orthodontics)
- Curve Notes+ drafts notes from conversations; Dentrix Ascend voice includes clinical notes — [Dr. Bicuspid](https://www.drbicuspid.com/clinical/treatment-software/ai/article/15829798/curve-dental-curve-dental-launches-curve-care-clinical-ai-suite); [Dentrix Ascend suite](https://www.dentrixascend.com/dental-solutions/charting-imaging-and-clinical-ai/dentrix-ascend-clinical-technology-suite/)
- Open Dental recall: Setup → Appointments → Recall Types; defaults Prophy, Child Prophy, Perio (required special types); each type has appointment length, interval/due date and procedures; custom types allowed; prophy and perio are mutually exclusive, "Set Perio" switches patient and recalculates due date; Recall List filter "Show Conflicting Types" — [Open Dental Recall Types](https://opendental.com/manual/recalltypes.html); [Open Dental Recall List](https://opendental.com/manual/recalllist.html)
- Common intervals: prophy 6 months, perio maintenance 3–4 months (vendor blog, practice guidance) — [builts.ai](https://builts.ai/blog/open-dental-recall-automation-patient-self-booking-guide/)
- CAMBRA (6 years–adult, updated 2019/2021): Column 1 "yes" = −1, Column 2 = +2, Column 3 = +3; totals Low −8 to −2, Moderate −1 to +2, High +3 to +17, Extreme +18 to +30 and/or high risk + hyposalivation; disease indicators in column 1 → high/extreme; CAMBRA is a UCSF trademark — [CAMBRA 2021 table (Featherstone)](https://supportservices.jobcorps.gov/health/Documents/OralHealth/Table2-CAMBRA-CRA-6Yr-Adult-Featherstone-Frontiers-FINAL-1-17-2021%20(1).pdf); [ATSU CAMBRA form](https://www.atsu.edu/asdoh/pdfs/cambra/asdoh_cambra_form_2-20-09.pdf)
- Risk-specific patient letters exist (e.g., ATSU "extreme risk" letter) — [ATSU letter](https://www.atsu.edu/asdoh/pdfs/cambra/cra_pt_ltr_extreme_07-27-07.pdf)
- Dentolize: inventory auto-deducts materials linked to procedures on completion; audit log records before/after values — [Dentolize features](https://dentolize.com/our-feature/)

### Inferences
- Auto-note engine: each procedure/finding template has an Arabic + English note template with placeholders (tooth, surfaces, material, shade, anesthesia, LOT) filled from the charted data; completing a procedure appends a draft note that the clinician confirms/edits and signs (locks after sign; addenda only).
- Template library per specialty (exam, prophy, filling, RCT visit 1/2, extraction, implant stage 1/2, crown prep/cement, ortho adjustment, aligner delivery, pediatric visit, emergency visit).
- Recall: recall types per tenant (Prophy 6m, Perio maintenance 3m, Child 6m, Ortho retention, Implant maintenance 12m, Post-endo review 6/12m), auto-set by completing procedures (trigger codes) and by perio stage; WhatsApp/SMS reminders (regionally essential — see Q10).
- Risk assessments: CAMBRA (computed score + level + recommended recall interval/fluoride regimen), perio risk (staging/grading), and medical-risk alerts (already decided).
- OHI handouts: Arabic printable/WhatsApp-shareable handouts per condition (brushing, interdental, post-extraction, post-implant, ortho hygiene, aligner care, whitening, fluoride/kids), auto-suggested from completed procedures.

### Gaps
- CAMBRA's exact checklist items per column and the 0–5 version were not fetched; trademark/licensing terms for embedding the CAMBRA form were not checked.

---

## Q8. Imaging inside the dental module (high level)

### Takeaway
Dentists expect FMX/bitewing mount templates with automatic tooth-number-based placement, per-image measurement/annotation, tooth-filtered history to compare the same tooth across dates, plus panoramic, ceph, CBCT and intraoral scans; AI radiograph analysis (caries, bone loss) is FDA-cleared from several vendors and is a later-phase item.

### Cited Findings
- DTX Studio (KaVo/Envista) intraoral workspace: FMX layouts, keyboard shortcuts to switch to default FMX, capture and vertical bitewing templates; double-click to measure, annotate, adjust brightness/contrast/filters — [DTX Studio help](https://helpfiles.dtxstudio.com/Help/50784413-8047-4699-82f7-d1e9a868909e/4.5/EN/Intraoral_workspace.htm)
- Planmeca Romexis: automatic tooth numbering enables automatic rotation/placement of intraoral images into study templates and filtering by tooth number for historical comparison; Romexis 7 (2026) AI sorts images captured in any order into template slots — [Planmeca news 2026](https://www.planmeca.com/news-and-events/newsroom/2026/ai-tools-for-intraoral-imaging-now-available-in-planmeca-romexis-7-software/); [Romexis 2D](https://www.planmeca.com/dental-software/planmeca-romexis/2d-imaging-software)
- KaVo 3D: superimposed CBCT recordings for before/after comparisons — [KaVo](https://kavo.com/en-us/node/943)
- AI: Overjet Caries Assist FDA 510(k) (vendor: dentists detected 32% more carious surfaces); Pearl Second Opinion cleared (caries, calculus, etc.; panoramic extension Dec 2025); VideaHealth caries clearance (vendor: 43% fewer missed lesions); Diagnocat Segmentron 510(k) K251072 (Sept 2025) for CBCT segmentation; Innolitics counts 44 AI dental devices cleared through Dec 2025 — [Dental Products Report](https://www.dentalproductsreport.com/view/overjet-s-ai-caries-assist-platform-receives-fda-clearance); [Fierce Biotech](https://www.fiercebiotech.com/medtech/fda-plays-tooth-fairy-awarding-clearance-videahealths-cavity-spotting-ai); [Innolitics](https://innolitics.com/articles/dental-ai-510k-clearances-2025/); [aidoctortools](https://aidoctortools.pages.dev/clinical-ai/best-ai-tools-dental-practices-2026)
- Open Dental saves tooth chart and perio chart images into the Images module (Tooth Charts folder) — [Open Dental Perio](https://www.opendental.com/manual/perio.html)
- Curve/Dentally: imaging accessible from the chart sidebar (Dentally Vision) — [Dentally overview](https://www.dentally.com/en-gb/insights-hub/an-overview-of-charting-in-dentally)

### Inferences
- Dental-module imaging needs (leaving DICOM infra to the other researcher): mount templates (FMX 18/20, 4BW, 2BW, vertical BW, pedo), drag-drop into slots with tooth tags auto-assigned per slot; panoramic and ceph as single images with calibration; CBCT as study link + viewer later; STL/PLY intraoral scan viewer (three.js) with tooth tags; tooth-centric image timeline ("all images of 36"); side-by-side compare with sync zoom; length/angle measurement with calibration; annotation layers; photo-series templates (ortho/cosmetic). AI = later, via partner APIs.

### Gaps
- Sidexis, CS Imaging, Dentrix Ascend Imaging specifics not found; Arabic-market imaging bridge expectations (e.g., common Chinese/Korean sensors in Syria) not researched.

---

## Q9. Dental-specific reports and KPIs beyond finance

### Takeaway
Clinical-operational KPIs that dental owners track: hygiene reappointment rate, case acceptance (count and value), unscheduled/pending treatment value, recall effectiveness, production per provider/hour/chair; benchmarks vary widely by source.

### Cited Findings
- Hygiene reappointment rate = share of hygiene patients booking the next visit before leaving; one source targets ≥90%; practices tend to overestimate it — [DentistryIQ](https://www.dentistryiq.com/practice-management/systems/article/14186117/the-5-metrics-every-dental-practice-should-be-tracking); [CDA](https://www.cda.org/news-events/measure-dental-practice-success-with-these-six-kpis)
- Case acceptance benchmarks conflict: ADA ≥75–80%, AACD 85–90%, a CPA firm 55–70% for strong practices — [ADA](https://www.ada.org/resources/practice/practice-management/measuring-success20160428t155202); [AACD](https://aacd.com/top-key-performance-indicators-for-dentists); [Adams Brown](https://www.adamsbrowncpa.com/blog/top-6-kpis-to-track-in-your-dental-practice/)
- "Unscheduled treatment value" recommended; counting accepted plans can hide never-scheduled treatment, so track presented vs accepted vs scheduled amounts — [PracticeNumbers](https://practicenumbers.com/?p=6848); [Spear Education](https://www.speareducation.com/?p=41519)
- Review cadence: production weekly; case acceptance, hygiene reappointment, A/R monthly; acquisition cost quarterly — [NetSuite dental metrics](https://www.netsuite.com/portal/resource/articles/erp/dental-metrics.shtml)

### Inferences
- Dental-specific reports for R1/R1-ext: treatment-plan funnel (presented → accepted → scheduled → completed; by provider, by procedure category, in each currency), unscheduled accepted treatment list (call list), recall due/overdue list and recall effectiveness, hygiene reappointment %, perio patients by stage and BOP% trend, caries-risk distribution, procedures by provider/code/tooth, lab cases overdue/remakes rate, implant registry (by brand/LOT — recall readiness), ortho active cases (months in treatment vs estimate, overdue visits, aligner stage), failed/cancelled appointment rate, new patients by source, chair utilization.

### Gaps
- No Middle-East-specific KPI benchmarks found.

---

## Q10. Arabic / Middle-East / Turkish dental software and what reviewers praise/complain about

### Takeaway
Regional products differentiate on Arabic RTL UI, WhatsApp automation, offline/mobile use, local e-invoicing/insurance (KSA ZATCA/NPHIES), patient loyalty/CRM, and online plan approval — not on clinical depth (perio/ortho/endo are thin or undocumented). This is the gap a Syrian product can exploit: Western-grade clinical depth + regional workflow.

### Cited Findings
- Dentolize (Egypt/KSA; markets incl. Syria, Iraq, Jordan, Lebanon): interactive chart, WhatsApp bot, loyalty program, patient feedback, CRM/automation, online payments and quotations with treatment plans approved/signed online from the patient's phone, insurance eligibility/co-pay check at booking, ZATCA e-invoicing, NPHIES, payroll/commissions, inventory auto-deduction per procedure, labs, QR codes, consent forms, offline charting with sync, audit log with before/after values, patient map; no perio/ortho/imaging detail published — [Dentolize features](https://dentolize.com/our-feature/); [Dentolize medical chart](https://dentolize.com/medical-chart/)
- CyberTooth: English/Arabic; real-time dashboard/analytics; billing/insurance claims; consent management; visit/treatment tracking (marketing claims) — [CyberTooth features](https://cybertooth-website.pages.dev/features)
- Smart Dentist (iOS/macOS): full RTL support, Arabic-Indic digits, localized exported documents; patients, treatments, billing, expenses, reports — [App Store](https://apps.apple.com/app/id1504745286)
- Turkey: DentSoft (DS4) claims all clinic modules in one; Medicasimple offers click-on-tooth restorative + perio + treatment plan in one flow (1,300+ clinics claimed); Dent-O-Soft lists odontogram, treatment plan, payments, lab/technician management — [DentSoft](https://dentsoft.com.tr/en/solutions); [Medicasimple](https://www.medicasimple.com/tr/dental-charting); [SourceForge Dent-O-Soft](https://www.sourceforge.net/software/compare/Dent-O-Soft-vs-Denty-Cloud)
- An Odoo dental add-on (Turkish listing) records findings per tooth/surface (M/O/D/B/L) with FDI/Universal and treatment lines with phase, estimated cost and status (proposed → accepted) — [Ecosire Odoo dental](https://ecosire.com/tr/apps/odoo/dental-practice-management)
- Western reviews: click count is the most common complaint; cloud latency for imaging; "too sensitive" tooth tapping (Curve) — see Q1 citations [Capterra Dentrix](https://www.capterra.com/p/2329/Dentrix/reviews/); [Capterra Curve](https://www.capterra.com/p/98688/Curve-Dental-Hero/reviews/)
- Terminology standards: SNODENT (ADA, ANSI standard, harmonized with SNOMED CT, aligned with ICD-10-CM) for dental diagnoses; ICD-10 K02.x for caries — [ADA SNODENT](https://ada.org/snodent); [HL7 SNODENT](https://terminology.hl7.org/5.2.0/CodeSystem-v3-ada-snodent.html); [DPR](https://www.dentalproductsreport.com/view/snodent-and-future-dental-ehr-coding)

### Inferences
- For Aleppo/Azaz: unreliable connectivity and power → offline-capable charting with later sync is a real differentiator (Dentolize already advertises it); WhatsApp (not SMS/email) for recall, plan approval links, handouts, implant passport; Arabic-Indic vs Western digits toggle (Smart Dentist evidence); dentists commonly use English clinical abbreviations (MOD, RCT) — keep bilingual labels in the chart.
- Turkish proximity (Azaz/Gaziantep supply chains, Turkish implant brands) → seed implant catalog with brands common in the region (needs field validation).
- Use internal diagnosis codes mapped optionally to ICD-10 (K00–K14) for future insurance/NGO reporting; SNODENT licensing not needed for R1.

### Gaps
- No user reviews (Arabic or Turkish) about charting usability for Dentolize, CyberTooth, DentSoft were found; Dentcard and "Dişhekimi yazılımı" products could not be verified.
- No data on Syrian dental software market share or what Syrian dentists currently use (likely paper + generic/ cracked desktop tools — unverified).

---

## Q11. Recommended tiering (R1 core / R1 extended / later) and key data-model entities

### Takeaway
R1 core should nail the odontogram interaction (tooth-first, surfaces, bridge wizard, filters, history slider, print), BPE + full 6-site perio chart with fast keypad entry and comparison, structured exam/notes templates with auto-notes, ortho records + per-visit appliance/aligner log + photo series, per-canal endo record, implant record + passport, recall types, CAMBRA. R1 extended adds staging/grading assistant, ceph manual tracing, IPR/attachment maps, imaging mounts, patient perio report, dental KPIs. Later: voice, AI imaging, AI ceph, 3D scans/CBCT viewer, DC/TMD, smile design.

### Cited Findings
- Tiering is a synthesis; supporting evidence: usability failure points (PMC2614265), fast-entry patterns (Open Dental perio), regional differentiators (Dentolize), tier-gated voice perio in Dentrix Ascend (premium) — [PMC2614265](https://pmc.ncbi.nlm.nih.gov/articles/PMC2614265); [Open Dental Perio](https://www.opendental.com/manual/perio.html); [Dentolize features](https://dentolize.com/our-feature/); [Dentrix Ascend Voice Perio](https://www.dentrixascend.com/dental-solutions/charting-imaging-and-clinical-ai/voice-perio/)

### Inferences — Tiering

**R1 core (must ship)**
1. Odontogram: anatomical SVG (buccal+root view, occlusal 5-surface view) + compact geometric toggle; permanent/primary/mixed dentition; tooth-first selection; Ctrl/Shift/drag multi-select; long-press context menu; quick-pick bar (user favorites, numeric hotkeys); FDI typing to jump; separate "Findings/Existing" vs "Planned" palette (maps to base vs proposed); clear Missing vs Extracted; hide/dim missing teeth; bridge wizard with linked group; supernumerary support (FDI 5x/… convention or "supernumerary near tooth X"); per-surface conditions; whole-mouth/arch/quadrant/sextant items (dentures, scaling); view filters (base / proposed / completed / all); time slider "chart as of date"; print/PDF chart snapshot with legend; undo; audit log.
2. Perio: BPE screening (sextant 0–4 + *); full 6-site chart (PD, GM ±, auto-CAL, BOP, suppuration, plaque, calculus, mobility Miller, furcation per entrance Glickman/Hamp setting, MGJ/KT width), skip/implant flags, configurable auto-advance path, triplet mode, ≥10 entry, red thresholds, previous exam ghost values, copy last exam, totals (sites ≥4/≥6 mm, BOP%, O'Leary plaque %), print + save to images, tablet keypad.
3. Exam & diagnosis: structured comprehensive exam (extraoral/intraoral soft tissue, occlusion, TMJ screen), diagnosis picklists per tooth (caries, pulpal/periapical AAE, perio), optional ICD-10 mapping.
4. Notes: per-procedure Arabic/English templates with auto-fill from charted data; sign/lock; addenda.
5. Endo: per-canal table (name, reference point, WL, MAF size/taper, obturation technique/sealer), endo tests table, AAE diagnosis picklists, visit status.
6. Implants: implant record with component traceability (brand, REF, LOT, UDI, dimensions), torque, ISQ (repeatable), grafts/membranes, healing component, loading protocol, restorative components; bilingual implant passport PDF/QR.
7. Ortho: initial exam form (Angle, OJ/OB, crowding, midlines, crossbites, profile), standard photo-series template, per-visit ortho log (wire per arch, elastics, brackets/bands set via prescription & copy-last-visit), aligner tracking (stages, current stage, dispense log), retention record, months-in-treatment counter (financial contract already decided).
8. Pediatric basics: primary-tooth chart, Frankl per visit, sealants/fluoride varnish/SSC/space maintainers as chartable items.
9. Oral surgery & prostho templates: extraction note (sutures, complications, post-op handout), crown/bridge/denture step tracking with shade (VITA) and material, linked to lab cases.
10. Recall: recall types (prophy, perio maintenance, child, ortho retention, implant maintenance, endo review) with intervals, triggers from completed procedures, WhatsApp reminders.
11. Caries risk: CAMBRA scoring (6+ years) with risk level stored and shown on patient banner.
12. Handouts: Arabic OHI/post-op handouts auto-suggested, printable/WhatsApp.

**R1 extended (ship if capacity allows / first updates)**
- AAP/EFP staging & grading assistant (auto-suggest + clinician confirm); exam-to-exam perio comparison view with deltas and trend charts; patient-friendly Arabic perio report.
- Aligner attachments map and IPR chart per contact (planned stage, done date); ortho chart graphics (brackets/wires drawn on facial view).
- Ceph manual landmark tracing with calibration and Steiner (+ partial McNamara/Downs) measurements and norms; progress superimposition.
- Imaging mounts (FMX/BW/pedo templates) with tooth tags, tooth-centric image timeline, side-by-side compare, measurement/annotation; ortho/cosmetic photo comparison.
- Dental KPIs: plan funnel (presented/accepted/scheduled/completed), unscheduled treatment list, hygiene reappointment %, recall effectiveness, perio stage distribution, lab turnaround/remakes, implant registry by LOT.
- Offline charting with sync (high value for Syria; architecture-dependent).
- BEWE erosive-wear screen, TMJ screening form, shade photo records, before/after cosmetic sets.

**Later**
- Voice charting (perio first, numbers grammar; Arabic/English), ambient AI notes.
- AI radiograph analysis via partners (caries, bone level), AI auto-ceph landmarks (licence + validation), AI image auto-mounting.
- CBCT viewer, STL/PLY intraoral-scan viewer with tooth segmentation, implant planning integration, digital smile design.
- Full DC/TMD protocol, sleep/airway, periodontal risk calculators (PRA), SNODENT coding, insurance-specific coding, perio probe hardware integration (e.g., Florida Probe), foot pedal.

### Inferences — Key data-model entities (suggested)
- `Tooth` (reference: FDI code, type permanent/primary/supernumerary, arch, quadrant, surfaces available); `PatientDentition` (per patient: tooth presence/eruption state over time).
- `ChartItem` (event-sourced): patient, tooth(s) / surfaces[] / area (mouth, arch, quadrant, sextant), item_type (finding/procedure), code (internal catalog → optional ICD-10/CDT/SNODENT map), layer (base/proposed), status (one of the 6), material, shade, provider, dates (diagnosed, planned, completed, valid_from/valid_to), group_id (bridge/denture/splint), treatment_plan_item_id, note_id, lab_case_id, attachments[].
- `ChartGroup` (bridge/denture/splint/implant-supported prosthesis): units[] with role (abutment, pontic, cantilever, implant abutment).
- `Diagnosis` (per tooth/site/patient; type: caries, pulpal, periapical, periodontal stage/grade, TMD, ortho; source auto/confirmed).
- `PerioExam` (date, provider, type full/BPE/re-eval/maintenance, smoking/HbA1c snapshot, notes, indices cache) → `PerioSiteMeasurement` (tooth, site 1–6, PD, GM, CAL computed, BOP, suppuration, plaque, calculus) + `PerioToothMeasurement` (mobility, furcation per entrance, MGJ/KT, skipped, implant flag) + `BPEScore` (sextant, code, furcation*).
- `PerioClassification` (stage, extent, grade, modifiers, evidence fields, confirmed_by).
- `RiskAssessment` (type CAMBRA/perio/medical, answers JSON, score, level, date).
- `EndoCase` → `EndoTest` (tooth, test type, result/value) and `Canal` (name, reference point, est/EAL/radiographic/final WL, MAF size, taper, file system, irrigants, medicament, obturation technique, sealer, status).
- `ImplantPlacement` (site, implant product REF/LOT/UDI, dimensions, torque, bone quality, guide, healing component, loading protocol) → `StabilityMeasurement` (ISQ/torque, date) ; `GraftMaterial` (type, brand, LOT, volume) ; `ImplantRestoration` (abutment REF/LOT, torque, retention type, crown material) ; `ImplantPassport` (generated doc).
- `OrthoCase` (diagnosis form JSON: Angle, OJ, OB, crowding, midlines…, start/est end, appliance type fixed/aligner) → `OrthoVisit` (wires per arch, elastics, notes, compliance) → `OrthoHardware` (tooth, type, product, placed/removed dates) ; `AlignerSeries` (brand, stages U/L, refinements) → `AlignerDispense` (stages from–to, date) ; `AttachmentPlan` (tooth, type, stage) ; `IPRPlan` (contact tooth pair, mm, stage, done_date) ; `Retainer` (arch, type, teeth range, dates).
- `CephAnalysis` (image_id, calibration, landmarks {code: x,y}, analysis type, computed measures, norms version).
- `ImageSeries` / `Mount` (template type, slots → image_id + tooth tags) ; `ClinicalPhotoSet` (template ortho/cosmetic, view slots).
- `ClinicalNote` (template_id, rendered text AR/EN, linked chart items, signed_at, addenda) ; `NoteTemplate` (procedure code, placeholders).
- `RecallType` (interval, procedures, triggers) ; `PatientRecall` (type, due date, status, last reminder).
- `Handout` (condition/procedure, language, content) ; `HandoutDelivery` (channel WhatsApp/print, date).
- `PediatricVisitBehavior` (Frankl score, technique) ; `SpaceMaintainer` (type, teeth, dates) can be ChartItems with extra attributes.
- `ShadeRecord` (tooth/arch, system VITA classic/3D-Master, value, photo_id).

### Gaps
- Tiering is an analyst synthesis and should be validated with 3–5 Aleppo/Azaz dentists (GP, orthodontist, endodontist, periodontist/implantologist) before freezing scope.
