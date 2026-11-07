# MVP Scope Benchmark: Multi-tenant Clinic SaaS + Patient Booking App for Syria (Aleppo/Azaz), General + Dentistry + Orthopedics

Research date: 2026-11-07. Web research only. All facts carry an inline source. Vendor and company self-descriptions are marked as claims. Inferences are separated from facts.

---

## 1. Syrian competitors: what is the parity baseline?

### Takeaway
At least four Syrian players are live in 2026: Moadna (ع موعدنا), Roshtah (روشتة), Tabib SY (طبيب) and DoctorBook, plus the directory TibbFlow. All share a common baseline: a public doctor page, search by city and specialty, online booking, reminders, and a clinic-side schedule with patient records and invoices. The more advanced ones (Roshtah, Moadna) add a live queue and waiting-room screen, WhatsApp confirmation, e-prescriptions and doctor verification badges. No competitor clearly advertises family sub-profiles or a walk-in ticket queue. Those are open gaps the MVP can win on.

### Cited Findings

**Moadna (ع موعدنا), Damascus, founded 2025**
- A clinic-management and booking platform. Founders named in coverage: Tarek Skheta, Maged Hamdeh and a third, unnamed co-founder. It raised $50,000 from angels at a $300,000 valuation and went through the Thimar programme for Syrian startups. Clinic features listed: appointment management, patient records, medical visit management, billing, revenue and expenses, and patient communication — [Wamda, 17 Jun 2026](https://www.wamda.com/en/2026/06/syrian-healthtech-moadna-raises-50000-early-stage-funding)
- Traction in June 2026: more than 550 doctors/clinics/centres, more than 8,000 users and more than 3,500 appointments booked — [Wamda](https://www.wamda.com/en/2026/06/syrian-healthtech-moadna-raises-50000-early-stage-funding). By about August 2026: more than 12,000 registered users, 560 doctors and more than 4,500 appointments — [MENA Startup Digest](https://menastartupdigest.com/?p=48912). Founder-name spellings differ across outlets (e.g. "Tariq Shahta / Majed Hamdeh") — [search summary of Bridge/MSD coverage](https://bridgemena.com/news/moadna-raises-50-k-to-accelerate-health-tech-expansion)
- **Regulatory signal:** Moadna says it received Syria **Ministry of Health approval** after meeting regulatory and technical requirements, and calls itself "the first comprehensive platform focused on medical appointment booking and clinic management" to get it. It holds **temporary approval from the National Authority for Information Technology Services** while it completes final accreditation — [MENA Startup Digest](https://menastartupdigest.com/?p=48912)
- Doctor-side features on its "for doctors" page: multi-calendar scheduling (تقويم مواعيد متعدد), booking requests (طلبات حجز), patient files and visit records (ملفات مرضى وسجلات زيارات), invoices and expenses (فواتير ومصاريف), clinic inventory (مخزن العيادة), a **patient waiting-room display** (شاشة انتظار للمرضى), and a public doctor page showing specialties, prices, working hours and **patient reviews**, with online booking and **instant WhatsApp confirmation**. It says data is **hosted on servers inside Syria**. Clinics register free ("سجّل عيادتك مجاناً"). No pricing is published — [moadna.com/fordoctors](https://moadna.com/fordoctors)
- The public directory lists doctors by city: Damascus 203, Aleppo 107, Latakia 98, Hama 63, Rif Damascus 56, Homs 46, Tartus 32, Idlib 18, Daraa 17, Raqqa 10, Deir ez-Zor 7, Hasakah 5, Suwayda 4, Quneitra 1 (sum 667). It has 26 specialties. **Dentistry is by far the largest (290)**, followed by psychology (54) and cosmetic medicine (51). Orthopedics and orthopedic surgery are both listed — [moadna.com](https://moadna.com/)

**Roshtah (روشتة)**
- Patient-side features: each doctor has a page with a booking link and **QR code**; instant booking; **live queue tracking from the phone**; online consultation (chat/video); a medical record holding appointments, prescriptions and history; and reminders for appointments **and medication doses** — [Roshtah features guide, 13 Jun 2026](https://www.roshtah.com/blog/roshtah-app-features-guide)
- Clinic-side features: electronic queue, digital patient records, e-prescriptions, a branded doctor page, and a separate hospital product (HMS) with 32 modules — [Roshtah features guide](https://www.roshtah.com/blog/roshtah-app-features-guide)
- **Pricing:**
  - "Doctor" plan: **$10/month for up to 5 doctors** (no per-seat fee). It covers one clinic with up to 5 branches, per-doctor/per-branch schedules and prices, live queue, patient booking chats, lab/radiology requests and results, staff permissions and salaries, consolidated profit reports, and an AI prescription assistant.
  - "Clinic group Pro" plan: **$50/month**, unlimited clinics. It adds a **full audit log of team actions**.
  - Voice-assistant add-on: $10/doctor/month.
  - No free tier is listed. A 13-month prepaid offer exists ($96 or $480).
  - **Payment is manual**: the clinic uploads a bank-transfer receipt, and an admin verifies it and activates the plan.
  — [roshtah.com/pricing](https://www.roshtah.com/pricing)
- **Live queue mechanics:**
  - The doctor sees the full day list, with statuses **waiting / inside / finished / no-show**.
  - Tapping "next" closes the current visit.
  - Patients follow their queue number by phone and arrive when their turn approaches.
  - A countdown runs before the shift starts.
  - The doctor can send a **bulk delay notice** to all patients in the shift (example: 30 min).
  - Patients get a day-before reminder to confirm or reschedule.
  - The article does not describe walk-in handling or secretary actions.
  — [Roshtah: live queue management](https://www.roshtah.com/blog/live-queue-management-for-doctors)
- The problem statement Roshtah markets against: "In many Syrian clinics, patients spend hours waiting without knowing their turn." It frames crowding as a "lack of order" (غياب الترتيب) rather than patient volume — [Roshtah: reduce waiting Syria](https://www.roshtah.com/blog/reduce-waiting-syria); [Roshtah live queue](https://www.roshtah.com/blog/live-queue-management-for-doctors)
- **Doctor verification:** the doctor submits personal ID, certificate and practice license, specialty and professional title, and clinic location and contacts. Roshtah's team reviews the request and returns a note listing any missing item. Approval earns a verification badge (شارة التوثيق). Re-verification is required when core details change (identity, clinic location, title). Patients also have identity verification — [Roshtah: verification badge](https://www.roshtah.com/blog/doctor-verification-badge-trust); [Roshtah blog index](https://www.roshtah.com/blog)
- Other capabilities evident from blog titles:
  - An AI receptionist that answers calls and books appointments
  - A **pediatrics specialty template** (growth curves, vaccine schedule), i.e. specialty-specific modules already exist in the market
  - Account types: independent doctor, multi-doctor clinic, clinic group
  - Inviting doctors to a clinic roster
  - Monthly earnings reports with PDF export
  - A "live turn screen + WhatsApp alert"
  — [Roshtah blog index](https://www.roshtah.com/blog)

**Tabib SY (طبيب), Ofuq Technologies, Android package com.ofuqtechnologies.tabibsy**
- Patient-side features:
  - Search by specialty, name or city, with filters for governorate and area
  - A profile showing clinic address, **consultation fee, appointment length** and available times
  - Book, reschedule or cancel **within each clinic's deadline**
  - Reminders, plus a notification when the patient's turn is near
  - Free for patients, who **pay the fee at the clinic**. Example fee shown: 150,000 SYP.
  — [tabib-sy.com](https://www.tabib-sy.com/)
- Doctor-side features: a verified profile (certificates and practice license required before the profile goes live, then a "طبيب موثّق" badge), schedule management (hours, slot length, days off), accept/confirm/reschedule bookings, messaging with automatic reminders, **QR-code check-in on arrival**, and an invoices screen. Cities: Damascus, **Aleppo**, Homs, Latakia, Hama, Tartus, Deir ez-Zor. The model is slot-based. No walk-in ticket queue is described — [tabib-sy.com](https://www.tabib-sy.com/)

**DoctorBook**
- Founded 2026 by Abdulrahman Aljandali and Abdulrahman Alkhateeb. It raised a $16,000 pre-seed round (announced 27 Jul 2026, via Riyada+). Patients search and book online; clinics manage appointments and patient engagement. No user numbers or pricing are disclosed — [Wamda, Jul 2026](https://www.wamda.com/2026/07/syrian-healthtech-doctorbook-raises-16000-pre-seed-round). One outlet reports a $200k valuation — [Waya](https://waya.media/syrias-doctorbook-raises-usd-16k-to-expand-digital-healthcare-services)

**TibbFlow (دليل أطباء سوريا)**
- A directory claiming more than 6,000 doctors in Damascus, Aleppo, Homs and Latakia, with booking via TibbFlow. This comes from a search snippet only and was not verified on the page — [tibbflow.com](https://tibbflow.com/)

### Inferences
- **Parity baseline (must meet):**
  - A public doctor page with a shareable link/QR, plus city and specialty search
  - Displayed fee, hours and address
  - Online booking with confirmation (WhatsApp is the Syrian norm, per Moadna)
  - Day-before reminders
  - Cancel/reschedule
  - A clinic-side schedule, patient file with visit history, and invoices/income
  - A doctor verification badge
- **Leading features (should match soon):** a live queue with statuses and a "your turn is near" alert, a waiting-room screen, bulk delay notices, and e-prescriptions.
- **Differentiation gaps in competitors' public material:**
  - (a) A **walk-in/ticket queue that merges booked and walk-in patients** (none describe it)
  - (b) **Family sub-profiles** under one phone number (none mention it)
  - (c) Deep **dental (odontogram, multi-visit treatment plans, installments)** and **orthopedic** templates. Roshtah built a pediatric template; no one advertises dental or ortho depth, even though dentistry is about 43% of Moadna's listed doctors.
  - (d) Coverage of northern Aleppo / Azaz. No competitor lists Azaz, and Moadna lists only 107 Aleppo doctors.
- **Price anchor:** Roshtah's $10/month for up to 5 doctors sets a very low ceiling. Moadna is free to register. An MVP priced above about $10–15/month per clinic needs clear extra value, or a free tier for solo doctors.
- **Regulatory anchor:** Moadna's MoH approval and its interim National IT Services Authority approval suggest these are de facto expectations for a Syrian medical booking platform. Its "data hosted inside Syria" claim is being used as a selling point.

### Gaps
- **Google Play ratings, download counts and user complaints** could not be retrieved. Play pages returned truncated content, and AppBrain/AppGoblin returned 403/404. Ratings and complaints for Moadna, Roshtah, Tabib SY and DoctorBook remain unknown and should be checked manually in the Play Store.
- **"Rahim" (رحيم):** no Syrian health app by this name was found.
- Moadna's clinic pricing, the content of its patient app (queue, family profiles), and its doctor verification process are not public.
- The exact Syrian MoH / National Authority for IT Services licensing requirements for health platforms were not found online.
- Whether any competitor operates in Azaz or northern Aleppo countryside was not found.

---

## 2. What did successful clinic SaaS products ship first, and what did they leave out?

### Takeaway
Every successful player started with **one narrow, high-frequency workflow**, almost always **scheduling/booking plus reminders**, and added EHR, telemedicine and payments years later. Doctolib shipped booking with SMS reminders in 2013 and added its EHR only in 2021. Jane began as an online booking tool for one clinic. Vezeeta's lesson is the inverse: its EMR-first product was used by doctors but ignored by patients, so it pivoted to consumer booking.

### Cited Findings
- **Doctolib:**
  - The MVP launched in **November 2013 with 50 doctors**. The first product was a booking-management system: patients book online, and doctors and admin staff manage the agenda.
  - **Automatic SMS and email reminders** were part of it from the start.
  - Launch price was **€99/month per doctor**, later €129–139.
  - About 1.5K professionals by 2014.
  - Telemedicine came in April 2020 (free during COVID, then paid). The **EHR (Doctolib Médecin, with records, invoicing and prescriptions) launched only in March 2021**, about 7.5 years after the MVP.
  - Company claims: saves doctors about 1.5 h/week and cuts no-shows by 60%. These are unverified marketing figures.
  — [Contrary Research](https://research.contrary.com/report/doctolib)
- **Jane App:** started in 2011 when Alison Taylor opened Canopy Integrated Health in North Vancouver. She judged that online booking was necessary to build caseload. **Within six weeks, the clinic had a real-time online booking tool connected to its website.** She used this early version in her own clinic **for a year** before licensing it to other Vancouver clinics. The company was bootstrapped — [Jane story](https://jane.app/story); [Boast.ai interview](https://boast.ai/blog/what-the-tech-episode-5-learn-by-doing-with-jane/). The founders' problem statement: no practice software that respected clinic branding, suited multidisciplinary clinics, and included charting — [Vancouver Guardian](https://vancouverguardian.com/vancouver-business-jane/)
- **Cliniko:** the idea came from an osteopath (Liora) frustrated with her clinic's existing software. Joel Friedlaender built the first iteration in about **six months** and launched around mid-2011, with a goal of 100 paying customers in year one — [Intercom interview (via search summary)](https://www.intercom.com/blog/?p=25702); [HealthTimes (via search summary)](https://healthtimes.com.au/hub/medical-technology/65/news/nc1/allied-health-software-enables-accurate-recording-of-sex-gender-identity-and-pronouns/4123/). It shipped **31 updates in its first ~2 months**. The founder positioned Cliniko against incumbents on price, being web-based, and mobile support — [Cliniko blog](https://cliniko.com/blog/news/a-lot-can-happen-in-2-months)
- **Vezeeta (Egypt):** founded 2012 and started as an **EMR for doctors**. Barsoum: "We launched the first product and it was picking up with the doctors, but we realized that nobody [patients] is using it." It launched online booking in late 2014 — [Egyptian Streets](https://egyptianstreets.com/2018/12/12/how-vezeeta-is-redefining-the-relationship-between-patients-and-doctors/); [IFC](https://www.ifc.org/en/stories/2010/health-tech-start-up-vezeeta-empowers-millions-patients). In its mature model, patients search by specialty and location, read reviews and book **for free**, while providers pay a **transaction fee that varies by specialty and location**. Scale: 4.5M users, about 300K bookings/month, 20K doctors — [The National](https://www.thenationalnews.com/business/technology/generation-start-up-vezeeta-the-healthcare-app-that-turns-patients-into-consumers-1.969333)
- **Practo Ray:** Practo's **first product (2008)** was Ray, a practice management tool covering appointments, patient records/EHR and billing. It reached 50,000+ doctors and 25M+ appointments in 5 countries — [CXOToday press release](https://cxotoday.com/press-release/practo-joins-the-ayushman-bharat-digital-mission-abdm-ecosystem-with-practice-management-software-ray/). It was later linked to the Practo.com consumer platform (feedback collection, record sharing) — [Capterra](https://www.capterra.in/software/167778/ray)
- **Vertical SaaS lessons:**
  - Start at a **control point / system of record** in the customer's workflow. Building a system of record up from a narrow point solution is "far more challenging" — [Fractal on Toast](https://medium.com/@verticalsaas/lessons-from-toast-on-multiproduct-vertical-saas-418baeaf4451)
  - **Churn is the leading indicator** of whether a product has become the system of record — [Index Ventures](https://www.indexventures.com/perspectives/with-hundreds-of-billions-of-dollars-up-for-grabs-the-race-to-power-legacy-industries-just-got/)
  - Great vertical companies win later with a "layer cake" of extra products, such as payments, sold into the same customer base — [Bessemer](https://www.bvp.com/atlas/ten-lessons-from-a-decade-of-vertical-software-investing)

### Inferences
- The MVP's control point in Syria is the **daily patient list (الدور) held in the secretary's notebook**. Replace that first: registration, plus a queue/agenda that merges walk-ins, phone bookings and app bookings. EHR depth comes second.
- Vezeeta's lesson applies directly: a clinic tool alone does not bring patients, and a patient app with no clinics is empty. The two must launch together, with the **clinic system as the supply source** for the patient app's bookable doctors. Doctolib and Jane solved this by making booking the first product.
- What leaders **deliberately deferred**: telemedicine (Doctolib waited until 2020), full EHR (Doctolib waited until 2021), payments (Vezeeta charges a fee but patients pay at the clinic), and pharmacy/lab integrations (Vezeeta's pharmacy came in 2019). The Syrian MVP can defer all of these.
- Jane's "use it in one clinic for a year" and Cliniko's "31 updates in 2 months" both argue for a **design-partner launch**: 5–10 clinics in Azaz/Aleppo with weekly releases, rather than a broad feature set.

### Gaps
- No detailed launch feature lists or changelogs were found for Cliniko v1, Jane v1 or Clinicy (Saudi). Clinicy was not researched due to tool budget.
- No primary source covers Doctolib's handling of phone calls and secretaries at launch.

---

## 3. Receptionist / secretary needs in Middle Eastern private clinics

### Takeaway
Direct Middle East studies were not found. The adjacent evidence is consistent: software is abandoned when it is **slower than paper**, crashes or freezes, or seems too complex for front-desk staff. Doctors delegate the business side to secretaries, so the **secretary is the real adopter and trainer**. Syrian competitors focus on the queue (statuses, waiting screen, WhatsApp alerts), QR check-in and invoices.

### Cited Findings
- **Physicians' main objection** to computerized order entry: it "takes more time than making the same request on a paper form" — [CMAJ 2006](https://www.cmaj.ca/content/174/11/1573)
- In a three-hospital study, a new system added **1.5 to 2 hours per day** of record management for physicians — [eWeek](https://www.eweek.com/news/study-physicians-resist-electronic-order-entry/)
- In an evaluation of the UK "Choose and Book" system, users found it **"cumbersome, slow, prone to freezing or crashing."** Even experienced users spent large amounts of time on glitches, helpdesk calls and workarounds, and it generated lots of printed paper — [HSJ](https://www.hsj.co.uk/5072570.article)
- Doctors and dentists in private practice (Philippines) "typically rely on their secretaries to handle most aspects of the business." Their hesitation stems from lack of time to change. One vendor succeeded by **training secretaries hands-on for free, who then trained the doctors on the job**. In that workflow, the secretary keys in the reason for visit when the patient arrives — [Philstar 2009](https://www.philstar.com/business/technology/2009/03/09/446477/prodding-doctors-step-digital-age)
- Vendor view on why clinics delay software: **cost**, and owners' fear that "receptionists, nurses, or billing staff may not understand software systems" — [MocDoc blog (vendor)](https://mocdoc.com/blog/why-clinics-delay-clinic-management-software-2025)
- What Syrian competitors give the front desk:
  - Statuses waiting/inside/finished/no-show, a one-tap "next patient", bulk delay notices — [Roshtah](https://www.roshtah.com/blog/live-queue-management-for-doctors)
  - A waiting-room display, invoices and expenses, WhatsApp confirmation — [Moadna](https://moadna.com/fordoctors)
  - QR check-in on arrival, booking accept/confirm/reschedule — [Tabib SY](https://www.tabib-sy.com/)
- A Syrian pain point: patients wait "hours" without knowing their turn — [Roshtah](https://www.roshtah.com/blog/reduce-waiting-syria)

### Inferences
- **Speed targets for the MVP** (design targets, not sourced benchmarks):
  - New walk-in registered and given a queue number in **≤ 20–30 seconds**, using only name, phone and age, with everything else optional
  - Returning patient found by **typing the last digits of their phone number**
  - Phone booking in ≤ 3 taps
- The **merged walk-in + booked queue** is the core reception object. Phone bookings and app bookings must land in the same list as walk-in tickets. Otherwise the secretary keeps the paper notebook in parallel and the software is abandoned.
- **Printing:**
  - Queue tickets (optional, for a thermal printer)
  - Cash receipts for the consultation fee (كشفية)
  - Doctor prescriptions on letterhead
  
  Patients pay at the clinic in cash (Tabib SY's model), so a **daily cash summary / end-of-day close** is the secretary's money view.
- Train the secretary first; give her a one-page Arabic cheat-sheet and a WhatsApp support line, per the Philstar playbook.
- The app must tolerate intermittent internet and power, because a frozen screen in a full waiting room equals abandonment (HSJ evidence). This needs at least graceful degradation (cached day list) or a printable fallback day sheet.

### Gaps
- No peer-reviewed or survey source was found on Syrian or MENA clinic secretaries' workflows, registration time, or software abandonment. Field interviews in Azaz/Aleppo are needed.
- No data was found on the walk-in vs. booked patient mix in Syrian clinics.
- Thermal printer and receipt norms in Syrian clinics are undocumented.

---

## 4. Doctor needs in the first version (EMR burnout evidence)

### Takeaway
The literature is unambiguous: EHRs consume about half of physicians' time and score an "F" for usability, and worse usability tracks with burnout. A Syrian private doctor seeing many patients per shift will reject anything slower than handwriting. The MVP must make **note + prescription + follow-up** faster than paper: templates, favorites, one-screen history, and print.

### Cited Findings
- **Hill et al. 2013 ("4000 Clicks"), community ED:** data entry took **43%** of physician time versus **28%** in direct patient contact. Clicks were extrapolated to **~4,000 per 10-hour shift** at 2.5 patients/hour (3,200 at 2/hour). The sample was small (30 observed hours) — [AJEM / Atlas summary](https://ajemjournal.com/article/S0735-67571300405-1/fulltext); [InformationWeek](https://www.informationweek.com/healthcare/electronic-health-records/in-one-er-ehr-takes-44--of-doctors-time/d/d-id/1111808)
- **Sinsky et al. 2016 (Annals of Internal Medicine), 57 physicians in family medicine, internal medicine, cardiology and orthopedics:**
  - In the office, **27% of time went to direct face time and 49.2% to EHR/desk work**. In the exam room the split was 52.9% face time vs 37% EHR/desk.
  - Physicians spent **nearly 2 hours of EHR/desk work for every hour** with patients, plus 1–2 hours after hours each night.
  - Caveat: the practices were self-selected high performers, and the study was AMA-funded.
  — [HC Innovation Group](https://www.hcinnovationgroup.com/clinical-it/news/13027410/study-ambulatory-physicians-spend-half-their-time-on-ehrs-desk-work); [Healio](https://www.healio.com/primary-care/practice-management/news/online/%7B063320c8-6954-45b8-89dc-3b293772d441%7D/physicians-spend-nearly-50-of-their-time-on-ehr-desk-work)
- **Arndt et al. 2017 (Annals of Family Medicine), 142 family physicians:**
  - **5.9 hours of an 11.4-hour workday** were spent in the EHR: 4.5 h during clinic and 1.4 h after.
  - **44% of EHR time was clerical**, and inbox work took about 24%.
  - The authors recommend delegating EHR tasks, such as staff entering data.
  — [Annals of Family Medicine](https://www.annfammed.org/content/15/5/419); [UW news](https://www.med.wisc.edu/news/physicians-spend-half-of-work-day-on-ehrs)
- **Melnick et al. 2020 (Mayo Clinic Proceedings), 870 physicians:**
  - The mean EHR System Usability Scale score was **45.9, grade "F"**, in the bottom 9% of products studied. Excel scored 57 and Google search earned an A.
  - **Each 1-point SUS gain was linked to 3% lower odds of burnout.**
  - Causality is unproven.
  — [Becker's](https://www.beckershospitalreview.com/healthcare-information-technology/ehrs/ama-study-physicians-give-ehr-usability-an-f-rating/); [Lown Institute](https://lowninstitute.org/ehrs-get-a-failing-grade-for-usability/)
- **Syrian market evidence:**
  - Roshtah ships e-prescriptions, a patient health timeline and an AI prescription assistant — [Roshtah blog](https://www.roshtah.com/blog); [Roshtah pricing](https://www.roshtah.com/pricing)
  - Moadna ships "patient files and visit records" — [Moadna](https://moadna.com/fordoctors)
- **Dental software essentials (vendor sources):** charting must be "graphical, intuitive, and fast," with periodontal charting. Treatment plans should be sequenced into phases with status tracking and estimates. The key differentiator is **how the plan links to scheduling and billing** — [fitgap/Software Advice summaries via search](https://www.softwareadvice.com/resources/key-dental-software-features); [Curve Dental](https://www.curvedental.com/blog/modern-practice-management-software-for-general-dentistry)

### Inferences
- **Doctor MVP must-haves:**
  - (1) A one-screen patient summary: last visits, diagnoses, current meds, allergies, attachments
  - (2) A visit note built from **specialty templates with quick-pick chips and free text**: general (complaint, exam, diagnosis, plan), dental (tooth chart / odontogram, procedure per tooth), orthopedic (affected joint/side, exam findings, imaging, plan)
  - (3) A **prescription builder** with drug autocomplete, the doctor's **favorites/saved regimens**, and **A5 print on clinic letterhead** in Arabic or English
  - (4) **One-tap follow-up** ("after 1 week / 2 weeks / 1 month"), which creates a booking or recall
  - (5) Photo upload of X-rays and reports from a phone. Orthopedics and dentistry depend on imaging.
- Delegation per Arndt: the secretary enters demographics and the reason for visit, so the doctor only adds clinical content.
- For dentistry, the multi-visit **treatment plan + per-patient balance/installments** is effectively the billing system. It belongs in MVP-should for dental tenants. This is an inference: vendor sources stress the plan–billing link but give little on installments.
- Measure usability early (for example SUS with design-partner doctors). Melnick's finding makes usability a retention metric, not just a nicety.

### Gaps
- No studies were found on Syrian or MENA physicians' EMR time or click burden.
- Common Syrian prescription format norms (A5 vs A4, bilingual, syndicate number on letterhead) were not documented online.
- No source was found on orthopedic-specific minimum EMR fields; this needs clinician input.

---

## 5. Patient app MVP essentials in low-income, Android-dominant markets

### Takeaway
Syria is overwhelmingly Android, with about a third of the population online. The patient app must be a light Android app with phone-number login, search, book or take a queue number, a live queue position, and reminders. Local competitors already offer all of these except family profiles. Health apps keep fewer users than average apps, so value must be immediate: **knowing your turn without sitting for hours** is the hook. Payments and telemedicine are not required at launch; competitors let patients pay at the clinic.

### Cited Findings
- **Syria digital context:**
  - Population 25.8M, with **9.25M internet users (35.8% penetration)**
  - **20.1M cellular connections (77.7%)**
  - Median mobile download speed 24.69 Mbps (late 2025)
  — [DataReportal Digital 2026: Syria](https://datareportal.com/reports/digital-2026-syria)
- **Mobile OS share in Syria:** **Android about 94–97%** and iOS about 3–5% on StatCounter mobile-only pages for May–Aug 2026. Some StatCounter pages mixing device types show lower Android figures — [StatCounter Syria mobile](https://gs.statcounter.com/os-market-share/mobile/syrian-arab-republic)
- **Health app retention:** healthcare apps average **44% retention at day 30**, versus 67% across all categories; 36% at day 90; 20% annually — [Apptentive 2022 benchmark](https://apptentive.com/blog/healthcare-apps-mobile-customer-engagement-benchmarks/). Top uninstall reasons are freeing storage (an Airship survey cites 32%), excessive notifications, and poor UX. These are vendor sources — [Sahha](https://sahha.ai/blog/health-app-churn-retention/)
- **Reminders work:** in a Cochrane review (7 RCTs, 5,841 people), attendance was **78.6% with SMS reminders versus 67.8% with none**. That is similar to phone-call reminders (80.3%), at 55–65% of the cost. Evidence quality is low to moderate — [Cochrane CD007458](https://www.cochrane.org/evidence/CD007458_mobile-phone-messaging-reminders-attendance-healthcare-appointments)
- **Competitor patient feature set:**
  - Tabib SY: search by specialty/name/city with area filter, visible fee, slot length and times, book/reschedule/cancel within the clinic's cancellation deadline, reminders, a "turn near" alert, free for patients, pay at clinic — [Tabib SY](https://www.tabib-sy.com/)
  - Roshtah: live queue tracking, records of appointments and prescriptions, appointment and medication reminders, chat/video consultations — [Roshtah](https://www.roshtah.com/blog/roshtah-app-features-guide)
  - Moadna: city/specialty browse, comparing doctors and available times, reviews on doctor pages, WhatsApp confirmation — [moadna.com](https://moadna.com/); [Moadna for doctors](https://moadna.com/fordoctors)
- **Vezeeta's consumer model:** search by specialty and location, **read reviews**, book free, with providers paying the fee — [The National](https://www.thenationalnews.com/business/technology/generation-start-up-vezeeta-the-healthcare-app-that-turns-patients-into-consumers-1.969333)
- **Doctolib's first product** included SMS/email reminders and document sharing (prescriptions) with patients — [Contrary](https://research.contrary.com/report/doctolib)

### Inferences
- **Patient MVP must-haves:**
  - Phone-number login with OTP
  - **Family sub-profiles** (children, elderly parents) under one phone number. This is a gap in competitors' public material and fits family-based healthcare seeking.
  - Search by specialty, area (Azaz, Aleppo neighborhoods) and doctor name, with a verified badge
  - Doctor page showing fee, hours, address/map and phone
  - **Book a slot OR take a queue number**, depending on the clinic's mode
  - **Live queue position** with an estimated time and a "your turn is near" push
  - Day-before reminder with confirm/cancel
  - Cancel/reschedule within the clinic's rules
  - "My visits" with **prescriptions** the doctor chose to share
- **Should-have:**
  - WhatsApp/SMS fallback for patients without the app. Most patients will first meet the system through a clinic's WhatsApp link or QR, not the store.
  - Doctor share link/QR
  - Visit-verified simple ratings (only after a completed visit, to avoid fake reviews). Moadna already shows reviews; parity pressure exists, but moderation cost argues for a later or simple version.
- **Later:** telemedicine (Roshtah has it, but Doctolib waited 7 years), online payment (no confirmed card or e-wallet rail found for Syria; Roshtah itself takes manual bank receipts), medication reminders, AI chat, lab results.
- Keep the APK small and the notification count low. Storage and notification overload are top uninstall drivers. Arabic-first RTL; English optional.
- **Install driver:** the clinic should push the app ("follow your turn from home") via a QR on the waiting-room wall and on the queue ticket. Roshtah and Tabib SY use doctor QR links in the same way.

### Gaps
- No MENA- or Syria-specific health-app install or retention data was found.
- SMS OTP cost and deliverability in Syria (Syriatel/MTN, and Turkish SIMs common in Azaz) was not researched. WhatsApp OTP is a possible alternative but unverified.
- No data was found on what share of Syrian patients book via app versus WhatsApp versus phone.

---

## 6. Super-admin panel essentials at launch

### Takeaway
In this market the super-admin is an operations console. It needs to: onboard tenants, **verify doctors manually** (ID, certificate, practice license), assign specialty template packs, toggle features per tenant, **activate subscriptions manually** (local norm: bank receipt upload), and provide audited, time-limited support access. Practitioner consensus on impersonation: read-only by default, reason-logged, time-boxed, visibly flagged.

### Cited Findings
- **Doctor verification in Syrian competitors:**
  - Roshtah requires ID, certificate and practice license, specialty/title and clinic location. Its team reviews and returns notes on missing items, issues a badge, and requires re-verification when core data changes — [Roshtah](https://www.roshtah.com/blog/doctor-verification-badge-trust)
  - Tabib SY requires certificates and a practice license before a profile goes live — [Tabib SY](https://www.tabib-sy.com/)
- **Subscription activation is manual:** the clinic uploads a bank receipt and an admin verifies it and activates the plan — [Roshtah pricing](https://www.roshtah.com/pricing)
- **Tenant structures in the market:** independent doctor, multi-doctor clinic, clinic group. Clinics can invite doctors (WhatsApp invites in the Pro plan) and assign them to branches with per-doctor schedules and prices — [Roshtah blog index](https://www.roshtah.com/blog); [Roshtah pricing](https://www.roshtah.com/pricing)
- **Specialty-specific modules exist:** Roshtah markets a pediatric template (growth curves, vaccines) — [Roshtah blog index](https://www.roshtah.com/blog)
- **Impersonation / support-access best practices** (vendor and engineering sources; no single formal standard was found):
  - Restrict to specific support roles
  - Read-only by default; mask sensitive fields
  - Auto-expiring sessions with a reason code or ticket ID
  - Individual staff accounts, never shared logins
  - Log the operator, target user, start/end time and reason
  - Show the impersonated state clearly in the UI
  - Notify the user and/or require consent
  - Block high-risk actions such as MFA resets
  — [Pigment engineering](https://engineering.pigment.com/2026/04/08/safe-user-impersonation/); [AppMaster](https://appmaster.io/blog/secure-admin-impersonation-controls-audit-scope); [Ory](https://www.ory.com/docs/guides/user-impersonation); [Appwrite](https://appwrite.io/docs/products/auth/impersonation)
- **Audit log as a feature tier:** Roshtah reserves a "full audit log of team actions" for its $50 Pro plan — [Roshtah pricing](https://www.roshtah.com/pricing)

### Inferences
- **Super-admin MUST:**
  - (1) Tenant CRUD: create clinic, owner account, plan, status (trial/active/suspended)
  - (2) **Doctor verification queue**: view uploaded documents, approve/reject with notes, badge on/off, re-verification trigger
  - (3) **Assign specialty → template pack** (General / Dental / Orthopedic), as the brief requires
  - (4) Per-tenant **feature flags** (patient-app listing on/off, online booking on/off, queue mode, WhatsApp/SMS on/off)
  - (5) Manual **payment/subscription activation** with receipt records and expiry alerts
  - (6) User lookup and password/phone reset
  - (7) **Audited, time-boxed, read-only-by-default support access**
  - (8) Platform audit log of all super-admin actions
  - (9) Basic usage metrics per tenant: active users/day, visits/day, app bookings, last login, to spot churn early (per Index Ventures' churn signal)
  - (10) Announcement banner or in-app message to clinics
- **SHOULD:** import-assist tooling (upload a clinic's Excel and map columns), patient-app content moderation (doctor profiles, reviews if enabled), and system health / backup status views.
- **LATER:** automated billing, marketplace ranking controls, analytics dashboards, multi-country settings.

### Gaps
- No public descriptions of competitors' own admin panels were found.
- No regulator requirement was found for how platforms must verify Syrian doctors, for example a check against Syrian Medical Syndicate (نقابة الأطباء) records. The verification standard and whether a syndicate API or registry exists remain unknown.

---

## 7. Minimum security / compliance for health data at launch

### Takeaway
No Syrian health-data protection regulation was found online. The observable local bar is set by Moadna: MoH approval, interim National IT Services Authority approval, and data hosted inside Syria. International frameworks (HIPAA Security Rule) give a practical MVP checklist: role-based access with unique users, audit controls, a contingency/backup plan, encryption in transit, and auto-logoff.

### Cited Findings
- **Syrian approvals:**
  - Moadna obtained MoH approval and interim approval from the National Authority for IT Services — [MENA Startup Digest](https://menastartupdigest.com/?p=48912)
  - Moadna markets **data hosting on servers inside Syria** — [Moadna](https://moadna.com/fordoctors)
- **HIPAA Security Rule structure:**
  - **Administrative, physical and technical safeguards**, each with "required" and "addressable" specifications. Ignoring an addressable item is not acceptable — [MIS Solutions summary](https://www.mis-solutions.com/?p=15891)
  - HHS publishes a small-provider safeguards checklist — [HHS small provider PDF](https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/securityrule/smallprovider.pdf)
  - **Access control** is a technical standard (45 CFR 164.312(a)(1)) — [HHS/NIST SP 800-66](https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/securityrule/nist80066.pdf)
  - The **contingency plan** standard provides for disaster recovery — [AAFP FPM](https://www.aafp.org/pubs/fpm/issues/2017/0300/p5.pdf)
  - Practical small-practice items: **unique named user accounts**, a documented **"break-glass" emergency access** procedure, and **automatic logoff** (vendor advice) — [Techvera](https://techvera.com/resources/blog/hipaa-security-rule-18-technical-safeguards-breakdown)
  - Designate a security official — [AccountableHQ](https://www.accountablehq.com/post/hipaa-administrative-safeguards-for-small-practices-a-practical-implementation-plan-45-cfr-164-308)
- Impersonation without consent may constitute **unauthorized access to personal data** under GDPR-style thinking (vendor interpretation) — [Ory](https://www.ory.com/docs/guides/user-impersonation)

### Inferences
- **Practical MVP security checklist:**
  - (1) **Strict tenant isolation**: every query is scoped by clinic_id, with automated tests
  - (2) **RBAC with at least four roles**: owner/clinic-admin, doctor, receptionist, super-admin (plus a support role). Receptionists see schedule, demographics and payments, but **not clinical notes**, unless the clinic opts in.
  - (3) Unique accounts per staff member (no shared reception login), session timeout and auto-logoff on shared reception PCs
  - (4) **Audit log** of create/read/update on patient records and of all exports and impersonation. Make it standard in all tiers, unlike Roshtah where it is a paid feature, so it can be a selling point.
  - (5) TLS everywhere, encryption at rest for the database and attachments, and hashed passwords / OTP rate limits
  - (6) **Automated daily encrypted backups to a second location, with a tested restore**, as part of a written contingency plan
  - (7) Patient-app **consent and privacy notice** at signup, plus consent before a clinic shares records or prescriptions into the app
  - (8) Clinic-level **data export** (Excel/PDF), so clinics are not locked in, which also builds trust
  - (9) Soft-delete only for medical records
  - (10) Decide hosting location early. In-Syria hosting is a competitor talking point and may matter for MoH approval. Cross-border hosting may be simpler technically but is unverified with regulators.

### Gaps
- No Syrian personal-data or health-data protection law, retention period, or MoH technical requirement for e-health platforms was found online.
- No information was found on licensing authority or requirements in Azaz (northern Aleppo) in 2026. Older Enab Baladi reports (2022) show the Azaz Local Council licensing private nursing clinics and labs — [Enab Baladi](https://www.enabbaladi.net/561287/?amp=1); [Enab Baladi](https://www.enabbaladi.net/552018/). It is unclear whether this still applies after 2025 administrative changes.

---

## 8. Onboarding and data migration

### Takeaway
The leading SaaS players treat migration as a free, staffed service. They import patient lists, appointments and charts from CSV, but explicitly do not import billing history. Syrian clinics mostly have paper notebooks and sometimes Excel. The MVP needs a simple Excel patient import, a first-day setup wizard, and secretary-first training.

### Cited Findings
- **Jane:**
  - Imports patient lists, appointments and charts (CSV) from Cliniko and other systems, through a secure upload under "Settings > Schedule an Import"
  - **Import specialists help for free**
  - Runs a monthly "switching to Jane" webinar
  - **Billing data cannot be imported** because every system formats it differently; credits and receivables are moved by hand
  — [Jane guide: importing from Cliniko](https://jane.app/guide/importing-from-cliniko); [Jane: where can you import from](https://jane.app/guide/where-can-you-import-from)
- **Cliniko** (importing from Jane): do not add data manually before the transfer, to avoid duplicates; data entered after the export is not transferred — [Cliniko help](https://help.cliniko.com/en/articles/7006965-transfer-data-from-jane-app-to-cliniko)
- **Secretary-first training** (free hands-on training for secretaries, who then train doctors) drove adoption in private practices — [Philstar](https://www.philstar.com/business/technology/2009/03/09/446477/prodding-doctors-step-digital-age)
- Moadna offers **free clinic registration** as its entry point — [Moadna](https://moadna.com/fordoctors)

### Inferences
- **MVP onboarding:**
  - (1) A super-admin-created tenant, or self-signup followed by verification
  - (2) A **setup wizard** (≤ 10 minutes): clinic name/logo/letterhead, address, working hours and shifts, consultation fee(s), queue mode (walk-in tickets / slots / mixed), staff invites (receptionist by phone), specialty pack preview
  - (3) **Excel/CSV patient import** with column mapping (name, phone, age/DOB, gender, file number, notes) and duplicate detection by phone
  - (4) A "start fresh" option. Most paper clinics will just register returning patients on first visit.
  - (5) A 30-minute on-site or video session for the secretary, an Arabic video library, and a WhatsApp support number
- Do not promise import of financial history (Jane's lesson). Import open balances by hand for dental installment patients.
- Plan for a parallel-run period: the paper notebook stays as backup for 1–2 weeks. The daily printable sheet is the safety net.

### Gaps
- No data was found on how Syrian clinics currently store patient lists (paper vs Excel vs legacy desktop software), or on typical clinic list sizes.
- The time-to-first-value benchmark for clinic SaaS onboarding was not found.

---

## 9. Synthesis: MUST / SHOULD / LATER per surface

### Takeaway
The MVP should replace the secretary's notebook and the doctor's prescription pad on day one, and make the patient app useful through live queue status and family booking. Everything that competitors added later (telemedicine, payments, labs, AI, inventory, HR) is deferred. Parity items are marked [P], and differentiators are marked [D].

### Cited Findings
- This section synthesizes the findings above. The key anchors:
  - The Syrian parity set comes from Moadna, Roshtah and Tabib SY — [Moadna](https://moadna.com/fordoctors); [Roshtah](https://www.roshtah.com/blog/roshtah-app-features-guide); [Tabib SY](https://www.tabib-sy.com/)
  - Booking and reminders first, EHR later — [Contrary/Doctolib](https://research.contrary.com/report/doctolib)
  - Doctor speed matters — [Sinsky via HCI](https://www.hcinnovationgroup.com/clinical-it/news/13027410/study-ambulatory-physicians-spend-half-their-time-on-ehrs-desk-work); [Melnick via Becker's](https://www.beckershospitalreview.com/healthcare-information-technology/ehrs/ama-study-physicians-give-ehr-usability-an-f-rating/)
  - Reminders improve attendance — [Cochrane](https://www.cochrane.org/evidence/CD007458_mobile-phone-messaging-reminders-attendance-healthcare-appointments)
  - Price anchor of $10/month for up to 5 doctors — [Roshtah pricing](https://www.roshtah.com/pricing)
  - Dentistry is the largest specialty on the leading Syrian platform — [moadna.com](https://moadna.com/)

### Inferences

**Surface 1: Clinic system**

*Receptionist*
- **MUST**
  - Fast patient registration (name, phone, age, gender; rest optional), search by phone, and duplicate warning [D on speed]
  - **Unified daily queue** merging walk-in tickets, phone bookings and app bookings, with statuses waiting / inside / done / no-show / cancelled [P status model; D walk-in merge]
  - Weekly agenda per doctor with slot or shift mode [P]
  - Check-in (manual; QR optional) [P]
  - Collect the consultation fee in cash, print a receipt, and run an end-of-day cash summary [P invoices]
  - Bulk delay notice to waiting/booked patients [P]
  - Print queue ticket or day list (fallback for outages) [D]
- **SHOULD**
  - Waiting-room TV screen (a browser page) [P Moadna/Roshtah]
  - WhatsApp click-to-send confirmations and reminders, before any paid WhatsApp API [P]
  - SMS reminders [P]
  - Simple expenses log [P Moadna]
- **LATER**
  - Inventory, staff salaries, lab/radiology orders, insurance, AI phone receptionist, multi-branch, clinic groups

*Doctor*
- **MUST**
  - One-screen patient summary/timeline
  - Visit note with **specialty template pack**: General, **Dental** (odontogram with per-tooth procedures and status), **Orthopedic** (side/joint, exam, imaging, diagnosis, plan)
  - Prescription builder with autocomplete and favorites, **A5 letterhead print**
  - One-tap follow-up booking
  - Attachments via phone camera (X-rays and reports)
  - Mark visit done → next patient [P]
- **SHOULD**
  - **Dental treatment plan** (multi-visit, phased, cost estimate) linked to the **patient balance / installments**
  - Share prescription into the patient app
  - Diagnosis quick-picks
  - Basic per-doctor income view
- **LATER**
  - AI prescription assistant [P Roshtah, but not needed]
  - Telemedicine
  - Lab integration
  - Coded diagnoses (ICD)
  - Clinical decision support

*Clinic admin / owner*
- **MUST**
  - Staff accounts and roles (doctor/receptionist), working hours and shifts, fees/services price list
  - Clinic profile, logo and letterhead
  - Public doctor page link + QR [P]
  - Online-booking on/off and queue-mode settings
  - Daily/monthly revenue report [P]
  - Excel patient import
  - Data export
- **SHOULD**
  - Multi-doctor clinic [P Roshtah up to 5 doctors at $10]
  - Audit log viewer [D, since Roshtah charges for it]
  - Cancellation-deadline rules
- **LATER**
  - Multi-branch, clinic groups, consolidated reports, payroll

**Surface 2: Patient app (Android-first, Arabic)**
- **MUST**
  - Phone + OTP login
  - **Family sub-profiles** [D]
  - Search by specialty, area and name, with verified badge [P]
  - Doctor page with fee, hours, address and booking mode [P]
  - **Book slot or take queue number** [P/D]
  - **Live queue position + "turn is near" push** [P Roshtah/Tabib]
  - Day-before reminder with confirm/cancel [P]
  - Cancel/reschedule within clinic rules [P]
  - My visits + shared prescriptions [P Roshtah]
  - Consent/privacy screen
- **SHOULD**
  - WhatsApp/SMS fallback for non-app patients
  - Open doctor page from QR/link without installing (web)
  - Visit-verified ratings (simple stars, moderated) [P pressure from Moadna/Vezeeta]
  - Favorite doctors
- **LATER**
  - Telemedicine, online payments, medication reminders, lab results, AI chat, health articles

**Surface 3: Platform super-admin**
- **MUST**
  - Tenant CRUD and status
  - **Doctor verification queue** (ID, certificate, practice license, approve/reject with notes, badge)
  - **Assign specialty → template pack**
  - Per-tenant feature flags
  - Manual subscription activation with receipt record
  - User/phone reset
  - **Time-boxed, read-only-by-default, reason-logged support access**
  - Platform audit log
  - Per-tenant usage metrics (logins, visits/day, bookings)
  - Announcement banner
- **SHOULD**
  - Assisted Excel import tool
  - Moderation of doctor profiles and reviews
  - Backup/health status page
- **LATER**
  - Automated billing/invoicing
  - Search-ranking controls
  - Advanced analytics
  - Template editor UI (hard-code the three packs in the MVP)

**Cross-cutting MVP security**
- Tenant isolation
- RBAC (receptionist cannot see clinical notes by default)
- Unique users and auto-logoff
- Audit trail of record access and changes
- TLS and encryption at rest
- Daily off-site encrypted backups with tested restore
- Consent capture
- Soft delete
- Data export
- An early hosting-location decision aligned with MoH approval

**Pricing hypothesis (inference):** a free tier for a solo doctor (patient-app listing + queue) to drive supply, versus Moadna's free registration. A paid tier at or below Roshtah's $10/month for records, prescriptions and reports. Manual activation by receipt (local norm).

### Gaps
- All MUST/SHOULD/LATER placements are inferences from competitor parity and international precedent. None were validated with Azaz/Aleppo clinic staff or patients.
- Recommended next step: 10–15 clinic visits, including dental and orthopedic ones, to time paper registration and observe walk-in vs booked mix, printing habits and payment handling.
