# Dental Clinic Practice Management + Dental EMR: MVP Scope for a Multi-Tenant Clinic SaaS (Syria: Aleppo & Azaz)

Research date: 2026-11-07. Web research only. Every claim below has a source link. Items under "Inferences" are reasoning or design recommendations, not sourced facts. Each section's Inferences tag features as **MVP**, **v2** or **LATER**. The last section consolidates the scope and sketches a data model.

Source-quality note: Open Dental's online manual is the most detailed primary source for charting, treatment plans and lab cases. Most Arab/ME vendor material is vendor marketing. Independent reviews of Arab dental software are scarce, and I found no Syrian dental software at all (see the Gaps sections).

---

## 1. Daily dental clinic workflow end-to-end, and who does what

### Takeaway
The day revolves around an appointment book scheduled by dentist and chair. Each appointment carries the planned procedures and teeth, plus any lab-work dependency. Chairside, the dentist or assistant charts findings and marks procedures complete. Completing a procedure posts the charge to the patient account at once, and the receptionist collects payment and books the next visit from the remaining treatment plan. Vendors build the daily screen around "today's list" plus a daily huddle: chair use, no-shows, production.

### Cited Findings
- Open Dental: marking a procedure "Complete" gives it a fee that is billed to the patient's Account straight away. "Treatment Planned" is the default status when charting. — [Open Dental: Procedure Info / Enter Treatment](https://opendental.com/manual/entertreatment.html)
- Open Dental treatment plans show each item's scheduling state: X = on a scheduled appointment, P = Planned Appointment, U = unscheduled. Completed items drop off the active plan. This is how the front desk sees what still needs booking. — [Open Dental: Treatment Plan](https://opendental.com/Manual/treatmentplan.html)
- CyberTooth (Arabic-capable vendor) shows a per-branch calendar by month, week, day or list. Each appointment shows the doctor and the planned procedures and teeth, and "today's list" appears at login on web and mobile. — [CyberTooth features](https://cybertooth-website.pages.dev/features)
- Dentally ties lab status to the fitting appointment (Sent, Received, or Overdue flagged 1–2 days before) so reception can chase the lab or reschedule before the patient arrives. — [Dentally Help: lab status](https://help.dentally.com/en/articles/10205410-how-to-use-lab-status-to-track-lab-work)
- Curve Dental's suggested daily huddle view covers chair utilization, same-day production against goal, and the no-show and late-cancellation count. Production per provider is reviewed weekly. — [Curve Dental: dental metrics explained](https://www.curvedental.com/dental-blog/dental-metrics-explained-what-each-one-measures-what-it-misses-and-when-to-review-it)
- Dentolize markets a "Patient Journey" tool for follow-ups, a WhatsApp bot for automated patient replies, "Tasks" for team assignment, and an internal staff chat in its iPad app. — [Dentolize features](https://dentolize.com/our-feature/); [Dentolize App Store](https://apps.apple.com/app/id1612892336)
- Dentolize says its charting works offline and syncs once the connection returns. This matters wherever power and internet are unreliable. — [Dentolize features](https://dentolize.com/our-feature/)

### Inferences
- **Workflow as the MVP must support it** (domain reasoning, not a sourced Syrian workflow study):
  1. **Booking (receptionist):** pick patient, dentist, chair, branch and duration. Optionally attach planned treatment items. Conflict checks run per dentist and per chair.
  2. **Walk-in or emergency (pain):** quick-create the patient (name + phone only), add a "walk-in / emergency" appointment into a gap or an overflow column, and flag the chief complaint ("pain, tooth 36"). Pain walk-ins are typical for cash-pay clinics, so this cannot be a v2 item.
  3. **Check-in (receptionist):** status goes Arrived → In chair. Show medical alerts (anticoagulant, allergy, pregnancy, bisphosphonate) at check-in and on the chart header.
  4. **Chairside (dentist; assistant may scribe):** chart findings on the odontogram, write the visit note, mark planned items complete, add new planned items, write a prescription, attach X-rays or photos.
  5. **Billing (receptionist or cashier):** completed procedures become charges. Collect cash in one of three currencies, or apply the payment to a deposit or installment. Print an Arabic receipt.
  6. **Next visit:** book from the remaining plan items. For long cases (ortho, implants), the next due installment shows up here.
  7. **End of day (owner or accountant):** cash count per cashbox per currency, the day's procedures per dentist, and the expenses paid.
- **Roles for MVP RBAC:** Owner/Admin (everything, all branches), Dentist (own patients and schedule, clinical edit, own revenue view), Assistant (chart and notes on the dentist's behalf, attach images, no financials), Receptionist (patients, appointments, payments, receipts, no clinical edit), Accountant (payments, expenses, cash close, reports, commissions; clinical data read-only or hidden). A solo dentist with a secretary uses only two roles, so roles must be optional and combinable.
- **MVP:** appointment book by dentist and chair, walk-in/emergency fast path, appointment statuses, today's list, medical-alert banner, complete-to-charge, next-visit booking from plan items.
- **v2:** WhatsApp reminders and confirmations, recall lists (6-month check-ups), waiting-list, internal chat, task assignment, offline-first charting. Offline matters in Syria, but it is a large architectural cost, so a v1 design should at least avoid precluding it.
- **LATER:** patient self-booking portal, automated "patient journey" campaigns.

### Gaps
- No primary source describing the day-to-day workflow of Syrian (Aleppo/Azaz) dental clinics specifically: receptionist versus dentist collecting cash, typical appointment length, share of walk-ins. Field interviews are needed.
- No data on how often Syrian clinics run multiple chairs per dentist (double booking across chairs).

---

## 2. Odontogram essentials: notation, surfaces, conditions, status colors, history, UX patterns; perio and ortho

### Takeaway
Use FDI/ISO 3950 two-digit numbering (11–48 permanent, 51–85 primary) and five-plus surface codes (M, O/I, D, B/F, L/P, plus optional V for cervical/Class V). Every chart entry should carry a status. Mature systems use Treatment Planned, Completed, Existing (this clinic), Existing (other clinic), Referred, and Condition/finding, and color the tooth graphic by status. A per-tooth history (or a chart "as of a date") is standard. Usability research shows status confusion and icon hunting are the main odontogram failure points, so the MVP set should stay small. Full perio charting and ortho tracking can wait.

### Cited Findings
**Notation**
- FDI notation, also called ISO 3950 notation, is the most widely used dental notation in the world. ISO 3950:2016 is titled "Dentistry — Designation system for teeth and areas of the oral cavity". Quadrants 1–4 are permanent (1 upper right, 2 upper left, 3 lower left, 4 lower right), numbered from the midline, e.g. 13 = upper right canine. — [Wikipedia: FDI notation](https://en.wikipedia.org/wiki/FDI_World_Dental_Federation_notation)
- Primary teeth use quadrants 5–8 (55–51, 61–65, 71–75, 81–85). Letter schemes (A–E / A–T) belong to Universal or Palmer and must not be mixed with FDI. — [Dr. Bunn tooth numbering chart](https://drbunn.com/faq/tooth-numbering/); [Wikipedia: Dental notation](https://en.wikipedia.org/wiki/Dental_notation)
- Open Dental offers four tooth-nomenclature preferences: Universal, FDI, Haderup and Palmer. In FDI mode, permanent teeth are 11–48 and primary teeth 51–85 ("not every number in these ranges is valid"), and foreign users can enter supernumeraries as 99. Supernumerary teeth are not drawn on the chart. — [Open Dental: Graphical Tooth Chart](https://opendental.com/manual/graphicaltoothchart.html)

**Surfaces**
- Open Dental's surface buttons are B/F, M, O/I, D, L and V. V marks a Class 5 location at the gingival margin of B/F, is drawn separately, and is converted to B or F on claims. — [Open Dental: Enter Treatment](https://opendental.com/manual/entertreatment.html)
- Common combined surfaces: MO, DO, MOD, MI, and the five-surface MODBL. — [SlideShare: dental charting basics](https://www.slideshare.net/slideshow/dental-charting-cavity-classification-basic-charting-terms/236728905); [Open Exam Prep: charting terminology](https://open-exam-prep.com/study-guides/rda/assessment-and-diagnostic-records-diagnostic-tests-imaging-cbct-and-charting/charting-terminology-universal-and-palmer)
- The palatal versus lingual naming of the maxillary inner surface varies between sources. Some call it palatal, and some use L for both. — [Open Exam Prep](https://open-exam-prep.com/study-guides/rda/assessment-and-diagnostic-records-diagnostic-tests-imaging-cbct-and-charting/charting-terminology-universal-and-palmer); [Kiroku: dental charting symbols](https://www.trykiroku.com/blog/dental-charting-symbols)

**Statuses and colors**
- Open Dental entry statuses: TreatPlan (TP, the default; recommended but not done), Complete (fee billed to account), ExistCurProv (done in your practice before the software was used, no fee), ExistOther (done elsewhere, no date or fee), Referred (to be done at another office; becomes ExistOther once done), and Condition (diagnoses or "watch" items charted separately from treatment). — [Open Dental: Enter Treatment](https://opendental.com/manual/entertreatment.html)
- The tooth-chart color comes from procedure status, which is user-customizable under Definitions > Chart Graphic Colors with light variants. A per-code "Color Override" replaces status coloring. By convention, metal restorations use dark colors and ceramic, porcelain or plastic use light ones. — [Open Dental: Graphical Tooth Chart](https://opendental.com/manual/graphicaltoothchart.html); [Open Dental: Chart Graphic Colors](https://opendental.com/Manual/definitionschartgraphiccolors.html)
- Charting-education convention: red for conditions needing treatment, blue or black for completed restorations. Existing restorations and planned treatment should be charted separately. — [Denti.AI: dental charting symbols](https://www.denti.ai/blog-posts/dental-charting-symbols); [Open Exam Prep](https://open-exam-prep.com/study-guides/rda/assessment-and-diagnostic-records-diagnostic-tests-imaging-cbct-and-charting/charting-terminology-universal-and-palmer)

**Graphics, selection and treatment areas**
- In Open Dental, each procedure code has a "paint type" (how it is drawn) and a "treatment area" (tooth, surface, quadrant, arch, range, mouth). Mouth-level items show no graphic. Selecting any tooth in a quadrant or arch assigns a quadrant or arch code automatically. Click-and-drag selects several teeth, and a range selection is used for range procedures such as bridges. — [Open Dental: Graphical Tooth Chart](https://opendental.com/manual/graphicaltoothchart.html); [Open Dental: Enter Treatment](https://opendental.com/manual/entertreatment.html)
- Open Dental charting inputs: a full procedure list, category-grouped procedure buttons (one button can map to several codes or "Auto Codes", for example picking the right filling code from the surface count), typed codes, and single-code "Quick Buttons" for fillings and sealants. Optional per-entry fields: date, one diagnosis, one prognosis, one plan priority. — [Open Dental: Enter Treatment](https://opendental.com/manual/entertreatment.html)
- A "Hide Graphics" flag stops outdated treatment, such as a crown that has since been removed, from showing on the chart. — [Open Dental: Graphical Tooth Chart](https://opendental.com/manual/graphicaltoothchart.html)

**History**
- Open Dental has a date slider under the chart that shows the mouth as of an earlier date. TP items appear as of their "Date TP", and everything else as of its entry date. The chart can also be saved as an image into the Imaging module. — [Open Dental: Graphical Tooth Chart](https://opendental.com/manual/graphicaltoothchart.html)
- Dentally's layout puts the patient's base chart (current state) in the centre two rows and proposed work in the outer rows "before it is committed to the base chart". A Base Chart mode records existing work without putting it on a plan. Hovering a tooth shows its charted history, including who charted it and whether it sits on a plan or the base chart. A newer feature shows planned treatment from all active plans at once. — [Dentally Help: Charting (Canada edition)](https://help.dentally.co/en/articles/9004569-charting-in-canada); [Dentally: How the odontogram treatment lines work](https://help.dentally.com/en/articles/9589866-how-the-odontogram-treatment-lines-work); [Dentally: recording a baseline chart](https://help.dentally.com/en/articles/3563965-how-to-record-a-baseline-chart); [Dentally: show all planned treatment](https://help.dentally.com/en/articles/14836285-how-to-show-all-planned-treatment-on-the-odontogram)

**Regional products**
- CyberTooth plans treatment on the chart by tooth, surface and canal for permanent, primary or mixed dentition. — [CyberTooth features](https://cybertooth-website.pages.dev/features)
- Smart Dentist (Arabic RTL) advertises a "visual 3D tooth chart" and "Full perio charting". — [Smart Dentist App Store](https://apps.apple.com/app/id1504745286)

**Usability evidence**
- A Pittsburgh study of four dental computer-based record systems found significant usability problems for novice users and a steep learning curve. In a survey of 102 US general dentists, usability and functionality were what they disliked most. — [PMC2614265](https://pmc.ncbi.nlm.nih.gov/articles/PMC2614265)
- Walji, Kalenderian et al. found 24 high-level usability problems in a widely used dental EHR, including unexpected ways of displaying diagnoses. — [PMC3492538](https://pmc.ncbi.nlm.nih.gov/articles/PMC3492538)
- In a touch-based tooth-charting prototype (iTooth), 78% of participants couldn't locate a particular icon, 44% were confused by charting statuses, and the root-canal gesture had a 50% recognition failure. The authors recommend better icon grouping and grouping of statuses. — [Marshfield Research: touch-based tooth charting usability](https://www.marshfieldresearch.org/srip/students/adam-sorenson)

### Inferences
- **MVP odontogram:**
  - FDI only in v1. FDI is the regional and ISO norm, and Universal/Palmer can be added later as a display preference if ever needed. Support a per-patient dentition mode (permanent / primary / mixed), so the mixed chart shows the primary teeth present plus the erupted permanent ones, and a "missing" flag per tooth.
  - Surfaces: M, O, I, D, B, F (alias of B for anterior teeth), L, P (alias of L for upper teeth), and optionally V/cervical. Store a canonical set {M,O,D,B,L,V}, with O/I, B/F and L/P resolved by tooth position. This avoids the palatal/lingual inconsistency.
  - A minimal finding and procedure set of about 15 items covers almost all GP charting:
    - Findings (conditions): caries (surfaces), fractured tooth, missing, root remnant, periapical lesion/abscess, mobility (grade), "watch".
    - Restorative and prosthetic items (planned, existing or completed): filling (composite / amalgam / GIC, surfaces), root canal treatment, post & core, crown (material: PFM / zirconia / metal / e-max), bridge (abutments + pontics over a range), veneer, implant, implant crown, extraction, sealant, removable denture (partial/complete per arch), scaling (mouth-level).
  - Six statuses: `planned`, `completed` (this clinic), `existing_this_clinic`, `existing_other`, `referred`, `condition`. Colors follow the conventions above: red for findings and planned work, blue for completed here, green or grey for existing. Users should not be able to recolor in v1, which keeps meaning consistent across tenants.
  - Per-tooth history drawer showing date, dentist, status, procedure, note and linked images. Dentally's hover-history is the model. A full "chart as of date" slider is v2.
  - A two-layer display (current state plus proposed work), following Dentally's base/proposed rows. It directly addresses the "confusion from charting statuses" problem.
  - Chairside speed: quick buttons for the 6–8 most common items and multi-tooth selection. Tablet-friendly tap targets matter because many Syrian chairs will use phones or tablets (an inference, unverified).
- **v2:** canal-level detail (number of canals, working lengths), a "chart as of date" slider, chart snapshot export as an image or PDF, a supernumerary tooth (99), a tooth-movement or rotation display, customizable colors, Universal/Palmer display.
- **v2 (perio):** a 6-point probing depth / recession / bleeding / mobility / furcation chart. Most GP visits in a cash-pay market don't produce perio charts (inference). Ship a simple per-tooth mobility and "perio condition" finding in MVP and the full chart in v2.
- **LATER (ortho):** brackets/wires per visit, angle classification, aligner stage tracking, cephalometrics. The *financial* side of ortho (down payment plus monthly installments) is MVP. See section 3.
- **LATER:** 3D chart, AI X-ray findings, voice charting.

### Gaps
- I could not access ISO 3950:2016 itself (paywalled). Notation details come from Wikipedia and vendor manuals.
- No authoritative, standardized list of the "minimal" set of chart conditions exists. The list above is synthesized from Open Dental's model and charting-education material.
- Not researched (time-boxed): the Dentrix and Curve Dental odontogram UX in detail, and Arab-vendor odontogram screenshots (Tabeeb, Clinicy).
- No data on device mix (tablet, desktop, phone) in Syrian clinics.

---

## 3. Treatment plans, procedure catalog (CDT licensing), installments / balances / deposits

### Takeaway
A treatment plan is a priced, prioritized (phased) list of tooth- and surface-level procedures. It can carry per-item discounts and a patient signature. Each item converts into a scheduled and then completed procedure, and the plan keeps a "done" record. CDT codes are ADA intellectual property licensed for US territory only, so a Syrian SaaS should not ship CDT. Ship a tenant-editable internal catalog with stable internal codes instead. Long treatments in the region are typically paid as a down payment plus installments tied to visits (e.g. ortho adjustments), so per-patient running balances, deposits and installment schedules belong in the MVP.

### Cited Findings
**Treatment plans**
- Open Dental runs one *active* plan per patient (TP items only, linked to appointments), any number of *inactive* or alternative plans, and *saved* plans that serve as permanent signed records. Items are sorted by "priority" (customizable names of up to 7 characters, effectively phases), then date, then tooth. The Discount button applies procedure discounts. "Sign TP" captures an e-signature, and plans can be printed or emailed. Estimated patient portion = Fee − Primary insurance − Secondary insurance − Discount. Completed items leave the active plan, and on a saved plan the "Done" column marks them. — [Open Dental: Treatment Plan](https://opendental.com/Manual/treatmentplan.html)
- Dentally lets you create several plans per patient, rename, clone and reorder them, add appointments from a plan, and start from saved plan templates. — [Dentally: charting overview](https://help.dentally.com/en/articles/3565932-how-to-chart-in-dentally)
- Dentolize calls treatment plans "Quotations": a priced plan that patients can approve and sign from their phone. — [Dentolize features](https://dentolize.com/our-feature/)

**Procedure codes and licensing**
- ADA terms limit end-user CDT use to "within the United States and its territories". Commercial use of CDT, including by practice-management software vendors, requires an ADA license with annual royalties. — [ADA: Licensing for commercial users](https://www.ada.org/en/publications/ada-store-products/licensing-for-commercial-users); [CMS ADA Terms & Conditions](https://www.cms.gov/Outreach-and-Education/Medicare-Learning-Network-MLN/MLNEdWebGuide/Downloads/ADA-Terms-Conditions.pdf)
- Open Dental's ADA license covers US distribution only. Countries outside its list "must arrange their own purchase of CDT codes". — [Open Dental: ADA CDT Codes](https://opendental.com/manual/cdt.html); [Open Dental: Regional Licensing Issues](https://opendental.com/site/caribbean.html)
- The ADA states that CDT is its intellectual property and a source of revenue. — [ADA News 2023: CDT is ADA intellectual property](https://adanews.ada.org/ada-news/2023/may/cdt-is-ada-intellectual-property-source-of-revenue-for-association/)
- Treating dental services as tenant-defined service items with a default price that can be changed on the invoice is the approach of Arab accounting tools aimed at dental clinics. — [Qoyod: dental clinics (Jordan)](https://www.qoyod.com/en/fields/accounting-software-for-dental-clinics-jordan/)

**Installments, balances and deposits**
- In a Saudi (Jeddah) orthodontic price guide, the clinic takes a down payment at bonding (example: 1,000–1,500 SAR), and the rest is split into monthly installments (300–500 SAR) paid at each monthly adjustment visit. The guide advises asking for a comprehensive quote covering exam, file opening, X-rays and adjustments. This is a commercial clinic site, so the figures are indicative. — [Capsulaa: orthodontic prices in Jeddah 2026](https://www.capsulaa.sa/saudi-arabia-services/أسعار-تقويم-الأسنان-في-جدة-السعودية/)
- In-house monthly plans paid directly to the practice, often interest-free, are common for braces, sometimes with a discount for paying in full. — [Cherry: braces payment plans](https://withcherry.com/blog/braces-payment-plan); [Norwest Orthodontics: interest-free payment plans](https://norwestortho.com.au/interest-free-payment-plans/)
- Qoyod's dental guide (Saudi) lists installment billing on long-cycle cases as a core need. Its Jordan page describes a per-patient running balance across sessions, with partial payments recorded against a credit invoice and the remaining balance shown in the customer statement and ageing report. — [Qoyod: dental clinics](https://www.qoyod.com/en/fields/accounting-software-for-dental-clinics/); [Qoyod: dental clinics Jordan](https://www.qoyod.com/en/fields/accounting-software-for-dental-clinics-jordan/)
- None of the Arabic-market products surfaced in searches (Dentee, Daftra, Practice-Web listings, CyberTooth, Smart Dentist, Dentolize) clearly documents a patient installment-plan feature. CyberTooth tracks payments and balances but does not mention installments. — [CyberTooth features](https://cybertooth-website.pages.dev/features); [Dentolize features](https://dentolize.com/our-feature/); [Smart Dentist App Store](https://apps.apple.com/app/id1504745286)

**Syrian pricing context** (search-snippet level; the pages returned HTTP 403 on fetch, so the exact article-to-claim mapping is unverified)
- Enab Baladi (2023) reported that some Syrian dentists set fees in lira but calculate them against the dollar exchange rate. The same reporting gave a single molar treatment at about 250,000 to 1.5 million SYP, root canal treatment at about 200,000 SYP, extraction at about 70,000 SYP, and implants up to about 2.5 million SYP (old-currency figures). — [Enab Baladi: dental treatment bills in Syria](https://www.enabbaladi.net/658943/)
- The official dental fee schedule dates from 2014 and was reported as unrealistic. Examination fees in 2025 ranged from 200,000 to 600,000 SYP depending on location and reputation. — [Enab Baladi: syndicate studies raising fees](https://www.enabbaladi.net/491411/); [Enab Baladi: examination fees](https://www.enabbaladi.net/725289/أجور-المعاينات-تزيد-أوجاع-المرضى-بحل/)

### Inferences
- **MVP: treatment plan**
  - Multiple plans per patient (main plus alternatives).
  - Each item holds tooth/teeth, surfaces, procedure, a price snapshot, an item discount (amount or %), the phase (Phase 1 urgent / 2 restorative / 3 prosthetic / custom) and a status: `proposed → accepted → scheduled → completed`, or `declined` / `cancelled`.
  - Plan-level discount, plan currency, a printable Arabic quotation (PDF) and acceptance capture (accepted-by, date, on-screen signature or a "verbal accepted" checkbox).
  - "Complete" on an item creates the chart entry and the charge in one action.
  - Freeze a saved or accepted version, because prices change with the exchange rate.
- **MVP: procedure catalog.** Do not use CDT (US-only license; royalties). Ship a seeded, tenant-editable catalog:
  - Fields: `internal_code` (e.g. `RES-COMP-2S`), `name_ar`, `name_en`, `category`, `treatment_area` (mouth / arch / quadrant / tooth / surface / range / root), `surfaces_required` (0–5, or variable), `chart_symbol` (filling / crown / RCT / extraction / implant / pontic / missing / sealant / veneer / denture / none), `default_price` per currency or per price list, `requires_lab` (bool), `default_duration_min`, `active`.
  - Starter categories (~40–60 items): Diagnostics (exam, consultation, periapical X-ray, panoramic referral); Preventive (scaling & polishing, fluoride, sealant); Restorative (composite 1–4+ surfaces, amalgam, GIC, temporary filling); Endodontics (RCT per canal-count bands: anterior/premolar/molar, retreatment, pulpotomy, pulpectomy for primary teeth); Surgery (simple extraction, surgical extraction, impacted 3rd molar, incision & drainage); Prosthodontics (crowns by material, post & core, bridge unit, veneer, complete denture, partial denture, repair); Implants (implant placement, abutment, implant crown, bone graft, sinus lift); Periodontics (deep scaling/root planing per quadrant, gingivectomy); Orthodontics (ortho package fixed/clear, monthly adjustment, retainer); Pediatric (stainless steel crown, space maintainer); Cosmetic (whitening).
  - Price lists: multiple named lists per tenant (e.g. "Standard USD", "Standard TRY"), assignable per branch. This is MVP because Aleppo branches might price in SYP/USD while Azaz prices in TRY (inference; the market currency split is for the payments researcher to confirm).
- **MVP: balances, deposits, installments**
  - A per-patient ledger by currency. Charges come from completed procedures; payments, deposits (unapplied credit) and refunds are separate entries.
  - An installment schedule attached to a plan (down payment + N installments, due dates, amounts). It drives "due today" lists at check-in.
  - No interest or late fees in v1 (inference based on the interest-free in-house norm above).
  - Exchange-rate snapshot on every payment if payment currency ≠ charge currency.
  - Balance shown on the appointment card and at check-in.
- **v2:** plan templates (e.g. "Implant single tooth package"), patient e-sign or approval from a phone link (the Dentolize pattern), plan comparison or alternatives printout, fee-schedule mass update (e.g. re-pricing after an FX move), case-acceptance tracking by dentist.
- **LATER:** insurance estimates and claims (insurance plays little role in the Syrian context; inference), CDT/SNODENT mapping if the product ever enters licensed markets.

### Gaps
- No source on how Aleppo/Azaz clinics specifically structure installments, deposits or currency for implants and crowns. The Saudi ortho pattern is the closest documented proxy.
- No Syrian syndicate fee schedule in machine-readable form, and the official schedule is reported outdated.
- The Enab Baladi figures are pre-redenomination SYP and could not be fetched directly to confirm the exact article attribution.

---

## 4. Dental lab work orders

### Takeaway
Every reference product tracks lab work as a "case" linked to the patient, the tooth or plan item, and the fitting appointment. The case moves through Created → Sent → Received (→ Quality-checked / Fitted), has a due date computed from lab turnaround, and raises an overdue flag before the fitting. Regional products add the lab fee per case and lab supplier balances. MVP-worthy, because lab cost feeds dentist commission.

### Cited Findings
- Open Dental lab case: the lab is chosen from a Laboratory Setup with services and turnaround times, which compute "Date Time Due" (it can also be typed by hand). Tracking statuses are Created, Sent, Received and Quality Checked, each with a date/time (a "Now" button). The case is attached to an appointment so staff can see whether it is ready. — [Open Dental: Lab Case Edit](https://opendental.com/manual/labcaseedit.html); [Open Dental: Lab Cases workflow](https://opendental.com/help254/workflowlabcases.html)
- Dentally (minimal pattern): an appointment-level "Lab work" field with None required / Sent (amber) / Received (green) / Overdue (red, usually flagged 1–2 days before the fitting), a beaker icon on the appointment, and a lab-work column and filter in the appointments report. — [Dentally Help: lab status](https://help.dentally.com/en/articles/10205410-how-to-use-lab-status-to-track-lab-work)
- Dentolize Labs: orders are raised from the treatment plan or chart, carrying patient, tooth, shade and procedure, plus material, instructions and attachments (scans, photos, prescriptions). Each lab has its own price list and turnaround. Statuses are open, due this week, overdue, received and fitted. The lab fee is recorded per case and per supplier and linked to the invoice. Lab spend is reportable by branch and procedure, with supplier statements and outstanding balances. Dentolize's search snippet also mentions filtering by treating doctor. — [Dentolize Labs](https://dentolize.com/labs/)
- CyberTooth lab orders carry patient, doctor, lab, procedure, total cost, amount paid and done status, and open orders and dues are visible. — [CyberTooth features](https://cybertooth-website.pages.dev/features)
- CareStack's lab case report includes sent date, due date and received date. — [CareStack: lab case management](https://carestack.com/dental-software/features/lab-case-management)
- Qoyod (accounting-side) records the dental lab as a supplier and its invoice as a purchase invoice, but "does not spread the lab invoice over each treatment or patient". That per-case cost link is the gap a clinical PMS fills. — [Qoyod: dental clinics Jordan](https://www.qoyod.com/en/fields/accounting-software-for-dental-clinics-jordan/)

### Inferences
- **MVP lab case fields:**
  - `lab_id` (supplier), `patient_id`, `dentist_id`, `branch_id`, linked plan item(s) / teeth (FDI list), `work_type` (from catalog), `material`, `shade` (free text, e.g. VITA A2), `instructions`, attachments.
  - `sent_at`, `due_at`, `received_at`, `fitted_at`, `status` (draft / sent / received / fitted / returned-for-remake / cancelled), `fitting_appointment_id`.
  - `lab_cost` + `currency`, `paid_amount`.
- **MVP behaviors:** overdue badge on the fitting appointment, a "cases due this week" list, a lab supplier ledger (what we owe each lab, payments to the lab), and per-case lab cost available for the dentist commission deduction (section 9).
- **v2:** lab price lists and turnaround per lab (auto due date), remake tracking, lab statement reconciliation, QR or shareable lab slip.
- **LATER:** lab portal (labs update status themselves), digital scan (STL) transfer to labs.

### Gaps
- No regional source on how Syrian clinics pay labs: per case in cash or a monthly account, and in which currency.
- I did not find whether Syrian labs commonly work with written prescriptions (lab slips) or WhatsApp photos. Field validation is needed.

---

## 5. Imaging: periapical/panoramic X-rays and intraoral photos

### Takeaway
Practice-management systems normally "bridge" to the imaging software that comes with the sensor rather than replacing it. Capture runs through TWAIN or vendor-direct integrations, and DICOM matters mainly for export and portability. For a cloud MVP, attaching JPEG/PNG/PDF/DICOM files per patient, tagged with tooth number(s), visit and image type, is sufficient. A web DICOM viewer and sensor bridges are later.

### Cited Findings
- An imaging "bridge" opens the imaging program on the patient already open in the PMS. ClearDent notes that it cannot convert systems that lack such a bridge. — [ClearDent: digital imaging integrations](https://www.cleardent.com/dental-software/digital-imaging-integrations/)
- TWAIN is a generic route for sensors to talk to software and is "usually more than adequate". Not all intraoral sensors have TWAIN drivers, while essentially every digital panoramic unit uses TWAIN. Many intraoral cameras have direct integrations instead. — [Dental Products Report: Imaging Software 101](https://www.dentalproductsreport.com/view/imaging-software-101); [DentiMax: TWAIN drivers](https://dentimax.com/twain-drivers)
- For portability, the key question is whether every radiograph, CBCT included, can be exported as DICOM with patient data attached. ADA Technical Report 1023 covers DICOM in dentistry. Intraoral scanners produce STL/PLY meshes rather than DICOM. — [Mindbowser: cloud dental imaging (sensors, bridges, DICOM)](https://www.mindbowser.com/cloud-dental-imaging-software/)
- Vendors such as Carestream support DICOM and JPEG import/export, and TigerView claims DICOM 3.0 compliance. — [Dental Products Report: Imaging Software 101](https://www.dentalproductsreport.com/view/imaging-software-101)
- Regional products store X-rays and signed consent forms on the patient record (CyberTooth) and attach scans and photos to lab orders (Dentolize). — [CyberTooth features](https://cybertooth-website.pages.dev/features); [Dentolize Labs](https://dentolize.com/labs/)
- Open Dental can save a snapshot of the tooth chart into its Imaging module image category. — [Open Dental: Graphical Tooth Chart](https://opendental.com/manual/graphicaltoothchart.html)

### Inferences
- **MVP:**
  - Upload from desktop or phone camera, including direct camera capture on a phone or tablet for intraoral photos and for photographing a film or monitor X-ray, which is common in low-resource clinics (inference).
  - Accept JPEG/PNG/PDF, and store .dcm as a file, previewing it only where the browser can.
  - Tag each image with type (periapical, bitewing, panoramic, CBCT report, intraoral photo, extraoral photo, document), tooth list (FDI), date and appointment/visit.
  - Show image thumbnails in the per-tooth history.
  - Basic viewer with zoom, rotate and brightness/contrast. Brightness and contrast matter for X-rays.
  - Per-tenant storage quotas, with images compressed to a sane size.
- **v2:** a "watch folder" desktop agent that picks up exports from the sensor software and auto-attaches them to the open patient (a light bridge), DICOM rendering in a web viewer (e.g. Cornerstone/OHIF-class), image comparison (before/after), a full-mouth series template layout.
- **LATER:** TWAIN capture from the browser via a local agent, direct bridges to specific sensor vendors, CBCT viewing, STL viewer, AI caries detection.

### Gaps
- No data on which sensor or panoramic brands dominate in Aleppo/Azaz, or whether clinics mostly hold scanned film, sensor exports or phone photos of X-rays.
- Not verified: the specific export formats of the cheap sensors common in the region (often Chinese-made). These typically export JPEG/BMP/DICOM via their bundled software, but that is unverified.

---

## 6. Dental medical history questionnaire and consent forms (minimal MVP set)

### Takeaway
Dental health-history forms consistently ask about anticoagulants and antiplatelets, bisphosphonates (oral vs IV, as an osteonecrosis risk), pregnancy and nursing, and allergies (local anesthetic, penicillin and other antibiotics, aspirin/NSAIDs, latex, sulfa, metals). Consent is expected for surgical and operative procedures and anesthesia, with separate procedure-specific forms for extraction, root canal and implants. A short structured questionnaire that drives alert flags, plus 4–5 consent templates with signature capture, is the MVP.

### Cited Findings
- The ADA-style Health History form asks about IV bisphosphonates (e.g. Aredia, Zometa), past or scheduled. The University of Washington DECOD questionnaire lists oral bisphosphonates (Fosamax, Boniva, Actonel). — [ADA-style health history (Officite)](https://my.officite.com/0028827/storage/app/media/health-history.pdf); [UW DECOD Health History](https://dental.washington.edu/wp-content/media/patient/DECODHealthHistory.pdf)
- Forms ask about blood thinners (Plavix, Coumadin, warfarin, aspirin), and some ask separately about aspirin/NSAIDs. — [Storrs Endo/Perio medical history](https://assets.doctorlogic.com/Images/Sites/A/ADMStorrsEndoPerio/Document/5734.pdf); [Health history form (Officite)](https://my.officite.com/0092159/storage/app/media/Docs/health-history-form.pdf)
- A "women only" section covers pregnancy, nursing and oral contraceptives. — [LSU Medical-Dental Questionnaire](https://www.lsusd.lsuhsc.edu/Documents/2019-02%20MDQ%20secure.pdf)
- Allergy categories: local anesthetics, penicillin or other antibiotics, aspirin, latex, sulfa drugs and metals, each with a description of the reaction. — [Storrs Endo/Perio medical history](https://assets.doctorlogic.com/Images/Sites/A/ADMStorrsEndoPerio/Document/5734.pdf)
- Pennsylvania Dental Association: any procedure that is surgical or operative, including the administration of anesthesia, requires informed consent (examples: root canals, extractions, implants). — [PDA Informed Consent QuickTips 2021](https://www.padental.org/docs/website/advocacy/sbod/Informed_Consent_QuickTips_2021.pdf)
- Typical form contents. Extraction forms list alternatives (e.g. root canal therapy) and record the patient's choice, and vendors recommend a separate extraction consent because of higher surgical risk (nerve damage, bone loss). Implant forms cover the nature of the surgery, risks, benefits, alternatives and follow-up. Root canal forms state that results are not guaranteed, that retreatment, surgery or extraction may be needed, and whether specialist referral was offered. — [PDA endodontic consent form](https://padental.org/Images/OnlineDocs/ResourcesPrograms/Practice%20Management/ConsentFormEndodontic.pdf); [Paperform extraction consent template](https://paperform.co/templates/dental-extraction-consent-form.md); [BoomCloud: extraction consent](https://boomcloudapps.com/informed-consent-and-permission-form-extractions)
- Regional vendors list "Consent Forms" (Dentolize) and stored signed consents (CyberTooth). — [Dentolize features](https://dentolize.com/our-feature/); [CyberTooth features](https://cybertooth-website.pages.dev/features)

### Inferences
- **MVP medical history.** Versioned, with "reviewed on" date and by whom, and re-confirmation prompted at each new course of treatment. About 20 structured questions, each yes/no with a details field:
  - Medications and conditions: anticoagulant/antiplatelet (warfarin, clopidogrel, aspirin, DOACs); bisphosphonates or antiresorptives (oral/IV); diabetes (controlled? HbA1c optional); hypertension; cardiac disease, prosthetic valve or prior endocarditis (antibiotic prophylaxis flag); bleeding disorder; hepatitis B/C or HIV (infection-control flag); epilepsy; asthma; kidney or liver disease; current cancer therapy or head-and-neck radiation; steroids; smoking.
  - Allergies: local anesthetic, penicillin, other antibiotics, NSAIDs/aspirin, latex, other.
  - Women: pregnancy (weeks) and breastfeeding.
  - Current medications free text, and emergency contact.
- **MVP alert flags.** Derived from the answers and shown as red chips at check-in and on the chart header and prescription screen: Anticoagulant, Bisphosphonate, Diabetes, Pregnant, Allergy-Penicillin, Allergy-LA, Cardiac/prophylaxis, Infectious.
- **MVP consent templates** (Arabic, editable per tenant, signed on tablet or printed and scanned): general treatment consent, local anesthesia, extraction/oral surgery, root canal treatment, implant surgery, plus an ortho financial and treatment agreement (installments, duration, retention). Store the template version and a signed snapshot (PDF) with timestamp and signer.
- **v2:** patient self-fill via phone link or QR before the visit (Dentolize offers QR codes), prescription-time drug-allergy cross-checks, a structured ASA classification.
- **LATER:** coded problem lists (SNODENT/ICD), interaction checking against a drug database.

### Gaps
- Not verified: diabetes appearing on the specific forms fetched. Diabetes is standard dental history content but was not explicitly confirmed in the retrieved snippets.
- No Syrian legal requirement for dental consent content was found, and no Syrian Dental Syndicate template was located.

---

## 7. Dental prescriptions: drugs to seed quick templates

### Takeaway
Across studies, the core dental prescribing set is consistent: amoxicillin (± clavulanate) as the dominant antibiotic, ibuprofen as the dominant NSAID, paracetamol, and chlorhexidine mouthwash. Ten to twelve quick templates cover most use.

### Cited Findings
- In a systematic review of 24 studies on dentists' antibiotic prescribing, amoxicillin was the most frequent antibacterial (23/24 studies), followed by amoxicillin/clavulanic acid (15/24). Ibuprofen was the most frequent NSAID (6/7 studies). Amoxicillin prescribing rates ranged from 12.5% in Croatia to 95% in Canada. The review flags empirical amoxicillin/clavulanate use as possibly inappropriate. — [Dentists' prescription patterns of NSAIDs and antibiotics: systematic review](https://opact.sdu.edu.tr/vufind/SummonRecord/FETCH-LOGICAL-c314t-c7ddbb426aaca91b5df4b448e5c8239c137cd2a3875577fd520edede29bb235b3)
- A Nepal survey of 70 dentists found that the first-choice antibiotic, analgesic and antiseptic were amoxicillin, ibuprofen and chlorhexidine respectively. — [Asian Journal of Medical Sciences (NepJOL)](https://nepjol.info/index.php/AJMS/article/view/8062/6841)
- An Oman dental clinic audit (Jan–Jun 2018) found chlorhexidine mouthwash the most prescribed (37.1%), then paracetamol (31.0%), ibuprofen (8.6%) and amoxicillin/clavulanate (4.3%). 65% of patients received no drug. — [Oman Medical Journal 2020](https://omjournal.org/PDF/OS-OMJ-D-19-00142%20(05C)_Final.pdf); [Nizwa University summary](https://nu.edu.om/blog/drug-prescribing-practices-in-dental-care-patients-at-a-dental-and-maxillofacial-surgery-clinic-in-oman)
- A Kerman (Iran) study reported amoxicillin in 60.5% of general dentists' prescriptions and ibuprofen derivatives in 55.4% (search-summary level; source page not fetched). — [SciELO (Pesquisa Brasileira em Odontopediatria)](https://old.scielo.br/j/pboci/a/YWMV7d7WYTvzJ9ycsmpZvTm/?lang=en)

### Inferences
- **MVP prescription module:**
  - Print an Arabic/English Rx with clinic header, patient name/age, date, dentist, and drug lines (name, strength, form, dose, frequency, duration, instructions). Add a free-text option.
  - Per-tenant favorite templates, with allergy and pregnancy alerts displayed (no automated interaction check).
- **Seed templates** (drug classes from the findings; doses are standard adult regimens the clinic must review; doses are not sourced here):
  1. Amoxicillin 500 mg caps
  2. Amoxicillin/clavulanate 625 mg or 1 g tabs
  3. Ibuprofen 400 mg / 600 mg
  4. Paracetamol 500 mg
  5. Chlorhexidine 0.12% mouthwash
  6. Paracetamol + ibuprofen combination regimen
  7. Pediatric amoxicillin suspension
  8. Pediatric paracetamol / ibuprofen suspension
  9. Clindamycin (penicillin-allergic alternative)
  10. Metronidazole (often combined)
  11. Diclofenac / nimesulide (locally common NSAIDs)
  12. Benzydamine mouthwash and topical gels
  13. Post-extraction "after-care" instruction sheet
- **v2:** a local Syrian/Turkish brand-name drug list mapped to generics (Azaz clinics likely see Turkish brands; inference), Rx history per patient, repeat-last-Rx.
- **LATER:** drug-interaction and allergy cross-checks against a licensed drug database, e-prescribing (no Syrian e-Rx infrastructure is known).

### Gaps
- Not verified in this research: clindamycin, metronidazole, diclofenac and benzydamine as locally common choices. They are included as plausible template candidates, not sourced findings.
- No Syria-specific dental prescribing study was found, and no list of locally available brand names.

---

## 8. Reports a dental clinic owner needs from day one

### Takeaway
Industry KPI guidance converges on a small core: daily production per dentist, collections versus production, outstanding balances (ageing), case acceptance (accepted ÷ presented plans) by dentist, chair/schedule utilization and no-shows. Production alone is misleading without collections. In a cash, multi-currency setting, the most important day-one report is the end-of-day cash report per cashbox and per currency.

### Cited Findings
- Curve Dental's daily view covers chair utilization, same-day production against goal, and no-shows and late cancellations; production per provider is reviewed weekly. "High production per provider means your schedule is busy, not necessarily that the practice is financially healthy. Pair it with collections." — [Curve Dental: dental metrics explained](https://www.curvedental.com/dental-blog/dental-metrics-explained-what-each-one-measures-what-it-misses-and-when-to-review-it)
- Denticon's formulas: average daily production per provider = month-to-date net production ÷ provider working days. Case acceptance % = accepted, scheduled or completed plans ÷ all plans × 100. — [Planet DDS: Denticon Practice Analytics dashboards](https://support.planetdds.com/hc/en-us/articles/49789717199771-Understanding-the-Denticon-Practice-Analytics-Dashboards-A-Complete-Guide-to-Metrics-and-Reports)
- Dentrix Ascend recommends breaking case acceptance down by provider, procedure type, treatment coordinator and location. Strong net production with lagging collections points to billing or payment follow-up problems. — [Dentrix Ascend: KPIs for office managers](https://www.dentrixascend.com/insights/blogs/dental-practice-kpis-office-managers/)
- Collections rate = collected ÷ produced, and there is no universal acceptance benchmark, so the trend matters more than the absolute number. — [Sunbit: office manager KPIs](https://sunbit.com/?p=267036)
- A practice-management source attributes a commonly used 75–80% case-acceptance target to the ADA, but I could not confirm this on the ADA page. — [ADA: Measuring Success](https://www.ada.org/resources/practice/practice-management/measuring-success20160428t155202) (not verified)
- Patient balances are tracked with customer statements and an ageing report. — [Qoyod: dental clinics Jordan](https://www.qoyod.com/en/fields/accounting-software-for-dental-clinics-jordan/)
- Regional products advertise a "Dynamic Dashboard", "Quick Reports", "Analytics" and "Treasury" (Dentolize). CyberTooth has cash, bank and card wallets, with expenses deducted from the wallet that paid them and per-branch reports. — [Dentolize features](https://dentolize.com/our-feature/); [CyberTooth features](https://cybertooth-website.pages.dev/features)
- Overall cost structure (US data): costs typically consume 58–68% of collections, and well-run practices keep a 35–42% profit margin. — [NetSuite: dental practice profitability](https://www.netsuite.com/portal/resource/articles/financial-management/dental-practice-profitability.shtml)

### Inferences
- **MVP reports** (filterable by branch, dentist, date range; every money figure split by currency, never auto-summed across currencies unless the user picks a conversion rate):
  1. **Daily cash close:** opening balance, receipts, refunds, expenses, closing balance per cashbox per currency, with each receptionist's collections.
  2. **Production by dentist:** completed procedures × price, by date range.
  3. **Collections by dentist:** payments allocated to that dentist's procedures.
  4. **Outstanding balances / ageing:** patients owing, by currency, with last payment date and the installments overdue.
  5. **Installments due:** due today, due this week, overdue.
  6. **Treatment plan acceptance:** proposed vs accepted vs completed value per dentist.
  7. **Appointments:** count, no-shows, cancellations, walk-ins.
  8. **Lab cases:** open, overdue, lab cost by lab, payable to each lab.
  9. **Dentist commission statement:** see section 9.
  10. **Expenses by category.**
- **v2:** chair utilization %, procedure mix, new patients per month, recall effectiveness, owner dashboard on mobile, export to Excel.
- **LATER:** benchmarking across tenants, P&L with depreciation, inventory consumption cost per procedure.

### Gaps
- No Middle East or Syria benchmarks for case acceptance, production or collections.
- The 75–80% case-acceptance target is unverified against its claimed ADA origin.

---

## 9. Multi-dentist clinics: commission and percentage splits, lab-cost deductions

### Takeaway
Associate dentists are commonly paid a percentage of what they collect or produce, typically 30–35% and ranging from 24% to 40%. Lab fees are deducted in full or in proportion before or after applying the percentage, and the base (gross vs net, collections vs production) has to be explicit. I found no published Arabic or Syrian source on local split norms, but regional software sells "Payroll & Commissions" and per-doctor revenue shares. The MVP needs a configurable per-dentist rule and a monthly statement.

### Cited Findings
- Most associates are offered 35% of collections. Some are offered "35% of collections less 35% of their lab fees", which nets about 33% of collections. — [Dental Economics: options for associate compensation](https://www.dentaleconomics.com/practice/article/14074431/options-for-associate-compensation)
- A consultant describes ~35% of collections minus the lab bill as common. Backing out the lab first makes a 35% rate an effective ~31.5%. — [Bulletproof Dental Practice: associate pay structure](https://www.bulletproofdentalpractice.com/associate-dentist-pay-structure/)
- Associate percentages range from 24% to 40% of collections, and 30% is the most frequent. The 40% figures often subtract lab and other expenses first. — [Dental Economics Transitions Roundtable](https://www.dentaleconomics.com/practice/article/14222484/transitions-roundtable-whats-a-fair-compensation-package-for-a-general-dentist-associate)
- Practitioner forums report that lab-fee deduction is standard but the method varies. Making the associate pay the full lab bill is called unusual. — [Student Doctor Network: lab fees and income structure](https://forums.studentdoctor.net/threads/lab-fees-and-income-structure-as-associate.1428919)
- Recruiters advise clarifying whether lab fees come off gross or net, and off collections or production. — [Henry Schein: associate employment agreement](https://dentalrecruitmentservices.henryschein.com/blog/creating-a-successful-associate-employment-agreement/)
- The ADA notes that associate compensation may be based on production or collections. — [ADA: compensation as an employee or associate dentist](https://www.ada.org/resources/careers/compensation-as-an-employee-or-associate-dentist)
- Dentolize lists "Payroll & Commissions". Its labs page links lab cost to the case, the invoice and the branch, and a search snippet mentions filtering lab cost by treating doctor. — [Dentolize features](https://dentolize.com/our-feature/); [Dentolize Labs](https://dentolize.com/labs/)
- CyberTooth was described in a search snippet as calculating "the share of revenue each doctor generates" for compensation, but the fetched features page does not mention a doctor-percentage feature (conflict). — [CyberTooth features](https://cybertooth-website.pages.dev/features)
- A Saudi press article says dentist income depends on operating cost, specialty and clinic equipment, but gives no standard split. — [Al Watan (Saudi)](https://www.alwatan.com.sa/article/1041688)

### Inferences
- **MVP commission engine.** A per-dentist rule, effective-dated:
  - `basis`: collections (default for cash clinics) | production
  - `percentage` (global), optionally overridden per procedure category (e.g. implants 40%, ortho 50%)
  - `lab_deduction`: none | full | proportional (same % as the dentist's share)
  - `material_deduction`: none | fixed per procedure (v2)
  - Optional fixed monthly salary, plus percentage, for employed dentists.
  - A monthly statement per dentist and currency: collections (or production) by patient and procedure, minus lab costs, × %, = payable. Payouts are recorded and the statement locked.
- **Owner-dentist case:** a solo owner simply has no commission rule, so the feature stays invisible for solo clinics.
- Collections-based attribution requires every payment to be allocated to procedures, and through them to a dentist. FIFO allocation to the oldest unpaid completed procedure is a sensible default, with manual override. This is a core data-model decision for the MVP.
- **v2:** per-procedure-category rates, assistant commissions, specialist (visiting) dentist splits with per-visit fees, material cost deduction.
- **LATER:** full payroll (attendance, leave).

### Gaps
- No Arabic or Syrian source on typical local percentage splits (e.g. whether 30%, 40% or 50% after lab is common in Aleppo). The figures above are US practitioner and trade sources. Local interviews are required.
- How regional software computes commissions (collections vs production basis, lab handling) is undocumented in the sources found.

---

## 10. What leading Arab and Middle East dental software offers, and what users complain about

### Takeaway
Regional products (Dentolize, CyberTooth, Smart Dentist, Nabd, Dentronix, Dentiflow, DentaLore, plus Arabic ERPs Daftra and Qoyod) converge on the following:
- Arabic RTL, odontogram, multi-branch, labs with cost, treasury/wallets, consent forms, WhatsApp, mobile apps.
- Saudi-oriented products add ZATCA e-invoicing and NPHIES insurance. These are irrelevant in Syria and therefore not competitive moats there.

What is notably *not* documented anywhere in the material found:
- multi-currency cash handling;
- patient installment schedules.

That is an opening for a Syria-focused product. Independent negative reviews are scarce. The usability literature points to learning curve, status confusion and icon hunting as the main pain points.

### Cited Findings
- **Dentolize:**
  - Modules: Dynamic Dashboard, Patient Profile, Dental Chart, Patient Journey, Dental CRM, WhatsApp Bot, Automation, Loyalty Program, Patient Feedback, Finance, Treasury, Online Payments, Quotations, Insurance Management, ZATCA E-Invoicing, NPHIES, Payroll & Commissions, Inventory, Labs, QR Codes, Consent Forms, Tasks, Mobile App, Analytics, Quick Reports, Patient Map, Team Management, Security, Integrations, Logs.
  - The page mentions no installments, multi-currency or explicit multi-branch feature. — [Dentolize features](https://dentolize.com/our-feature/)
  - Listed from $50 (Slashdot). Capterra rating 4.4 from only 5 reviews. Reviewers praise multi-branch handling and finance, and the vendor helped migrate data from old software. — [Slashdot: Dentolize](https://slashdot.org/software/p/Dentolize); [SourceForge: Dentolize](https://sourceforge.net/software/product/Dentolize); [Capterra UK: Dentolize](https://www.capterra.co.uk/software/1045474/dentolize)
- **CyberTooth:**
  - Cash, bank and card-terminal wallets with automatic card-fee deduction, and expenses paid from wallets.
  - Inventory in "servings", deducted FIFO by expiry when a procedure is recorded.
  - Insurance approvals.
  - Chart by tooth, surface and canal for permanent, primary and mixed dentition.
  - Labs with cost and amount paid.
  - Multi-branch with per-branch wallets, stock, calendars and permissions.
  - Native iOS and Android with Arabic RTL.
  - Multi-currency and installments are not mentioned, and the vendor's country is not stated. — [CyberTooth features](https://cybertooth-website.pages.dev/features)
- **Smart Dentist (Zaatar Labs):**
  - Arabic with full RTL and Arabic-Indic digits.
  - 3D chart and full perio charting.
  - Multi-doctor filtering of reports.
  - 4.9/5 from 61 App Store ratings.
  - No currency, installment, prescription or lab features listed.
  - The only visible user ask was to email performed treatment to patients. — [Smart Dentist App Store](https://apps.apple.com/app/id1504745286)
- **Nabd (NabdMS):** desktop on-premise, Arabic/English, interactive odontogram, "no subscriptions", aimed at clinics wanting local data. — [NabdMS: on-premise practice management](https://practice-management.pages.dev/en/)
- **Dentronix:** lists Arabic support and a one-click odontogram. Dentiflow (Lebanese) lists Egypt and Jordan. DentaLore (Nebras Technology) lists Egypt. — [Capterra UAE: Dentronix](https://www.capterra.ae/software/1097553/Dentronix); [Capterra UAE: Dentiflow](https://www.capterra.ae/software/183516/dentiflow); [Capterra UAE: DentaLore](https://www.capterra.ae/software/169865/dentalore)
- **Daftra** (Arabic ERP) markets a dental-clinic edition with patient history and e-invoices. **Qoyod** is accounting-only and states that it does not handle appointments, medical files or treatment plans. — [Daftra dental clinics](https://www.daftra.com/%D8%A8%D8%B1%D9%86%D8%A7%D9%85%D8%AC-%D8%A5%D8%AF%D8%A7%D8%B1%D8%A9-%D8%B9%D9%8A%D8%A7%D8%AF%D8%A7%D8%AA-%D8%A7%D9%84%D8%A3%D8%B3%D9%86%D8%A7%D9%86); [Qoyod: dental clinics Jordan](https://www.qoyod.com/en/fields/accounting-software-for-dental-clinics-jordan/)
- **Odoo** has Arabic-capable dental and odontogram modules (generic ERP add-ons). — [Odoo: dzental module](https://apps.odoo.com/apps/modules/19.0/dzental); [Odoo: odontogram module](https://apps.odoo.com/apps/modules/18.0/odontogram)
- **Complaints found:**
  - ADSTRA users note support is remote-only. — [ZoftwareHub: ADSTRA reviews](https://zoftwarehub.com/ar-ae/products/adstra-dental-software-suite/reviews)
  - Dental EHRs in general show significant novice usability problems and a steep learning curve, and dentists most dislike usability and functionality. — [PMC2614265](https://pmc.ncbi.nlm.nih.gov/articles/PMC2614265)
  - Charting-status confusion and icon findability. — [Marshfield iTooth study](https://www.marshfieldresearch.org/srip/students/adam-sorenson)
- iDentalSoft's listing states no Arabic support. — [ZoftwareHub: iDentalSoft plans](https://zoftwarehub.com/products/identalsoft/plans)

### Inferences
- **Table stakes in the region (MVP):** Arabic RTL with correct FDI chart rendering in RTL (the chart must *not* mirror; the patient's right stays on the viewer's left by dental convention, an inference worth validating with dentists), multi-branch, lab cost tracking, consent forms, mobile and tablet usability.
- **Syria-specific differentiators** (none documented in competitors): three-currency cash ledger and cash close, installment schedules, exchange-rate snapshots, working on weak connectivity, low price point (Dentolize from ~$50; Syrian clinics are likely more price-sensitive, an inference).
- **Ignore for Syria:** ZATCA, NPHIES and insurance claims (Saudi-specific).
- **v2 parity items:** WhatsApp reminders, inventory with expiry, patient feedback, QR intake forms.

### Gaps
- **Clinicy:** no reliable information found (searches returned other products). "Tabeeb", "Dental Pro Arabic" and "DentalSoft/Dentsoft" (Turkish) were not located in the time available.
- **No Syrian dental software** was found in Arabic or English searches.
- **Turkish market products** were not researched. They are relevant for Azaz, where clinics may already use Turkish software; this needs follow-up, e.g. "diş hekimi yazılımı".
- **Independent reviews:** too few independent negative reviews of Arab dental software (Capterra pages for Dentolize returned 403). Arabic Facebook dentist groups could not be searched with the available tools.

---

## 11. Synthesis: consolidated MVP / v2 / LATER scope and data model

### Takeaway
The dental MVP has four parts: (1) an appointment book by dentist, chair and branch with a walk-in fast path; (2) an FDI odontogram with a small finding/procedure set, six statuses and per-tooth history; (3) phased, priced treatment plans that convert to completed procedures and charges; and (4) a multi-currency cash ledger with deposits, installments and daily cash close. Around these sit lab cases with cost, image attachments tagged by tooth, a medical-history alert system, Arabic consent and prescription templates, a per-dentist commission rule, and about ten owner reports. Everything else waits for v2 or later.

### Cited Findings
- The reference behaviors are sourced in sections 1–10. Key anchors:
  - statuses and treatment areas: [Open Dental Enter Treatment](https://opendental.com/manual/entertreatment.html)
  - plans and priorities: [Open Dental Treatment Plan](https://opendental.com/Manual/treatmentplan.html)
  - lab statuses: [Open Dental Lab Case](https://opendental.com/manual/labcaseedit.html), [Dentally lab status](https://help.dentally.com/en/articles/10205410-how-to-use-lab-status-to-track-lab-work)
  - CDT territory limit: [ADA licensing](https://www.ada.org/en/publications/ada-store-products/licensing-for-commercial-users)
  - installments pattern: [Capsulaa Jeddah ortho](https://www.capsulaa.sa/saudi-arabia-services/أسعار-تقويم-الأسنان-في-جدة-السعودية/)
  - commission norms: [Dental Economics](https://www.dentaleconomics.com/practice/article/14074431/options-for-associate-compensation)
  - KPIs: [Denticon analytics](https://support.planetdds.com/hc/en-us/articles/49789717199771-Understanding-the-Denticon-Practice-Analytics-Dashboards-A-Complete-Guide-to-Metrics-and-Reports)

### Inferences

**MVP (v1): must ship**

| Area | Scope | Justification |
|---|---|---|
| Tenancy & org | Tenant → Branches → Chairs. Users with roles (Owner, Dentist, Assistant, Receptionist, Accountant), branch-scoped permissions | Range from solo to multi-branch; regional competitors all have multi-branch |
| Patients | Shared across tenant branches. Arabic name fields, phone (WhatsApp number), DOB/age, gender, file number, referral source, medical alerts | Base of everything |
| Scheduling | Day/week view by dentist and by chair. Walk-in/emergency fast path. Statuses: booked, confirmed, arrived, in-chair, completed, no-show, cancelled. Planned items and lab flag on the appointment | Core daily loop (§1) |
| Odontogram | FDI 11–48 / 51–85, permanent/primary/mixed, surfaces M O/I D B/F L/P (+V), ~15 findings/procedures, 6 statuses with fixed colors, per-tooth history, base vs proposed layers, quick buttons, multi-tooth select | §2; usability evidence favors small sets and clear statuses |
| Clinical notes | Per-visit note (complaint, findings, treatment done, next step) linked to procedures; note templates | Legal record; minimal EMR |
| Treatment plans | Multiple plans, phases, item price snapshot, item and plan discounts, accept/decline per item, signature or "accepted" capture, Arabic printable quote, complete → charge | §3 |
| Catalog | Tenant-editable internal catalog (no CDT), seeded ~50 items, Arabic/English names, treatment area, chart symbol, price lists per currency | CDT license is US-only (§3) |
| Money | Patient ledger per currency, payments (cash default), deposits, refunds, FX snapshot, installment schedules, receipts (Arabic print), cashboxes per branch per currency, expenses, daily cash close | Cash, 3 currencies, long treatments (§3, §8) |
| Labs | Lab suppliers, lab cases (teeth, work type, shade, material, sent/due/received/fitted), overdue flag on appointment, lab cost per case, payable per lab | §4, and it feeds commissions |
| Imaging | Upload or capture images and PDFs, tag type, teeth and visit, simple viewer with brightness/contrast, per-tooth thumbnails | §5 |
| Medical history | Versioned questionnaire (~20 items) → alert chips | §6 |
| Consent | 5–6 Arabic templates, tablet signature, stored signed PDF | §6 |
| Prescriptions | Templates (~12), print Arabic/English, allergy/pregnancy banner | §7 |
| Commissions | Per-dentist rule (basis, %, lab deduction), monthly statement | §9 |
| Reports | Daily cash close, production and collections per dentist, balances/ageing, installments due, plan acceptance, appointments/no-shows, lab cases/payables, commission statement, expenses | §8 |
| Audit | Audit log on clinical and financial edits (who, when, before/after). No hard delete of completed procedures or payments; void with reason | Charts are legal records ([Open Exam Prep](https://open-exam-prep.com/study-guides/rda/assessment-and-diagnostic-records-diagnostic-tests-imaging-cbct-and-charting/charting-terminology-universal-and-palmer)); money integrity |

**v2: should have**
- WhatsApp reminders and confirmations, recall lists, waiting list.
- Full perio chart (6-point), canal-level endo details, chart-as-of-date slider.
- Plan templates, patient e-approval link, fee re-pricing tools.
- Lab price lists and turnaround, remakes, lab statements.
- Watch-folder imaging agent, web DICOM viewer, before/after compare.
- Patient self-fill of medical history via QR or link.
- Inventory (materials, expiry), material cost per procedure.
- Advanced commissions (per category, assistants, visiting specialists).
- Offline-first chairside mode.
- Excel export, mobile owner dashboard.

**LATER**
- Ortho clinical tracking (wires, aligner stages, cephalometrics).
- TWAIN or sensor bridges, CBCT and STL viewers, AI X-ray analysis.
- Patient portal or online booking, loyalty, CRM campaigns.
- Drug-interaction checking, coded diagnoses (SNODENT/ICD).
- Insurance or corporate billing (if Syrian insurers emerge), CDT mapping for licensed markets.
- Lab portal, full payroll, cross-tenant benchmarking.

**Core data-model sketch (MVP)**
- `tenant`, `branch` (default_currency, price_list_id), `chair` (branch_id, name), `user` (roles[], branch_ids[]), `dentist_profile` (user_id, specialty, color, commission_rule_id).
- `patient` (tenant_id, file_no, names_ar/en, phone, dob, gender, dentition_mode, notes), `medical_history_version` (patient_id, answers jsonb, reviewed_by, reviewed_at), `patient_alert` (derived: type, severity).
- `appointment` (branch_id, chair_id, dentist_id, patient_id, start, end, status, kind: planned/walk_in/emergency, chief_complaint, lab_case_id?), `appointment_item` → `treatment_plan_item`.
- `procedure_catalog_item` (internal_code, name_ar, name_en, category, treatment_area, surfaces_rule, chart_symbol, requires_lab, default_duration), `price_list` (currency) and `price_list_entry` (catalog_item_id, price).
- `tooth_record` (patient_id, tooth_fdi smallint, flags: missing/unerupted/primary_retained/supernumerary).
- `chart_entry` (patient_id, tooth_fdi[] or range, surfaces set, root/canal?, catalog_item_id or finding_code, status enum {planned, completed, existing_here, existing_other, referred, condition}, material, dentist_id, date_planned, date_completed, plan_item_id?, visit_note_id?, hidden bool).
- `treatment_plan` (patient_id, title, status: draft/presented/accepted/partial/declined/completed, currency, discount, accepted_at, accepted_by, signature_file, version_snapshot) and `treatment_plan_item` (plan_id, phase, chart_entry_id, unit_price, discount, status).
- `visit_note` (appointment_id, dentist_id, text, template_id).
- `charge` (patient_id, chart_entry_id, dentist_id, branch_id, amount, currency, date) and `payment` (patient_id, branch_id, cashbox_id, amount, currency, fx_rate_to_base?, method, received_by, kind: payment/deposit/refund), `payment_allocation` (payment_id, charge_id, amount). The allocation drives collections-based commissions.
- `installment_schedule` (plan_id, currency, down_payment) and `installment` (schedule_id, due_date, amount, status).
- `cashbox` (branch_id, currency), `cash_close` (cashbox_id, date, expected, counted, diff, closed_by), `expense` (branch_id, cashbox_id, category, amount, currency).
- `lab` (tenant_id, name, phone) and `lab_case` (patient_id, dentist_id, branch_id, lab_id, plan_item_ids[], teeth[], work_type, material, shade, instructions, sent_at, due_at, received_at, fitted_at, status, cost, currency, fitting_appointment_id), `lab_payment`.
- `attachment` (patient_id, type, teeth[], appointment_id?, taken_at, file_key, mime).
- `consent_template` (versioned) and `consent_signed` (patient_id, template_version, pdf_key, signed_at, signer_name).
- `rx_template` and `prescription` (patient_id, dentist_id, items jsonb, printed_at).
- `commission_rule` (dentist_id, basis, pct, lab_deduction_mode, effective_from) and `commission_statement` (dentist_id, period, currency, totals, locked).
- `audit_log` (entity, entity_id, action, before, after, user_id, at).

### Gaps
- Must be validated with Aleppo/Azaz dentists:
  - local commission norms;
  - installment and deposit conventions per treatment type;
  - which currency each branch prices in;
  - whether the receptionist or the dentist collects cash;
  - the device mix;
  - imaging sources (sensor, film scan, phone photo);
  - preference for Turkish vs Arabic drug brand names in Azaz.
- Not researched: Turkish-market dental software (relevant for Azaz), Clinicy, Tabeeb, and Syrian Dental Syndicate record-keeping or consent requirements.
